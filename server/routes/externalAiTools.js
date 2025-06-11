// FusedChatbot/server/routes/externalAiTools.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer'); // For handling file uploads
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Explicitly require form-data

// Read the Python service URL from environment variables
// This ensures it's read once when the module loads, after dotenv has done its job in server.js
const PYTHON_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
console.log('[externalAiTools.js] Initialized with PYTHON_AI_CORE_SERVICE_URL:', PYTHON_SERVICE_URL);

// --- Multer setup for file uploads ---
const UPLOAD_DIR_NODE = path.join(__dirname, '..', 'uploads_node_temp');
if (!fs.existsSync(UPLOAD_DIR_NODE)) {
    try {
        fs.mkdirSync(UPLOAD_DIR_NODE, { recursive: true });
        console.log(`[externalAiTools.js] Created temporary upload directory: ${UPLOAD_DIR_NODE}`);
    } catch (err) {
        console.error(`[externalAiTools.js] Error creating temporary upload directory ${UPLOAD_DIR_NODE}: ${err.message}`);
        // Depending on how critical this is, you might want to throw an error or exit
    }
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR_NODE);
    },
    filename: function (req, file, cb) {
        // Use a timestamp for unique filenames to avoid collisions during concurrent requests
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, ''));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Example: 100MB file size limit
});
// --- End Multer Setup ---

// --- Helper function to forward requests to the Python service ---
async function forwardToPythonService(req, res, pythonEndpoint, payload, isFileUpload = false, httpMethod = 'POST', queryParams = null) {
    // Check if PYTHON_SERVICE_URL was correctly loaded when the module initialized
    if (!PYTHON_SERVICE_URL || typeof PYTHON_SERVICE_URL !== 'string' || !PYTHON_SERVICE_URL.startsWith('http')) {
        const errorMsg = `CRITICAL: PYTHON_AI_CORE_SERVICE_URL is invalid or not set in Node.js environment. Value: '${PYTHON_SERVICE_URL}'`;
        console.error(`[forwardToPythonService] ${errorMsg}`);
        return res.status(500).json({ message: "Internal server configuration error: Python service URL is not correctly set.", error: errorMsg });
    }
    
    const url = `${PYTHON_SERVICE_URL}${pythonEndpoint}`;
    console.log(`[forwardToPythonService] Forwarding ${httpMethod} request to Python URL: ${url}`);
    if (queryParams) console.log(`[forwardToPythonService] With Query Params:`, queryParams);
    if (!isFileUpload && payload && typeof payload !== 'string') console.log(`[forwardToPythonService] With JSON Payload (first 100 chars): ${JSON.stringify(payload).substring(0,100)}...`);
    if (typeof payload === 'string') console.log(`[forwardToPythonService] With Raw Text Payload (first 100 chars): ${payload.substring(0,100)}...`);


    const axiosConfig = {
        method: httpMethod,
        url: url,
        headers: {}, // Initialize headers
        timeout: 120000, // Example: 2 minutes timeout for potentially long Python operations
    };

    if (isFileUpload && payload instanceof FormData) {
        axiosConfig.data = payload;
        axiosConfig.headers = { ...payload.getHeaders() }; // Let FormData set the Content-Type
    } else if (typeof payload === 'string' && req.get('Content-Type')) {
        // For raw text payloads like markdown for PPT
        axiosConfig.data = payload;
        axiosConfig.headers['Content-Type'] = req.get('Content-Type'); // Forward client's Content-Type
    } else if (payload) { // Default to JSON payload
        axiosConfig.data = payload;
        axiosConfig.headers['Content-Type'] = 'application/json';
    }

    if (queryParams) {
        axiosConfig.params = queryParams;
    }
    
    try {
        const response = await axios(axiosConfig);
        console.log(`[forwardToPythonService] Python service responded with status: ${response.status} for ${url}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        const errorStatus = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: error.message };
        const pythonErrorMessage = errorData?.error || errorData?.message || (typeof errorData === 'string' ? errorData : "Unknown error from Python service");

        console.error(`[forwardToPythonService] Error forwarding to Python (${url}): [${errorStatus}]`, pythonErrorMessage);
        if (error.code) console.error(`[forwardToPythonService] Axios error code: ${error.code}`);
        
        res.status(errorStatus).json({
            message: `Failed request to Python service. Endpoint: ${pythonEndpoint}`,
            error: pythonErrorMessage,
            details: error.code ? `Axios Error Code: ${error.code}` : undefined
        });
    }
}

// --- Academic Search Routes ---
router.post('/search/core', (req, res) => {
    console.log('[Route /search/core] Received request. Body keys:', Object.keys(req.body || {}));
    forwardToPythonService(req, res, '/tools/search/core', req.body);
});

router.post('/search/combined', (req, res) => {
    console.log('[Route /search/combined] Received request. Body keys:', Object.keys(req.body || {}));
    forwardToPythonService(req, res, '/tools/search/combined', req.body);
});

// --- Content Creation Routes ---
router.post('/create/ppt', (req, res) => {
    // Assumes express.text() middleware is applied in server.js for this route
    // req.body will be the raw markdown string
    console.log('[Route /create/ppt] Received request. Query params:', req.query);
    console.log('[Route /create/ppt] Markdown body length:', req.body ? req.body.length : 'N/A');
    forwardToPythonService(req, res, '/tools/create/ppt', req.body, false, 'POST', req.query);
});

router.post('/create/doc', (req, res) => {
    // Expects JSON: {markdown_content, content_key, filename}
    console.log('[Route /create/doc] Received request. Body keys:', Object.keys(req.body || {}));
    forwardToPythonService(req, res, '/tools/create/doc', req.body);
});

// --- PDF Processing (OCR) Routes ---
// 'upload.single('pdf_file')' middleware handles the file upload first
router.post('/ocr/tesseract', upload.single('pdf_file'), async (req, res) => {
    console.log('[Route /ocr/tesseract] Received file upload request.');
    if (!req.file) {
        console.warn('[Route /ocr/tesseract] No PDF file uploaded.');
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    console.log(`[Route /ocr/tesseract] File uploaded: ${req.file.originalname}, Temp path: ${req.file.path}`);
    
    const formData = new FormData();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
    
    // forwardToPythonService will be called, then the finally block
    try {
        await forwardToPythonService(req, res, '/tools/ocr/tesseract', formData, true);
    } finally {
        // Cleanup the temporarily uploaded file on the Node server regardless of Python response
        fs.unlink(req.file.path, err => {
            if (err) console.error("[Route /ocr/tesseract] Error deleting temp uploaded file:", err.message);
            else console.log(`[Route /ocr/tesseract] Deleted temp file: ${req.file.path}`);
        });
    }
});

router.post('/ocr/nougat', upload.single('pdf_file'), async (req, res) => {
    console.log('[Route /ocr/nougat] Received file upload request.');
    if (!req.file) {
        console.warn('[Route /ocr/nougat] No PDF file uploaded.');
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    console.log(`[Route /ocr/nougat] File uploaded: ${req.file.originalname}, Temp path: ${req.file.path}`);

    const formData = new FormData();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);

    try {
        await forwardToPythonService(req, res, '/tools/ocr/nougat', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error("[Route /ocr/nougat] Error deleting temp uploaded file:", err.message);
            else console.log(`[Route /ocr/nougat] Deleted temp file: ${req.file.path}`);
        });
    }
});

// --- Web Resources Routes ---
router.post('/download/web_pdfs', (req, res) => {
    console.log('[Route /download/web_pdfs] Received request. Body keys:', Object.keys(req.body || {}));
    forwardToPythonService(req, res, '/tools/download/web_pdfs', req.body);
});

router.post('/download/youtube', (req, res) => {
    console.log('[Route /download/youtube] Received request. Body keys:', Object.keys(req.body || {}));
    forwardToPythonService(req, res, '/tools/download/youtube', req.body);
});

// --- Route to Proxy File Downloads from Python Service ---
router.get('/files/:serviceBasePath/:filename', async (req, res) => {
    const { serviceBasePath, filename } = req.params;
    // Reconstruct Python's expected subpath carefully
    const pythonFileSubpath = `${serviceBasePath}/${filename}`; 
    
    if (!PYTHON_SERVICE_URL || typeof PYTHON_SERVICE_URL !== 'string' || !PYTHON_SERVICE_URL.startsWith('http')) {
        const errorMsg = `CRITICAL: PYTHON_AI_CORE_SERVICE_URL is invalid or not set for file proxy. Value: '${PYTHON_SERVICE_URL}'`;
        console.error(`[Route /files proxy] ${errorMsg}`);
        return res.status(500).json({ message: "Internal server configuration error: Python service URL is not correctly set for file proxy.", error: errorMsg });
    }

    const pythonFileUrl = `${PYTHON_SERVICE_URL}/files/${pythonFileSubpath}`;
    
    console.log(`[Route /files proxy] Node proxying file request for: '${pythonFileSubpath}' from Python URL: ${pythonFileUrl}`);
    try {
        const response = await axios.get(pythonFileUrl, {
            responseType: 'stream', // Important for binary files/streaming
            timeout: 600000 // Example: 10 minutes timeout for large file downloads
        });
        // Forward headers from Python response (like Content-Type, Content-Disposition)
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-disposition']) {
            res.setHeader('Content-Disposition', response.headers['content-disposition']);
        }
        console.log(`[Route /files proxy] Streaming file '${pythonFileSubpath}' to client. Content-Type: ${res.getHeader('Content-Type')}`);
        response.data.pipe(res); // Stream the file content back to the client
    } catch (error) {
        const errorStatus = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: error.message }; // error.response.data might be a stream or error object
        let pythonErrorMessage = "Unknown error from Python file service";
        
        // Attempt to read error from stream if it's an error response from Python
        if (error.response && error.response.data && typeof error.response.data.on === 'function') {
            // It's a stream, try to read it for an error message
             pythonErrorMessage = await new Promise(resolve => {
                let data = '';
                error.response.data.on('data', chunk => data += chunk);
                error.response.data.on('end', () => resolve(data || "Streamed error from Python, no specific message."));
                error.response.data.on('error', () => resolve("Error reading error stream from Python."));
            });
        } else if (errorData) {
            pythonErrorMessage = errorData.error || errorData.message || (typeof errorData === 'string' ? errorData : pythonErrorMessage);
        }

        console.error(`[Route /files proxy] Error proxying file '${pythonFileSubpath}' from Python: [${errorStatus}]`, pythonErrorMessage);
        if (error.code) console.error(`[Route /files proxy] Axios error code: ${error.code}`);

        res.status(errorStatus).json({
            message: `File not found or error fetching from Python service: ${pythonFileSubpath}`,
            error: pythonErrorMessage,
            details: error.code ? `Axios Error Code: ${error.code}` : undefined
        });
    }
});

module.exports = router;