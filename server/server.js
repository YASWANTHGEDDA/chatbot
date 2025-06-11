// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getLocalIPs } = require('./utils/networkUtils');
const fs = require('fs');
const axios = require('axios');
const os = require('os');
const mongoose = require('mongoose');
require('dotenv').config();
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

const connectDB = require('./config/db');
const { performAssetCleanup } = require('./utils/assetCleanup');
const analysisRoutes = require('./routes/analysis');

// --- START OF MODIFICATION ---
// Import the new history routes
const historyRoutes = require('./routes/history');
// --- END OF MODIFICATION ---

const DEFAULT_PORT = 5000;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/chatbotGeminiDB';
const DEFAULT_PYTHON_SERVICE_URL = 'http://localhost:5001';

let port = process.env.PORT || DEFAULT_PORT;
let mongoUri = process.env.MONGO_URI || '';
let pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL || '';
let geminiApiKey = process.env.GEMINI_API_KEY || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => res.send('Chatbot Backend API (FusedChatbot Server) is running...'));

app.use('/api/network', require('./routes/network'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/files', require('./routes/files'));
app.use('/api/syllabus', require('./routes/syllabus'));
app.use('/api/analysis', analysisRoutes);
app.use('/api/history', historyRoutes);

app.use((err, req, res, next) => {
    console.error("Unhandled Error in Express:", err.stack || err);
    const statusCode = err.status || err.statusCode || 500;
    let message = err.message || 'An internal server error occurred.';
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'An internal server error occurred.';
    }
    if (req.originalUrl.startsWith('/api/')) {
         return res.status(statusCode).json({ message: message, error: err.name || "Error" });
    }
    res.status(statusCode).send(message);
});

let server;

const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    readline.close();
    try {
        if (server) {
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    await mongoose.connection.close();
                    console.log('MongoDB connection closed.');
                } catch (dbCloseError) {
                    console.error("Error closing MongoDB connection:", dbCloseError);
                }
                process.exit(0);
            });
        } else {
             try {
                 await mongoose.connection.close();
                 console.log('MongoDB connection closed.');
             } catch (dbCloseError) {
                 console.error("Error closing MongoDB connection:", dbCloseError);
             }
            process.exit(0);
        }
        setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit.');
            process.exit(1);
        }, 10000);
    } catch (shutdownError) {
        console.error("Error during graceful shutdown initiation:", shutdownError);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function checkPythonService(url) {
    if (!url) {
        console.warn('! Python AI Core service URL is not configured. Cannot check health.');
        return false;
    }
    console.log(`\nChecking Python AI Core service health at ${url}...`);
    try {
        const response = await axios.get(`${url}/health`, { timeout: 7000 }); // 7-second timeout
        if (response.status === 200 && response.data?.status === 'ok') {
            console.log('✓ Python AI Core service is available and healthy.');
            if(response.data.embedding_model_name) console.log(`  Embedding Model: ${response.data.embedding_model_name}`);
            if(response.data.default_index_loaded !== undefined) console.log(`  Default Index Loaded: ${response.data.default_index_loaded}`);
            if(response.data.core_api_key_set !== undefined) console.log(`  CORE API Key Set (Python side): ${response.data.core_api_key_set}`);
            if (response.data.message && response.data.message.includes("Status: ")) { // Check for more detailed status messages
                 console.log(`  Python Service Health Details: ${response.data.message}`);
            }
            return true;
        } else {
             console.warn(`! Python AI Core service responded but is not healthy: Status ${response.status} - Data: ${JSON.stringify(response.data)}`);
             return false;
        }
    } catch (error) {
        console.warn('! Python AI Core service is not reachable or an error occurred during health check.');
        if (error.code) { // Axios error codes
             console.warn(`  Error Code: ${error.code}`);
        }
        if (error.message) {
             console.warn(`  Error Message: ${error.message}`);
        }
        if (error.code === 'ECONNREFUSED') {
             console.warn(`  Ensure the Python AI Core service (ai_core_service/app.py) is running on the configured port.`);
        }
        console.warn('  Features dependent on this service may be unavailable or impaired.');
        return false;
    }
}

async function ensureServerDirectories() {
    // Directories essential for this Node.js server's operation
    // (Python service manages its own output dirs via its config.py)
    const dirs = [
        path.join(__dirname, 'assets'),          // For general static assets if any
        path.join(__dirname, 'backup_assets'),   // For backups
        path.join(__dirname, 'uploads_node_temp') // For temporary file uploads by Multer
    ];
    console.log("\nEnsuring essential server directories exist...");
    try {
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
                console.log(`  Created directory: ${dir}`);
            }
        }
        console.log("✓ Essential server directories checked/created.");
    } catch (error) {
        console.error('!!! Error creating essential server directories:', error);
        throw error; // Propagate error to stop server start if critical dirs can't be made
    }
}

function askQuestion(query) {
    return new Promise(resolve => readline.question(query, resolve));
}

async function configureAndStart() {
    console.log("--- Starting Server Configuration ---");

    if (!geminiApiKey) {
        console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FATAL: GEMINI_API_KEY environment variable is not set.   !!!");
        console.error("!!! Please set it in your server/.env file.                  !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
        process.exit(1);
    } else {
        console.log("✓ GEMINI_API_KEY found.");
    }

    if (!mongoUri) {
        console.warn("\nMongoDB URI not found in .env (MONGO_URI).");
        const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `);
        mongoUri = answer.trim() || DEFAULT_MONGO_URI;
    }
    console.log(`Using MongoDB URI: ${mongoUri}`);
    process.env.MONGO_URI = mongoUri; // Ensure it's set for connectDB

    if (!pythonServiceUrl) {
        console.warn("\nPython AI Core Service URL not found in .env (PYTHON_AI_CORE_SERVICE_URL).");
        const answer = await askQuestion(`Enter Python AI Core Service URL or press Enter for default (${DEFAULT_PYTHON_SERVICE_URL}): `);
        pythonServiceUrl = answer.trim() || DEFAULT_PYTHON_SERVICE_URL;
    }
    console.log(`Using Python AI Core Service URL: ${pythonServiceUrl}`);
    process.env.PYTHON_AI_CORE_SERVICE_URL = pythonServiceUrl; // Ensure it's set for route handlers

    // Port for this Node.js server (already loaded into 'port' variable)
    console.log(`Node.js server will attempt to listen on port: ${port}`);

    readline.close(); // Close the prompt interface
    console.log("--- Configuration Complete ---");

    await startServer();
}

async function startServer() {
    console.log("\n--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories();    // Ensure Node.js server's own directories
        await connectDB(mongoUri);          // Connect to MongoDB
        await performAssetCleanup();        // Perform asset cleanup if any
        await checkPythonService(pythonServiceUrl); // Check Python service health

        const PORT = parseInt(port, 10);

        server = app.listen(PORT, '0.0.0.0', () => {
            const nodeEnv = process.env.NODE_ENV || 'development';
            console.log(`\n======================================================================`);
            console.log(`🚀 Node.js Server (FusedChatbot Backend) is running!`);
            console.log(`   Mode: ${nodeEnv}`);
            console.log(`   Port: ${PORT}`);
            const localIPs = getLocalIPs();
            console.log(`   Listening on: http://localhost:${PORT}`);
            localIPs.forEach(ip => {
                if (ip !== '127.0.0.1' && ip !== 'localhost') { // Avoid redundancy
                    console.log(`                 http://${ip}:${PORT} (on your network)`);
                }
            });
            console.log(`   MongoDB Connected To: ${mongoUri.substring(0, mongoUri.lastIndexOf('/'))}/...`);
            console.log(`   Python AI Core Service Expected At: ${pythonServiceUrl}`);
            console.log(`======================================================================\n`);
        });

    } catch (error) {
        console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FAILED TO START NODE.JS SERVER                           !!!");
        if (error.code === 'EADDRINUSE') {
            console.error(`!!! Port ${port} is already in use. ` +
                          `Please check if another application (or a previous instance of this server) ` +
                          `is using this port, or change the PORT in your server/.env file.`);
        } else {
            console.error(`!!! Error: ${error.message}`);
        }
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
        process.exit(1); // Exit if server fails to start
    }
}

// --- Execute Configuration and Server Start ---
configureAndStart();