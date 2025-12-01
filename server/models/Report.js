const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  vendorProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorProduct'
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: String,
    trim: true
  },
  handled: {
    type: Boolean,
    default: false
  },
  actionTaken: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);