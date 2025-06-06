const axios = require('axios');
const { PYTHON_RAG_SERVICE_URL } = require('../config'); // Assuming config has the RAG service URL

/**
 * Queries the Python RAG service for relevant documents based on a user query.
 * @param {string} query - The user's search query.
 * @param {string} userId - The ID of the user performing the query.
 * @returns {Promise<Array<Object>>} - A promise that resolves with an array of relevant document chunks.
 * @throws {Error} - Throws an error if the RAG service call fails.
 */
const queryPythonRagService = async (query, userId) => {
    if (!PYTHON_RAG_SERVICE_URL) {
        console.error('PYTHON_RAG_SERVICE_URL is not defined in config.');
        throw new Error('RAG service URL not configured.');
    }

    try {
        const response = await axios.post(`${PYTHON_RAG_SERVICE_URL}/query`, {
            query: query,
            user_id: userId // Pass user_id to the Python service
        });

        if (response.status !== 200 || !response.data || !Array.isArray(response.data.relevant_chunks)) {
             console.error('Invalid response from Python RAG service /query:', response.status, response.data);
             throw new Error('Invalid response format from RAG service.');
        }

        console.log(`RAG service /query successful: ${response.data.relevant_chunks.length} chunks found.`);
        return response.data.relevant_chunks; // Assuming the Python service returns an object with a relevant_chunks array

    } catch (error) {
        console.error(`Error calling Python RAG service /query for user ${userId}:`, error.message);
        // Rethrow a more descriptive error
        throw new Error(`Failed to query RAG service: ${error.message}`);
    }
};

// You might also want functions for triggering document processing here:

/**
 * Triggers the Python RAG service to process a new document.
 * @param {string} filename - The name of the file to process.
 * @param {string} filePath - The absolute path to the file on the server.
 * @param {string} userId - The ID of the user who uploaded the file.
 * @returns {Promise<Object>} - A promise that resolves with the RAG service response.
 * @throws {Error} - Throws an error if the RAG service call fails.
 */
const addDocumentToRagService = async (filename, filePath, userId) => {
    if (!PYTHON_RAG_SERVICE_URL) {
        console.error('PYTHON_RAG_SERVICE_URL is not defined in config.');
        throw new Error('RAG service URL not configured.');
    }

    try {
        const response = await axios.post(`${PYTHON_RAG_SERVICE_URL}/add_document`, {
            filename: filename,
            file_path: filePath, // Python service needs access to this path
            user_id: userId // Pass user_id to the Python service
        });

        if (response.status !== 200 || !response.data) {
             console.error('Invalid response from Python RAG service /add_document:', response.status, response.data);
             throw new Error('Invalid response from RAG service document add.');
        }

        console.log(`RAG service /add_document successful for ${filename}.`);
        return response.data;

    } catch (error) {
        console.error(`Error calling Python RAG service /add_document for ${filename} (user ${userId}):`, error.message);
        // Rethrow a more descriptive error
        throw new Error(`Failed to add document to RAG service: ${error.message}`);
    }
};


module.exports = {
    queryPythonRagService,
    addDocumentToRagService
}; 