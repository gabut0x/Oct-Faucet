import * as nacl from 'tweetnacl';
import axios from 'axios';
import * as crypto from 'crypto';
import { logger } from './logger';

const MU_FACTOR = 1_000_000;

interface FaucetConfig {
  privateKey: string;
  publicKey: string;
  address: string;
  rpcUrl: string;
}

let cachedConfig: FaucetConfig | null = null;

function getFaucetConfig(): FaucetConfig {
  if (cachedConfig) return cachedConfig;

  const privateKey = process.env.FAUCET_PRIVATE_KEY;
  const publicKey = process.env.FAUCET_PUBLIC_KEY;
  const address = process.env.FAUCET_ADDRESS;
  const rpcUrl = process.env.OCTRA_RPC_URL || 'https://octra.network';

  if (!privateKey) {
    logger.error('FAUCET_PRIVATE_KEY environment variable is required');
    throw new Error('FAUCET_PRIVATE_KEY is not configured');
  }

  if (!publicKey) {
    logger.error('FAUCET_PUBLIC_KEY environment variable is required');
    throw new Error('FAUCET_PUBLIC_KEY is not configured');
  }

  if (!address) {
    logger.error('FAUCET_ADDRESS environment variable is required');
    throw new Error('FAUCET_ADDRESS is not configured');
  }

  cachedConfig = { privateKey, publicKey, address, rpcUrl };

  logger.info('Blockchain configuration loaded', {
    hasFaucetPrivateKey: true,
    hasFaucetPublicKey: true,
    faucetAddress: address,
    octraRpcUrl: rpcUrl
  });

  return cachedConfig;
}

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

// Encryption utilities for private transfers
function deriveEncryptionKey(privkeyB64: string): Buffer {
  const privkeyBytes = Buffer.from(privkeyB64, 'base64');
  const salt = Buffer.from("octra_encrypted_balance_v2");
  return crypto.createHash('sha256').update(Buffer.concat([salt, privkeyBytes])).digest().slice(0, 32);
}

function encryptClientBalance(balance: number, privkeyB64: string): string {
  const key = deriveEncryptionKey(privkeyB64);
  const nonce = crypto.randomBytes(12);
  const plaintext = Buffer.from(balance.toString());
  
  const cipher = crypto.createCipherGCM('aes-256-gcm', key);
  cipher.setAAD(Buffer.alloc(0)); // No additional authenticated data
  
  let ciphertext = cipher.update(plaintext);
  cipher.final();
  const tag = cipher.getAuthTag();
  
  const result = Buffer.concat([nonce, ciphertext, tag]);
  return "v2|" + result.toString('base64');
}

function deriveSharedSecret(myPrivkeyB64: string, ephemeralPubkeyB64: string): Buffer {
  const sk = nacl.sign.keyPair.fromSeed(Buffer.from(myPrivkeyB64, 'base64'));
  const myPubkeyBytes = sk.publicKey;
  const ephPubBytes = Buffer.from(ephemeralPubkeyB64, 'base64');
  
  const smaller = Buffer.compare(ephPubBytes, myPubkeyBytes) < 0 ? ephPubBytes : myPubkeyBytes;
  const larger = Buffer.compare(ephPubBytes, myPubkeyBytes) < 0 ? myPubkeyBytes : ephPubBytes;
  
  const combined = Buffer.concat([smaller, larger]);
  const round1 = crypto.createHash('sha256').update(combined).digest();
  const round2 = crypto.createHash('sha256').update(Buffer.concat([round1, Buffer.from("OCTRA_SYMMETRIC_V1")])).digest();
  return round2.slice(0, 32);
}

function encryptPrivateAmount(amount: number, sharedSecret: Buffer): string {
  const nonce = crypto.randomBytes(12);
  const plaintext = Buffer.from((amount * MU_FACTOR).toString());
  
  const cipher = crypto.createCipherGCM('aes-256-gcm', sharedSecret);
  cipher.setAAD(Buffer.alloc(0));
  
  let ciphertext = cipher.update(plaintext);
  cipher.final();
  const tag = cipher.getAuthTag();
  
  const result = Buffer.concat([nonce, ciphertext, tag]);
  return "v2|" + result.toString('base64');
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

  const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

  const secretKey = new Uint8Array(64);
  secretKey.set(privateKeyBuffer, 0);
  secretKey.set(publicKeyBuffer, 32);

  const signature = nacl.sign.detached(new TextEncoder().encode(JSON.stringify(transaction)), secretKey);

  transaction.signature = Buffer.from(signature).toString('base64');
  transaction.public_key = Buffer.from(publicKeyBuffer).toString('base64');

  return transaction;
}

export async function createPrivateTransfer(recipientAddress: string, amount: number): Promise<TransactionResult> {
  const { privateKey, publicKey, address, rpcUrl } = getFaucetConfig();

  try {
    logger.info('Starting private transfer', {
      from: address,
      to: recipientAddress,
      amount
    });

    // First, get recipient's public key
    const recipientPubKeyResponse = await axios.get(`${rpcUrl}/public_key/${recipientAddress}`, { timeout: 10000 });
    
    if (!recipientPubKeyResponse.data || !recipientPubKeyResponse.data.public_key) {
      logger.error('Recipient has no public key', { recipientAddress });
      return { success: false, error: 'Recipient has no public key' };
    }

    const recipientPublicKey = recipientPubKeyResponse.data.public_key;

    // Generate ephemeral key pair
    const ephemeralKeyPair = nacl.sign.keyPair();
    const ephemeralPrivateKey = Buffer.from(ephemeralKeyPair.secretKey.slice(0, 32)).toString('base64');
    const ephemeralPublicKey = Buffer.from(ephemeralKeyPair.publicKey).toString('base64');

    // Derive shared secret
    const sharedSecret = deriveSharedSecret(ephemeralPrivateKey, recipientPublicKey);

    // Encrypt the amount
    const encryptedAmount = encryptPrivateAmount(amount, sharedSecret);

    const data = {
      from: address,
      to: recipientAddress,
      amount: (amount * MU_FACTOR).toString(),
      from_private_key: privateKey,
      to_public_key: recipientPublicKey,
      ephemeral_key: ephemeralPublicKey,
      encrypted_data: encryptedAmount
    };

    logger.info('Sending private transfer request', {
      from: address,
      to: recipientAddress,
      hasEphemeralKey: !!ephemeralPublicKey,
      hasEncryptedData: !!encryptedAmount
    });

    const response = await axios.post(`${rpcUrl}/private_transfer`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (response.status === 200) {
      try {
        const responseData = JSON.parse(responseText);
        if (responseData.status === 'accepted') {
          logger.info('Private transfer successful', { hash: responseData.tx_hash });
          return { success: true, hash: responseData.tx_hash };
        }
      } catch {
        const hashMatch = responseText.match(/OK\s+([0-9a-fA-F]{64})/);
        if (hashMatch) {
          logger.info('Private transfer successful', { hash: hashMatch[1] });
          return { success: true, hash: hashMatch[1] };
        }
      }

      logger.info('Private transfer successful', { response: responseText });
      return { success: true, hash: responseText };
    }

    logger.error('Private transfer failed', { status: response.status, data: responseText });
    return { success: false, error: responseText };
  } catch (error) {
    logger.error('Private transfer error', { error, recipientAddress, amount });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
export async function fetchFaucetBalance(): Promise<number> {
  const { address, rpcUrl } = getFaucetConfig();

  try {
    logger.info('Fetching faucet balance', {
      address,
      url: `${rpcUrl}/address/${address}`
    });

    const response = await axios.get(`${rpcUrl}/address/${address}`, { timeout: 10000 });

    const balance = typeof response.data.balance === 'string'
      ? parseFloat(response.data.balance)
      : (response.data.balance || 0);

    logger.info('Faucet balance fetched successfully', { balance });
    return balance;
  } catch (error) {
    logger.error('Failed to fetch faucet balance', {
      error,
      address,
      url: `${rpcUrl}/address/${address}`
    });
    throw new Error('Unable to fetch faucet balance');
  }
}

export async function fetchFaucetNonce(): Promise<number> {
  const { address, rpcUrl } = getFaucetConfig();

  try {
    logger.info('Fetching faucet nonce', {
      address,
      url: `${rpcUrl}/address/${address}`
    });

    const response = await axios.get(`${rpcUrl}/address/${address}`, { timeout: 10000 });

    const nonce = response.data.nonce || 0;
    logger.info('Faucet nonce fetched successfully', { nonce });
    return nonce;
  } catch (error) {
    logger.error('Failed to fetch faucet nonce', {
      error,
      address,
      url: `${rpcUrl}/address/${address}`
    });
    throw new Error('Unable to fetch faucet nonce');
  }
}

export async function sendTransaction(recipientAddress: string, amount: number): Promise<TransactionResult> {
  const { privateKey, publicKey, address, rpcUrl } = getFaucetConfig();

  try {
    logger.info('Starting transaction', {
      from: address,
      to: recipientAddress,
      amount
    });

    const nonce = await fetchFaucetNonce();

    const transaction = createTransaction(
      address,
      recipientAddress,
      amount,
      nonce + 1,
      privateKey,
      publicKey
    );

    logger.info('Transaction created', {
      nonce: transaction.nonce,
      amount: transaction.amount,
      ou: transaction.ou
    });

    const response = await axios.post(`${rpcUrl}/send-tx`, transaction, {
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
          logger.info('Transaction successful', { hash: data.tx_hash });
          return { success: true, hash: data.tx_hash };
        }
      } catch {
        const hashMatch = responseText.match(/OK\s+([0-9a-fA-F]{64})/);
        if (hashMatch) {
          logger.info('Transaction successful', { hash: hashMatch[1] });
          return { success: true, hash: hashMatch[1] };
        }
      }

      logger.info('Transaction successful', { response: responseText });
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
