const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import custom middleware and config
const { connectDB, checkDBHealth } = require('./config/database');
const compressionMiddleware = require('./middleware/compression');
const { generalLimiter, authLimiter, apiLimiter, speedLimiter, loginAttemptLimiter, monitoringLimiter } = require('./middleware/rateLimiter');
const { smartAuthLimiter } = require('./middleware/smartAuthLimiter');
// const { authRequestLogger } = require('./utils/rate-limit-debug');
const { getCacheStats, invalidateCache } = require('./middleware/cache');
const { performanceMiddleware, metricsCollector } = require('./middleware/performance');

const app = express();

// Trust proxy for load balancer
app.set('trust proxy', 1);

// Compression middleware (should be early in the stack)
app.use(compressionMiddleware);

// CORS configuration for better cross-origin support
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware - More permissive for development
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development to allow Tailwind CDN
  crossOriginEmbedderPolicy: false
}));

// Apply speed limiter to all requests
app.use(speedLimiter);

// Apply general rate limiter
app.use(generalLimiter);

// Performance monitoring
app.use(performanceMiddleware);

// Body parsing middleware with size limits
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000
}));

// Static files
app.use(express.static(path.join(__dirname, '../client/public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Optimized session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600, // Lazy session update
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native', // Let MongoDB handle expired session removal
    stringify: false, // Better performance
    serialize: (session) => JSON.stringify(session),
    unserialize: (session) => JSON.parse(session)
  }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  },
  rolling: true, // Reset expiration on activity
  name: 'riztoo.sid' // Custom session name
}));

// Cache for health and metrics data
let healthCache = null;
let metricsCache = null;
let healthCacheTime = 0;
let metricsCacheTime = 0;
const CACHE_DURATION = 10000; // 10 seconds cache

// Lightweight health check endpoint
app.get('/health', monitoringLimiter, async (req, res) => {
  const now = Date.now();

  // Return cached data if still valid
  if (healthCache && (now - healthCacheTime) < CACHE_DURATION) {
    return res.json(healthCache);
  }

  try {
    // Quick health check without expensive DB operations
    const memoryUsage = process.memoryUsage();

    healthCache = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
      },
      pid: process.pid
    };
    healthCacheTime = now;

    res.json(healthCache);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check endpoint (includes database check)
app.get('/health/detailed', monitoringLimiter, async (req, res) => {
  try {
    const dbHealth = await checkDBHealth();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
      },
      pid: process.pid
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint with caching and rate limiting
app.get('/metrics', monitoringLimiter, (req, res) => {
  const now = Date.now();

  // Return cached data if still valid
  if (metricsCache && (now - metricsCacheTime) < CACHE_DURATION) {
    return res.json(metricsCache);
  }

  const metrics = metricsCollector.getMetrics();
  metricsCache = {
    ...metrics,
    timestamp: new Date().toISOString(),
    pid: process.pid
  };
  metricsCacheTime = now;

  res.json(metricsCache);
});

// Routes with specific rate limiting and caching
app.use('/auth', smartAuthLimiter, require('./routes/auth'));
app.use('/users', apiLimiter, require('./routes/users'));
app.use('/vendors', apiLimiter, require('./routes/vendors'));
app.use('/products', apiLimiter, require('./routes/products'));
app.use('/cart', apiLimiter, require('./routes/cart'));
app.use('/orders', apiLimiter, require('./routes/orders'));
app.use('/reviews', apiLimiter, require('./routes/reviews'));
app.use('/stores', apiLimiter, require('./routes/stores'));
app.use('/admin', authLimiter, require('./routes/admin'));
app.use('/payments', apiLimiter, require('./routes/payments'));
app.use('/support', apiLimiter, require('./routes/support'));

// Serve login pages
app.get('/login/user', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login-user.html'));
});

app.get('/login/vendor', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login-vendor.html'));
});

app.get('/login/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login-admin.html'));
});

// Server status page
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/server-status.html'));
});

// Vendor dashboard (alias for optimized version)
app.get('/vendor-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/optimized-vendor-dashboard.html'));
});

// Cache statistics endpoint (for monitoring)
app.get('/cache-stats', (req, res) => {
  try {
    const { getCacheStats } = require('./middleware/cache');
    res.json(getCacheStats());
  } catch (error) {
    res.json({ error: 'Cache stats not available' });
  }
});

// Cache management endpoint
app.post('/admin/clear-cache', authLimiter, (req, res) => {
  // Clear health and metrics cache
  healthCache = null;
  metricsCache = null;
  healthCacheTime = 0;
  metricsCacheTime = 0;

  // Clear application caches
  try {
    const { invalidateCache } = require('./middleware/cache');
    invalidateCache.all();
  } catch (error) {
    console.log('Application cache not available');
  }

  // Reset metrics collector if needed
  if (metricsCollector && typeof metricsCollector.reset === 'function') {
    metricsCollector.reset();
  }

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    const PORT = process.env.PORT || 3002;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Application: http://localhost:${PORT}`);
      console.log(`👷 Worker PID: ${process.pid}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();