const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const mcpProtocol = require('../mcp/protocol');

// Initialize MCP protocol
mcpProtocol.initialize().catch(console.error);

// Get registered services
router.get('/services', tempAuth, async (req, res) => {
    try {
        const services = Array.from(mcpProtocol.services.entries()).map(([id, service]) => ({
            id,
            type: service.type,
            status: service.status,
            lastHeartbeat: service.lastHeartbeat
        }));
        res.json(services);
    } catch (error) {
        console.error('Error getting services:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new context
router.post('/contexts', tempAuth, async (req, res) => {
    try {
        const { serviceId, data } = req.body;
        const contextId = await mcpProtocol.createContext(serviceId, data);
        res.json({ contextId });
    } catch (error) {
        console.error('Error creating context:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process request through context
router.post('/chat', tempAuth, async (req, res) => {
    try {
        const { contextId, message, options } = req.body;
        const response = await mcpProtocol.processRequest(contextId, {
            type: 'chat',
            message,
            options
        });
        res.json(response);
    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get context history
router.get('/contexts/:contextId/history', tempAuth, async (req, res) => {
    try {
        const { contextId } = req.params;
        const history = await mcpProtocol.getContextHistory(contextId);
        res.json(history);
    } catch (error) {
        console.error('Error getting context history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cleanup context
router.delete('/contexts/:contextId', tempAuth, async (req, res) => {
    try {
        const { contextId } = req.params;
        await mcpProtocol.cleanupContext(contextId);
        res.json({ message: 'Context cleaned up successfully' });
    } catch (error) {
        console.error('Error cleaning up context:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 