const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { ensureAuthenticated, ensureAuthenticatedWithCache } = require('../middlewares/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

const router = express.Router();

// Create review
router.post('/', ensureAuthenticatedWithCache, [
  body('orderId').isMongoId(),
  body('productId').isMongoId(),
  body('vendorId').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, productId, vendorId, rating, comment } = req.body;

    // Verify user has purchased this product
    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.user.id,
      status: 'paid'
    });

    if (!order) {
      return res.status(400).json({ error: 'Order not found or not paid' });
    }

    // Check if product is in the order
    const orderItem = order.items.find(item => 
      item.productId.toString() === productId && 
      item.vendorId.toString() === vendorId
    );

    if (!orderItem) {
      return res.status(400).json({ error: 'Product not found in this order' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      userId: req.session.user.id,
      orderId,
      productId,
      vendorId
    });

    if (existingReview) {
      return res.status(400).json({ error: 'Review already exists for this product' });
    }

    // Create review
    const review = new Review({
      userId: req.session.user.id,
      orderId,
      productId,
      vendorId,
      vendorProductId: orderItem.vendorProductId,
      rating: parseInt(rating),
      comment: comment || ''
    });

    await review.save();

    // Invalidate review cache for this product
    invalidateCache.reviews(productId);

    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name')
      .populate('productId', 'name')
      .populate('vendorId', 'storeName');

    res.json({ message: 'Review created successfully', review: populatedReview });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get reviews for a product (public - vendors and customers can see)
router.get('/product/:productId', cacheMiddleware.reviews, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const reviews = await Review.find({ productId: req.params.productId })
      .populate('userId', 'name')
      .populate('vendorId', 'storeName')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await Review.countDocuments({ productId: req.params.productId });

    // Calculate rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { productId: mongoose.Types.ObjectId(req.params.productId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    res.json({
      reviews,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      ratingDistribution: ratingStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        hasNext: page < Math.ceil(totalReviews / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews for vendor's products
router.get('/vendor/my-reviews', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id }).lean();
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ vendorId: vendor._id })
      .populate('userId', 'name')
      .populate('productId', 'name')
      .populate('orderId', 'createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await Review.countDocuments({ vendorId: vendor._id });

    // Calculate vendor's average rating
    const avgRating = await Review.aggregate([
      { $match: { vendorId: vendor._id } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    res.json({
      reviews,
      averageRating: avgRating.length > 0 ? Math.round(avgRating[0].averageRating * 10) / 10 : 0,
      totalReviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        hasNext: page < Math.ceil(totalReviews / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor reviews' });
  }
});

// Get user's reviews
router.get('/my-reviews', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.session.user.id })
      .populate('productId', 'name')
      .populate('vendorId', 'storeName')
      .populate('orderId', 'createdAt')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Update review
router.put('/:reviewId', ensureAuthenticatedWithCache, [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, comment } = req.body;

    const review = await Review.findOne({
      _id: req.params.reviewId,
      userId: req.session.user.id
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const updateData = {};
    if (rating !== undefined) updateData.rating = parseInt(rating);
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.reviewId,
      updateData,
      { new: true }
    )
    .populate('userId', 'name')
    .populate('productId', 'name')
    .populate('vendorId', 'storeName');

    res.json({ message: 'Review updated successfully', review: updatedReview });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete review
router.delete('/:reviewId', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({
      _id: req.params.reviewId,
      userId: req.session.user.id
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;