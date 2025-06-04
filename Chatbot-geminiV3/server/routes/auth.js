// server/routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();

// --- @route   POST /api/auth/signup ---
// --- @desc    Register a new user with role ---
// --- @access  Public ---
router.post('/signup', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  if (!['mentor', 'mentee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be mentor, mentee, or admin.' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = new User({ username, password, role });
    await newUser.save();

    const sessionId = uuidv4();

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      sessionId: sessionId,
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

    const sessionId = uuidv4();

    res.status(200).json({
      _id: user._id,
      username: user.username,
      role: user.role,
      sessionId: sessionId,
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
