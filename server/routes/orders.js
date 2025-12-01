const express = require('express');
const Order = require('../models/Order');
const VendorProduct = require('../models/VendorProduct');
const Payment = require('../models/Payment');
const { ensureAuthenticated, ensureAuthenticatedWithCache } = require('../middlewares/auth');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

const router = express.Router();

// Create order (with fallback for demo)
router.post('/create-order', ensureAuthenticated, async (req, res) => {
  try {
    const cart = req.session.cart;
    
    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate stock and calculate total with optimized query
    const vendorProductIds = cart.map(item => item.vendorProductId);
    const vendorProducts = await VendorProduct.find({ 
      _id: { $in: vendorProductIds } 
    }).populate('productId', 'name').populate('vendorId', 'storeName').lean(); // Use lean for better performance

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart) {
      const vendorProduct = vendorProducts.find(vp => vp._id.toString() === item.vendorProductId);
      
      if (!vendorProduct) {
        return res.status(400).json({ error: `Product ${item.productName} not found` });
      }

      if (vendorProduct.stock < item.qty) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.productName}. Available: ${vendorProduct.stock}` 
        });
      }

      const itemTotal = vendorProduct.price * item.qty;
      totalAmount += itemTotal;

      orderItems.push({
        vendorProductId: vendorProduct._id,
        productId: vendorProduct.productId._id,
        vendorId: vendorProduct.vendorId._id,
        price: vendorProduct.price,
        qty: item.qty,
        productName: vendorProduct.productId.name,
        storeName: vendorProduct.vendorId.storeName
      });
    }

    // Try Razorpay first, fallback to demo mode
    let razorpayOrder = null;
    let paymentType = 'demo';
    
    try {
      // Only try Razorpay if keys are properly configured
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_demo_key') {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100), // Amount in paise
          currency: 'INR',
          receipt: `order_${Date.now()}`,
          notes: {
            userId: req.session.user.id,
            itemCount: orderItems.length
          }
        });
        paymentType = 'razorpay';
      }
    } catch (razorpayError) {
      console.log('Razorpay not configured, using demo mode:', razorpayError.message);
    }

    // Create pending order in database
    const order = new Order({
      userId: req.session.user.id,
      items: orderItems,
      totalAmount,
      status: 'pending',
      paymentType: paymentType,
      razorpayOrderId: razorpayOrder?.id || `demo_${Date.now()}`
    });

    await order.save();

    if (paymentType === 'razorpay') {
      res.json({
        orderId: order._id,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID
      });
    } else {
      // Demo mode - simulate successful payment
      res.json({
        orderId: order._id,
        demoMode: true,
        amount: totalAmount,
        currency: 'INR',
        message: 'Demo mode - payment will be simulated'
      });
    }

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Demo checkout (for when Razorpay is not configured)
router.post('/demo-checkout', ensureAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.userId.toString() !== req.session.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update stock for all items (bulk operation for performance)
    const stockUpdates = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.vendorProductId },
        update: { $inc: { stock: -item.qty } }
      }
    }));

    await VendorProduct.bulkWrite(stockUpdates);

    // Update order status
    order.status = 'paid';
    order.razorpayPaymentId = `demo_payment_${Date.now()}`;
    order.paidAt = new Date();
    await order.save();

    // Process vendor payouts
    await processVendorPayouts(order);

    // Clear cart
    req.session.cart = [];

    res.json({ 
      message: 'Demo payment successful! Order completed.', 
      orderId: order._id 
    });

  } catch (error) {
    console.error('Demo checkout error:', error);
    res.status(500).json({ error: 'Demo checkout failed' });
  }
});

// Verify payment and complete order
router.post('/verify-payment', ensureAuthenticated, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId 
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Find and update order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update stock for all items
    const stockUpdates = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.vendorProductId },
        update: { $inc: { stock: -item.qty } }
      }
    }));

    await VendorProduct.bulkWrite(stockUpdates);

    // Update order status
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    await order.save();

    // Create payment record
    const payment = new Payment({
      orderId: order._id,
      userId: order.userId,
      amount: order.totalAmount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      status: 'completed'
    });
    await payment.save();

    // Process vendor payouts
    await processVendorPayouts(order);

    // Clear cart
    req.session.cart = [];

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId', 'name')
      .populate('items.vendorId', 'storeName');

    res.json({ 
      message: 'Payment verified and order completed', 
      order: populatedOrder 
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Process vendor payouts
async function processVendorPayouts(order) {
  try {
    const VendorPayment = require('../models/VendorPayment');
    
    // Group items by vendor
    const vendorGroups = {};
    order.items.forEach(item => {
      const vendorId = item.vendorId.toString();
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = [];
      }
      vendorGroups[vendorId].push(item);
    });

    // Create payout records for each vendor
    for (const [vendorId, items] of Object.entries(vendorGroups)) {
      const vendorTotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const commission = vendorTotal * 0.01; // 1% commission
      const vendorEarning = vendorTotal - commission;

      const payout = new Payment({
        orderId: order._id,
        vendorId: vendorId,
        amount: vendorEarning,
        commission: commission,
        status: 'pending_payout',
        type: 'vendor_payout'
      });

      await payout.save();
    }
  } catch (error) {
    console.error('Vendor payout processing error:', error);
  }
}

// Get user orders (optimized)
router.get('/my-orders', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.session.user.id })
      .populate('items.productId', 'name category images')
      .populate('items.vendorId', 'storeName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance

    const totalOrders = await Order.countDocuments({ userId: req.session.user.id });

    res.json({
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page < Math.ceil(totalOrders / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:orderId', ensureAuthenticated, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.session.user.id
    })
    .populate('items.productId', 'name category images')
    .populate('items.vendorId', 'storeName companyName');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get vendor orders (optimized)
router.get('/vendor/my-orders', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    const Vendor = require('../models/Vendor');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const vendor = await Vendor.findOne({ userId: req.session.user.id }).lean();
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    // Optimized aggregation pipeline
    const vendorOrders = await Order.aggregate([
      {
        $match: {
          'items.vendorId': vendor._id,
          status: { $ne: 'pending' } // Only show completed orders
        }
      },
      {
        $addFields: {
          items: {
            $filter: {
              input: '$items',
              cond: { $eq: ['$$this.vendorId', vendor._id] }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'productmasters',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'products',
          pipeline: [{ $project: { name: 1, category: 1 } }]
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const totalOrders = await Order.countDocuments({
      'items.vendorId': vendor._id,
      status: { $ne: 'pending' }
    });

    res.json({
      orders: vendorOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page < Math.ceil(totalOrders / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get vendor orders error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor orders' });
  }
});

// Get vendor orders (alias for profile page)
router.get('/vendor-orders', ensureAuthenticated, async (req, res) => {
  try {
    // Check if user is a vendor
    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    // Find orders containing vendor's products
    const orders = await Order.find({
      'items.vendorId': vendor._id
    })
    .populate('userId', 'name email')
    .populate('items.productId', 'name category')
    .sort({ createdAt: -1 });

    // Filter items to show only vendor's products
    const vendorOrders = orders.map(order => ({
      ...order.toObject(),
      items: order.items.filter(item => item.vendorId.toString() === vendor._id.toString())
    }));

    res.json(vendorOrders);
  } catch (error) {
    console.error('Get vendor orders error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor orders' });
  }
});

module.exports = router;