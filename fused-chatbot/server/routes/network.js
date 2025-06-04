const express = require('express');
const router = express.Router();
const { getLocalIPs } = require('../utils/networkUtils');

/**
 * @route   GET /api/network/ips
 * @desc    Get all local IP addresses
 * @access  Public
 */
router.get('/ips', (req, res) => {
    try {
        const ips = getLocalIPs();
        res.json({ ips });
    } catch (error) {
        console.error('Error getting IP addresses:', error);
        res.status(500).json({ error: 'Failed to get IP addresses' });
    }
});

module.exports = router; 