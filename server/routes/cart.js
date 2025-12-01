const express = require('express');
const VendorProduct = require('../models/VendorProduct');

const router = express.Router();

// Add item to cart
router.post('/add', async (req, res) => {
  try {
    const { vendorProductId, qty = 1 } = req.body;

    // Validate vendor product exists and has stock
    const vendorProduct = await VendorProduct.findById(vendorProductId)
      .populate('productId')
      .populate('vendorId', 'storeName');

    if (!vendorProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (vendorProduct.stock < qty) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Initialize cart if not exists
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Check if item already in cart
    const existingItemIndex = req.session.cart.findIndex(
      item => item.vendorProductId === vendorProductId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      req.session.cart[existingItemIndex].qty += parseInt(qty);
    } else {
      // Add new item
      req.session.cart.push({
        vendorProductId,
        productId: vendorProduct.productId._id,
        vendorId: vendorProduct.vendorId._id,
        qty: parseInt(qty),
        price: vendorProduct.price,
        productName: vendorProduct.productId.name,
        storeName: vendorProduct.vendorId.storeName
      });
    }

    res.json({ message: 'Item added to cart', cart: req.session.cart });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Remove item from cart
router.post('/remove', (req, res) => {
  try {
    const { vendorProductId } = req.body;

    if (!req.session.cart) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    req.session.cart = req.session.cart.filter(
      item => item.vendorProductId !== vendorProductId
    );

    res.json({ message: 'Item removed from cart', cart: req.session.cart });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Update cart item quantity
router.post('/update', (req, res) => {
  try {
    const { vendorProductId, qty } = req.body;

    if (!req.session.cart) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const itemIndex = req.session.cart.findIndex(
      item => item.vendorProductId === vendorProductId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (qty <= 0) {
      req.session.cart.splice(itemIndex, 1);
    } else {
      req.session.cart[itemIndex].qty = parseInt(qty);
    }

    res.json({ message: 'Cart updated', cart: req.session.cart });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Get cart
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  res.json({ 
    cart, 
    total,
    itemCount: cart.reduce((sum, item) => sum + item.qty, 0)
  });
});

// Clear cart
router.post('/clear', (req, res) => {
  req.session.cart = [];
  res.json({ message: 'Cart cleared' });
});

module.exports = router;