# Quick Fix untuk Error Environment Variables

## Problem
```
Error: FAUCET_PRIVATE_KEY environment variable is required
Error: FAUCET_PRIVATE_KEY is not configured
```

## Solution

### Opsi 1: Quick Fix Script (Recommended)
```cmd
quick-fix-env.bat
```

### Opsi 2: Manual Steps

1. **Generate development keys:**
   ```cmd
   node generate-dev-keys.js
   ```

2. **Copy keys ke backend/.env:**
   ```cmd
   copy backend\.env.development backend\.env
   ```

3. **Update backend/.env dengan keys yang di-generate**

### Opsi 3: Manual Configuration

Buat file `backend\.env` dengan content:

```env
# Development Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=https://oct-faucet.local
REDIS_URL=redis://localhost:6379

# Development Faucet Keys (DEVELOPMENT ONLY!)
FAUCET_PRIVATE_KEY=dGVzdC1wcml2YXRlLWtleS1mb3ItZGV2ZWxvcG1lbnQtb25seQ==
FAUCET_PUBLIC_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
FAUCET_ADDRESS=oct1234567890abcdefghijklmnopqrstuvwxyz

# reCAPTCHA Test Keys
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe

# Other settings
OCTRA_RPC_URL=https://octra.network
LOG_LEVEL=debug
TRUST_PROXY=true
```

## Setelah Fix

Jalankan development servers:

```cmd
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
npm run dev

# Terminal 3 - Caddy
caddy run
```

## Important Notes

⚠️ **WARNING**: Keys yang di-generate hanya untuk development!

- Jangan gunakan keys ini di production
- Generate keys baru untuk production yang aman
- Simpan production keys dengan aman

## Test Environment

Setelah setup, test di:
- Frontend: https://oct-faucet.local
- Backend: https://api-oct-faucet.local/health

## Troubleshooting

Jika masih error:
1. Pastikan file `backend\.env` ada dan berisi keys
2. Restart backend server
3. Check console untuk error lainnya