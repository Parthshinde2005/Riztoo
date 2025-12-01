// In-memory cache for user sessions to reduce database calls
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    // Cache user data in request for subsequent middleware
    req.user = req.session.user;
    
    // Update cache with fresh session data
    const cacheKey = `user_${req.session.user.id}`;
    userCache.set(cacheKey, {
      data: req.session.user,
      timestamp: Date.now()
    });
    
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Enhanced auth with caching
function ensureAuthenticatedWithCache(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.session.user.id;
  const cacheKey = `user_${userId}`;
  const cached = userCache.get(cacheKey);

  // Check if we have valid cached data
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    req.user = cached.data;
    return next();
  }

  // Use session data and update cache
  req.user = req.session.user;
  userCache.set(cacheKey, {
    data: req.session.user,
    timestamp: Date.now()
  });

  next();
}

// Clear user from cache (call when user data changes)
function clearUserCache(userId) {
  const cacheKey = `user_${userId}`;
  userCache.delete(cacheKey);
}

function ensureRole(role) {
  return (req, res, next) => {
    if (req.session?.user?.role === role) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

function ensureAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

function ensureVendor(req, res, next) {
  if (req.session?.user?.role === 'vendor') {
    return next();
  }
  return res.status(403).json({ error: 'Vendor access required' });
}

module.exports = {
  ensureAuthenticated,
  ensureAuthenticatedWithCache,
  ensureRole,
  ensureAdmin,
  ensureVendor,
  clearUserCache
};