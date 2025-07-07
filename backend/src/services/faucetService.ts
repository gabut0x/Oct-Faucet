import { redisClient } from '../server';
import { createTransaction, sendTransaction, fetchFaucetBalance } from '../utils/blockchain';
import { logger } from '../utils/logger';

const FAUCET_AMOUNT = 0.5;
const ADDRESS_COOLDOWN = 24 * 60 * 60; // 24 hours in seconds
const IP_COOLDOWN = 60 * 60; // 1 hour in seconds

interface ClaimResult {
  success: boolean;
  txHash?: string;
  error?: string;
  nextClaimTime?: number;
}

interface FaucetStats {
  totalClaimed: number;
  totalUsers: number;
  totalTransactions: number;
  faucetBalance: number;
  lastClaim: string | null;
}

interface EligibilityCheck {
  eligible: boolean;
  reason?: string;
  nextClaimTime?: number;
}

export async function claimTokens(address: string, clientIP: string): Promise<ClaimResult> {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Check address cooldown
    const lastAddressClaim = await redisClient.get(`faucet:address:${address}`);
    if (lastAddressClaim) {
      const timeSinceLastClaim = now - parseInt(lastAddressClaim);
      if (timeSinceLastClaim < ADDRESS_COOLDOWN) {
        const nextClaimTime = parseInt(lastAddressClaim) + ADDRESS_COOLDOWN;
        return {
          success: false,
          error: 'Address rate limit exceeded. You can claim again in 24 hours.',
          nextClaimTime
        };
      }
    }

    // Check IP cooldown
    const lastIPClaim = await redisClient.get(`faucet:ip:${clientIP}`);
    if (lastIPClaim) {
      const timeSinceLastClaim = now - parseInt(lastIPClaim);
      if (timeSinceLastClaim < IP_COOLDOWN) {
        const nextClaimTime = parseInt(lastIPClaim) + IP_COOLDOWN;
        return {
          success: false,
          error: 'IP rate limit exceeded. You can claim again in 1 hour.',
          nextClaimTime
        };
      }
    }

    // Check faucet balance
    const faucetBalance = await fetchFaucetBalance();
    if (faucetBalance < FAUCET_AMOUNT) {
      logger.error('Insufficient faucet balance', { balance: faucetBalance, required: FAUCET_AMOUNT });
      return {
        success: false,
        error: 'Faucet is temporarily out of funds. Please try again later.'
      };
    }

    // Create and send transaction
    const txResult = await sendTransaction(address, FAUCET_AMOUNT);
    
    if (txResult.success && txResult.hash) {
      // Update rate limiting records
      await Promise.all([
        redisClient.setEx(`faucet:address:${address}`, ADDRESS_COOLDOWN, now.toString()),
        redisClient.setEx(`faucet:ip:${clientIP}`, IP_COOLDOWN, now.toString())
      ]);

      // Update statistics
      await updateStats(address, FAUCET_AMOUNT, txResult.hash);

      return {
        success: true,
        txHash: txResult.hash
      };
    } else {
      logger.error('Transaction failed', { address, error: txResult.error });
      return {
        success: false,
        error: txResult.error || 'Transaction failed'
      };
    }
  } catch (error) {
    logger.error('Claim tokens error', { address, clientIP, error });
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function checkEligibility(address: string): Promise<EligibilityCheck> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const lastClaim = await redisClient.get(`faucet:address:${address}`);
    
    if (!lastClaim) {
      return { eligible: true };
    }

    const timeSinceLastClaim = now - parseInt(lastClaim);
    if (timeSinceLastClaim >= ADDRESS_COOLDOWN) {
      return { eligible: true };
    }

    const nextClaimTime = parseInt(lastClaim) + ADDRESS_COOLDOWN;
    return {
      eligible: false,
      reason: 'Address rate limit active',
      nextClaimTime
    };
  } catch (error) {
    logger.error('Check eligibility error', { address, error });
    return {
      eligible: false,
      reason: 'Unable to check eligibility'
    };
  }
}

export async function getStats(): Promise<FaucetStats> {
  try {
    const [totalClaimed, totalUsers, totalTransactions, lastClaim] = await Promise.all([
      redisClient.get('faucet:stats:totalClaimed'),
      redisClient.get('faucet:stats:totalUsers'),
      redisClient.get('faucet:stats:totalTransactions'),
      redisClient.get('faucet:stats:lastClaim')
    ]);

    const faucetBalance = await fetchFaucetBalance();

    return {
      totalClaimed: parseFloat(totalClaimed || '0'),
      totalUsers: parseInt(totalUsers || '0'),
      totalTransactions: parseInt(totalTransactions || '0'),
      faucetBalance,
      lastClaim
    };
  } catch (error) {
    logger.error('Get stats error', error);
    return {
      totalClaimed: 0,
      totalUsers: 0,
      totalTransactions: 0,
      faucetBalance: 0,
      lastClaim: null
    };
  }
}

async function updateStats(address: string, amount: number, txHash: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Check if this is a new user
    const isNewUser = !(await redisClient.exists(`faucet:user:${address}`));
    
    await Promise.all([
      // Update total claimed
      redisClient.incrByFloat('faucet:stats:totalClaimed', amount),
      
      // Update total transactions
      redisClient.incr('faucet:stats:totalTransactions'),
      
      // Update total users if new
      isNewUser ? redisClient.incr('faucet:stats:totalUsers') : Promise.resolve(),
      
      // Mark user as seen
      redisClient.set(`faucet:user:${address}`, '1'),
      
      // Update last claim time
      redisClient.set('faucet:stats:lastClaim', now),
      
      // Store transaction record
      redisClient.hSet(`faucet:tx:${txHash}`, {
        address,
        amount: amount.toString(),
        timestamp: now
      })
    ]);
  } catch (error) {
    logger.error('Update stats error', { address, amount, txHash, error });
  }
}