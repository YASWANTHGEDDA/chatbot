# Chatbot with Gemini and Ollama Integration

This project integrates the Chatbot-geminiV3 with the Ollama service using the Multi-Context Protocol (MCP).

## Integration Structure

```
Chatbot-geminiV3/
├── server/
│   ├── config/
│   │   └── mcp.js           # MCP configuration
│   └── mcp/
│       └── protocol.js      # MCP protocol implementation
└── client/
    └── src/
        └── services/
            └── mcpService.js # Client-side MCP service

Notebook/
└── backend/
    ├── app.py              # Main Ollama service
    └── ai_core.py          # Core AI functionality
```

## Prerequisites

1. Ollama service running at `http://172.18.9.187:11435`
2. Node.js and npm installed
3. Python 3.8+ for Notebook backend

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Create a `.env` file in the root directory:
   ```
   MCP_SERVER_URL=http://localhost:5000
   OLLAMA_URL=http://172.18.9.187:11435
   ```

3. Start the MCP server:
   ```bash
   npm run dev
   ```

## Testing the Integration

1. Run the integration tests:
   ```bash
   npm test
   ```

2. The test suite will verify:
   - Ollama service availability
   - MCP service registration
   - Context creation
   - Chat functionality
   - Context history

## Using the Integration

1. Initialize the MCP service:
   ```javascript
   import mcpService from './services/mcpService';

   // Initialize
   await mcpService.initialize();

   // Send a message
   const response = await mcpService.sendMessage('Hello, how are you?', {
       model: 'qwen2.5:14b-instruct',
       temperature: 0.7
   });

   // Get context history
   const history = await mcpService.getContextHistory();

   // Clear context when done
   await mcpService.clearContext();
   ```

## Features

1. **Multi-Context Protocol (MCP)**:
   - Service registration and health checks
   - Context management
   - Request routing
   - Response formatting

2. **Ollama Integration**:
   - LLM capabilities
   - RAG functionality
   - Knowledge Graph generation
   - Document analysis

3. **Client Features**:
   - Easy-to-use service interface
   - Context management
   - Error handling
   - Response formatting

## Troubleshooting

1. If Ollama service is not available:
   - Check if Ollama is running at the correct URL
   - Verify network connectivity
   - Check Ollama service logs

2. If MCP registration fails:
   - Verify MCP server is running
   - Check service configuration
   - Review server logs

3. If chat functionality fails:
   - Check context creation
   - Verify message format
   - Review error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

```env
PORT=5001 # Port for the backend (make sure it's free)
MONGO_URI=mongodb://localhost:27017/chatbot_gemini # Your MongoDB connection string
JWT_SECRET=your_super_strong_and_secret_jwt_key_12345! # A strong, random secret key for JWT
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY_HERE # Your actual Gemini API Key
NOTEBOOK_BACKEND_URL=http://localhost:5000 # URL of the Notebook backend
```
*   **MONGO_URI:**
    *   For local MongoDB: `mongodb://localhost:27017/chatbot_gemini` (or your chosen DB name).
    *   For MongoDB Atlas: Get the connection string from your Atlas cluster (replace `<password>` and specify your database name). Example: `mongodb+srv://<username>:<password>@yourcluster.mongodb.net/chatbot_gemini?retryWrites=true&w=majority`
*   **JWT_SECRET:** Generate a strong random string for security.
*   **GEMINI_API_KEY:** Paste the key you obtained from Google AI Studio.
*   **NOTEBOOK_BACKEND_URL:** The URL where your Notebook backend is running (default: http://localhost:5000)
