// Script untuk debug environment variables
const path = require('path');
const fs = require('fs');

console.log('🔍 Debugging Environment Variables...\n');

// Check current working directory
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Check if .env file exists
const envPath = path.join(process.cwd(), 'backend', '.env');
console.log('Looking for .env at:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    console.log('\n📄 .env file contents:');
    console.log('========================');
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log(envContent);
    console.log('========================\n');
}

// Check environment variables
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FAUCET_PRIVATE_KEY exists:', !!process.env.FAUCET_PRIVATE_KEY);
console.log('FAUCET_PRIVATE_KEY length:', process.env.FAUCET_PRIVATE_KEY?.length || 0);
console.log('FAUCET_PUBLIC_KEY exists:', !!process.env.FAUCET_PUBLIC_KEY);
console.log('FAUCET_ADDRESS:', process.env.FAUCET_ADDRESS);

// List all environment variables that start with FAUCET
console.log('\nAll FAUCET_* environment variables:');
Object.keys(process.env)
    .filter(key => key.startsWith('FAUCET_'))
    .forEach(key => {
        console.log(`${key}:`, process.env[key] ? 'SET' : 'NOT_SET');
    });