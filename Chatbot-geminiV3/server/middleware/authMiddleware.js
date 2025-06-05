// server/middleware/authMiddleware.js
const User = require('../models/User');

// TEMPORARY Authentication Middleware (INSECURE - for testing only)
const tempAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        console.warn("TempAuth Middleware: Missing X-User-ID header.");
        return res.status(401).json({ message: 'Unauthorized: Missing User ID header' });
    }

    // For testing purposes, accept any user ID
    req.user = { id: userId, username: 'test-user' };
    next();
};

// Export the temporary middleware
module.exports = { tempAuth };
