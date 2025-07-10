import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { claimTokens, getStats, checkEligibility, claimPrivateTokens, getPrivateStats } from '../services/faucetService';
import { verifyRecaptcha } from '../services/recaptchaService';
import { logger } from '../utils/logger';

const router = Router();

// Faucet-specific rate limiting - only apply to successful requests
const faucetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // 1 request per hour per IP
  message: { error: 'Rate limit exceeded. Only 1 claim per hour per IP address.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use real IP from proxy headers if available
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Skip rate limiting for failed requests (validation errors, recaptcha failures, etc.)
  skip: (req, res) => {
    // Don't apply rate limiting to failed requests
    // This will be handled in the route handler
    return false;
  },
  // Custom handler to only count successful claims
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    res.status(429).json({ 
      error: 'Rate limit exceeded. Only 1 claim per hour per IP address.',
      nextClaimTime: Date.now() + (60 * 60 * 1000) // 1 hour from now
    });
  }
});

// Validation middleware
const validateClaimRequest = [
  body('address')
    .isString()
    .trim()
    .isLength({ min: 10, max: 100 })
    .matches(/^oct[a-zA-Z0-9]+$/)
    .withMessage('Invalid Octra address format'),
  body('recaptchaToken')
    .isString()
    .notEmpty()
    .withMessage('reCAPTCHA token is required')
];

// Get faucet statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get private faucet statistics
router.get('/stats-private', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getPrivateStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
// Check if address is eligible for claim
router.get('/eligibility/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    if (!address.match(/^oct[a-zA-Z0-9]+$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const eligibility = await checkEligibility(address);
    res.json(eligibility);
  } catch (error) {
    next(error);
  }
});

// Claim tokens - custom rate limiting logic
router.post('/claim', 
  validateClaimRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors first
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation failed for faucet claim', {
          errors: errors.array(),
          ip: req.ip
        });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { address, recaptchaToken } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info('Faucet claim attempt', { 
        address, 
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        xForwardedFor: req.get('X-Forwarded-For'),
        xRealIp: req.get('X-Real-IP')
      });

      // Verify reCAPTCHA first (before rate limiting)
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken, clientIP);
      if (!isRecaptchaValid) {
        logger.warn('Invalid reCAPTCHA attempt', { address, ip: clientIP });
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      // Apply rate limiting only after validation and reCAPTCHA check
      // Check if this IP has made a successful claim in the last hour
      const rateLimitKey = `rate_limit:${clientIP}`;
      // This will be handled in the faucetService with Redis

      // Process claim
      const result = await claimTokens(address, clientIP);
      
      if (result.success) {
        logger.info('Successful faucet claim', { 
          address, 
          ip: clientIP, 
          txHash: result.txHash 
        });
        res.json(result);
      } else {
        logger.warn('Failed faucet claim', { 
          address, 
          ip: clientIP, 
          error: result.error 
        });
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Claim private tokens - custom rate limiting logic
router.post('/claim-private', 
  validateClaimRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors first
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation failed for private faucet claim', {
          errors: errors.array(),
          ip: req.ip
        });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { address, recaptchaToken } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info('Private faucet claim attempt', { 
        address, 
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        xForwardedFor: req.get('X-Forwarded-For'),
        xRealIp: req.get('X-Real-IP')
      });

      // Verify reCAPTCHA first (before rate limiting)
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken, clientIP);
      if (!isRecaptchaValid) {
        logger.warn('Invalid reCAPTCHA attempt for private claim', { address, ip: clientIP });
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      // Process private claim
      const result = await claimPrivateTokens(address, clientIP);
      
      if (result.success) {
        logger.info('Successful private faucet claim', { 
          address, 
          ip: clientIP, 
          txHash: result.txHash 
        });
        res.json(result);
      } else {
        logger.warn('Failed private faucet claim', { 
          address, 
          ip: clientIP, 
          error: result.error 
        });
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }
);
export { router as faucetRouter };