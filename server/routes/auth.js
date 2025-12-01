const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 }),
  body('role').isIn(['customer', 'vendor'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role, storeName, companyName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email,
      passwordHash,
      name,
      role
    });

    await user.save();

    // If vendor, create vendor profile
    if (role === 'vendor') {
      const vendor = new Vendor({
        userId: user._id,
        storeName: storeName || name + "'s Store",
        companyName: companyName || '',
        verified: false
      });
      await vendor.save();
    }

    // Set session
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    res.json({ message: 'Registration successful', user: req.session.user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    res.json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Guest login
router.post('/guest', async (req, res) => {
  try {
    const { role = 'customer' } = req.body;

    // Create temporary guest user
    const guestUser = new User({
      email: `guest_${Date.now()}@riztoo.temp`,
      passwordHash: await bcrypt.hash('guest123', 10),
      name: `Guest ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role: role,
      isGuest: true
    });

    await guestUser.save();

    // Set session
    req.session.user = {
      id: guestUser._id,
      email: guestUser.email,
      name: guestUser.name,
      role: guestUser.role,
      isGuest: true
    };

    res.json({ message: 'Guest session created', user: req.session.user });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ error: 'Guest login failed' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Check session
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;