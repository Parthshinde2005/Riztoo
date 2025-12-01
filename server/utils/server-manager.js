const { spawn, fork } = require('child_process');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

class ServerManager {
  constructor(options = {}) {
    this.options = {
      mode: 'single',
      port: 3002,
      maxRetries: 3,
      retryDelay: 5000,
      healthCheckTimeout: 15000,
      ...options
    };
    this.serverProcess = null;
    this.retryCount = 0;
  }

  async start() {
    console.log(`🚀 Starting server in ${this.options.mode} mode on port ${this.options.port}`);
    
    try {
      await this.checkMongoDB();
      console.log('✅ MongoDB connection verified');
      
      await this.startServerProcess();
      await this.waitForServer();
      
      console.log('✅ Server started successfully!');
      console.log(`🌐 Access your application at: http://localhost:${this.options.port}`);
      
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      
      if (this.retryCount < this.options.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying in ${this.options.retryDelay / 1000} seconds... (${this.retryCount}/${this.options.maxRetries})`);
        
        setTimeout(() => {
          this.start();
        }, this.options.retryDelay);
      } else {
        console.error('❌ Max retries reached. Server startup failed.');
        process.exit(1);
      }
    }
  }

  async startServerProcess() {
    return new Promise((resolve, reject) => {
      let serverFile;
      let args = [];

      switch (this.options.mode) {
        case 'cluster':
          serverFile = path.join(__dirname, '../cluster.js');
          break;
        case 'dev':
          // Try nodemon first, fall back to node
          try {
            require.resolve('nodemon');
            this.serverProcess = spawn('npx', ['nodemon', 'server/server.js'], {
              stdio: 'inherit',
              env: { ...process.env, PORT: this.options.port }
            });
          } catch (e) {
            serverFile = path.join(__dirname, '../server.js');
          }
          break;
        default:
          serverFile = path.join(__dirname, '../server.js');
      }

      if (!this.serverProcess && serverFile) {
        this.serverProcess = fork(serverFile, args, {
          env: { ...process.env, PORT: this.options.port },
          silent: false
        });
      }

      if (this.serverProcess) {
        this.serverProcess.on('error', reject);
        this.serverProcess.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Server process exited with code ${code}`));
          }
        });

        // Give the process a moment to start
        setTimeout(resolve, 2000);
      } else {
        reject(new Error('Failed to start server process'));
      }
    });
  }

  async waitForServer() {
    const startTime = Date.now();
    const timeout = this.options.healthCheckTimeout;

    while (Date.now() - startTime < timeout) {
      try {
        await this.checkServerHealth();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Server health check timeout after ${timeout}ms`);
  }

  async checkServerHealth() {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${this.options.port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Health check request timeout'));
      });
    });
  }

  async checkMongoDB() {
    try {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/riztoo';
      await mongoose.connect(mongoUri);
      await mongoose.connection.db.admin().ping();
      await mongoose.disconnect();
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  async runLoadTest(options = {}) {
    const { url = 'http://localhost:3002', concurrency = 10, duration = 30000 } = options;
    
    console.log('🔥 Starting load test...');
    console.log(`📊 Target: ${url}`);
    console.log(`👥 Concurrency: ${concurrency}`);
    console.log(`⏱️  Duration: ${duration / 1000} seconds`);
    console.log('');

    const startTime = Date.now();
    const endTime = startTime + duration;
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const responseTimes = [];

    const makeRequest = () => {
      return new Promise((resolve) => {
        const requestStart = Date.now();
        
        const req = http.get(url, (res) => {
          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
          
          if (res.statusCode === 200) {
            successfulRequests++;
          } else {
            failedRequests++;
          }
          
          totalRequests++;
          resolve();
        });

        req.on('error', () => {
          failedRequests++;
          totalRequests++;
          resolve();
        });

        req.setTimeout(10000, () => {
          req.destroy();
          failedRequests++;
          totalRequests++;
          resolve();
        });
      });
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runWorker(makeRequest, endTime));
    }

    await Promise.all(workers);

    // Calculate statistics
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const requestsPerSecond = totalRequests / (duration / 1000);

    console.log('');
    console.log('📈 Load Test Results:');
    console.log('====================');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Failed: ${failedRequests}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`Requests/sec: ${requestsPerSecond.toFixed(2)}`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      console.log(`95th Percentile: ${p95}ms`);
      console.log(`99th Percentile: ${p99}ms`);
    }
  }

  async runWorker(makeRequest, endTime) {
    while (Date.now() < endTime) {
      await makeRequest();
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }
}

module.exports = ServerManager;