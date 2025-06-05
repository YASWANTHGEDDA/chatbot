require('dotenv').config();

module.exports = {
    // Service URLs
    services: {
        gemini: {
            url: process.env.GEMINI_SERVICE_URL || 'http://localhost:5001',
            type: 'llm',
            healthEndpoint: '/health'
        },
        ollama: {
            type: 'llm',
            url: 'http://172.180.9.187:11435',
            healthEndpoint: '/api/version',
            model: 'llama2',
            status: 'inactive',
            lastHeartbeat: null
        },
        rag: {
            type: 'rag',
            url: 'http://localhost:5000',
            healthEndpoint: '/health',
            status: 'inactive',
            lastHeartbeat: null,
            optional: true
        },
        kg: {
            type: 'kg',
            url: 'http://localhost:5000',
            healthEndpoint: '/health',
            status: 'inactive',
            lastHeartbeat: null,
            optional: true
        }
    },

    // MCP Protocol Settings
    protocol: {
        maxContextAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        maxContextSize: 1000, // Maximum number of messages in a context
        cleanupInterval: 60 * 60 * 1000, // 1 hour in milliseconds
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
        defaultModel: 'llama2',
        defaultTemperature: 0.7,
        defaultMaxTokens: 1000
    },

    // Security Settings
    security: {
        requireAuth: true,
        allowedOrigins: process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : 
            ['http://localhost:3000']
    }
}; 