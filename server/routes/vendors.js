const express = require('express');
const { body, validationResult } = require('express-validator');
const Vendor = require('../models/Vendor');
const VendorProduct = require('../models/VendorProduct');
const ProductMaster = require('../models/ProductMaster');
const { ensureAuthenticated, ensureAuthenticatedWithCache, ensureVendor } = require('../middlewares/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const upload = require('../middlewares/multer');

const router = express.Router();

// Get vendor profile
router.get('/me', ensureAuthenticatedWithCache, ensureVendor, cacheMiddleware.vendorProfile, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.session.user.id })
      .populate('userId', 'name email');

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Get vendor profile error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor profile' });
  }
});

// Get vendor store info (alias for /me for profile page)
router.get('/my-store', ensureAuthenticated, ensureVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.session.user.id })
      .populate('userId', 'name email');

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Get vendor store info error:', error);
    res.status(500).json({ error: 'Failed to fetch store information' });
  }
});

// Update vendor profile
router.put('/me', ensureAuthenticated, ensureVendor, upload.array('images', 5), [
  body('storeName').trim().isLength({ min: 2 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { storeName, companyName, description, address, city, state, pincode } = req.body;
    
    const updateData = {
      storeName,
      companyName: companyName || '',
      description: description || '',
      location: {
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || ''
      }
    };

    // Add uploaded images
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `/uploads/${file.filename}`);
    }

    const vendor = await Vendor.findOneAndUpdate(
      { userId: req.session.user.id },
      updateData,
      { new: true }
    );

    res.json({ message: 'Vendor profile updated', vendor });
  } catch (error) {
    console.error('Update vendor profile error:', error);
    res.status(500).json({ error: 'Failed to update vendor profile' });
  }
});

// Create vendor product
router.post('/products', ensureAuthenticated, ensureVendor, upload.array('images', 5), [
  body('price').isNumeric().withMessage('Price must be a valid number').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
  body('stock').isNumeric().withMessage('Stock must be a valid number').isInt({ min: 0 }).withMessage('Stock cannot be negative'),
  body('productId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid product ID'),
  body('productName').optional().trim().isLength({ min: 2 }).withMessage('Product name must be at least 2 characters'),
  body('category').optional().trim().isLength({ min: 2 }).withMessage('Category must be at least 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Product creation validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed', 
        errors: errors.array(),
        details: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    // Check if vendor is verified
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    if (!vendor.verified) {
      return res.status(403).json({ error: 'Vendor account not verified' });
    }

    const { price, stock, productId, productName, category, description, companyName } = req.body;
    
    let masterProductId = productId;

    // If no productId provided, create new product master
    if (!productId && productName && category) {
      const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const newProduct = new ProductMaster({
        name: productName,
        slug: `${slug}-${Date.now()}`,
        category,
        description: description || '',
        images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
      });

      await newProduct.save();
      masterProductId = newProduct._id;
    }

    if (!masterProductId) {
      return res.status(400).json({ error: 'Product ID or product details required' });
    }

    // Create vendor product
    const vendorProduct = new VendorProduct({
      vendorId: vendor._id,
      productId: masterProductId,
      companyName: companyName || vendor.companyName || '',
      price: parseFloat(price),
      stock: parseInt(stock),
      images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
    });

    await vendorProduct.save();

    const populatedProduct = await VendorProduct.findById(vendorProduct._id)
      .populate('productId')
      .populate('vendorId', 'storeName');

    res.json({ message: 'Product created successfully', product: populatedProduct });
  } catch (error) {
    console.error('Create vendor product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Get vendor's products
router.get('/products', ensureAuthenticated, ensureVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    const products = await VendorProduct.find({ vendorId: vendor._id })
      .populate('productId')
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Update vendor product
router.put('/products/:id', ensureAuthenticated, ensureVendor, upload.array('images', 5), [
  body('price').optional().isNumeric().withMessage('Price must be a valid number').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
  body('stock').optional().isNumeric().withMessage('Stock must be a valid number').isInt({ min: 0 }).withMessage('Stock cannot be negative')
], async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    const product = await VendorProduct.findOne({
      _id: req.params.id,
      vendorId: vendor._id
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { price, stock, companyName } = req.body;
    
    const updateData = {};
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (companyName !== undefined) updateData.companyName = companyName;

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `/uploads/${file.filename}`);
    }

    const updatedProduct = await VendorProduct.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('productId');

    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Update vendor product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete vendor product
router.delete('/products/:id', ensureAuthenticated, ensureVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    const product = await VendorProduct.findOneAndDelete({
      _id: req.params.id,
      vendorId: vendor._id
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete vendor product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get vendor by ID (public)
router.get('/:vendorId/products', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const products = await VendorProduct.find({ vendorId: vendor._id })
      .populate('productId')
      .sort({ createdAt: -1 });

    res.json({
      vendor: {
        _id: vendor._id,
        storeName: vendor.storeName,
        companyName: vendor.companyName,
        description: vendor.description,
        location: vendor.location,
        verified: vendor.verified
      },
      products
    });
  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor products' });
  }
});

module.exports = router;