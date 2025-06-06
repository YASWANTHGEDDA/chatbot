// server/middleware/authMiddleware.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT Authentication Middleware
const protect = async (req, res, next) => {
  let token;

  // --- TEMP LOG: Check JWT_SECRET status ---
  if (!process.env.JWT_SECRET) {
      console.error("!!! AUTH MIDDLEWARE: JWT_SECRET environment variable is NOT set. Token verification will fail.");
  } else {
      console.log("AUTH MIDDLEWARE: JWT_SECRET is set.");
  }
  // --- END TEMP LOG ---

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.warn("Auth Middleware: No token found in Authorization header.");
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Auth Middleware: Token decoded successfully.", decoded);

    // Find user by ID from token payload
    // We select '-password' to exclude password from the user object
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      console.warn(`Auth Middleware: User not found for decoded ID: ${decoded.id}`);
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user; // Attach user to the request object
    next();

  } catch (error) {
    console.error('Auth Middleware: Token verification failed:', error.message);
    // Log specific errors for debugging, but send generic 401 to client
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authorized, token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

// Export the new authentication middleware
module.exports = { protect };
