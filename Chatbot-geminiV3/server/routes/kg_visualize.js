const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// --- @route   GET /api/kg/visualize ---
// --- @desc    Proxies KG visualization data requests to the Python backend KG Service ---
// --- @access  Private (protected) ---
router.get('/', protect, async (req, res) => {
    const { filename } = req.query; // Expect filename as a query parameter
    const userId = req.user._id.toString(); // For logging or potential future use in KG service

    if (!filename) {
        return res.status(400).json({ message: 'Filename is required for KG visualization.' });
    }

    const pythonBackendUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
    const kgVisualizeUrl = `${pythonBackendUrl}/get_kg_data?filename=${encodeURIComponent(filename)}`;

    console.log(`Forwarding KG visualization request to Python backend: ${kgVisualizeUrl}`);
    try {
        const response = await axios.get(kgVisualizeUrl, { timeout: 60000 }); // 60 second timeout for KG data

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Error forwarding KG visualization request to Python backend:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to retrieve KG data for visualization.',
            error: error.message
        });
    }
});

module.exports = router; 