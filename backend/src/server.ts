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

// Debug environment variables immediately after loading
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('RECAPTCHA_SECRET_KEY exists:', !!process.env.RECAPTCHA_SECRET_KEY);
console.log('RECAPTCHA_SECRET_KEY length:', process.env.RECAPTCHA_SECRET_KEY?.length || 0);
console.log('RECAPTCHA_SECRET_KEY preview:', process.env.RECAPTCHA_SECRET_KEY?.substring(0, 10) + '...' || 'NOT_SET');
console.log('TRUST_PROXY:', process.env.TRUST_PROXY);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('All env keys containing RECAPTCHA:', Object.keys(process.env).filter(key => key.includes('RECAPTCHA')));
console.log('=====================================');

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
      console.error('❌ RECAPTCHA_SECRET_KEY is missing!');
      console.error('Please check your .env file and make sure it contains:');
      console.error('RECAPTCHA_SECRET_KEY=your-secret-key-here');
      process.exit(1);
    }

    // Connect to Redis
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Faucet backend server running on port ${PORT}`);
      console.log(`✅ Server started on port ${PORT}`);
      console.log('✅ reCAPTCHA configured:', !!process.env.RECAPTCHA_SECRET_KEY);
      console.log('Environment variables check:', {
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