const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * @route   POST /api/chat/message
 * @desc    Send a message to the chat
 * @access  Public
 */
router.post('/message', async (req, res) => {
    try {
        const { message, context } = req.body;

        // Validate input
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Call RAG service
        const ragResponse = await axios.post(
            `${process.env.PYTHON_RAG_SERVICE_URL}/chat`,
            {
                query: message,
                context: context || '',
                llm: 'gemini'  // or get from request
            }
        );

        res.json(ragResponse.data);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

/**
 * @route   POST /api/chat/analyze
 * @desc    Analyze a document
 * @access  Public
 */
router.post('/analyze', async (req, res) => {
    try {
        const { text, type } = req.body;

        // Validate input
        if (!text || !type) {
            return res.status(400).json({ error: 'Text and analysis type are required' });
        }

        // Call RAG service
        const ragResponse = await axios.post(
            `${process.env.PYTHON_RAG_SERVICE_URL}/analyze`,
            { text, type }
        );

        res.json(ragResponse.data);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze document' });
    }
});

module.exports = router; 