#!/usr/bin/env node

require('dotenv').config();
const ServerManager = require('./server/utils/server-manager');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'single';

async function main() {
  console.log('🚀 Riztoo E-commerce Platform Launcher');
  console.log('=====================================');
  console.log('');

  try {
    switch (mode.toLowerCase()) {
      case 'single':
        await startServer('single');
        break;
        
      case 'cluster':
        await startServer('cluster');
        break;
        
      case 'dev':
        await startServer('dev');
        break;
        
      case 'dev:watch':
        await startDevWithWatcher();
        break;
        
      case 'docker':
        await startDocker();
        break;
        
      case 'load-test':
        await runLoadTest();
        break;
        
      case 'fix':
        await fixCommonIssues();
        break;
        
      case 'health':
        await checkHealth();
        break;
        
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function startServer(serverMode) {
  const port = process.env.PORT || args[1] || 3002;
  
  const manager = new ServerManager({
    mode: serverMode,
    port: parseInt(port),
    maxRetries: 3,
    retryDelay: 5000,
    healthCheckTimeout: 15000
  });

  await manager.start();
}

async function startDocker() {
  console.log('🐳 Starting Docker containers...');
  console.log('Building and starting all services...');
  
  const dockerCompose = spawn('docker-compose', ['up', '--build'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  dockerCompose.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Docker containers started successfully');
    } else {
      console.log(`❌ Docker Compose exited with code ${code}`);
    }
  });
}

async function runLoadTest() {
  const url = args[1] || 'http://localhost:3002';
  const concurrency = parseInt(args[2]) || 10;
  const duration = parseInt(args[3]) || 30000;
  
  const manager = new ServerManager();
  await manager.runLoadTest({ url, concurrency, duration });
}

async function fixCommonIssues() {
  console.log('🔧 Running diagnostic and fix utility...');
  console.log('');
  
  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`📋 Node.js version: ${nodeVersion}`);
  
  if (parseInt(nodeVersion.slice(1)) < 16) {
    console.log('⚠️  Warning: Node.js 16+ is recommended');
  } else {
    console.log('✅ Node.js version is compatible');
  }
  
  // Check npm packages
  console.log('📦 Checking npm packages...');
  try {
    const { execSync } = require('child_process');
    execSync('npm list --depth=0', { stdio: 'pipe' });
    console.log('✅ All npm packages are installed');
  } catch (error) {
    console.log('⚠️  Some npm packages may be missing');
    console.log('💡 Run: npm install');
  }
  
  // Check MongoDB
  console.log('🔌 Checking MongoDB connection...');
  try {
    const manager = new ServerManager();
    await manager.checkMongoDB();
  } catch (error) {
    console.log('❌ MongoDB connection failed');
    console.log('💡 Make sure MongoDB is running: mongod');
  }
  
  // Check port availability
  const port = process.env.PORT || 3002;
  console.log(`🔌 Checking port ${port} availability...`);
  
  const net = require('net');
  const server = net.createServer();
  
  try {
    await new Promise((resolve, reject) => {
      server.listen(port, () => {
        server.close();
        resolve();
      });
      server.on('error', reject);
    });
    console.log(`✅ Port ${port} is available`);
  } catch (error) {
    console.log(`❌ Port ${port} is in use`);
    console.log('💡 Try a different port or stop the process using this port');
  }
  
  console.log('');
  console.log('🎯 Diagnostic complete!');
}

async function startDevWithWatcher() {
  console.log('🛠️  Starting development server with file watcher...');
  
  const DevWatcher = require('./server/utils/dev-watcher');
  const watcher = new DevWatcher({
    serverFile: 'server/server.js',
    watchDirs: ['server', 'client/public'],
    debounceTime: 1000
  });
  
  watcher.start();
}

async function checkHealth() {
  const port = process.env.PORT || args[1] || 3002;
  const url = `http://localhost:${port}/health`;
  
  console.log(`🏥 Checking server health at ${url}...`);
  
  const http = require('http');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.get(url, resolve);
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
    
    let body = '';
    response.on('data', chunk => body += chunk);
    
    await new Promise(resolve => response.on('end', resolve));
    
    if (response.statusCode === 200) {
      console.log('✅ Server is healthy');
      const healthData = JSON.parse(body);
      console.log(`📊 Uptime: ${Math.floor(healthData.uptime / 60)} minutes`);
      console.log(`💾 Memory: ${healthData.memory.heapUsed}`);
      console.log(`🔢 Process ID: ${healthData.pid}`);
    } else {
      console.log(`❌ Server returned status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log('❌ Server is not responding');
    console.log('💡 Make sure the server is running');
  }
}

function showHelp() {
  console.log(`
Usage: node start.js [mode] [options]

Modes:
  single      Start single server instance (default)
  cluster     Start server in cluster mode (uses all CPU cores)
  dev         Start development server (tries nodemon, falls back to node)
  dev:watch   Start development server with custom file watcher
  docker      Start using Docker Compose with load balancer
  load-test   Run load test against the server
  fix         Run diagnostic and fix common issues
  health      Check server health status
  help        Show this help message

Examples:
  node start.js single                    # Single instance
  node start.js cluster                   # Cluster mode
  node start.js dev                       # Development mode (auto-detects nodemon)
  node start.js dev:watch                 # Development with custom file watcher
  node start.js docker                    # Docker with load balancer
  node start.js load-test                 # Load test localhost:3002
  node start.js load-test http://localhost:3002 20 60000  # Custom load test
  node start.js fix                       # Diagnose and fix issues
  node start.js health                    # Check server health

Load Test Options:
  [url]         Target URL (default: http://localhost:3002)
  [concurrency] Number of concurrent requests (default: 10)
  [duration]    Test duration in milliseconds (default: 30000)

Environment Variables:
  NODE_ENV      Set to 'production' for production mode
  PORT          Server port (default: 3002)
  MONGO_URI     MongoDB connection string
  SESSION_SECRET Session secret key

Quick Start:
  1. node start.js fix          # Check for issues
  2. node start.js single       # Start server
  3. node start.js health       # Verify it's working

For production deployment:
  1. Set NODE_ENV=production
  2. Configure proper MongoDB URI
  3. Set a secure SESSION_SECRET
  4. Use 'cluster' mode for better performance
  `);
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}