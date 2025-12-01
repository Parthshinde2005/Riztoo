const express = require('express');
const ProductMaster = require('../models/ProductMaster');
const VendorProduct = require('../models/VendorProduct');
const Review = require('../models/Review');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Get all products with vendor listings
router.get('/', cacheMiddleware.products, async (req, res) => {
  try {
    const { q, category, vendorId, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (category) query.category = new RegExp(category, 'i');
    if (q) query.name = new RegExp(q, 'i');

    const products = await ProductMaster.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Get vendor products for each product
    const productsWithVendors = await Promise.all(
      products.map(async (product) => {
        let vendorQuery = { productId: product._id };
        if (vendorId) vendorQuery.vendorId = vendorId;

        const vendorProducts = await VendorProduct.find(vendorQuery)
          .populate('vendorId', 'storeName companyName verified');

        return {
          ...product.toObject(),
          vendorListings: vendorProducts
        };
      })
    );

    res.json(productsWithVendors);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID with vendor listings and reviews
router.get('/:id', async (req, res) => {
  try {
    const product = await ProductMaster.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const vendorProducts = await VendorProduct.find({ productId: product._id })
      .populate('vendorId', 'storeName companyName verified location');

    const reviews = await Review.find({ productId: product._id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.json({
      ...product.toObject(),
      vendorListings: vendorProducts,
      reviews
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get vendor product details
router.get('/vendor-products/:id', async (req, res) => {
  try {
    const vendorProduct = await VendorProduct.findById(req.params.id)
      .populate('productId')
      .populate('vendorId', 'storeName companyName verified location');

    if (!vendorProduct) {
      return res.status(404).json({ error: 'Vendor product not found' });
    }

    res.json(vendorProduct);
  } catch (error) {
    console.error('Get vendor product error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor product' });
  }
});

// Get vendor's own products (for profile page)
router.get('/my-products', async (req, res) => {
  try {
    // Check if user is authenticated and is a vendor
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.session.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied. Vendor role required.' });
    }

    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findOne({ userId: req.session.user.id });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const products = await VendorProduct.find({ vendorId: vendor._id })
      .populate('productId')
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Search products in master catalog
router.get('/search/master', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const products = await ProductMaster.find({
      name: new RegExp(q, 'i')
    }).limit(10);

    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;