const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 100 to 200 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More reasonable rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased to 50 attempts per 15 minutes for better UX
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for logout, session check, and health requests
    const skipPaths = ['/logout', '/me'];
    return skipPaths.includes(req.path);
  }
});

// API rate limiter for heavy operations
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: 'API rate limit exceeded, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Speed limiter to slow down requests instead of blocking
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window at full speed
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // Maximum delay of 2 seconds
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    error: 'Upload limit exceeded, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter specifically for login attempts (POST requests)
const loginAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login attempts per 15 minutes
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to POST requests (actual login attempts)
    return req.method !== 'POST';
  }
});

// Monitoring endpoints rate limiter (more permissive but still controlled)
const monitoringLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (every 2 seconds max)
  message: {
    error: 'Monitoring rate limit exceeded, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for internal health checks
    const userAgent = req.get('User-Agent') || '';
    return userAgent.includes('node') || userAgent.includes('curl');
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  speedLimiter,
  uploadLimiter,
  loginAttemptLimiter,
  monitoringLimiter
};