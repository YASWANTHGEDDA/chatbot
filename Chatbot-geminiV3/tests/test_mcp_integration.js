const axios = require('axios');
const assert = require('assert');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:5000/mcp';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://172.180.9.187:11435';

// Common headers for all requests
const headers = {
    'X-User-ID': 'test-user',
    'Content-Type': 'application/json'
};

async function testOllamaService() {
    console.log('Testing Ollama service availability...');
    try {
        const response = await axios.get(`${OLLAMA_URL}/api/version`);
        console.log('✅ Ollama service is available:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Ollama service is not available:', error.message);
        return false;
    }
}

async function testMCPRegistration() {
    console.log('\nTesting MCP service registration...');
    try {
        const response = await axios.get(`${MCP_SERVER_URL}/services`, { headers });
        const services = response.data;
        assert(Array.isArray(services), 'Services should be an array');
        const ollamaService = services.find(s => s.id === 'ollama');
        assert(ollamaService, 'Ollama service not registered');
        console.log('✅ MCP services registered:', services);
        return true;
    } catch (error) {
        console.error('❌ MCP service registration failed:', error.message);
        return false;
    }
}

async function testContextCreation() {
    console.log('\nTesting context creation...');
    try {
        const response = await axios.post(`${MCP_SERVER_URL}/contexts`, {
            serviceId: 'ollama'
        }, { headers });
        assert(response.data.contextId, 'No context ID returned');
        console.log('✅ Context created:', response.data.contextId);
        return response.data.contextId;
    } catch (error) {
        console.error('❌ Context creation failed:', error.message);
        return null;
    }
}

async function testChatMessage(contextId) {
    console.log('\nTesting chat message...');
    try {
        const response = await axios.post(`${MCP_SERVER_URL}/chat`, {
            contextId,
            message: 'Hello, how are you?',
            options: {
                model: 'qwen2.5:14b-instruct',
                temperature: 0.7
            }
        }, { headers });
        assert(response.data.answer, 'No answer in response');
        console.log('✅ Chat response received:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Chat message failed:', error.message);
        return false;
    }
}

async function testContextHistory(contextId) {
    console.log('\nTesting context history...');
    try {
        const response = await axios.get(`${MCP_SERVER_URL}/contexts/${contextId}/history`, { headers });
        assert(Array.isArray(response.data), 'History is not an array');
        console.log('✅ Context history retrieved:', response.data.length, 'messages');
        return true;
    } catch (error) {
        console.error('❌ Context history failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('Starting MCP Integration Tests...\n');

    // Test Ollama service
    const ollamaAvailable = await testOllamaService();
    if (!ollamaAvailable) {
        console.error('❌ Ollama service is required for tests');
        process.exit(1);
    }

    // Test MCP registration
    const registrationSuccess = await testMCPRegistration();
    if (!registrationSuccess) {
        console.error('❌ MCP registration is required for tests');
        process.exit(1);
    }

    // Test context creation
    const contextId = await testContextCreation();
    if (!contextId) {
        console.error('❌ Context creation is required for tests');
        process.exit(1);
    }

    // Test chat message
    const chatSuccess = await testChatMessage(contextId);
    if (!chatSuccess) {
        console.error('❌ Chat functionality is required');
        process.exit(1);
    }

    // Test context history
    const historySuccess = await testContextHistory(contextId);
    if (!historySuccess) {
        console.error('❌ Context history is required');
        process.exit(1);
    }

    console.log('\n✅ All tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
}); 