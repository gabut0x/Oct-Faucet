import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { claimTokens, getStats, checkEligibility } from '../services/faucetService';
import { verifyRecaptcha } from '../services/recaptchaService';
import { logger } from '../utils/logger';

const router = Router();

// Faucet-specific rate limiting
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
  // Skip rate limiting if we can't determine IP
  skip: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!ip || ip === 'unknown') {
      logger.warn('Unable to determine client IP for rate limiting');
      return false; // Don't skip, but log the issue
    }
    return false;
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

// Claim tokens
router.post('/claim', 
  faucetLimiter,
  validateClaimRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
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

      // Verify reCAPTCHA
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken, clientIP);
      if (!isRecaptchaValid) {
        logger.warn('Invalid reCAPTCHA attempt', { address, ip: clientIP });
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

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

export { router as faucetRouter };