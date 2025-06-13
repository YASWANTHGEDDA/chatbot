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
// Increase file size limit for video files
const upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 500 } }); // 500MB limit for videos

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

    // Set a very long timeout for potentially slow operations like video processing
    const requestTimeout = pythonEndpoint.includes('/video') ? 30 * 60 * 1000 : 5 * 60 * 1000; // 30 mins for video, 5 for others
    console.log(`${logPrefix} Request timeout set to ${requestTimeout / 1000} seconds.`);

    const axiosConfig = {
        method: httpMethod,
        url: targetUrl,
        headers: { 'x-user-id': userId },
        timeout: requestTimeout,
    };

    let finalPayload = payload;
    // If payload is an object and not FormData, ensure user_id is in it for Python tools
    if (payload && typeof payload === 'object' && !(payload instanceof FormDataNode) && !isFileUpload) {
        finalPayload = { ...payload, user_id: userId }; // Add/overwrite user_id
    } else if (isFileUpload && payload instanceof FormDataNode) {
        // For FormData, Python's request.form.get('user_id') will be used if Node adds it
        payload.append('user_id', userId); // Add user_id to FormData
        finalPayload = payload;
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
        if (error.code === 'ECONNABORTED') {
            console.error(`${logPrefix} Request timed out.`);
        }
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
    forwardToPythonService(req, res, '/tools/search/combined', req.body);
});

router.post('/search/core', (req, res) => {
    forwardToPythonService(req, res, '/tools/search/core', req.body);
});

// Content Creation Routes
router.post('/create/ppt', express.text({ type: ['text/markdown', 'text/plain', 'application/text'], limit: '10mb' }), (req, res) => {
    const filename = req.query.filename || 'Presentation.pptx';
    const userId = req.headers['x-user-id'] || 'guest_user';
    forwardToPythonService(req, res, '/tools/create/ppt', req.body, false, 'POST', { filename, user_id: userId });
});

router.post('/create/doc', (req, res) => {
    const payload = req.body;
    if (!payload.markdown_content || !payload.content_key) {
        return res.status(400).json({ error: "markdown_content and content_key are required for DOCX generation." });
    }
    forwardToPythonService(req, res, '/tools/create/doc', payload);
});

// PDF Processing (OCR) Routes
router.post('/ocr/tesseract', upload.single('pdf_file'), async (req, res) => {
    const logPrefix = '[Node /ocr/tesseract]';
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });
    console.log(`${logPrefix} File: ${req.file.originalname}, Temp path: ${req.file.path}`);
    const formData = new FormDataNode();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
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
    try {
        await forwardToPythonService(req, res, '/tools/ocr/nougat', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error(`${logPrefix} Error deleting temp file:`, err.message);
            else console.log(`${logPrefix} Deleted temp file: ${req.file.path}`);
        });
    }
});

// Video Processing Route (NEW)
router.post('/process/video', upload.single('video_file'), async (req, res) => {
    const logPrefix = '[Node /process/video]';
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });
    
    console.log(`${logPrefix} File: ${req.file.originalname}, Temp path: ${req.file.path}`);
    const formData = new FormDataNode();
    formData.append('video_file', fs.createReadStream(req.file.path), req.file.originalname);
    
    // Append other form fields from the request, e.g., ollama_model
    if (req.body.ollama_model) {
        formData.append('ollama_model', req.body.ollama_model);
    }
    
    try {
        await forwardToPythonService(req, res, '/tools/process/video', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error(`${logPrefix} Error deleting temp video file:`, err.message);
            else console.log(`${logPrefix} Deleted temp video file: ${req.file.path}`);
        });
    }
});

// Web Resources Download Routes
router.post('/download/youtube', (req, res) => {
    const payload = req.body;
    if (!payload.url) return res.status(400).json({ error: "YouTube URL is required." });
    forwardToPythonService(req, res, '/tools/download/youtube', payload);
});

router.post('/download/web_pdfs', (req, res) => {
    const payload = req.body;
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
        const errorStatus = error.response ? error.response.status : 502;
        const pythonErrorMessage = "Error fetching file from Python service.";
        console.error(`${logPrefix} Error: [${errorStatus}]`, error.message, error.code ? `Axios: ${error.code}` : '');
        res.status(errorStatus).json({
            message: `File proxy error for: ${requestedPathFromClient}`,
            python_error: error.message
        });
    }
});

module.exports = router;