const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: [{
    vendorProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorProduct',
      required: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductMaster',
      required: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    },
    price: {
      type: Number,
      required: true
    },
    qty: {
      type: Number,
      required: true,
      min: 1
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentType: {
    type: String,
    default: 'razorpay'
  },
  razorpayOrderId: {
    type: String,
    index: true
  },
  razorpayPaymentId: {
    type: String
  },
  paidAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'items.vendorId': 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);