const express = require('express');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const VendorPayment = require('../models/VendorPayment');
const { ensureAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Create Razorpay order
router.post('/create-order', ensureAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Get order details
    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.user.id
    }).populate('items.vendorId');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Order is not pending payment' });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.totalAmount * 100), // Amount in paise
      currency: 'INR',
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        userId: req.session.user.id
      }
    });

    // Save payment record
    const payment = new Payment({
      orderId: order._id,
      userId: req.session.user.id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      status: 'created'
    });

    await payment.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify payment
router.post('/verify', ensureAuthenticated, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';

    // Calculate vendor payouts with commission
    const order = await Order.findById(payment.orderId).populate('items.vendorId');
    const vendorPayouts = [];

    // Group items by vendor
    const vendorGroups = {};
    order.items.forEach(item => {
      const vendorId = item.vendorId._id.toString();
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = {
          vendorId: item.vendorId._id,
          totalAmount: 0
        };
      }
      vendorGroups[vendorId].totalAmount += item.price * item.qty;
    });

    // Calculate commission and net amount for each vendor
    for (const vendorGroup of Object.values(vendorGroups)) {
      const commissionRate = 1.0; // 1% commission
      const commission = (vendorGroup.totalAmount * commissionRate) / 100;
      const netAmount = vendorGroup.totalAmount - commission;

      vendorPayouts.push({
        vendorId: vendorGroup.vendorId,
        amount: vendorGroup.totalAmount,
        commission: commission,
        netAmount: netAmount,
        status: 'pending'
      });
    }

    payment.vendorPayouts = vendorPayouts;
    await payment.save();

    // Update order status
    order.status = 'paid';
    order.paymentId = payment._id;
    await order.save();

    res.json({ 
      success: true, 
      message: 'Payment verified successfully',
      orderId: order._id 
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get payment details
router.get('/order/:orderId', ensureAuthenticated, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      orderId: req.params.orderId,
      userId: req.session.user.id
    }).populate('vendorPayouts.vendorId', 'storeName');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

// Vendor payment setup
router.post('/vendor/setup', ensureAuthenticated, async (req, res) => {
  try {
    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      upiId,
      panNumber,
      panName,
      gstNumber,
      gstName
    } = req.body;

    // Check if payment setup already exists
    let vendorPayment = await VendorPayment.findOne({ vendorId: vendor._id });
    
    if (vendorPayment) {
      // Update existing
      vendorPayment.bankDetails = {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        branchName
      };
      vendorPayment.upiDetails.upiId = upiId;
      vendorPayment.panDetails = {
        panNumber,
        panName
      };
      if (gstNumber) {
        vendorPayment.gstDetails = {
          gstNumber,
          gstName
        };
      }
      vendorPayment.verificationStatus = 'pending';
    } else {
      // Create new
      vendorPayment = new VendorPayment({
        vendorId: vendor._id,
        bankDetails: {
          accountHolderName,
          accountNumber,
          ifscCode,
          bankName,
          branchName
        },
        upiDetails: {
          upiId: upiId || ''
        },
        panDetails: {
          panNumber,
          panName
        },
        gstDetails: {
          gstNumber: gstNumber || '',
          gstName: gstName || ''
        }
      });
    }

    await vendorPayment.save();

    res.json({ 
      message: 'Payment details saved successfully',
      vendorPayment 
    });

  } catch (error) {
    console.error('Vendor payment setup error:', error);
    res.status(500).json({ error: 'Failed to save payment details' });
  }
});

// Get vendor payment details
router.get('/vendor/details', ensureAuthenticated, async (req, res) => {
  try {
    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const vendorPayment = await VendorPayment.findOne({ vendorId: vendor._id });

    res.json(vendorPayment || {});
  } catch (error) {
    console.error('Get vendor payment details error:', error);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

// Get vendor earnings
router.get('/vendor/earnings', ensureAuthenticated, async (req, res) => {
  try {
    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    // Get all payments for this vendor
    const payments = await Payment.find({
      'vendorPayouts.vendorId': vendor._id,
      status: 'paid'
    }).populate('orderId', 'createdAt');

    let totalEarnings = 0;
    let totalCommission = 0;
    let totalNetAmount = 0;
    const earningsHistory = [];

    payments.forEach(payment => {
      const vendorPayout = payment.vendorPayouts.find(
        payout => payout.vendorId.toString() === vendor._id.toString()
      );
      
      if (vendorPayout) {
        totalEarnings += vendorPayout.amount;
        totalCommission += vendorPayout.commission;
        totalNetAmount += vendorPayout.netAmount;
        
        earningsHistory.push({
          date: payment.createdAt,
          orderId: payment.orderId._id,
          amount: vendorPayout.amount,
          commission: vendorPayout.commission,
          netAmount: vendorPayout.netAmount,
          status: vendorPayout.status
        });
      }
    });

    res.json({
      totalEarnings,
      totalCommission,
      totalNetAmount,
      commissionRate: 1.0,
      earningsHistory: earningsHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
    });

  } catch (error) {
    console.error('Get vendor earnings error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

module.exports = router;