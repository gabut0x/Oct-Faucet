import axios from 'axios';
import { logger } from '../utils/logger';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verifyRecaptcha(token: string, clientIP: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET_KEY) {
    logger.error('reCAPTCHA secret key not configured', {
      envVarExists: !!process.env.RECAPTCHA_SECRET_KEY,
      envVarLength: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('RECAPTCHA'))
    });
    return false;
  }

  if (!token || token.trim() === '') {
    logger.warn('Empty reCAPTCHA token provided', { clientIP });
    return false;
  }

  try {
    logger.info('Verifying reCAPTCHA', { 
      clientIP, 
      tokenLength: token.length,
      secretKeyLength: RECAPTCHA_SECRET_KEY.length 
    });

    const response = await axios.post<RecaptchaResponse>(
      RECAPTCHA_VERIFY_URL,
      new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: clientIP
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const { success, 'error-codes': errorCodes } = response.data;

    if (!success) {
      logger.warn('reCAPTCHA verification failed', { 
        errorCodes, 
        clientIP,
        token: token.substring(0, 10) + '...',
        responseData: response.data
      });
      return false;
    }

    logger.info('reCAPTCHA verification successful', { clientIP });
    return true;
  } catch (error) {
    logger.error('reCAPTCHA verification error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP,
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}