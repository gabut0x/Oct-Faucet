// Script untuk generate development keys
const crypto = require('crypto');
const nacl = require('tweetnacl');

console.log('🔑 Generating development keys for Octra Faucet...\n');

// Generate a random private key (32 bytes)
const privateKey = crypto.randomBytes(32);
const privateKeyBase64 = privateKey.toString('base64');

// Generate key pair from private key
const keyPair = nacl.sign.keyPair.fromSeed(privateKey);
const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');

// Generate a mock Octra address
const addressHash = crypto.createHash('sha256').update(keyPair.publicKey).digest();
const address = 'oct' + addressHash.slice(0, 20).toString('hex');

console.log('Generated Development Keys:');
console.log('==========================');
console.log(`FAUCET_PRIVATE_KEY=${privateKeyBase64}`);
console.log(`FAUCET_PUBLIC_KEY=${publicKeyHex}`);
console.log(`FAUCET_ADDRESS=${address}`);
console.log('');
console.log('⚠️  WARNING: These keys are for DEVELOPMENT ONLY!');
console.log('   Do NOT use these keys in production!');
console.log('');
console.log('📝 Copy these values to your backend/.env file');