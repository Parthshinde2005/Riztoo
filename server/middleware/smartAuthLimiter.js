const rateLimit = require('express-rate-limit');

// Create different rate limiters for different auth operations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login attempts per 15 minutes
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  message: {
    error: 'Too many registration attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const guestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 guest sessions per 5 minutes
  message: {
    error: 'Too many guest session requests, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 session checks per minute
  message: {
    error: 'Too many session requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Smart middleware that applies appropriate rate limiting based on the endpoint
const smartAuthLimiter = (req, res, next) => {
  const path = req.path;
  const method = req.method;

  // Apply specific rate limiting based on endpoint
  if (path === '/login' && method === 'POST') {
    return loginLimiter(req, res, next);
  } else if (path === '/register' && method === 'POST') {
    return registerLimiter(req, res, next);
  } else if (path === '/guest' && method === 'POST') {
    return guestLimiter(req, res, next);
  } else if (path === '/me' && method === 'GET') {
    return sessionLimiter(req, res, next);
  } else if (path === '/logout' && method === 'GET') {
    // No rate limiting for logout - users should always be able to logout
    return next();
  } else {
    // Default rate limiting for other auth endpoints
    const defaultLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 requests per 15 minutes for other operations
      message: {
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    return defaultLimiter(req, res, next);
  }
};

module.exports = {
  smartAuthLimiter,
  loginLimiter,
  registerLimiter,
  guestLimiter,
  sessionLimiter
};