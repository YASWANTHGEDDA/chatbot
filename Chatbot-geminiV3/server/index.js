const express = require('express');
const cors = require('cors');
const mcpProtocol = require('./mcp/protocol');
const config = require('./config/mcp');
const mcpRoutes = require('./routes/mcp');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Network timeout middleware
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(408).json({
            status: 'error',
            message: 'Request timeout'
        });
    });
    next();
});

// Mount routes
app.use('/mcp', mcpRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check if Ollama service is available
        const ollamaAvailable = await mcpProtocol.checkServiceHealth('ollama');
        res.json({
            status: 'ok',
            services: {
                ollama: ollamaAvailable ? 'available' : 'unavailable'
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Service health check failed',
            error: error.message
        });
    }
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
});

// Initialize MCP protocol and start server
async function startServer() {
    try {
        // Initialize MCP protocol first
        await mcpProtocol.initialize();
        console.log('MCP Protocol initialized successfully');

        // Start server after initialization
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize MCP Protocol:', error);
        process.exit(1);
    }
}

startServer(); 