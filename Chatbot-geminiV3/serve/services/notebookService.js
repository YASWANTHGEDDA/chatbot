const axios = require('axios');

// Configuration
const NOTEBOOK_BACKEND_URL = process.env.NOTEBOOK_BACKEND_URL || 'http://localhost:5000';

class NotebookService {
    constructor() {
        this.notebookUrl = NOTEBOOK_BACKEND_URL;
    }

    async queryNotebook(userId, query) {
        try {
            const response = await axios.post(`${this.notebookUrl}/chat`, {
                user_id: userId,
                query: query
            });

            if (response.data && response.data.answer) {
                return {
                    answer: response.data.answer,
                    references: response.data.references || [],
                    thinking: response.data.thinking || null
                };
            }
            throw new Error('Invalid response format from Notebook backend');
        } catch (error) {
            console.error('Error querying Notebook backend:', error);
            throw error;
        }
    }

    async updateKnowledgeGraph(graphData) {
        try {
            const response = await axios.post(`${this.notebookUrl}/kg/update`, {
                graph_data: graphData
            });

            return response.data;
        } catch (error) {
            console.error('Error updating knowledge graph:', error);
            throw error;
        }
    }
}

module.exports = new NotebookService(); 