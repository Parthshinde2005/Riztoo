const express = require('express');
const OptimizedQueries = require('../utils/optimized-queries');
const { cacheMiddleware } = require('../middleware/cache');
const { ensureAuthenticatedWithCache } = require('../middlewares/auth');

const router = express.Router();

// Optimized product listing with aggressive caching
router.get('/', cacheMiddleware.products, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, vendorId } = req.query;
    
    // Use optimized aggregation query
    const products = await OptimizedQueries.getProductsWithVendors(
      { category, search, vendorId },
      { page: parseInt(page), limit: parseInt(limit) }
    );

    // Set cache headers for client-side caching
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"products-${page}-${category || 'all'}-${search || 'none'}"`
    });

    res.json(products);
  } catch (error) {
    console.error('Optimized products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Optimized single product with reviews
router.get('/:productId', cacheMiddleware.reviews, async (req, res) => {
  try {
    const { productId } = req.params;
    const { reviewPage = 1, reviewLimit = 5 } = req.query;

    // Parallel queries for better performance
    const [product, reviewData] = await Promise.all([
      require('../models/ProductMaster').findById(productId).lean(),
      OptimizedQueries.getProductReviews(productId, {
        page: parseInt(reviewPage),
        limit: parseInt(reviewLimit)
      })
    ]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Combine data
    const result = {
      ...product,
      reviews: reviewData.reviews,
      reviewStats: reviewData.statistics
    };

    // Set cache headers
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes
      'ETag': `"product-${productId}-${reviewPage}"`
    });

    res.json(result);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Optimized product search with autocomplete
router.get('/search/autocomplete', cacheMiddleware.products, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Fast text search using indexes
    const suggestions = await require('../models/ProductMaster').aggregate([
      {
        $match: {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } }
          ]
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          _id: 1
        }
      },
      { $limit: 10 },
      {
        $group: {
          _id: null,
          products: { $push: { name: '$name', id: '$_id' } },
          categories: { $addToSet: '$category' }
        }
      }
    ]);

    const result = suggestions[0] || { products: [], categories: [] };

    // Aggressive caching for autocomplete
    res.set({
      'Cache-Control': 'public, max-age=1800', // 30 minutes
      'ETag': `"autocomplete-${q}"`
    });

    res.json(result);
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Optimized bulk product operations for vendors
router.post('/bulk-update', ensureAuthenticatedWithCache, async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, price, stock }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates array' });
    }

    // Batch update for better performance
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { 
          _id: update.id,
          vendorId: req.user.vendorId // Ensure vendor owns the product
        },
        update: {
          ...(update.price && { price: update.price }),
          ...(update.stock !== undefined && { stock: update.stock }),
          updatedAt: new Date()
        }
      }
    }));

    const result = await require('../models/VendorProduct').bulkWrite(bulkOps);

    // Invalidate related caches
    require('../middleware/cache').invalidateCache.products();

    res.json({
      message: 'Products updated successfully',
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

module.exports = router;