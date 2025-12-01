const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const VendorProduct = require('../models/VendorProduct');
const Report = require('../models/Report');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

// Admin dashboard stats
router.get('/dashboard', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments({ role: 'customer' }),
      totalVendors: await Vendor.countDocuments(),
      unverifiedVendors: await Vendor.countDocuments({ verified: false }),
      totalProducts: await VendorProduct.countDocuments(),
      pendingReports: await Report.countDocuments({ handled: false })
    };

    res.json(stats);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get unverified vendors
router.get('/vendors/unverified', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vendors = await Vendor.find({ verified: false })
      .populate('userId', 'name email createdAt')
      .sort({ createdAt: -1 });

    res.json(vendors);
  } catch (error) {
    console.error('Get unverified vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch unverified vendors' });
  }
});

// Get all vendors
router.get('/vendors', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, verified } = req.query;
    
    let query = {};
    if (verified !== undefined) {
      query.verified = verified === 'true';
    }

    const vendors = await Vendor.find(query)
      .populate('userId', 'name email createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Vendor.countDocuments(query);

    res.json({
      vendors,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// Verify vendor
router.post('/vendors/:id/verify', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { verified: true },
      { new: true }
    ).populate('userId', 'name email');

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({ message: 'Vendor verified successfully', vendor });
  } catch (error) {
    console.error('Verify vendor error:', error);
    res.status(500).json({ error: 'Failed to verify vendor' });
  }
});

// Reject vendor
router.post('/vendors/:id/reject', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Delete vendor and associated user
    await VendorProduct.deleteMany({ vendorId: vendor._id });
    await User.findByIdAndDelete(vendor.userId);
    await Vendor.findByIdAndDelete(vendor._id);

    res.json({ message: 'Vendor rejected and deleted successfully' });
  } catch (error) {
    console.error('Reject vendor error:', error);
    res.status(500).json({ error: 'Failed to reject vendor' });
  }
});

// Delete vendor
router.delete('/vendors/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { deleteProducts = false } = req.query;
    
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Delete vendor products if requested
    if (deleteProducts === 'true') {
      await VendorProduct.deleteMany({ vendorId: vendor._id });
    }

    // Delete vendor and user
    await User.findByIdAndDelete(vendor.userId);
    await Vendor.findByIdAndDelete(vendor._id);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// Get all reports
router.get('/reports', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, handled } = req.query;
    
    let query = {};
    if (handled !== undefined) {
      query.handled = handled === 'true';
    }

    const reports = await Report.find(query)
      .populate('reporterUserId', 'name email')
      .populate('vendorId', 'storeName companyName')
      .populate('vendorProductId', 'price')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Take action on report
router.post('/reports/:id/action', ensureAuthenticated, ensureAdmin, [
  body('actionTaken').trim().isLength({ min: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { actionTaken } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { 
        handled: true, 
        actionTaken 
      },
      { new: true }
    )
    .populate('reporterUserId', 'name email')
    .populate('vendorId', 'storeName companyName')
    .populate('vendorProductId', 'price');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Action recorded successfully', report });
  } catch (error) {
    console.error('Report action error:', error);
    res.status(500).json({ error: 'Failed to record action' });
  }
});

// Get all users
router.get('/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    
    let query = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete user
router.delete('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If vendor, delete vendor profile and products
    if (user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: user._id });
      if (vendor) {
        await VendorProduct.deleteMany({ vendorId: vendor._id });
        await Vendor.findByIdAndDelete(vendor._id);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;