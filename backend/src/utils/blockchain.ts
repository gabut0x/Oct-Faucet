import * as nacl from 'tweetnacl';
import axios from 'axios';
import { logger } from './logger';

const MU_FACTOR = 1_000_000;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY!;
const FAUCET_PUBLIC_KEY = process.env.FAUCET_PUBLIC_KEY!;
const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS!;
const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

interface Transaction {
  from: string;
  to_: string;
  amount: string;
  nonce: number;
  ou: string;
  timestamp: number;
  signature?: string;
  public_key?: string;
}

interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export function createTransaction(
  senderAddress: string,
  recipientAddress: string,
  amount: number,
  nonce: number,
  privateKeyBase64: string,
  publicKeyHex: string
): Transaction {
  const amountMu = Math.floor(amount * MU_FACTOR);
  const ou = amount < 1000 ? "1" : "3";
  const timestamp = Date.now() / 1000 + Math.random() * 0.01;

  const transaction: Transaction = {
    from: senderAddress,
    to_: recipientAddress,
    amount: amountMu.toString(),
    nonce,
    ou,
    timestamp
  };

  const txString = JSON.stringify(transaction, null, 0);
  
  const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
  
  const secretKey = new Uint8Array(64);
  secretKey.set(privateKeyBuffer, 0);
  secretKey.set(publicKeyBuffer, 32);

  const signature = nacl.sign.detached(new TextEncoder().encode(txString), secretKey);

  transaction.signature = Buffer.from(signature).toString('base64');
  transaction.public_key = Buffer.from(publicKeyBuffer).toString('base64');

  return transaction;
}

export async function fetchFaucetBalance(): Promise<number> {
  try {
    const response = await axios.get(`${OCTRA_RPC_URL}/address/${FAUCET_ADDRESS}`, {
      timeout: 10000
    });
    
    const balance = typeof response.data.balance === 'string' 
      ? parseFloat(response.data.balance) 
      : (response.data.balance || 0);
    
    return balance;
  } catch (error) {
    logger.error('Failed to fetch faucet balance', { error });
    throw new Error('Unable to fetch faucet balance');
  }
}

export async function fetchFaucetNonce(): Promise<number> {
  try {
    const response = await axios.get(`${OCTRA_RPC_URL}/address/${FAUCET_ADDRESS}`, {
      timeout: 10000
    });
    
    return response.data.nonce || 0;
  } catch (error) {
    logger.error('Failed to fetch faucet nonce', { error });
    throw new Error('Unable to fetch faucet nonce');
  }
}

export async function sendTransaction(recipientAddress: string, amount: number): Promise<TransactionResult> {
  try {
    // Get current nonce
    const nonce = await fetchFaucetNonce();
    
    // Create transaction
    const transaction = createTransaction(
      FAUCET_ADDRESS,
      recipientAddress,
      amount,
      nonce + 1,
      FAUCET_PRIVATE_KEY,
      FAUCET_PUBLIC_KEY
    );

    // Send transaction
    const response = await axios.post(`${OCTRA_RPC_URL}/send-tx`, transaction, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (response.status === 200) {
      try {
        const data = JSON.parse(responseText);
        if (data.status === 'accepted') {
          return { success: true, hash: data.tx_hash };
        }
      } catch {
        const hashMatch = responseText.match(/OK\s+([0-9a-fA-F]{64})/);
        if (hashMatch) {
          return { success: true, hash: hashMatch[1] };
        }
      }
      return { success: true, hash: responseText };
    }

    logger.error('Transaction failed', { status: response.status, data: responseText });
    return { success: false, error: responseText };
  } catch (error) {
    logger.error('Send transaction error', { error, recipientAddress, amount });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}