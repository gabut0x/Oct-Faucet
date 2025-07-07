import * as nacl from 'tweetnacl';
import * as bip39 from 'bip39';

const MU_FACTOR = 1_000_000;

export interface Transaction {
  from: string;
  to_: string;
  amount: string;
  nonce: number;
  ou: string;
  timestamp: number;
  signature?: string;
  public_key?: string;
}

// Utility functions for buffer conversion
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

// Generate a new mnemonic phrase
export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

// Validate a mnemonic phrase
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

// Create Octra address from public key
export async function createOctraAddress(publicKey: Buffer): Promise<string> {
  // Simple address generation - in real implementation this would use proper hashing
  const hash = await crypto.subtle.digest('SHA-256', publicKey);
  const hashArray = new Uint8Array(hash);
  const addressBytes = hashArray.slice(0, 20); // Take first 20 bytes
  const hexAddress = Array.from(addressBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `oct${hexAddress}`;
}

// Generate wallet from mnemonic
export async function generateWalletFromMnemonic(mnemonic: string): Promise<{
  address: string;
  privateKey: string;
  publicKey: string;
  mnemonic: string;
}> {
  // Convert mnemonic to seed
  const seed = await bip39.mnemonicToSeed(mnemonic);
  
  // Use first 32 bytes as private key
  const privateKeyBuffer = Buffer.from(seed.slice(0, 32));
  
  // Generate key pair from private key
  const keyPair = nacl.sign.keyPair.fromSeed(privateKeyBuffer);
  const publicKeyBuffer = Buffer.from(keyPair.publicKey);
  
  // Generate address
  const address = await createOctraAddress(publicKeyBuffer);
  
  return {
    address,
    privateKey: bufferToBase64(privateKeyBuffer),
    publicKey: bufferToHex(publicKeyBuffer),
    mnemonic
  };
}

export function createTransaction(
  senderAddress: string,
  recipientAddress: string,
  amount: number,
  nonce: number,
  privateKeyBase64: string,
  publicKeyHex: string
): Transaction {
  // Convert amount to micro units (multiply by 1,000,000)
  const amountMu = Math.floor(amount * MU_FACTOR);
  
  // Determine OU based on amount
  const ou = amount < 1000 ? "1" : "3";
  
  // Create timestamp with small random component
  const timestamp = Date.now() / 1000 + Math.random() * 0.01;

  // Create base transaction object
  const transaction: Transaction = {
    from: senderAddress,
    to_: recipientAddress,
    amount: amountMu.toString(),
    nonce,
    ou,
    timestamp
  };

  // Convert transaction to JSON string for signing
  const txString = JSON.stringify(transaction, null, 0);
  
  // Prepare keys for signing
  const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
  
  // Create secret key for nacl (64 bytes: 32 private + 32 public)
  const secretKey = new Uint8Array(64);
  secretKey.set(privateKeyBuffer, 0);
  secretKey.set(publicKeyBuffer, 32);

  // Sign the transaction
  const signature = nacl.sign.detached(new TextEncoder().encode(txString), secretKey);

  // Add signature and public key to transaction
  transaction.signature = Buffer.from(signature).toString('base64');
  transaction.public_key = Buffer.from(publicKeyBuffer).toString('base64');

  return transaction;
}