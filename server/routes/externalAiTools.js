// FusedChatbot/server/routes/externalAiTools.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormDataNode = require('form-data'); // For Node.js to create FormData

const PYTHON_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
if (!PYTHON_SERVICE_URL) {
    console.error("CRITICAL ERROR: PYTHON_AI_CORE_SERVICE_URL is not set in .env for externalAiTools.js. This module will not function.");
} else {
    console.log('[externalAiTools.js] Python Service URL configured to:', PYTHON_SERVICE_URL);
}

// --- Multer Setup ---
const UPLOAD_DIR_NODE_TEMP = path.join(__dirname, '..', 'uploads_node_temp');
if (!fs.existsSync(UPLOAD_DIR_NODE_TEMP)) {
    try {
        fs.mkdirSync(UPLOAD_DIR_NODE_TEMP, { recursive: true });
        console.log(`[externalAiTools.js] Created temp upload dir for Node: ${UPLOAD_DIR_NODE_TEMP}`);
    } catch (err) {
        console.error(`[externalAiTools.js] Error creating temp upload dir ${UPLOAD_DIR_NODE_TEMP}: ${err.message}`);
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR_NODE_TEMP),
    filename: (req, file, cb) => {
        const safeOriginalName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
        cb(null, `${Date.now()}-${safeOriginalName}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

// --- Helper: Forward to Python Service ---
async function forwardToPythonService(req, res, pythonEndpoint, payload, isFileUpload = false, httpMethod = 'POST', queryParams = null) {
    if (!PYTHON_SERVICE_URL) {
        const errorMsg = "Python service URL is not configured on the Node.js server.";
        console.error(`[forwardToPythonService - ${pythonEndpoint}] CRITICAL: ${errorMsg}`);
        return res.status(500).json({ message: errorMsg, error: "ConfigurationError" });
    }
    const targetUrl = `${PYTHON_SERVICE_URL}${pythonEndpoint}`;
    const logPrefix = `[Node Forwarder - ${pythonEndpoint}]`;
    const userId = req.headers['x-user-id'] || 'guest_user'; // Get user_id for logging/payload

    console.log(`${logPrefix} User='${userId}', Forwarding ${httpMethod} to: ${targetUrl}`);
    if (queryParams) console.log(`${logPrefix} Query Params:`, queryParams);

    const axiosConfig = {
        method: httpMethod,
        url: targetUrl,
        headers: { 'x-user-id': userId }, // Always forward user-id in header if Python side needs it
        timeout: 300000, // 5 minutes
    };

    let finalPayload = payload;
    // If payload is an object and not FormData, ensure user_id is in it for Python tools
    if (payload && typeof payload === 'object' && !(payload instanceof FormDataNode) && !isFileUpload) {
        finalPayload = { ...payload, user_id: userId }; // Add/overwrite user_id
    } else if (isFileUpload && payload instanceof FormDataNode) {
        // For FormData, Python's request.form.get('user_id') will be used if Node adds it
        payload.append('user_id', userId); // Add user_id to FormData
        finalPayload = payload; // already assigned
    }


    if (isFileUpload && finalPayload instanceof FormDataNode) {
        axiosConfig.data = finalPayload;
        axiosConfig.headers = { ...axiosConfig.headers, ...finalPayload.getHeaders() };
        console.log(`${logPrefix} Payload: FormData (file upload), UserID='${userId}' included in form.`);
    } else if (typeof finalPayload === 'string' && req.get('Content-Type') && req.get('Content-Type').startsWith('text/')) {
        axiosConfig.data = finalPayload;
        axiosConfig.headers['Content-Type'] = req.get('Content-Type');
        console.log(`${logPrefix} Payload: Raw text (first 100 chars): ${finalPayload.substring(0, 100)}...`);
    } else if (finalPayload) {
        axiosConfig.data = finalPayload;
        axiosConfig.headers['Content-Type'] = 'application/json';
        console.log(`${logPrefix} Payload: JSON (first 100 chars): ${JSON.stringify(finalPayload).substring(0,100)}...`);
    }

    if (queryParams) {
        axiosConfig.params = queryParams;
        // If user_id is also needed as a query param for some Python routes (like PPT/DOCX creation)
        // ensure it's added here or handled by the specific route before calling this helper.
        // Example for PPT/DOCX, queryParams already includes user_id from the route handler.
    }
    
    try {
        const pythonResponse = await axios(axiosConfig);
        console.log(`${logPrefix} Python service responded with status: ${pythonResponse.status}`);
        res.status(pythonResponse.status).json(pythonResponse.data);
    } catch (error) {
        const errorStatus = error.response ? error.response.status : 502;
        const errorData = error.response ? error.response.data : { error: error.message, details: "No response from Python or network issue." };
        const pythonErrorMessage = errorData?.error || errorData?.message || (typeof errorData === 'string' ? errorData : "Unknown Python error");
        console.error(`${logPrefix} Error forwarding to Python (${targetUrl}): [${errorStatus}]`, pythonErrorMessage);
        if (error.code) console.error(`${logPrefix} Axios error code: ${error.code}`);
        res.status(errorStatus).json({
            message: `Request to Python service endpoint '${pythonEndpoint}' failed.`,
            python_error: pythonErrorMessage,
            details: error.code ? `Node.js Request Error Code: ${error.code}` : (errorData.details || undefined)
        });
    }
}

// --- Tool Routes ---

// Academic Search Routes
router.post('/search/combined', (req, res) => {
    const payload = req.body; // Expects { query, min_year, etc. }
    // user_id will be added to payload by forwardToPythonService if not already
    forwardToPythonService(req, res, '/tools/search/combined', payload);
});

router.post('/search/core', (req, res) => {
    const payload = req.body; // Expects { query, core_api_key, download_pdfs, max_pages }
    // user_id will be added by forwardToPythonService
    forwardToPythonService(req, res, '/tools/search/core', payload);
});

// Content Creation Routes
router.post('/create/ppt', express.text({ type: ['text/markdown', 'text/plain', 'application/text'], limit: '10mb' }), (req, res) => {
    const filename = req.query.filename || 'Presentation.pptx';
    const userId = req.headers['x-user-id'] || 'guest_user'; // Python route expects user_id in query for this one
    // Raw markdown is req.body
    forwardToPythonService(req, res, '/tools/create/ppt', req.body, false, 'POST', { filename, user_id: userId });
});

router.post('/create/doc', (req, res) => { // ADDED THIS ROUTE
    const userId = req.headers['x-user-id'] || 'guest_user';
    // Python route expects JSON: {markdown_content, content_key, filename, user_id}
    // The forwardToPythonService will add user_id to the payload if it's an object
    const payload = req.body; // Should be {markdown_content, content_key, filename} from client
    console.log(`[Node /create/doc] Received payload for DOCX:`, payload);
    if (!payload.markdown_content || !payload.content_key) {
        return res.status(400).json({ error: "markdown_content and content_key are required for DOCX generation." });
    }
    forwardToPythonService(req, res, '/tools/create/doc', payload); // user_id will be added to payload object by helper
});

// PDF Processing (OCR) Routes
router.post('/ocr/tesseract', upload.single('pdf_file'), async (req, res) => {
    const logPrefix = '[Node /ocr/tesseract]';
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });
    console.log(`${logPrefix} File: ${req.file.originalname}, Temp path: ${req.file.path}`);
    const formData = new FormDataNode();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
    // user_id is added to FormData by forwardToPythonService helper
    try {
        await forwardToPythonService(req, res, '/tools/ocr/tesseract', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error(`${logPrefix} Error deleting temp file:`, err.message);
            else console.log(`${logPrefix} Deleted temp file: ${req.file.path}`);
        });
    }
});

router.post('/ocr/nougat', upload.single('pdf_file'), async (req, res) => {
    const logPrefix = '[Node /ocr/nougat]';
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });
    console.log(`${logPrefix} File: ${req.file.originalname}, Temp path: ${req.file.path}`);
    const formData = new FormDataNode();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
    // user_id is added by forwardToPythonService helper
    try {
        await forwardToPythonService(req, res, '/tools/ocr/nougat', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error(`${logPrefix} Error deleting temp file:`, err.message);
            else console.log(`${logPrefix} Deleted temp file: ${req.file.path}`);
        });
    }
});

// Web Resources Download Routes
router.post('/download/youtube', (req, res) => {
    const payload = req.body; // Expects { url, quality }
    // user_id will be added by forwardToPythonService
    if (!payload.url) return res.status(400).json({ error: "YouTube URL is required." });
    forwardToPythonService(req, res, '/tools/download/youtube', payload);
});

router.post('/download/web_pdfs', (req, res) => {
    const payload = req.body; // Expects { query, max_downloads }
    // user_id will be added by forwardToPythonService
    if (!payload.query) return res.status(400).json({ error: "Search query is required." });
    forwardToPythonService(req, res, '/tools/download/web_pdfs', payload);
});


// --- File Proxy Route ---
router.get('/files/*', async (req, res) => {
    const requestedPathFromClient = req.params[0];
    const logPrefix = `[Node FileProxy - ${requestedPathFromClient}]`;
    if (!PYTHON_SERVICE_URL) {
        return res.status(500).json({ message: "Python service URL not configured for file proxy." });
    }
    const pythonFileUrl = `${PYTHON_SERVICE_URL}/files/${requestedPathFromClient}`;
    console.log(`${logPrefix} Proxying to Python: ${pythonFileUrl}`);
    try {
        const pythonStreamResponse = await axios.get(pythonFileUrl, { responseType: 'stream', timeout: 600000 });
        const headersToForward = ['content-type', 'content-disposition', 'content-length'];
        headersToForward.forEach(headerName => {
            if (pythonStreamResponse.headers[headerName]) {
                res.setHeader(headerName, pythonStreamResponse.headers[headerName]);
            }
        });
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
        pythonStreamResponse.data.pipe(res);
    } catch (error) {
        // ... (Keep the detailed error handling for file proxy from your previous version) ...
        const errorStatus = error.response ? error.response.status : 502;
        let pythonErrorMessage = "Error fetching file from Python service.";
        // (Code to try and parse error from stream if JSON, or use error.message)
        // For brevity, using a simpler form here, but your more detailed one was good.
        if (error.response && error.response.data && typeof error.response.data.on === 'function' && error.response.headers['content-type']?.includes('application/json')) {
             pythonErrorMessage = await new Promise(resolve => { /* ... parse stream ... */ });
        } else if (error.message) {
            pythonErrorMessage = error.message;
        }
        console.error(`${logPrefix} Error: [${errorStatus}]`, pythonErrorMessage, error.code ? `Axios: ${error.code}` : '');
        res.status(errorStatus).json({
            message: `File error for: ${requestedPathFromClient}`,
            python_error: pythonErrorMessage
        });
    }
});

module.exports = router;