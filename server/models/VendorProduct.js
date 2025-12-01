const mongoose = require('mongoose');

const vendorProductSchema = new mongoose.Schema({
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
  companyName: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  images: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for better query performance
vendorProductSchema.index({ vendorId: 1, isActive: 1 });
vendorProductSchema.index({ productId: 1, isActive: 1 });
vendorProductSchema.index({ price: 1, stock: 1 });
vendorProductSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('VendorProduct', vendorProductSchema);