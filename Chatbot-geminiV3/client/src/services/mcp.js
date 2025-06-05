import axios from 'axios';

class MCPClient {
    constructor() {
        this.baseUrl = '/api/mcp';
        this.contexts = new Map();
    }

    async createContext(serviceId, data) {
        try {
            const response = await axios.post(`${this.baseUrl}/context`, {
                serviceId,
                data
            });
            const { contextId } = response.data;
            this.contexts.set(contextId, { serviceId, data });
            return contextId;
        } catch (error) {
            console.error('Error creating MCP context:', error);
            throw error;
        }
    }

    async processRequest(contextId, request) {
        try {
            const response = await axios.post(`${this.baseUrl}/process/${contextId}`, request);
            return response.data;
        } catch (error) {
            console.error('Error processing MCP request:', error);
            throw error;
        }
    }

    async getContextHistory(contextId) {
        try {
            const response = await axios.get(`${this.baseUrl}/history/${contextId}`);
            return response.data.history;
        } catch (error) {
            console.error('Error getting MCP context history:', error);
            throw error;
        }
    }

    async cleanupContext(contextId) {
        try {
            await axios.delete(`${this.baseUrl}/context/${contextId}`);
            this.contexts.delete(contextId);
        } catch (error) {
            console.error('Error cleaning up MCP context:', error);
            throw error;
        }
    }

    async getServices() {
        try {
            const response = await axios.get(`${this.baseUrl}/services`);
            return response.data.services;
        } catch (error) {
            console.error('Error getting MCP services:', error);
            throw error;
        }
    }
}

export default new MCPClient(); 