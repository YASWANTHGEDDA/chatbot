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

// Standard instance with 5-minute timeout
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 minutes default timeout
});

// Instance for long-running tasks like video processing
const longRunningApi = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30 * 60 * 1000, // 30 minutes timeout
});

// --- Interceptors ---
const applyInterceptors = (apiInstance) => {
    apiInstance.interceptors.request.use(
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

    apiInstance.interceptors.response.use(
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
            const errorMessage = error.response?.data?.python_error ||
                                 error.response?.data?.details ||
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
};

applyInterceptors(api);
applyInterceptors(longRunningApi);

// --- START: CORE API FUNCTIONS ---
// Authentication
export const signupUser = (userData) => api.post('/auth/signup', userData).then(res => res.data);
export const signinUser = (userData) => api.post('/auth/signin', userData).then(res => res.data);
export const saveApiKeys = (keyData) => api.post('/auth/keys', keyData).then(res => res.data);

// Chat Interaction
export const sendMessage = (messageData) => api.post('/chat/message', messageData).then(res => res.data);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData).then(res => res.data);

// Chat History Retrieval
export const getChatSessions = () => api.get('/chat/sessions').then(res => res.data);
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`).then(res => res.data);
export const deleteChatSession = (sessionId) => api.delete(`/history/session/${sessionId}`).then(res => res.data);

// File Upload (for RAG ingestion by Node.js backend)
export const uploadFile = (formData) => api.post('/upload', formData).then(res => res.data);

// File Management (for RAG ingested files)
export const getUserFiles = () => api.get('/files').then(res => res.data);
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName }).then(res => res.data);
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`).then(res => res.data);

// Document Analysis (using existing RAG ingested documents, text sent in payload)
export const analyzeDocument = (analysisData) => api.post('/analysis/document', analysisData).then(res => res.data);
// --- END: CORE API FUNCTIONS ---

// --- NEW: External AI Tool Service Functions ---
const EXTERNAL_AI_TOOLS_PROXY_PATH = `/external-ai-tools`;

// --- Academic Search ---
export const searchCoreApi = async (query, maxPages = 1, downloadPdfs = false) => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/search/core`, {
        query,
        max_pages: maxPages,
        download_pdfs: downloadPdfs
    }).then(res => res.data);
};

export const searchCombinedAcademic = async (searchParams) => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/search/combined`, searchParams).then(res => res.data);
};

// --- Content Creation ---
export const createPresentationFromMarkdown = async (markdownContent, filename = 'Presentation.pptx') => {
    const queryParams = `?filename=${encodeURIComponent(filename)}`;
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/create/ppt${queryParams}`,
        markdownContent,
        { headers: { 'Content-Type': 'text/markdown' } }
    ).then(res => res.data);
};

export const createDocumentFromMarkdown = async (markdownContent, contentKey, filename = 'Document.docx') => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/create/doc`, {
        markdown_content: markdownContent,
        content_key: contentKey,
        filename
    }).then(res => res.data);
};

// --- OCR ---
export const ocrPdfWithTesseract = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name);
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/ocr/tesseract`, formData).then(res => res.data);
};

export const ocrPdfWithNougat = async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile, pdfFile.name);
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/ocr/nougat`, formData).then(res => res.data);
};

// --- Video Processing (NEW) ---
export const processVideo = async (videoFile, options = {}) => {
    const formData = new FormData();
    formData.append('video_file', videoFile, videoFile.name);
    if (options.ollama_model) {
        formData.append('ollama_model', options.ollama_model);
    }
    // Use the long-running API instance for this call
    return longRunningApi.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/process/video`, formData).then(res => res.data);
};


// --- Web Resource Downloads ---
export const downloadWebPdfs = async (query, maxDownloads = 3) => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/download/web_pdfs`, {
        query,
        max_downloads: maxDownloads
    }).then(res => res.data);
};

export const downloadYouTubeMedia = async (youtubeUrl, qualityProfile = '720p') => {
    return api.post(`${EXTERNAL_AI_TOOLS_PROXY_PATH}/download/youtube`, {
        url: youtubeUrl,
        quality: qualityProfile
    }).then(res => res.data);
};

// --- Helper for constructing full download URLs ---
export const getProxiedFileDownloadUrl = (relativePathFromServer) => {
    if (!relativePathFromServer || typeof relativePathFromServer !== 'string') {
        console.warn("getProxiedFileDownloadUrl: Invalid relativePathFromServer:", relativePathFromServer);
        return "#";
    }
    // The relative path from the server should not have a leading slash for URL joining
    const cleanRelativePath = relativePathFromServer.startsWith('/')
        ? relativePathFromServer.substring(1)
        : relativePathFromServer;
    return `${API_BASE_URL}${EXTERNAL_AI_TOOLS_PROXY_PATH}/files/${cleanRelativePath}`;
};

// --- DEFAULT EXPORT ---
// The default export remains the standard 'api' instance for general use.
// Specific long-running functions call 'longRunningApi' directly.
export default api;