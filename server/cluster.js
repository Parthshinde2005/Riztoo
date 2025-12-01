const cluster = require('cluster');
const os = require('os');
const path = require('path');

// Get number of CPU cores
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Starting ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    console.log('Starting a new worker...');
    cluster.fork();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Master received SIGTERM, shutting down gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

} else {
  // Worker process - start the actual server
  require('./server.js');
  console.log(`Worker ${process.pid} started`);
}