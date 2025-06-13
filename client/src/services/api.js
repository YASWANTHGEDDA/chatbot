// client/src/services/api.js
import axios from 'axios';

// Dynamically determine API Base URL
const getApiBaseUrl = () => {
    const backendHostEnv = process.env.REACT_APP_BACKEND_HOST;
    const backendPortEnv = process.env.REACT_APP_BACKEND_PORT;
    const protocol = window.location.protocol;
    let backendHost, backendPort;

    if (backendHostEnv && backendPortEnv) {
        backendHost = backendHostEnv;
        backendPort = backendPortEnv;
    } else {
        const hostname = window.location.hostname;
        backendPort = process.env.NODE_PORT || process.env.REACT_APP_BACKEND_PORT || 5003;
        backendHost = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost' : hostname;
    }
    return `${protocol}//${backendHost}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL (api.js):", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000,
});

// --- Interceptors (Keep your existing interceptors) ---
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId');
        if (userId) {
            config.headers['x-user-id'] = userId;
        } else if (!config.url.includes('/auth/')) {
             console.warn("API Interceptor: userId not found for non-auth request to", config.url);
        }
        if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }
        return config;
    }, (error) => {
        console.error("API Request Interceptor Error:", error);
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("API Interceptor: 401 Unauthorized. Clearing auth & redirecting to /login.");
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                 window.location.href = '/login?sessionExpired=true';
            }
        }
        const errorMessage = error.response?.data?.python_error || // Prioritize Python error
                             error.response?.data?.message ||
                             error.response?.data?.error ||
                             error.message ||
                             'An unknown API error occurred';
        console.error("API Error:", errorMessage, "URL:", error.config?.url, "Status:", error.response?.status);
        const customError = new Error(errorMessage);
        customError.response = error.response;
        customError.isAxiosError = error.isAxiosError;
        return Promise.reject(customError);
    }
);

// --- START: RESTORED ORIGINAL API FUNCTIONS ---
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
export const deleteChatSession = (sessionId) => api.delete(`/history/session/${sessionId}`); // Ensure this matches your Node.js route

// File Upload (for RAG ingestion by Node.js backend)
export const uploadFile = (formData) => api.post('/upload', formData);

// File Management (for RAG ingested files)
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);

// Document Analysis (using existing RAG ingested documents, text sent in payload)
export const analyzeDocument = (analysisData) => api.post('/analysis/document', analysisData);
// --- END: RESTORED ORIGINAL API FUNCTIONS ---

// --- NEW: External AI Tool Service Functions ---
const EXTERNAL_AI_TOOLS_PROXY_PATH = `/external-ai-tools`; // Path on Node.js server

// --- Academic Search ---
export const searchCoreApi = async (query, maxPages = 1, downloadPdfs = false) => { // Make sure this is implemented if used
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/search/core`, {
        query,
        max_pages: maxPages,
        download_pdfs: downloadPdfs
    });
};

export const searchCombinedAcademic = async (searchParams) => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/search/combined`, searchParams);
};

// --- Content Creation ---
export const createPresentationFromMarkdown = async (markdownContent, filename = 'Presentation.pptx') => {
    const queryParams = `?filename=${encodeURIComponent(filename)}`;
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/create/ppt${queryParams}`,
        markdownContent,
        { headers: { 'Content-Type': 'text/markdown' } }
    );
};

export const createDocumentFromMarkdown = async (markdownContent, contentKey, filename = 'Document.docx') => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/create/doc`, {
        markdown_content: markdownContent,
        content_key: contentKey,
        filename
    });
};

// --- OCR ---
export const ocrPdfWithTesseract = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name);
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/ocr/tesseract`, formData);
};

export const ocrPdfWithNougat = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name);
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/ocr/nougat`, formData);
};

// --- Web Resource Downloads ---
export const downloadWebPdfs = async (query, maxDownloads = 3) => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/download/web_pdfs`, {
        query,
        max_downloads: maxDownloads
    });
};

export const downloadYouTubeMedia = async (youtubeUrl, qualityProfile = '720p') => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/download/youtube`, {
        url: youtubeUrl,
        quality: qualityProfile
    });
};

// Helper for constructing full download URLs
export const getProxiedFileDownloadUrl = (relativePathFromServer) => {
    if (!relativePathFromServer || typeof relativePathFromServer !== 'string') {
        console.warn("getProxiedFileDownloadUrl: Invalid relativePathFromServer:", relativePathFromServer);
        return "#";
    }
    const cleanRelativePath = relativePathFromServer.startsWith('/')
        ? relativePathFromServer.substring(1)
        : relativePathFromServer;
    return `${API_BASE_URL}${EXTERNAL_AI_TOOLS_PROXY_PATH}/files/${cleanRelativePath}`;
};

// --- DEFAULT EXPORT ---
export default api;