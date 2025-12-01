const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'attempted', 'paid', 'failed', 'cancelled'],
    default: 'created'
  },
  paymentMethod: {
    type: String
  },
  failureReason: {
    type: String
  },
  vendorPayouts: [{
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    commission: {
      type: Number,
      required: true
    },
    netAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    },
    processedAt: Date
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);