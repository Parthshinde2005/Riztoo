const compression = require('compression');

// Custom compression middleware with optimized settings
const compressionMiddleware = compression({
  // Only compress responses that are larger than 1kb
  threshold: 1024,
  
  // Compression level (1-9, 6 is default, higher = better compression but slower)
  level: 6,
  
  // Only compress these MIME types
  filter: (req, res) => {
    // Don't compress if the request includes a Cache-Control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }

    // Use compression filter function
    return compression.filter(req, res);
  },

  // Custom compression for different content types
  chunkSize: 16 * 1024, // 16KB chunks
  windowBits: 15,
  memLevel: 8
});

module.exports = compressionMiddleware;