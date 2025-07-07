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
  // Debug log untuk melihat nilai environment variable
  console.log('=== RECAPTCHA DEBUG ===');
  console.log('RECAPTCHA_SECRET_KEY exists:', !!RECAPTCHA_SECRET_KEY);
  console.log('RECAPTCHA_SECRET_KEY length:', RECAPTCHA_SECRET_KEY?.length || 0);
  console.log('RECAPTCHA_SECRET_KEY preview:', RECAPTCHA_SECRET_KEY?.substring(0, 10) + '...' || 'NOT_SET');
  console.log('RECAPTCHA_SECRET_KEY type:', typeof RECAPTCHA_SECRET_KEY);
  console.log('Token length:', token?.length || 0);
  console.log('Client IP:', clientIP);
  
  // Test kondisi yang menyebabkan error
  const isUndefined = RECAPTCHA_SECRET_KEY === undefined;
  const isNull = RECAPTCHA_SECRET_KEY === null;
  const isEmpty = RECAPTCHA_SECRET_KEY === '';
  const isTrimEmpty = RECAPTCHA_SECRET_KEY?.trim() === '';
  
  console.log('Condition tests:');
  console.log('- isUndefined:', isUndefined);
  console.log('- isNull:', isNull);
  console.log('- isEmpty:', isEmpty);
  console.log('- isTrimEmpty:', isTrimEmpty);
  console.log('- Overall condition result:', !RECAPTCHA_SECRET_KEY || RECAPTCHA_SECRET_KEY.trim() === '');
  console.log('======================');

  // Perbaiki kondisi - pastikan kita cek dengan benar
  if (!RECAPTCHA_SECRET_KEY) {
    logger.error('reCAPTCHA secret key is undefined or null', {
      envVarExists: !!process.env.RECAPTCHA_SECRET_KEY,
      envVarLength: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('RECAPTCHA')),
      secretKeyValue: RECAPTCHA_SECRET_KEY,
      secretKeyType: typeof RECAPTCHA_SECRET_KEY
    });
    return false;
  }

  if (RECAPTCHA_SECRET_KEY.trim() === '') {
    logger.error('reCAPTCHA secret key is empty after trim', {
      originalLength: RECAPTCHA_SECRET_KEY.length,
      trimmedLength: RECAPTCHA_SECRET_KEY.trim().length
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
      secretKeyLength: RECAPTCHA_SECRET_KEY.length,
      secretKeyPreview: RECAPTCHA_SECRET_KEY.substring(0, 10) + '...'
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