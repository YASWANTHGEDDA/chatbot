// // FusedChatbot/server/routes/externalAiTools.js
// const express = require('express');
// const router = express.Router();
// const axios = require('axios');
// const multer = require('multer'); // For handling file uploads
// const fs = require('fs');
// const path = require('path');
// const FormData = require('form-data'); // Explicitly require form-data

// // Read the Python service URL from environment variables
// // This ensures it's read once when the module loads, after dotenv has done its job in server.js
// const PYTHON_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
// console.log('[externalAiTools.js] Initialized with PYTHON_AI_CORE_SERVICE_URL:', PYTHON_SERVICE_URL);

// // --- Multer setup for file uploads ---
// const UPLOAD_DIR_NODE = path.join(__dirname, '..', 'uploads_node_temp');
// if (!fs.existsSync(UPLOAD_DIR_NODE)) {
//     try {
//         fs.mkdirSync(UPLOAD_DIR_NODE, { recursive: true });
//         console.log(`[externalAiTools.js] Created temporary upload directory: ${UPLOAD_DIR_NODE}`);
//     } catch (err) {
//         console.error(`[externalAiTools.js] Error creating temporary upload directory ${UPLOAD_DIR_NODE}: ${err.message}`);
//         // Depending on how critical this is, you might want to throw an error or exit
//     }
// }
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, UPLOAD_DIR_NODE);
//     },
//     filename: function (req, file, cb) {
//         // Use a timestamp for unique filenames to avoid collisions during concurrent requests
//         cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, ''));
//     }
// });
// const upload = multer({ 
//     storage: storage,
//     limits: { fileSize: 100 * 1024 * 1024 } // Example: 100MB file size limit
// });
// // --- End Multer Setup ---

// // --- Helper function to forward requests to the Python service ---
// async function forwardToPythonService(req, res, pythonEndpoint, payload, isFileUpload = false, httpMethod = 'POST', queryParams = null) {
//     // Check if PYTHON_SERVICE_URL was correctly loaded when the module initialized
//     if (!PYTHON_SERVICE_URL || typeof PYTHON_SERVICE_URL !== 'string' || !PYTHON_SERVICE_URL.startsWith('http')) {
//         const errorMsg = `CRITICAL: PYTHON_AI_CORE_SERVICE_URL is invalid or not set in Node.js environment. Value: '${PYTHON_SERVICE_URL}'`;
//         console.error(`[forwardToPythonService] ${errorMsg}`);
//         return res.status(500).json({ message: "Internal server configuration error: Python service URL is not correctly set.", error: errorMsg });
//     }
    
//     const url = `${PYTHON_SERVICE_URL}${pythonEndpoint}`;
//     console.log(`[forwardToPythonService] Forwarding ${httpMethod} request to Python URL: ${url}`);
//     if (queryParams) console.log(`[forwardToPythonService] With Query Params:`, queryParams);
//     if (!isFileUpload && payload && typeof payload !== 'string') console.log(`[forwardToPythonService] With JSON Payload (first 100 chars): ${JSON.stringify(payload).substring(0,100)}...`);
//     if (typeof payload === 'string') console.log(`[forwardToPythonService] With Raw Text Payload (first 100 chars): ${payload.substring(0,100)}...`);


//     const axiosConfig = {
//         method: httpMethod,
//         url: url,
//         headers: {}, // Initialize headers
//         timeout: 120000, // Example: 2 minutes timeout for potentially long Python operations
//     };

//     if (isFileUpload && payload instanceof FormData) {
//         axiosConfig.data = payload;
//         axiosConfig.headers = { ...payload.getHeaders() }; // Let FormData set the Content-Type
//     } else if (typeof payload === 'string' && req.get('Content-Type')) {
//         // For raw text payloads like markdown for PPT
//         axiosConfig.data = payload;
//         axiosConfig.headers['Content-Type'] = req.get('Content-Type'); // Forward client's Content-Type
//     } else if (payload) { // Default to JSON payload
//         axiosConfig.data = payload;
//         axiosConfig.headers['Content-Type'] = 'application/json';
//     }

//     if (queryParams) {
//         axiosConfig.params = queryParams;
//     }
    
//     try {
//         const response = await axios(axiosConfig);
//         console.log(`[forwardToPythonService] Python service responded with status: ${response.status} for ${url}`);
//         res.status(response.status).json(response.data);
//     } catch (error) {
//         const errorStatus = error.response ? error.response.status : 500;
//         const errorData = error.response ? error.response.data : { error: error.message };
//         const pythonErrorMessage = errorData?.error || errorData?.message || (typeof errorData === 'string' ? errorData : "Unknown error from Python service");

//         console.error(`[forwardToPythonService] Error forwarding to Python (${url}): [${errorStatus}]`, pythonErrorMessage);
//         if (error.code) console.error(`[forwardToPythonService] Axios error code: ${error.code}`);
        
//         res.status(errorStatus).json({
//             message: `Failed request to Python service. Endpoint: ${pythonEndpoint}`,
//             error: pythonErrorMessage,
//             details: error.code ? `Axios Error Code: ${error.code}` : undefined
//         });
//     }
// }

// // --- Academic Search Routes ---
// router.post('/search/core', (req, res) => {
//     console.log('[Route /search/core] Received request. Body keys:', Object.keys(req.body || {}));
//     forwardToPythonService(req, res, '/tools/search/core', req.body);
// });

// router.post('/search/combined', (req, res) => {
//     console.log('[Route /search/combined] Received request. Body keys:', Object.keys(req.body || {}));
//     forwardToPythonService(req, res, '/tools/search/combined', req.body);
// });

// // --- Content Creation Routes ---
// router.post('/create/ppt', (req, res) => {
//     // Assumes express.text() middleware is applied in server.js for this route
//     // req.body will be the raw markdown string
//     console.log('[Route /create/ppt] Received request. Query params:', req.query);
//     console.log('[Route /create/ppt] Markdown body length:', req.body ? req.body.length : 'N/A');
//     forwardToPythonService(req, res, '/tools/create/ppt', req.body, false, 'POST', req.query);
// });

// router.post('/create/doc', (req, res) => {
//     // Expects JSON: {markdown_content, content_key, filename}
//     console.log('[Route /create/doc] Received request. Body keys:', Object.keys(req.body || {}));
//     forwardToPythonService(req, res, '/tools/create/doc', req.body);
// });

// // --- PDF Processing (OCR) Routes ---
// // 'upload.single('pdf_file')' middleware handles the file upload first
// router.post('/ocr/tesseract', upload.single('pdf_file'), async (req, res) => {
//     console.log('[Route /ocr/tesseract] Received file upload request.');
//     if (!req.file) {
//         console.warn('[Route /ocr/tesseract] No PDF file uploaded.');
//         return res.status(400).json({ error: 'No PDF file uploaded.' });
//     }
//     console.log(`[Route /ocr/tesseract] File uploaded: ${req.file.originalname}, Temp path: ${req.file.path}`);
    
//     const formData = new FormData();
//     formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
    
//     // forwardToPythonService will be called, then the finally block
//     try {
//         await forwardToPythonService(req, res, '/tools/ocr/tesseract', formData, true);
//     } finally {
//         // Cleanup the temporarily uploaded file on the Node server regardless of Python response
//         fs.unlink(req.file.path, err => {
//             if (err) console.error("[Route /ocr/tesseract] Error deleting temp uploaded file:", err.message);
//             else console.log(`[Route /ocr/tesseract] Deleted temp file: ${req.file.path}`);
//         });
//     }
// });

// router.post('/ocr/nougat', upload.single('pdf_file'), async (req, res) => {
//     console.log('[Route /ocr/nougat] Received file upload request.');
//     if (!req.file) {
//         console.warn('[Route /ocr/nougat] No PDF file uploaded.');
//         return res.status(400).json({ error: 'No PDF file uploaded.' });
//     }
//     console.log(`[Route /ocr/nougat] File uploaded: ${req.file.originalname}, Temp path: ${req.file.path}`);

//     const formData = new FormData();
//     formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);

//     try {
//         await forwardToPythonService(req, res, '/tools/ocr/nougat', formData, true);
//     } finally {
//         fs.unlink(req.file.path, err => {
//             if (err) console.error("[Route /ocr/nougat] Error deleting temp uploaded file:", err.message);
//             else console.log(`[Route /ocr/nougat] Deleted temp file: ${req.file.path}`);
//         });
//     }
// });

// // --- Web Resources Routes ---
// router.post('/download/web_pdfs', (req, res) => {
//     console.log('[Route /download/web_pdfs] Received request. Body keys:', Object.keys(req.body || {}));
//     forwardToPythonService(req, res, '/tools/download/web_pdfs', req.body);
// });

// router.post('/download/youtube', (req, res) => {
//     console.log('[Route /download/youtube] Received request. Body keys:', Object.keys(req.body || {}));
//     forwardToPythonService(req, res, '/tools/download/youtube', req.body);
// });

// // --- Route to Proxy File Downloads from Python Service ---
// router.get('/files/:serviceBasePath/:filename', async (req, res) => {
//     const { serviceBasePath, filename } = req.params;
//     // Reconstruct Python's expected subpath carefully
//     const pythonFileSubpath = `${serviceBasePath}/${filename}`; 
    
//     if (!PYTHON_SERVICE_URL || typeof PYTHON_SERVICE_URL !== 'string' || !PYTHON_SERVICE_URL.startsWith('http')) {
//         const errorMsg = `CRITICAL: PYTHON_AI_CORE_SERVICE_URL is invalid or not set for file proxy. Value: '${PYTHON_SERVICE_URL}'`;
//         console.error(`[Route /files proxy] ${errorMsg}`);
//         return res.status(500).json({ message: "Internal server configuration error: Python service URL is not correctly set for file proxy.", error: errorMsg });
//     }

//     const pythonFileUrl = `${PYTHON_SERVICE_URL}/files/${pythonFileSubpath}`;
    
//     console.log(`[Route /files proxy] Node proxying file request for: '${pythonFileSubpath}' from Python URL: ${pythonFileUrl}`);
//     try {
//         const response = await axios.get(pythonFileUrl, {
//             responseType: 'stream', // Important for binary files/streaming
//             timeout: 600000 // Example: 10 minutes timeout for large file downloads
//         });
//         // Forward headers from Python response (like Content-Type, Content-Disposition)
//         res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
//         if (response.headers['content-disposition']) {
//             res.setHeader('Content-Disposition', response.headers['content-disposition']);
//         }
//         console.log(`[Route /files proxy] Streaming file '${pythonFileSubpath}' to client. Content-Type: ${res.getHeader('Content-Type')}`);
//         response.data.pipe(res); // Stream the file content back to the client
//     } catch (error) {
//         const errorStatus = error.response ? error.response.status : 500;
//         const errorData = error.response ? error.response.data : { error: error.message }; // error.response.data might be a stream or error object
//         let pythonErrorMessage = "Unknown error from Python file service";
        
//         // Attempt to read error from stream if it's an error response from Python
//         if (error.response && error.response.data && typeof error.response.data.on === 'function') {
//             // It's a stream, try to read it for an error message
//              pythonErrorMessage = await new Promise(resolve => {
//                 let data = '';
//                 error.response.data.on('data', chunk => data += chunk);
//                 error.response.data.on('end', () => resolve(data || "Streamed error from Python, no specific message."));
//                 error.response.data.on('error', () => resolve("Error reading error stream from Python."));
//             });
//         } else if (errorData) {
//             pythonErrorMessage = errorData.error || errorData.message || (typeof errorData === 'string' ? errorData : pythonErrorMessage);
//         }

//         console.error(`[Route /files proxy] Error proxying file '${pythonFileSubpath}' from Python: [${errorStatus}]`, pythonErrorMessage);
//         if (error.code) console.error(`[Route /files proxy] Axios error code: ${error.code}`);

//         res.status(errorStatus).json({
//             message: `File not found or error fetching from Python service: ${pythonFileSubpath}`,
//             error: pythonErrorMessage,
//             details: error.code ? `Axios Error Code: ${error.code}` : undefined
//         });
//     }
// });

// module.exports = router;

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

// --- Multer Setup (for Node.js to receive files from client before forwarding) ---
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
    const targetUrl = `${PYTHON_SERVICE_URL}${pythonEndpoint}`; // Ensure pythonEndpoint starts with '/'
    const logPrefix = `[Node Forwarder - ${pythonEndpoint}]`;
    console.log(`${logPrefix} Forwarding ${httpMethod} request to Python: ${targetUrl}`);
    if (queryParams) console.log(`${logPrefix} With Query Params:`, queryParams);

    const axiosConfig = {
        method: httpMethod,
        url: targetUrl,
        headers: {},
        timeout: 300000, // 5 minutes timeout for tool operations
    };

    // Forward x-user-id header if present (Python might use it for user-specific folders)
    const userId = req.headers['x-user-id'];
    if (userId) {
        // Option 1: Add to headers (Python needs to read it from headers)
        // axiosConfig.headers['x-user-id'] = userId;
        // Option 2: Add to payload/queryParams if Python expects it there for tools (more common for POST bodies)
        // This is handled per-route below if necessary.
        console.log(`${logPrefix} User ID from header: ${userId}`);
    }


    if (isFileUpload && payload instanceof FormDataNode) {
        axiosConfig.data = payload;
        // Let form-data library set the Content-Type and boundary
        axiosConfig.headers = { ...axiosConfig.headers, ...payload.getHeaders() };
        console.log(`${logPrefix} Payload: FormData (file upload)`);
    } else if (typeof payload === 'string' && req.get('Content-Type') && req.get('Content-Type').startsWith('text/')) {
        axiosConfig.data = payload;
        axiosConfig.headers['Content-Type'] = req.get('Content-Type'); // Forward client's text Content-Type
        console.log(`${logPrefix} Payload: Raw text (first 100 chars): ${payload.substring(0, 100)}... Content-Type: ${req.get('Content-Type')}`);
    } else if (payload) { // Default to JSON payload
        axiosConfig.data = payload;
        axiosConfig.headers['Content-Type'] = 'application/json';
        console.log(`${logPrefix} Payload: JSON (first 100 chars): ${JSON.stringify(payload).substring(0,100)}...`);
    }

    if (queryParams) {
        axiosConfig.params = queryParams;
    }
    
    try {
        const pythonResponse = await axios(axiosConfig);
        console.log(`${logPrefix} Python service responded with status: ${pythonResponse.status}`);
        // Forward Python's status and data
        res.status(pythonResponse.status).json(pythonResponse.data);
    } catch (error) {
        const errorStatus = error.response ? error.response.status : 502; // 502 Bad Gateway if no response from upstream
        const errorData = error.response ? error.response.data : { error: error.message, details: "No response from Python service or network issue." };
        // Try to get a more specific error message from Python's JSON response
        const pythonErrorMessage = errorData?.error || errorData?.message || (typeof errorData === 'string' ? errorData : "Unknown error from Python service");

        console.error(`${logPrefix} Error forwarding to Python (${targetUrl}): [${errorStatus}]`, pythonErrorMessage);
        if (error.code) console.error(`${logPrefix} Axios error code: ${error.code}`); // e.g., ECONNREFUSED
        
        res.status(errorStatus).json({
            message: `Request to Python service endpoint '${pythonEndpoint}' failed.`,
            python_error: pythonErrorMessage, // Include the error message from Python if available
            details: error.code ? `Node.js Request Error Code: ${error.code}` : (errorData.details || undefined)
        });
    }
}

// --- Tool Routes ---

// YouTube Download
router.post('/download/youtube', (req, res) => {
    const { url, quality } = req.body;
    const userId = req.headers['x-user-id'] || 'guest_user'; // Get user ID from header
    console.log(`[Node /download/youtube] Req: url=${url}, quality=${quality}, user=${userId}`);
    if (!url) return res.status(400).json({ error: "YouTube URL is required." });
    // Python's route expects user_id in the payload
    forwardToPythonService(req, res, '/tools/download/youtube', { url, quality, user_id: userId });
});

// Web PDF Download
router.post('/download/web_pdfs', (req, res) => {
    const { query, max_downloads } = req.body;
    const userId = req.headers['x-user-id'] || 'guest_user';
    console.log(`[Node /download/web_pdfs] Req: query=${query}, max_downloads=${max_downloads}, user=${userId}`);
    if (!query) return res.status(400).json({ error: "Search query is required." });
    // Python's route expects user_id in the payload
    forwardToPythonService(req, res, '/tools/download/web_pdfs', { query, max_downloads, user_id: userId });
});

// Create PPT from Markdown
// Use express.text() middleware for routes expecting raw text body
router.post('/create/ppt', express.text({ type: ['text/markdown', 'text/plain', 'application/text'], limit: '10mb' }), (req, res) => {
    const filename = req.query.filename || 'Presentation.pptx'; // Get filename from query param
    const userId = req.headers['x-user-id'] || 'guest_user'; // Get user ID for folder structuring
    console.log(`[Node /create/ppt] Filename: ${filename}, Markdown length: ${req.body.length}, UserID: ${userId}, Content-Type: ${req.get('Content-Type')}`);
    // Python route expects filename and user_id as query parameters
    forwardToPythonService(req, res, '/tools/create/ppt', req.body, false, 'POST', { filename, user_id: userId });
});

// --- TODO: Implement other tool routes (OCR, Academic Search, Create DOCX) ---
// Follow the pattern:
// 1. Define the route.
// 2. Use `upload.single()` if it involves a file upload from the client to Node.
// 3. Extract necessary data from `req.body`, `req.query`, `req.file`, and `req.headers['x-user-id']`.
// 4. Construct the payload/FormData for Python.
// 5. Call `forwardToPythonService`.
// 6. Handle file cleanup for `uploads_node_temp` if applicable.

// Example: OCR Tesseract
router.post('/ocr/tesseract', upload.single('pdf_file'), async (req, res) => {
    const logPrefix = '[Node /ocr/tesseract]';
    console.log(`${logPrefix} Received file upload request.`);
    if (!req.file) {
        console.warn(`${logPrefix} No PDF file uploaded.`);
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    console.log(`${logPrefix} File: ${req.file.originalname}, Temp path: ${req.file.path}`);
    
    const formData = new FormDataNode();
    formData.append('pdf_file', fs.createReadStream(req.file.path), req.file.originalname);
    // Add user_id to FormData if Python needs it for output organization
    // const userId = req.headers['x-user-id'] || 'guest_user';
    // formData.append('user_id', userId);
    
    try {
        await forwardToPythonService(req, res, '/tools/ocr/tesseract', formData, true);
    } finally {
        fs.unlink(req.file.path, err => {
            if (err) console.error(`${logPrefix} Error deleting temp file on Node server:`, err.message);
            else console.log(`${logPrefix} Deleted temp file from Node server: ${req.file.path}`);
        });
    }
});


// --- File Proxy Route (for client to download files generated/stored by Python) ---
router.get('/files/*', async (req, res) => { // Wildcard captures the full path after /files/
    const requestedPathFromClient = req.params[0]; // e.g., "guest_user/youtube_downloads/VideoTitle.mp4"
    const logPrefix = `[Node FileProxy - ${requestedPathFromClient}]`;

    if (!PYTHON_SERVICE_URL) {
        console.error(`${logPrefix} CRITICAL: PYTHON_SERVICE_URL not available for file proxy.`);
        return res.status(500).json({ message: "Python service URL not configured for file proxy." });
    }

    // Python serves files from its own /files/ endpoint, using the path relative to its ASSETS_DIR
    const pythonFileUrl = `${PYTHON_SERVICE_URL}/files/${requestedPathFromClient}`;
    console.log(`${logPrefix} Proxying file request to Python URL: ${pythonFileUrl}`);

    try {
        const pythonStreamResponse = await axios.get(pythonFileUrl, {
            responseType: 'stream',
            timeout: 600000 // 10 minutes timeout for potentially large file downloads from Python
        });

        // Forward essential headers from Python's response to the client
        const headersToForward = ['content-type', 'content-disposition', 'content-length'];
        headersToForward.forEach(headerName => {
            if (pythonStreamResponse.headers[headerName]) {
                res.setHeader(headerName, pythonStreamResponse.headers[headerName]);
            }
        });
        if (!res.getHeader('Content-Type')) { // Fallback Content-Type
            res.setHeader('Content-Type', 'application/octet-stream');
        }

        console.log(`${logPrefix} Streaming file to client. Content-Type: ${res.getHeader('Content-Type')}`);
        pythonStreamResponse.data.pipe(res); // Stream the file content from Python directly to the client

    } catch (error) {
        const errorStatus = error.response ? error.response.status : 502; // Bad Gateway
        // Attempt to parse error if Python sent a JSON error response within the stream
        let pythonErrorMessage = "Error fetching file from Python service.";
        if (error.response && error.response.data && error.response.headers['content-type']?.includes('application/json')) {
            pythonErrorMessage = await new Promise(resolve => {
                let dataChunks = '';
                error.response.data.on('data', chunk => dataChunks += chunk);
                error.response.data.on('end', () => {
                    try {
                        const jsonData = JSON.parse(dataChunks);
                        resolve(jsonData.error || jsonData.message || jsonData.details || "Streamed JSON error from Python.");
                    } catch (parseError) { resolve("Could not parse streamed JSON error from Python."); }
                });
                error.response.data.on('error', () => resolve("Error reading error stream from Python."));
            });
        } else if (error.message) {
            pythonErrorMessage = error.message;
        }

        console.error(`${logPrefix} Error proxying file: [${errorStatus}]`, pythonErrorMessage);
        if (error.code) console.error(`${logPrefix} Axios error code: ${error.code}`);

        res.status(errorStatus).json({
            message: `File not found or error fetching from Python service: ${requestedPathFromClient}`,
            python_error: pythonErrorMessage,
            details: error.code ? `Node.js Request Error Code: ${error.code}` : undefined
        });
    }
});

module.exports = router;