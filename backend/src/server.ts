import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import winston from 'winston';
import { faucetRouter } from './routes/faucet';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables FIRST
dotenv.config();

// Debug environment variables
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RECAPTCHA_SECRET_KEY_EXISTS: !!process.env.RECAPTCHA_SECRET_KEY,
  RECAPTCHA_SECRET_KEY_LENGTH: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
  RECAPTCHA_SECRET_KEY_PREVIEW: process.env.RECAPTCHA_SECRET_KEY?.substring(0, 10) + '...',
  TRUST_PROXY: process.env.TRUST_PROXY,
  REDIS_URL: process.env.REDIS_URL
});

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'octra-faucet' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - IMPORTANT: Add this before any middleware that uses req.ip
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', true);
  logger.info('Trust proxy enabled');
} else {
  logger.info('Trust proxy disabled');
}

// Initialize Redis client
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
      frameSrc: ["https://www.google.com"],
      connectSrc: ["'self'", "https://octra.network"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting - moved after trust proxy setting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to handle proxy properly
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      RECAPTCHA_CONFIGURED: !!process.env.RECAPTCHA_SECRET_KEY,
      RECAPTCHA_KEY_LENGTH: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
      TRUST_PROXY: process.env.TRUST_PROXY
    }
  });
});

// API routes
app.use('/api/faucet', faucetRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

async function startServer() {
  try {
    // Validate required environment variables
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      logger.error('RECAPTCHA_SECRET_KEY environment variable is required but not set');
      process.exit(1);
    }

    // Connect to Redis
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Faucet backend server running on port ${PORT}`);
      logger.info('Environment variables check:', {
        RECAPTCHA_SECRET_KEY_EXISTS: !!process.env.RECAPTCHA_SECRET_KEY,
        RECAPTCHA_SECRET_KEY_LENGTH: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
        TRUST_PROXY: process.env.TRUST_PROXY
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

startServer();