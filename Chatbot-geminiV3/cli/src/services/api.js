// client/src/services/api.js
import axios from 'axios';

// Configuration for different services
const SERVICES = {
    API_GATEWAY: {
        port: process.env.REACT_APP_API_GATEWAY_PORT || 5001,
        path: '/api'
    },
    LLM_SERVICE: {
        port: process.env.REACT_APP_LLM_SERVICE_PORT || 5002,
        path: '/api/llm'
    },
    RAG_SERVICE: {
        port: process.env.REACT_APP_RAG_SERVICE_PORT || 5003,
        path: '/api/rag'
    },
    KG_SERVICE: {
        port: process.env.REACT_APP_KG_SERVICE_PORT || 5004,
        path: '/api/kg'
    }
};

// Dynamically determine API Base URL for a specific service
const getServiceUrl = (service) => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendHost = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'localhost'
        : hostname;

    return `${protocol}//${backendHost}:${service.port}${service.path}`;
};

// Create Axios instances for each service
const createServiceInstance = (service) => {
    const instance = axios.create({
        baseURL: getServiceUrl(service),
        timeout: 30000, // 30 second timeout
    });

    // Add request interceptor
    instance.interceptors.request.use(
        (config) => {
            const userId = localStorage.getItem('userId');
            if (userId) {
                config.headers['x-user-id'] = userId;
            }
            
            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            } else if (!config.headers['Content-Type']) {
                config.headers['Content-Type'] = 'application/json';
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Add response interceptor
    instance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('sessionId');
                localStorage.removeItem('username');
                localStorage.removeItem('userId');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login?sessionExpired=true';
                }
            }
            return Promise.reject(error);
        }
    );

    return instance;
};

// Create service instances
const apiGateway = createServiceInstance(SERVICES.API_GATEWAY);
const llmService = createServiceInstance(SERVICES.LLM_SERVICE);
const ragService = createServiceInstance(SERVICES.RAG_SERVICE);
const kgService = createServiceInstance(SERVICES.KG_SERVICE);

// --- Authentication ---
export const signupUser = (userData) => apiGateway.post('/auth/signup', userData);
export const signinUser = (userData) => apiGateway.post('/auth/signin', userData);

// --- Chat Interaction ---
export const sendMessage = (messageData) => apiGateway.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => apiGateway.post('/chat/history', historyData);

// --- LLM Service ---
export const getAvailableModels = () => llmService.get('/models');
export const generateResponse = (data) => llmService.post('/generate', data);
export const streamResponse = (data) => llmService.post('/stream', data, {
    responseType: 'stream'
});

// --- RAG Service ---
export const queryRagService = (queryData) => ragService.post('/query', queryData);
export const indexDocument = (formData) => ragService.post('/index', formData);
export const getRagStatus = () => ragService.get('/status');

// --- Knowledge Graph Service ---
export const queryKnowledgeGraph = (queryData) => kgService.post('/query', queryData);
export const getGraphVisualization = (queryData) => kgService.post('/visualize', queryData);
export const updateKnowledgeGraph = (data) => kgService.post('/update', data);

// --- File Management ---
export const uploadFile = (formData) => apiGateway.post('/upload', formData);
export const getUserFiles = () => apiGateway.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => 
    apiGateway.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => 
    apiGateway.delete(`/files/${serverFilename}`);

// --- Chat History ---
export const getChatSessions = () => apiGateway.get('/chat/sessions');
export const getSessionDetails = (sessionId) => apiGateway.get(`/chat/session/${sessionId}`);

// Export the API Gateway instance as default
export default apiGateway;
