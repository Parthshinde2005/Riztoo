const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class DevWatcher {
  constructor(options = {}) {
    this.options = {
      serverFile: 'server/server.js',
      watchDirs: ['server'],
      debounceTime: 1000,
      ...options
    };
    
    this.serverProcess = null;
    this.restartTimer = null;
    this.watchers = [];
  }

  start() {
    console.log('🛠️  Starting development server with file watcher...');
    console.log(`📁 Watching directories: ${this.options.watchDirs.join(', ')}`);
    console.log('');

    // Start the server
    this.startServer();

    // Set up file watchers
    this.setupWatchers();

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down development server...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.stop();
      process.exit(0);
    });
  }

  startServer() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }

    console.log('🚀 Starting server...');
    
    this.serverProcess = spawn('node', [this.options.serverFile], {
      stdio: 'inherit',
      env: process.env
    });

    this.serverProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`❌ Server exited with code ${code}`);
      }
    });

    this.serverProcess.on('error', (error) => {
      console.error('❌ Server error:', error.message);
    });
  }

  setupWatchers() {
    this.options.watchDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`👀 Watching: ${dir}`);
        
        const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
          if (filename && this.shouldRestart(filename)) {
            console.log(`📝 File changed: ${filename}`);
            this.scheduleRestart();
          }
        });

        this.watchers.push(watcher);
      } else {
        console.log(`⚠️  Directory not found: ${dir}`);
      }
    });
  }

  shouldRestart(filename) {
    // Only restart for JavaScript files and ignore certain patterns
    const ext = path.extname(filename);
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /uploads/,
      /logs/,
      /\.log$/,
      /\.tmp$/,
      /~$/
    ];

    if (!['.js', '.json'].includes(ext)) {
      return false;
    }

    return !ignoredPatterns.some(pattern => pattern.test(filename));
  }

  scheduleRestart() {
    // Debounce restarts to avoid multiple rapid restarts
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = setTimeout(() => {
      console.log('🔄 Restarting server...');
      this.startServer();
    }, this.options.debounceTime);
  }

  stop() {
    // Clear restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    // Close file watchers
    this.watchers.forEach(watcher => {
      watcher.close();
    });
    this.watchers = [];

    // Kill server process
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    console.log('✅ Development server stopped');
  }
}

module.exports = DevWatcher;