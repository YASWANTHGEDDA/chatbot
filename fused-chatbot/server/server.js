// server/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { getLocalIPs } = require('./utils/networkUtils');
const fs = require('fs');
const axios = require('axios');
const os = require('os');
const mongoose = require('mongoose');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});
const { spawn } = require('child_process');

// --- Custom Modules ---
const connectDB = require('./config/db');
const { performAssetCleanup } = require('./utils/assetCleanup');

// --- Configuration Loading ---
dotenv.config();

// --- Configuration Defaults & Variables ---
const DEFAULT_PORT = 5001;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/fusedChatbotDB';
const DEFAULT_PYTHON_RAG_URL = 'http://localhost:5002';

let port = process.env.PORT || DEFAULT_PORT;
let mongoUri = process.env.MONGO_URI || '';
let pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL || '';
let geminiApiKey = process.env.GEMINI_API_KEY || '';

// --- Express Application Setup ---
const app = express();

// --- Core Middleware ---
app.use(cors());
app.use(express.json());

// --- Basic Root Route ---
app.get('/', (req, res) => res.send('Fused Chatbot Backend API is running...'));

// --- API Route Mounting ---
app.use('/api/network', require('./routes/network'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/files', require('./routes/files'));
app.use('/api/upload', require('./routes/upload'));

// --- Centralized Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const statusCode = err.status || 500;
    let message = err.message || 'An internal server error occurred.';
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'An internal server error occurred.';
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(statusCode).json({ message: message });
    }
    res.status(statusCode).send(message);
});

// --- Server Instance Variable ---
let server;

// --- RAG Service Management ---
function startRagService() {
    return new Promise((resolve, reject) => {
        console.log('\nStarting RAG service...');
        const ragServicePath = path.join(__dirname, 'rag_service');
        
        // First, ensure Python dependencies are installed
        console.log('Checking Python dependencies...');
        const pipProcess = spawn('pip', ['install', '-r', 'requirements.txt'], {
            cwd: ragServicePath,
            stdio: 'pipe'
        });

        pipProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Failed to install Python dependencies');
                reject(new Error('Python dependencies installation failed'));
                return;
            }

            console.log('Python dependencies installed successfully');
            
            // Now start the RAG service
            const pythonProcess = spawn('python', ['app.py'], {
                cwd: ragServicePath,
                stdio: 'pipe'
            });

            let isStarted = false;
            let startupTimeout;
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`RAG Service: ${output}`);
                if (output.includes('Running on') && !isStarted) {
                    isStarted = true;
                    clearTimeout(startupTimeout);
                    console.log('✓ RAG service started successfully');
                    resolve(pythonProcess);
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                const error = data.toString();
                errorOutput += error;
                console.error(`RAG Service Error: ${error}`);
            });

            pythonProcess.on('close', (code) => {
                if (!isStarted) {
                    console.error('RAG service failed to start');
                    console.error('Error output:', errorOutput);
                    reject(new Error('RAG service failed to start'));
                }
            });

            // Set timeout for startup
            startupTimeout = setTimeout(() => {
                if (!isStarted) {
                    pythonProcess.kill();
                    reject(new Error('RAG service startup timed out'));
                }
            }, 30000); // 30 second timeout
        });
    });
}

// --- Graceful Shutdown Logic ---
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
                if (global.ragProcess) {
                    global.ragProcess.kill();
                    console.log('RAG service stopped.');
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
            if (global.ragProcess) {
                global.ragProcess.kill();
                console.log('RAG service stopped.');
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

// --- Directory Structure Check ---
async function ensureServerDirectories() {
    const dirs = [
        path.join(__dirname, 'assets'),
        path.join(__dirname, 'backup_assets'),
    ];
    console.log("\nEnsuring server directories exist...");
    try {
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
                console.log(`  Created directory: ${dir}`);
            }
        }
        console.log("✓ Server directories checked/created.");
    } catch (error) {
        console.error('!!! Error creating essential server directories:', error);
        throw error;
    }
}

// --- Prompt for Configuration ---
function askQuestion(query) {
    return new Promise(resolve => readline.question(query, resolve));
}

async function configureAndStart() {
    console.log("--- Starting Server Configuration ---");

    // 1. Gemini API Key Check
    if (!geminiApiKey) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FATAL: GEMINI_API_KEY environment variable is not set. !!!");
        console.error("!!! Please set it before running the server:               !!!");
        console.error("!!! export GEMINI_API_KEY='YOUR_API_KEY'                   !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    } else {
        console.log("✓ GEMINI_API_KEY found.");
    }

    // 2. MongoDB URI
    if (!mongoUri) {
        const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `);
        mongoUri = answer.trim() || DEFAULT_MONGO_URI;
    }
    console.log(`Using MongoDB URI: ${mongoUri}`);

    // 3. Python RAG Service URL
    if (!pythonRagUrl) {
        const answer = await askQuestion(`Enter Python RAG Service URL or press Enter for default (${DEFAULT_PYTHON_RAG_URL}): `);
        pythonRagUrl = answer.trim() || DEFAULT_PYTHON_RAG_URL;
    }
    console.log(`Using Python RAG Service URL: ${pythonRagUrl}`);

    // 4. Port
    console.log(`Node.js server will listen on port: ${port}`);

    readline.close();

    // --- Pass configuration to other modules ---
    process.env.MONGO_URI = mongoUri;
    process.env.PYTHON_RAG_SERVICE_URL = pythonRagUrl;

    console.log("--- Configuration Complete ---");

    // --- Proceed with Server Startup ---
    await startServer();
}

// --- Asynchronous Server Startup Function ---
async function startServer() {
    console.log("\n--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories();
        await connectDB(mongoUri);
        await performAssetCleanup();
        
        // Start RAG service
        try {
            global.ragProcess = await startRagService();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await checkRagService(pythonRagUrl);
        } catch (ragError) {
            console.error("Failed to start RAG service:", ragError);
            console.warn("Continuing without RAG service - some features may be limited");
        }

        const PORT = port;
        const availableIPs = getLocalIPs();

        server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=== Node.js Server Ready ===');
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log('   Access the application via these URLs (using common frontend ports):');
            const frontendPorts = [3000, 3001, 8080, 5173];
            availableIPs.forEach(ip => {
                frontendPorts.forEach(fp => {
                    console.log(`   - http://${ip}:${fp} (Frontend) -> Connects to Backend at http://${ip}:${PORT}`);
                });
            });
            console.log('============================\n');
            console.log("💡 Hint: Client automatically detects backend IP based on how you access the frontend.");
            console.log(`   Ensure firewalls allow connections on port ${PORT} (Backend) and your frontend port.`);
            console.log("--- Server Initialization Complete ---");
        });

    } catch (error) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! Failed to start Node.js server:", error.message);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    }
}

// --- Execute Configuration and Server Start ---
configureAndStart(); 