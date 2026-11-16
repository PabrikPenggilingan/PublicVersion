const app = require('./app');
const config = require('./config/env');
const { pool, logPool } = require('./config/database');

const PORT = config.port;

// Test database connections
const testConnections = async () => {
  try {
    // Test main database
    await pool.query('SELECT NOW()');
    console.log('✓ Main database connection established');

    // Test log database
    await logPool.query('SELECT NOW()');
    console.log('✓ Log database connection established');

    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
};

// Start server
const startServer = async () => {
  // Test database connections
  const dbConnected = await testConnections();
  
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Start listening
  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Belanja Giling Management System API Server         ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(39)}║
║   Port:        ${PORT.toString().padEnd(39)}║
║   Health:      http://localhost:${PORT}/health${' '.repeat(18)}║
║                                                        ║
║   API Base:    http://localhost:${PORT}/api${' '.repeat(21)}║
╚════════════════════════════════════════════════════════╝
    `);
  });

  return server;
};

// Store server instance for graceful shutdown
let server;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error('Error Stack:', error.stack || error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down gracefully...');
  console.error('Error Stack:', error.stack || error);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  pool.end(() => {
    console.log('✓ Main database pool closed');
  });
  logPool.end(() => {
    console.log('✓ Log database pool closed');
    process.exit(0);
  });
});

// Start the server
startServer().then(s => {
  server = s;
});
