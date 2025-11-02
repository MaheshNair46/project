const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sandboxRoutes = require('./routes/sandboxes');
const networkRoutes = require('./routes/network');
const analysisRoutes = require('./routes/analysis');
const configRoutes = require('./routes/config');
const monitoringRoutes = require('./routes/monitoring');

const { initializeDatabase } = require('./database');
const { initializeRedis } = require('./redis');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(require('compression')());

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: 'connected', // TODO: Check actual DB connection
      redis: 'connected', // TODO: Check actual Redis connection
      docker: 'connected' // TODO: Check actual Docker connection
    }
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sandboxes', sandboxRoutes);
app.use('/api/v1/network', networkRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.originalUrl
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  try {
    await require('./database').pool.end();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }

  // Close Redis connection
  try {
    await require('./redis').quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }

  process.exit(0);
}

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`Android Sandbox API server starting on port ${PORT}`);

  try {
    // Initialize services
    await initializeDatabase();
    await initializeRedis();

    logger.info(`Android Sandbox API server started successfully on port ${PORT}`);
    logger.info(`Health check available at http://localhost:${PORT}/api/v1/health`);
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
});

module.exports = app;