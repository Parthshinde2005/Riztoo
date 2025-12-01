const NodeCache = require('node-cache');

// Create cache instances with different TTL for different data types
const caches = {
  // Short-term cache for frequently changing data (1 minute)
  short: new NodeCache({ stdTTL: 60, checkperiod: 30 }),
  
  // Medium-term cache for semi-static data (5 minutes)
  medium: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
  
  // Long-term cache for static data (15 minutes)
  long: new NodeCache({ stdTTL: 900, checkperiod: 120 }),
  
  // User session cache (30 minutes)
  session: new NodeCache({ stdTTL: 1800, checkperiod: 300 })
};

// Cache middleware factory
const createCacheMiddleware = (cacheType = 'medium', keyGenerator = null) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req) 
      : `${req.originalUrl}_${req.session?.user?.id || 'anonymous'}`;

    // Try to get from cache
    const cachedData = caches[cacheType].get(cacheKey);
    
    if (cachedData) {
      console.log(`Cache HIT: ${cacheKey}`);
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Cache SET: ${cacheKey}`);
        caches[cacheType].set(cacheKey, data);
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// Specific cache middleware for different routes
const cacheMiddleware = {
  // Products cache (medium-term)
  products: createCacheMiddleware('medium', (req) => {
    const { page = 1, limit = 10, category, search } = req.query;
    return `products_${page}_${limit}_${category || 'all'}_${search || 'none'}`;
  }),

  // Stores cache (medium-term)
  stores: createCacheMiddleware('medium', (req) => {
    const { page = 1, limit = 10 } = req.query;
    return `stores_${page}_${limit}`;
  }),

  // Reviews cache (short-term)
  reviews: createCacheMiddleware('short', (req) => {
    const { productId } = req.params;
    const { page = 1, sortBy = 'createdAt', rating } = req.query;
    return `reviews_${productId}_${page}_${sortBy}_${rating || 'all'}`;
  }),

  // Vendor products cache (short-term)
  vendorProducts: createCacheMiddleware('short', (req) => {
    const userId = req.session?.user?.id;
    return `vendor_products_${userId}`;
  }),

  // User profile cache (session-based)
  userProfile: createCacheMiddleware('session', (req) => {
    const userId = req.session?.user?.id;
    return `user_profile_${userId}`;
  }),

  // Vendor profile cache (session-based)
  vendorProfile: createCacheMiddleware('session', (req) => {
    const userId = req.session?.user?.id;
    return `vendor_profile_${userId}`;
  })
};

// Cache invalidation helpers
const invalidateCache = {
  // Invalidate product-related caches
  products: () => {
    caches.medium.flushAll();
    console.log('Products cache invalidated');
  },

  // Invalidate user-specific caches
  user: (userId) => {
    const patterns = [
      `user_profile_${userId}`,
      `vendor_profile_${userId}`,
      `vendor_products_${userId}`
    ];
    
    patterns.forEach(pattern => {
      caches.session.del(pattern);
      caches.short.del(pattern);
    });
    console.log(`User cache invalidated for: ${userId}`);
  },

  // Invalidate review caches for a product
  reviews: (productId) => {
    const keys = caches.short.keys();
    const reviewKeys = keys.filter(key => key.startsWith(`reviews_${productId}`));
    reviewKeys.forEach(key => caches.short.del(key));
    console.log(`Review cache invalidated for product: ${productId}`);
  },

  // Clear all caches
  all: () => {
    Object.values(caches).forEach(cache => cache.flushAll());
    console.log('All caches cleared');
  }
};

// Cache statistics
const getCacheStats = () => {
  return {
    short: caches.short.getStats(),
    medium: caches.medium.getStats(),
    long: caches.long.getStats(),
    session: caches.session.getStats()
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  getCacheStats,
  caches
};