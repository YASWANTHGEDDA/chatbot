const axios = require('axios');
const assert = require('assert');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:5000';

async function testHealthCheck() {
    console.log('Testing server health check...');
    try {
        const response = await axios.get(`${MCP_SERVER_URL}/health`);
        assert(response.data.status === 'ok', 'Health check failed');
        console.log('✅ Server health check passed');
        return true;
    } catch (error) {
        console.error('❌ Server health check failed:', error.message);
        return false;
    }
}

async function testNetworkTimeout() {
    console.log('\nTesting network timeout handling...');
    try {
        // Intentionally use a very short timeout
        await axios.get(`${MCP_SERVER_URL}/health`, { timeout: 1 });
        console.error('❌ Timeout test failed: Request did not timeout');
        return false;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log('✅ Network timeout handled correctly');
            return true;
        }
        console.error('❌ Unexpected error during timeout test:', error.message);
        return false;
    }
}

async function testSignUp() {
    console.log('\nTesting sign up...');
    try {
        const testUser = {
            username: `testuser_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            password: 'Test@123'
        };

        const response = await axios.post(`${MCP_SERVER_URL}/auth/register`, testUser);
        assert(response.data.user, 'No user data in response');
        console.log('✅ Sign up successful');
        return testUser;
    } catch (error) {
        console.error('❌ Sign up failed:', error.response?.data?.message || error.message);
        return null;
    }
}

async function testSignIn(credentials) {
    console.log('\nTesting sign in...');
    try {
        const response = await axios.post(`${MCP_SERVER_URL}/auth/login`, credentials);
        assert(response.data.token, 'No token in response');
        console.log('✅ Sign in successful');
        return response.data.token;
    } catch (error) {
        console.error('❌ Sign in failed:', error.response?.data?.message || error.message);
        return null;
    }
}

async function testAuthenticatedRequest(token) {
    console.log('\nTesting authenticated request...');
    try {
        const response = await axios.get(`${MCP_SERVER_URL}/services`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert(response.data, 'No data in response');
        console.log('✅ Authenticated request successful');
        return true;
    } catch (error) {
        console.error('❌ Authenticated request failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testInvalidToken() {
    console.log('\nTesting invalid token handling...');
    try {
        await axios.get(`${MCP_SERVER_URL}/services`, {
            headers: { Authorization: 'Bearer invalid_token' }
        });
        console.error('❌ Invalid token test failed: Request should have been rejected');
        return false;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Invalid token handled correctly');
            return true;
        }
        console.error('❌ Unexpected error during invalid token test:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('Starting Authentication Integration Tests...\n');

    // Test server health
    const healthCheckPassed = await testHealthCheck();
    if (!healthCheckPassed) {
        console.error('❌ Health check is required for tests');
        process.exit(1);
    }

    // Test network timeout handling
    const timeoutTestPassed = await testNetworkTimeout();
    if (!timeoutTestPassed) {
        console.error('❌ Timeout handling is required for tests');
        process.exit(1);
    }

    // Test sign up
    const testUser = await testSignUp();
    if (!testUser) {
        console.error('❌ Sign up is required for tests');
        process.exit(1);
    }

    // Test sign in
    const token = await testSignIn({
        email: testUser.email,
        password: testUser.password
    });
    if (!token) {
        console.error('❌ Sign in is required for tests');
        process.exit(1);
    }

    // Test authenticated request
    const authRequestPassed = await testAuthenticatedRequest(token);
    if (!authRequestPassed) {
        console.error('❌ Authenticated requests are required');
        process.exit(1);
    }

    // Test invalid token handling
    const invalidTokenTestPassed = await testInvalidToken();
    if (!invalidTokenTestPassed) {
        console.error('❌ Invalid token handling is required');
        process.exit(1);
    }

    console.log('\n✅ All authentication tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
}); 