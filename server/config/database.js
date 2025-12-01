const mongoose = require('mongoose');

// Optimized MongoDB connection with connection pooling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Optimized connection pool settings
      maxPoolSize: 50, // Increased for better concurrency
      minPoolSize: 10, // Higher minimum to avoid connection delays
      maxIdleTimeMS: 60000, // Keep connections alive longer
      serverSelectionTimeoutMS: 3000, // Faster server selection
      socketTimeoutMS: 30000, // Reduced socket timeout
      connectTimeoutMS: 10000, // Connection timeout
      heartbeatFrequencyMS: 10000, // More frequent heartbeats
      
      // Performance optimizations
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
      // Compression for better network performance
      compressors: ['zlib'],
      zlibCompressionLevel: 1, // Faster compression
      
      // Read preferences for better performance
      readPreference: 'primaryPreferred',
      readConcern: { level: 'local' },
      writeConcern: { w: 1, j: false }, // Faster writes
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Disable mongoose buffering for better performance
    mongoose.set('bufferCommands', false);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected from MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Database health check
const checkDBHealth = async () => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();
    return { status: 'healthy', ping: result };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};

module.exports = {
  connectDB,
  checkDBHealth
};