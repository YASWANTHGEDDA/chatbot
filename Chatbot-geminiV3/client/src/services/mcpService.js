import axios from 'axios';

const MCP_SERVER_URL = process.env.REACT_APP_MCP_SERVER_URL || 'http://localhost:5000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

class MCPService {
    constructor() {
        this.contextId = null;
        this.services = new Map();
        this.defaultOptions = {
            model: 'qwen2.5:14b-instruct',
            temperature: 0.7,
            maxTokens: 1000
        };
        this.isAuthenticated = false;
        this.authToken = null;
    }

    async checkNetworkConnection() {
        try {
            await axios.get(`${MCP_SERVER_URL}/health`, { timeout: 5000 });
            return true;
        } catch (error) {
            console.error('Network connection check failed:', error.message);
            return false;
        }
    }

    async retryOperation(operation, maxRetries = MAX_RETRIES) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
            }
        }
    }

    async initialize() {
        try {
            // Check network connection first
            const isConnected = await this.checkNetworkConnection();
            if (!isConnected) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }

            const response = await this.retryOperation(async () => {
                return await axios.get(`${MCP_SERVER_URL}/services`);
            });

            this.services = new Map(Object.entries(response.data));
            return true;
        } catch (error) {
            console.error('Failed to initialize MCP service:', error);
            throw new Error('Service initialization failed. Please try again later.');
        }
    }

    async authenticate(credentials) {
        try {
            const isConnected = await this.checkNetworkConnection();
            if (!isConnected) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }

            const response = await this.retryOperation(async () => {
                return await axios.post(`${MCP_SERVER_URL}/auth/login`, credentials);
            });

            this.authToken = response.data.token;
            this.isAuthenticated = true;
            return response.data;
        } catch (error) {
            console.error('Authentication failed:', error);
            if (error.response) {
                throw new Error(error.response.data.message || 'Authentication failed');
            }
            throw new Error('Network error during authentication. Please try again.');
        }
    }

    async register(userData) {
        try {
            const isConnected = await this.checkNetworkConnection();
            if (!isConnected) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }

            const response = await this.retryOperation(async () => {
                return await axios.post(`${MCP_SERVER_URL}/auth/register`, userData);
            });

            return response.data;
        } catch (error) {
            console.error('Registration failed:', error);
            if (error.response) {
                throw new Error(error.response.data.message || 'Registration failed');
            }
            throw new Error('Network error during registration. Please try again.');
        }
    }

    // Add auth header to requests
    getAuthHeader() {
        return this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {};
    }

    async createContext(serviceId = 'ollama') {
        try {
            const isConnected = await this.checkNetworkConnection();
            if (!isConnected) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }

            const response = await this.retryOperation(async () => {
                return await axios.post(
                    `${MCP_SERVER_URL}/contexts`,
                    { serviceId },
                    { headers: this.getAuthHeader() }
                );
            });

            this.contextId = response.data.contextId;
            return this.contextId;
        } catch (error) {
            console.error('Failed to create context:', error);
            throw new Error('Failed to create chat context. Please try again.');
        }
    }

    async sendMessage(message, options = {}) {
        if (!this.contextId) {
            await this.createContext();
        }

        try {
            const isConnected = await this.checkNetworkConnection();
            if (!isConnected) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }

            const request = {
                contextId: this.contextId,
                message,
                options: {
                    ...this.defaultOptions,
                    ...options
                }
            };

            const response = await this.retryOperation(async () => {
                return await axios.post(
                    `${MCP_SERVER_URL}/chat`,
                    request,
                    { headers: this.getAuthHeader() }
                );
            });

            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Failed to send message:', error);
            throw new Error('Failed to send message. Please try again.');
        }
    }

    formatResponse(data) {
        const baseResponse = {
            answer: data.answer || data.response,
            thinking: data.thinking || '',
            references: data.references || [],
            service: data.service,
            model: data.model
        };

        // Add any additional service-specific formatting
        if (data.service === 'ollama') {
            return {
                ...baseResponse,
                model: data.model || this.defaultOptions.model
            };
        }

        return baseResponse;
    }

    async getContextHistory() {
        if (!this.contextId) {
            return [];
        }

        try {
            const response = await axios.get(`${MCP_SERVER_URL}/contexts/${this.contextId}/history`);
            return response.data;
        } catch (error) {
            console.error('Failed to get context history:', error);
            return [];
        }
    }

    async clearContext() {
        if (!this.contextId) {
            return;
        }

        try {
            await axios.delete(`${MCP_SERVER_URL}/contexts/${this.contextId}`);
            this.contextId = null;
        } catch (error) {
            console.error('Failed to clear context:', error);
            throw error;
        }
    }

    setDefaultOptions(options) {
        this.defaultOptions = {
            ...this.defaultOptions,
            ...options
        };
    }
}

export default new MCPService(); 