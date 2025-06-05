const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const config = require('../config/mcp');

class MCPProtocol {
    constructor() {
        this.services = new Map();
        this.contexts = new Map();
        this.serviceConfigs = config.services;
    }

    async checkServiceHealth(serviceId) {
        const service = this.services.get(serviceId);
        if (!service) return false;

        try {
            if (serviceId === 'ollama') {
                const response = await axios.get(`${service.url}/api/version`, { timeout: 5000 });
                return response.status === 200;
            } else {
                const response = await axios.get(`${service.url}${service.healthEndpoint}`, { timeout: 5000 });
                return response.status === 200;
            }
        } catch (error) {
            console.error(`Health check failed for service ${serviceId}:`, error.message);
            return false;
        }
    }

    async initialize() {
        console.log('Initializing MCP Protocol...');
        
        // Initialize all services
        for (const [serviceId, config] of Object.entries(this.serviceConfigs)) {
            console.log(`Registering service: ${serviceId}`);
            const success = await this.registerService(serviceId, config);
            if (success) {
                console.log(`Service ${serviceId} registered successfully`);
            } else {
                console.error(`Failed to register service ${serviceId}`);
            }
        }

        // Verify services are registered
        console.log('Registered services:', Array.from(this.services.keys()));
    }

    async registerService(serviceId, config) {
        try {
            // Special handling for Ollama service
            if (serviceId === 'ollama') {
                try {
                    // Check if Ollama is available using version endpoint
                    const response = await axios.get(`${config.url}/api/version`, { timeout: 5000 });
                    if (response.status === 200) {
                        this.services.set(serviceId, {
                            ...config,
                            status: 'active',
                            lastHeartbeat: Date.now()
                        });
                        console.log(`Ollama service registered at ${config.url}`);
                        return true;
                    }
                } catch (error) {
                    console.error('Ollama service not available:', error.message);
                    return false;
                }
            }

            // For other services, check health
            try {
                const healthCheck = await axios.get(`${config.url}${config.healthEndpoint}`, { timeout: 5000 });
                if (healthCheck.status === 200) {
                    this.services.set(serviceId, {
                        ...config,
                        status: 'active',
                        lastHeartbeat: Date.now()
                    });
                    console.log(`Service ${serviceId} registered successfully`);
                    return true;
                }
            } catch (error) {
                if (config.optional) {
                    console.log(`Optional service ${serviceId} not available:`, error.message);
                    return true; // Return true for optional services that fail
                }
                console.error(`Health check failed for service ${serviceId}:`, error.message);
                return false;
            }
        } catch (error) {
            if (config.optional) {
                console.log(`Optional service ${serviceId} not available:`, error.message);
                return true; // Return true for optional services that fail
            }
            console.error(`Failed to register service ${serviceId}:`, error.message);
            return false;
        }
    }

    async createContext(serviceId, data) {
        const contextId = uuidv4();
        this.contexts.set(contextId, {
            serviceId,
            data,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            history: []
        });
        return contextId;
    }

    async processRequest(contextId, request) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error('Context not found');
        }

        const service = this.services.get(context.serviceId);
        if (!service) {
            throw new Error('Service not found');
        }

        // Add request to context history
        context.history.push({
            type: 'request',
            timestamp: Date.now(),
            data: request
        });

        try {
            // Process request through appropriate service
            const response = await this.routeToService(service, request);
            
            // Add response to context history
            context.history.push({
                type: 'response',
                timestamp: Date.now(),
                data: response
            });

            // Update context
            context.updatedAt = Date.now();
            this.contexts.set(contextId, context);

            return response;
        } catch (error) {
            console.error('Error processing request:', error);
            throw error;
        }
    }

    async routeToService(service, request) {
        switch (service.type) {
            case 'llm':
                return await this.handleLLMRequest(service, request);
            case 'rag':
                return await this.handleRAGRequest(service, request);
            case 'kg':
                return await this.handleKGRequest(service, request);
            default:
                throw new Error(`Unknown service type: ${service.type}`);
        }
    }

    async handleLLMRequest(service, request) {
        if (service.type === 'llm' && service.url.includes('172.180.9.187:11435')) {
            // Handle Ollama request
            try {
                // If useKG is true, first query the knowledge graph
                let kgContext = '';
                if (request.options?.useKG) {
                    try {
                        const kgService = this.services.get('kg');
                        if (kgService && kgService.status === 'active') {
                            const kgResponse = await axios.post(`${kgService.url}/query_kg`, {
                                query: request.message
                            });
                            if (kgResponse.data && kgResponse.data.context) {
                                kgContext = `\nKnowledge Graph Context: ${kgResponse.data.context}`;
                            }
                        }
                    } catch (error) {
                        console.warn('KG query failed:', error.message);
                    }
                }

                // Prepare the prompt with KG context if available
                const prompt = kgContext ? `${request.message}${kgContext}` : request.message;

                const response = await axios.post(`${service.url}/api/chat`, {
                    model: request.options?.model || service.model || config.protocol.defaultModel,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    stream: false,
                    options: {
                        temperature: request.options?.temperature || config.protocol.defaultTemperature,
                        num_predict: request.options?.maxTokens || config.protocol.defaultMaxTokens
                    }
                });

                return {
                    answer: response.data.message.content,
                    thinking: response.data.message.thinking || '',
                    references: request.references || [],
                    service: 'ollama',
                    model: response.data.model,
                    kgContext: kgContext ? true : false
                };
            } catch (error) {
                console.error('Ollama request failed:', error);
                throw new Error(`Ollama request failed: ${error.message}`);
            }
        } else {
            // Handle Gemini request
            const response = await axios.post(`${service.url}/generate`, request);
            return {
                ...response.data,
                service: 'gemini'
            };
        }
    }

    async handleRAGRequest(service, request) {
        const response = await axios.post(`${service.url}/query`, request);
        return response.data;
    }

    async handleKGRequest(service, request) {
        const response = await axios.post(`${service.url}/query_kg`, request);
        return response.data;
    }

    async getContextHistory(contextId) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error('Context not found');
        }
        return context.history;
    }

    async cleanupContext(contextId) {
        this.contexts.delete(contextId);
    }
}

module.exports = new MCPProtocol(); 