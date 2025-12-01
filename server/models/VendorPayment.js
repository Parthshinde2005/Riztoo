const mongoose = require('mongoose');

const vendorPaymentSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    unique: true,
    index: true
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    branchName: {
      type: String
    }
  },
  upiDetails: {
    upiId: {
      type: String
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  panDetails: {
    panNumber: {
      type: String,
      required: true
    },
    panName: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  gstDetails: {
    gstNumber: {
      type: String
    },
    gstName: {
      type: String
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  commissionRate: {
    type: Number,
    default: 1.0, // 1% commission
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VendorPayment', vendorPaymentSchema);