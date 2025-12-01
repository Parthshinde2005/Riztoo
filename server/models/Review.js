const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductMaster',
    required: true,
    index: true
  },
  vendorProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorProduct',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for better performance
reviewSchema.index({ productId: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ vendorId: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate reviews for same order item
reviewSchema.index({ userId: 1, orderId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);