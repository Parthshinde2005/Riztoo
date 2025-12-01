const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

// Optimized server configuration
const createOptimizedServer = () => {
  const app = express();

  // Trust proxy for better performance behind load balancers
  app.set('trust proxy', 1);

  // Disable unnecessary Express features for better performance
  app.disable('x-powered-by');
  app.set('etag', 'strong'); // Enable strong ETags for better caching

  // High-performance compression
  app.use(compression({
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress files larger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) return false;
      // Use compression filter
      return compression.filter(req, res);
    }
  }));

  // Optimized security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdn.tailwindcss.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Optimized static file serving with aggressive caching
  app.use(express.static(path.join(__dirname, '../../client/public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Cache static assets aggressively
      if (path.endsWith('.css') || path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Cache images for a week
      if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
      // Cache HTML files for a short time
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));

  // Optimized uploads serving
  app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d',
    etag: true,
    lastModified: true
  }));

  return app;
};

module.exports = { createOptimizedServer };