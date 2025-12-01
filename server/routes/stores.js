const express = require('express');
const Vendor = require('../models/Vendor');

const router = express.Router();

// Get all stores (public endpoint)
router.get('/', async (req, res) => {
  try {
    const { verified, page = 1, limit = 20 } = req.query;
    
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
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get store by ID (public endpoint)
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate('userId', 'name email');

    if (!vendor) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

module.exports = router;