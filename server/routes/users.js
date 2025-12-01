const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Report = require('../models/Report');
const { ensureAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Get user profile
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    // Users can only access their own profile
    if (req.params.id !== req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/:id', ensureAuthenticated, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    // Users can only update their own profile
    if (req.params.id !== req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name;
    if (email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updateData.email = email;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-passwordHash');

    // Update session
    if (name) req.session.user.name = name;
    if (email) req.session.user.email = email;

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Report vendor/store
router.post('/:id/report', ensureAuthenticated, [
  body('vendorId').isMongoId(),
  body('reason').trim().isLength({ min: 5 }),
  body('details').optional().trim(),
  body('vendorProductId').optional().isMongoId()
], async (req, res) => {
  try {
    // Users can only create reports from their own account
    if (req.params.id !== req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendorId, reason, details, vendorProductId } = req.body;

    // Check if user has already reported this vendor
    const existingReport = await Report.findOne({
      reporterUserId: req.session.user.id,
      vendorId,
      vendorProductId: vendorProductId || null
    });

    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this vendor/product' });
    }

    const report = new Report({
      reporterUserId: req.session.user.id,
      vendorId,
      vendorProductId: vendorProductId || undefined,
      reason,
      details: details || ''
    });

    await report.save();

    const populatedReport = await Report.findById(report._id)
      .populate('reporterUserId', 'name email')
      .populate('vendorId', 'storeName companyName')
      .populate('vendorProductId', 'price');

    res.json({ message: 'Report submitted successfully', report: populatedReport });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Get user's reports
router.get('/:id/reports', ensureAuthenticated, async (req, res) => {
  try {
    // Users can only access their own reports
    if (req.params.id !== req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reports = await Report.find({ reporterUserId: req.session.user.id })
      .populate('vendorId', 'storeName companyName')
      .populate('vendorProductId', 'price')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Get user reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

module.exports = router;