// client/src/services/api.js
import axios from 'axios';

// Dynamically determine API Base URL
const getApiBaseUrl = () => {
    // Use REACT_APP_BACKEND_HOST and REACT_APP_BACKEND_PORT if available, otherwise derive
    const backendHostEnv = process.env.REACT_APP_BACKEND_HOST;
    const backendPortEnv = process.env.REACT_APP_BACKEND_PORT;

    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    let backendHost, backendPort;

    if (backendHostEnv && backendPortEnv) {
        backendHost = backendHostEnv;
        backendPort = backendPortEnv;
    } else {
        // Fallback to deriving from window.location.hostname (less reliable for complex setups)
        const hostname = window.location.hostname;
        backendPort = process.env.REACT_APP_BACKEND_PORT || 5003; // Default to 5003 if only port is missing
        backendHost = (hostname === 'localhost' || hostname === '127.0.0.1')
            ? 'localhost' // Or specific IP if needed for Docker/VMs
            : hostname; // This might not be correct if client and server are on different domains/subdomains
    }
    return `${protocol}//${backendHost}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL (api.js):", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000, // Default timeout for API calls (e.g., 2 minutes)
});

// --- Interceptor to add User ID header & handle Content-Type ---
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId'); // Or however you store/retrieve user ID
        if (userId) {
            config.headers['x-user-id'] = userId;
        } else if (!config.url.includes('/auth/')) { // Don't warn for auth routes
             console.warn("API Interceptor: userId not found for non-auth request to", config.url);
        }

        // Do not set Content-Type for FormData, let browser/axios handle it
        // Also, do not set for raw text uploads if Content-Type is already set by the caller
        if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }
        return config;
    },
    (error) => {
        console.error("API Request Interceptor Error:", error);
        return Promise.reject(error);
    }
);

// --- Interceptor to handle 401 Unauthorized responses ---
api.interceptors.response.use(
    (response) => response, // Pass through successful responses
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("API Interceptor: 401 Unauthorized. Clearing auth & redirecting to /login.");
            // Clear user session data
            localStorage.removeItem('sessionId'); // Or your session token key
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            // Redirect to login page, ensuring it's not already there to avoid loops
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                 window.location.href = '/login?sessionExpired=true';
            }
        }
        // For other errors, try to extract a more meaningful message
        const errorMessage = error.response?.data?.message ||
                             error.response?.data?.error ||
                             error.message ||
                             'An unknown API error occurred';
        console.error("API Response Interceptor Error:", errorMessage, error.config?.url, error.response?.status);
        
        // You might want to construct a new error object with a better message
        const customError = new Error(errorMessage);
        customError.response = error.response; // Attach original response if available
        customError.isAxiosError = error.isAxiosError; // Preserve Axios error flag
        return Promise.reject(customError); // Reject with the custom or original error
    }
);

// --- NAMED EXPORTS for API functions ---

// Authentication
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);
export const saveApiKeys = (keyData) => api.post('/auth/keys', keyData);


// Chat Interaction
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);

// Chat History Retrieval
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);
// --- START OF MODIFICATION ---
// New function to delete a specific chat session
export const deleteChatSession = (sessionId) => api.delete(`/history/session/${sessionId}`);
// --- END OF MODIFICATION ---

// File Upload (for RAG ingestion by Node.js backend)
// formData should be a FormData object with the file
export const uploadFile = (formData) => api.post('/upload', formData); // Uses FormData, Content-Type handled by interceptor

// File Management (for RAG ingested files)
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);

// Document Analysis (using existing RAG ingested documents, text sent in payload)
export const analyzeDocument = (analysisData) => api.post('/analysis/document', analysisData);

// --- NEW: External AI Tool Service Functions ---
const EXTERNAL_AI_TOOLS_BASE = `/external-ai-tools`;

// --- Academic Search ---
export const searchCoreApi = async (query, maxPages = 1, downloadPdfs = false) => {
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/search/core`, {
        query,
        max_pages: maxPages,
        download_pdfs: downloadPdfs
    });
};

export const searchCombinedAcademic = async (searchParams) => {
    // searchParams = { query, min_year, openalex_max_records, scholar_max_results, etc. }
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/search/combined`, searchParams);
};

// --- Content Creation ---
export const createPresentationFromMarkdown = async (markdownContent, filename = 'Presentation.pptx') => {
    // For raw text body, Content-Type is set explicitly
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/create/ppt?filename=${encodeURIComponent(filename)}`,
        markdownContent, // Send raw string as data
        {
            headers: {
                'Content-Type': 'text/markdown' // Override default JSON Content-Type
            }
        }
    );
};

export const createDocumentFromMarkdown = async (markdownContent, contentKey, filename = 'Document.docx') => {
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/create/doc`, {
        markdown_content: markdownContent,
        content_key: contentKey,
        filename
    });
};

// --- OCR ---
export const ocrPdfWithTesseract = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name); // Include original filename
    // Axios will set Content-Type for FormData automatically
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/ocr/tesseract`, formData);
};

export const ocrPdfWithNougat = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name); // Include original filename
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/ocr/nougat`, formData);
};

// --- Web Resource Downloads ---
export const downloadWebPdfs = async (query, maxDownloads = 2) => {
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/download/web_pdfs`, {
        query,
        max_downloads: maxDownloads
    });
};

export const downloadYouTubeMedia = async (youtubeUrl, qualityProfile = '720p') => {
    return api.post(`${EXTERNAL_AI_TOOLS_BASE}/download/youtube`, {
        url: youtubeUrl,
        quality: qualityProfile
    });
};

// Helper for constructing full download URLs for files proxied by Node.js
// relativePath will be like "generated_pptx/MyPres.pptx" from Python response's download_link
export const getProxiedFileDownloadUrl = (relativePathFromServer) => {
    if (!relativePathFromServer) return null;
    // Ensure no double slashes and correct joining
    const cleanRelativePath = relativePathFromServer.startsWith('/') ? relativePathFromServer.substring(1) : relativePathFromServer;
    return `${API_BASE_URL}${EXTERNAL_AI_TOOLS_BASE}/files/${cleanRelativePath}`;
};

// --- DEFAULT EXPORT ---
// Export the configured Axios instance if needed for direct use elsewhere,
// though using named exports for specific functions is generally preferred.
export default api;