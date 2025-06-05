const axios = require('axios');

const MCP_SERVER_URL = 'http://localhost:5000/mcp';
const OLLAMA_URL = 'http://172.180.9.187:11435';
const headers = {
    'X-User-ID': 'test-user',
    'Content-Type': 'application/json'
};

async function checkServices() {
    console.log('\nChecking service availability...');
    
    // Check Ollama
    try {
        const ollamaResponse = await axios.get(`${OLLAMA_URL}/api/version`);
        console.log('✅ Ollama service:', ollamaResponse.data);
    } catch (error) {
        console.error('❌ Ollama service error:', error.message);
        throw new Error('Ollama service is not available');
    }

    // Check MCP server
    try {
        const mcpResponse = await axios.get(`${MCP_SERVER_URL}/services`, { headers });
        console.log('✅ MCP services:', mcpResponse.data);
    } catch (error) {
        console.error('❌ MCP server error:', error.message);
        throw new Error('MCP server is not available');
    }
}

async function testIntegration() {
    console.log('Testing KG+Notebook Integration with Chatbot-geminiV3...\n');

    try {
        // Check services first
        await checkServices();

        // 1. Create a new context
        console.log('\n1. Creating new context...');
        const contextResponse = await axios.post(`${MCP_SERVER_URL}/contexts`, {
            serviceId: 'ollama',
            data: {
                type: 'chat',
                model: 'llama2'
            }
        }, { headers });
        const contextId = contextResponse.data.contextId;
        console.log('✅ Context created:', contextId);

        // 2. Send a test message that should trigger KG+Notebook
        console.log('\n2. Sending test message...');
        const messageResponse = await axios.post(`${MCP_SERVER_URL}/chat`, {
            contextId,
            message: 'What can you tell me about the knowledge graph?',
            options: {
                model: 'llama2',
                temperature: 0.7,
                useKG: true  // Enable KG integration
            }
        }, { headers });
        console.log('✅ Response received:', JSON.stringify(messageResponse.data, null, 2));

        // 3. Check context history
        console.log('\n3. Checking context history...');
        const historyResponse = await axios.get(`${MCP_SERVER_URL}/contexts/${contextId}/history`, { headers });
        console.log('✅ Context history:', JSON.stringify(historyResponse.data, null, 2));

        // 4. Clean up
        console.log('\n4. Cleaning up...');
        await axios.delete(`${MCP_SERVER_URL}/contexts/${contextId}`, { headers });
        console.log('✅ Context cleaned up');

        console.log('\n✅ Integration test completed successfully!');
    } catch (error) {
        console.error('\n❌ Integration test failed:', error.message);
        if (error.response) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response status:', error.response.status);
            console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
        }
        process.exit(1);
    }
}

// Run the test
testIntegration(); 