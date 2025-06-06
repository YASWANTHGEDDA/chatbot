// server/routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// Helper function to generate a JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
};

// --- @route   POST /api/auth/signup ---
// --- @desc    Register a new user with role ---
// --- @access  Public ---
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    // Generate JWT token (without role)
    const token = generateToken(newUser._id, null);

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      token: token, // Send JWT token instead of sessionId
      message: 'User registered successfully',
    });

  } catch (error) {
    console.error('Signup Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already exists.' });
    }
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// --- @route   POST /api/auth/signin ---
// --- @desc    Authenticate user (with role check) ---
// --- @access  Public ---
router.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }

  try {
    const user = await User.findByCredentials(username, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token (without role)
    const token = generateToken(user._id, null);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      token: token, // Send JWT token instead of sessionId
      message: 'Login successful',
    });

  } catch (error) {
    console.error('Signin Error:', error);
    if (error.message === "Password field not available for comparison.") {
      return res.status(500).json({ message: 'Internal server configuration error during signin.' });
    }
    res.status(500).json({ message: 'Server error during signin' });
  }
});

module.exports = router;
