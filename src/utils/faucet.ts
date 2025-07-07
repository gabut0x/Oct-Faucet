import { createTransaction } from './crypto';

// Faucet configuration
const FAUCET_AMOUNT = 10; // OCT tokens per claim
const FAUCET_PRIVATE_KEY = "your-faucet-private-key-base64"; // Replace with actual faucet private key
const FAUCET_PUBLIC_KEY = "your-faucet-public-key-hex"; // Replace with actual faucet public key
const FAUCET_ADDRESS = "oct1234567890abcdef"; // Replace with actual faucet address

interface FaucetResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

interface RateLimitCheck {
  canClaim: boolean;
  timeUntilNext?: number;
  reason?: string;
}

// Mock rate limiting - in production, this should be handled by a backend
const rateLimitStore = {
  addresses: new Map<string, number>(),
  ips: new Map<string, number>()
};

function checkRateLimit(address: string, ip?: string): RateLimitCheck {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // Check address rate limit (24 hours)
  const lastAddressClaim = rateLimitStore.addresses.get(address);
  if (lastAddressClaim && (now - lastAddressClaim) < oneDay) {
    const timeUntilNext = oneDay - (now - lastAddressClaim);
    return {
      canClaim: false,
      timeUntilNext: timeUntilNext / (60 * 60 * 1000), // Convert to hours
      reason: 'Address rate limit: 1 claim per 24 hours'
    };
  }

  // Check IP rate limit (1 hour) - simplified for demo
  if (ip) {
    const lastIpClaim = rateLimitStore.ips.get(ip);
    if (lastIpClaim && (now - lastIpClaim) < oneHour) {
      const timeUntilNext = oneHour - (now - lastIpClaim);
      return {
        canClaim: false,
        timeUntilNext: timeUntilNext / (60 * 60 * 1000), // Convert to hours
        reason: 'IP rate limit: 1 claim per hour'
      };
    }
  }

  return { canClaim: true };
}

function updateRateLimit(address: string, ip?: string) {
  const now = Date.now();
  rateLimitStore.addresses.set(address, now);
  if (ip) {
    rateLimitStore.ips.set(ip, now);
  }
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    // In production, this should be done on the backend
    // For demo purposes, we'll just validate that a token exists
    return token.length > 0;
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    return false;
  }
}

async function fetchFaucetNonce(): Promise<number> {
  try {
    const response = await fetch(`/api/address/${FAUCET_ADDRESS}`);
    if (!response.ok) {
      throw new Error('Failed to fetch faucet nonce');
    }
    const data = await response.json();
    return data.nonce || 0;
  } catch (error) {
    console.error('Error fetching faucet nonce:', error);
    // Return a random nonce for demo purposes
    return Math.floor(Math.random() * 1000);
  }
}

async function sendTransaction(transaction: any): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const response = await fetch(`/api/send-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction),
    });

    const text = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(text);
        if (data.status === 'accepted') {
          return { success: true, hash: data.tx_hash };
        }
      } catch {
        const hashMatch = text.match(/OK\s+([0-9a-fA-F]{64})/);
        if (hashMatch) {
          return { success: true, hash: hashMatch[1] };
        }
      }
      return { success: true, hash: text };
    }

    console.error('Transaction failed:', text);
    return { success: false, error: text };
  } catch (error) {
    console.error('Error sending transaction:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendFaucetTransaction(
  recipientAddress: string, 
  recaptchaToken: string
): Promise<FaucetResult> {
  try {
    // Verify reCAPTCHA
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return {
        success: false,
        error: 'reCAPTCHA verification failed'
      };
    }

    // Get user IP (simplified for demo)
    const userIp = 'demo-ip'; // In production, get from request headers

    // Check rate limits
    const rateLimitCheck = checkRateLimit(recipientAddress, userIp);
    if (!rateLimitCheck.canClaim) {
      return {
        success: false,
        error: rateLimitCheck.reason
      };
    }

    // Get current nonce for faucet address
    const nonce = await fetchFaucetNonce();

    // Create transaction
    const transaction = createTransaction(
      FAUCET_ADDRESS,
      recipientAddress,
      FAUCET_AMOUNT,
      nonce + 1,
      FAUCET_PRIVATE_KEY,
      FAUCET_PUBLIC_KEY
    );

    // Send transaction
    const result = await sendTransaction(transaction);

    if (result.success) {
      // Update rate limits
      updateRateLimit(recipientAddress, userIp);
      
      return {
        success: true,
        txHash: result.hash
      };
    } else {
      return {
        success: false,
        error: result.error || 'Transaction failed'
      };
    }
  } catch (error) {
    console.error('Faucet transaction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function getRemainingTime(address: string): number | null {
  const lastClaim = rateLimitStore.addresses.get(address);
  if (!lastClaim) return null;
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const timeSinceLastClaim = now - lastClaim;
  
  if (timeSinceLastClaim >= oneDay) return null;
  
  return (oneDay - timeSinceLastClaim) / (60 * 60 * 1000); // Return hours
}