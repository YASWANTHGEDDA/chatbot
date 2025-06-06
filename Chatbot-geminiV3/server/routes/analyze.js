const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// --- @route   POST /api/llm/analyze ---
// --- @desc    Proxies analysis requests to the Python backend LLM Service ---
// --- @access  Private (protected) ---
router.post('/', protect, async (req, res) => {
    const { filename, analysis_type, llm_preference } = req.body;
    const userId = req.user._id.toString();

    if (!filename || !analysis_type) {
        return res.status(400).json({ message: 'Filename and analysis type are required.' });
    }

    const pythonBackendUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
    const analyzeUrl = `${pythonBackendUrl}/analyze`;

    console.log(`Forwarding analysis request to Python backend: ${analyzeUrl}`);
    try {
        const response = await axios.post(analyzeUrl, {
            user_id: userId,
            filename: filename,
            analysis_type: analysis_type,
            llm_preference: llm_preference // Pass LLM preference
        }, { timeout: 300000 }); // 5 minute timeout for analysis

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Error forwarding analysis request to Python backend:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to perform analysis.',
            error: error.message
        });
    }
});

module.exports = router; 