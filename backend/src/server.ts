import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from 'redis';
import winston from 'winston';
import { faucetRouter } from './routes/faucet';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables FIRST with explicit path
const envPath = path.join(__dirname, '..', '.env');
console.log('🔧 Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('❌ Error loading .env file:', envResult.error);
  // Try alternative paths
  const altPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env'),
    '.env'
  ];
  
  for (const altPath of altPaths) {
    console.log('🔄 Trying alternative path:', altPath);
    const altResult = dotenv.config({ path: altPath });
    if (!altResult.error) {
      console.log('✅ Successfully loaded .env from:', altPath);
      break;
    }
  }
} else {
  console.log('✅ Successfully loaded .env file');
}

// Debug environment variables immediately after loading
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('RECAPTCHA_SECRET_KEY exists:', !!process.env.RECAPTCHA_SECRET_KEY);
console.log('RECAPTCHA_SECRET_KEY length:', process.env.RECAPTCHA_SECRET_KEY?.length || 0);
console.log('RECAPTCHA_SECRET_KEY preview:', process.env.RECAPTCHA_SECRET_KEY?.substring(0, 10) + '...' || 'NOT_SET');
console.log('FAUCET_ADDRESS:', process.env.FAUCET_ADDRESS);
console.log('FAUCET_PRIVATE_KEY exists:', !!process.env.FAUCET_PRIVATE_KEY);
console.log('FAUCET_PRIVATE_KEY length:', process.env.FAUCET_PRIVATE_KEY?.length || 0);
console.log('FAUCET_PRIVATE_KEY preview:', process.env.FAUCET_PRIVATE_KEY?.substring(0, 10) + '...' || 'NOT_SET');
console.log('FAUCET_PUBLIC_KEY exists:', !!process.env.FAUCET_PUBLIC_KEY);
console.log('TRUST_PROXY:', process.env.TRUST_PROXY);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('All env keys containing RECAPTCHA:', Object.keys(process.env).filter(key => key.includes('RECAPTCHA')));
console.log('All env keys containing FAUCET:', Object.keys(process.env).filter(key => key.includes('FAUCET')));
console.log('=====================================');

// Validate critical environment variables immediately
const requiredEnvVars = [
  'RECAPTCHA_SECRET_KEY',
  'FAUCET_PRIVATE_KEY',
  'FAUCET_PUBLIC_KEY',
  'FAUCET_ADDRESS'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please check your .env file and ensure all required variables are set.');
  console.error('Required variables:');
  requiredEnvVars.forEach(varName => {
    const exists = !!process.env[varName];
    console.error(`  - ${varName}: ${exists ? '✅ SET' : '❌ MISSING'}`);
  });
  
  console.error('\n🔧 Quick fix suggestions:');
  console.error('1. Run: node debug-env.js');
  console.error('2. Run: quick-fix-env.bat');
  console.error('3. Check if backend/.env file exists and contains the required variables');
  
  process.exit(1);
}

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

// CORS configuration - FIXED: Proper configuration for production
const allowedOrigins = [
  'https://oct-faucet.xme.my.id',
  'https://www.oct-faucet.xme.my.id',
  'https://oct-faucet.local',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

// Add environment-specific origins
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

console.log('🌐 Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    console.log('🔍 CORS: Checking origin:', origin);
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS: Origin blocked:', origin);
      logger.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400 // 24 hours
}));

// Add explicit OPTIONS handler for preflight requests
app.options('*', (req, res) => {
  console.log('🔄 Handling preflight OPTIONS request for:', req.path);
  console.log('🔄 Origin:', req.get('Origin'));
  console.log('🔄 Access-Control-Request-Method:', req.get('Access-Control-Request-Method'));
  console.log('🔄 Access-Control-Request-Headers:', req.get('Access-Control-Request-Headers'));
  
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

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
      FAUCET_CONFIGURED: !!(process.env.FAUCET_ADDRESS && process.env.FAUCET_PRIVATE_KEY && process.env.FAUCET_PUBLIC_KEY),
      FAUCET_ADDRESS: process.env.FAUCET_ADDRESS,
      TRUST_PROXY: process.env.TRUST_PROXY,
      FRONTEND_URL: process.env.FRONTEND_URL,
      CORS_ORIGINS: allowedOrigins
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
    // Final validation of required environment variables
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      logger.error('RECAPTCHA_SECRET_KEY environment variable is required but not set');
      console.error('❌ RECAPTCHA_SECRET_KEY is missing!');
      console.error('Please check your .env file and make sure it contains:');
      console.error('RECAPTCHA_SECRET_KEY=your-secret-key-here');
      process.exit(1);
    }

    if (!process.env.FAUCET_ADDRESS) {
      logger.error('FAUCET_ADDRESS environment variable is required but not set');
      console.error('❌ FAUCET_ADDRESS is missing!');
      console.error('Please check your .env file and make sure it contains:');
      console.error('FAUCET_ADDRESS=oct1234567890abcdef');
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
      console.log('✅ Faucet configured:', !!(process.env.FAUCET_ADDRESS && process.env.FAUCET_PRIVATE_KEY && process.env.FAUCET_PUBLIC_KEY));
      console.log('✅ CORS origins:', allowedOrigins);
      console.log('Environment variables check:', {
        RECAPTCHA_SECRET_KEY_EXISTS: !!process.env.RECAPTCHA_SECRET_KEY,
        RECAPTCHA_SECRET_KEY_LENGTH: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
        FAUCET_ADDRESS: process.env.FAUCET_ADDRESS,
        FAUCET_PRIVATE_KEY_EXISTS: !!process.env.FAUCET_PRIVATE_KEY,
        FAUCET_PUBLIC_KEY_EXISTS: !!process.env.FAUCET_PUBLIC_KEY,
        TRUST_PROXY: process.env.TRUST_PROXY,
        FRONTEND_URL: process.env.FRONTEND_URL
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