const { performance } = require('perf_hooks');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = performance.now();
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics
  res.end = function(...args) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log performance metrics
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration.toFixed(2)}ms`);
    
    // Add performance headers
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.set('X-Process-ID', process.pid);
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

// Memory usage monitoring
const memoryMonitor = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
  };
};

// CPU usage monitoring (simplified)
const cpuMonitor = () => {
  const usage = process.cpuUsage();
  return {
    user: usage.user,
    system: usage.system
  };
};

// Request metrics collector
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: 0,
      responses: {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0
      },
      averageResponseTime: 0,
      responseTimes: []
    };
  }

  recordRequest(statusCode, responseTime) {
    this.metrics.requests++;
    this.metrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times for memory efficiency
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
    }
    
    // Update response code counters
    const statusCategory = `${Math.floor(statusCode / 100)}xx`;
    if (this.metrics.responses[statusCategory] !== undefined) {
      this.metrics.responses[statusCategory]++;
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      memory: memoryMonitor(),
      cpu: cpuMonitor(),
      uptime: process.uptime()
    };
  }

  reset() {
    this.metrics = {
      requests: 0,
      responses: {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0
      },
      averageResponseTime: 0,
      responseTimes: []
    };
  }
}

const metricsCollector = new MetricsCollector();

// Enhanced performance middleware with metrics collection
const performanceMiddleware = (req, res, next) => {
  const startTime = performance.now();
  
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;
  
  let finished = false;
  
  const finishRequest = () => {
    if (finished) return;
    finished = true;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Record metrics
    metricsCollector.recordRequest(res.statusCode, duration);
    
    // Log performance (only in development or for slow requests, exclude monitoring endpoints)
    const isMonitoringEndpoint = req.originalUrl === '/health' || req.originalUrl === '/metrics';
    const shouldLog = !isMonitoringEndpoint && (process.env.NODE_ENV !== 'production' || duration > 1000);
    
    if (shouldLog) {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration.toFixed(2)}ms`);
    }
  };
  
  // Override end method
  res.end = function(...args) {
    finishRequest();
    originalEnd.apply(this, args);
  };
  
  // Override send method
  res.send = function(...args) {
    if (!finished && !res.headersSent) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      res.set('X-Process-ID', process.pid);
    }
    finishRequest();
    return originalSend.apply(this, args);
  };
  
  // Override json method
  res.json = function(...args) {
    if (!finished && !res.headersSent) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      res.set('X-Process-ID', process.pid);
    }
    finishRequest();
    return originalJson.apply(this, args);
  };
  
  next();
};

module.exports = {
  performanceMonitor,
  performanceMiddleware,
  memoryMonitor,
  cpuMonitor,
  metricsCollector,
  MetricsCollector
};