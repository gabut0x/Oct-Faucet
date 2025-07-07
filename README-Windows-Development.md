# Setup Development Local di Windows dengan Caddy

## Prerequisites

1. **Node.js** (versi 18 atau lebih baru)
   - Download dari: https://nodejs.org/
   - Pastikan `npm` tersedia di PATH

2. **Git** (opsional, untuk clone repository)
   - Download dari: https://git-scm.com/

3. **Chocolatey** (package manager untuk Windows)
   - Install dari: https://chocolatey.org/install
   - Atau install Caddy secara manual

## Langkah-langkah Setup

### 1. Setup Otomatis (Recommended)

1. **Buka Command Prompt sebagai Administrator**
   - Klik kanan pada "Command Prompt" 
   - Pilih "Run as administrator"

2. **Jalankan script setup**
   ```cmd
   setup-local-dev-windows.bat
   ```

3. **Script akan otomatis:**
   - Install Caddy (via Chocolatey)
   - Menambahkan domain lokal ke hosts file
   - Install dependencies Node.js
   - Setup file environment
   - Install Redis

### 2. Setup Manual (Jika script gagal)

#### Install Caddy
```cmd
# Via Chocolatey (recommended)
choco install caddy -y

# Atau download manual dari https://caddyserver.com/download
```

#### Edit Hosts File
Buka file `C:\Windows\System32\drivers\etc\hosts` sebagai Administrator dan tambahkan:
```
127.0.0.1 oct-faucet.local
127.0.0.1 api-oct-faucet.local
```

#### Install Dependencies
```cmd
# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..
```

#### Setup Environment Files
```cmd
# Copy dan edit file environment
copy .env.example .env
copy backend\.env.example backend\.env
```

Edit file `.env`:
```env
VITE_API_URL=https://api-oct-faucet.local
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

Edit file `backend\.env`:
```env
FRONTEND_URL=https://oct-faucet.local
# ... konfigurasi lainnya
```

#### Install Redis
```cmd
# Via Chocolatey
choco install redis-64 -y

# Atau download dari: https://github.com/microsoftarchive/redis/releases
```

## Menjalankan Development Environment

### Opsi 1: Menggunakan Script (Recommended)
```cmd
start-dev-windows.bat
```

### Opsi 2: Manual (3 Command Prompt terpisah)

**Terminal 1 - Frontend:**
```cmd
npm run dev
```

**Terminal 2 - Backend:**
```cmd
cd backend
npm run dev
```

**Terminal 3 - Caddy:**
```cmd
caddy run
```

## Akses Aplikasi

- **Frontend**: https://oct-faucet.local
- **Backend API**: https://api-oct-faucet.local
- **Health Check**: https://api-oct-faucet.local/health

## Menghentikan Development Environment

### Opsi 1: Menggunakan Script
```cmd
stop-dev-windows.bat
```

### Opsi 2: Manual
- Tekan `Ctrl+C` di setiap Command Prompt window
- Atau tutup semua Command Prompt windows

## Troubleshooting

### 1. "Access Denied" saat menjalankan script
- Pastikan menjalankan Command Prompt sebagai Administrator
- Klik kanan pada Command Prompt → "Run as administrator"

### 2. Caddy tidak bisa bind ke port 80/443
```cmd
# Hentikan IIS jika berjalan
net stop iisadmin
net stop w3svc

# Atau gunakan port lain di Caddyfile
```

### 3. Domain tidak bisa diakses
- Pastikan hosts file sudah diupdate dengan benar
- Flush DNS cache:
```cmd
ipconfig /flushdns
```

### 4. Redis connection error
```cmd
# Start Redis service
redis-server --service-start

# Atau install ulang Redis
choco uninstall redis-64
choco install redis-64 -y
```

### 5. Node.js dependencies error
```cmd
# Clear npm cache
npm cache clean --force

# Delete node_modules dan install ulang
rmdir /s node_modules
rmdir /s backend\node_modules
npm install
cd backend && npm install
```

### 6. CORS errors
- Pastikan Caddy berjalan dengan benar
- Check Caddyfile configuration
- Pastikan backend environment FRONTEND_URL sudah benar

## File Konfigurasi Penting

- `Caddyfile` - Konfigurasi reverse proxy
- `.env` - Environment variables frontend
- `backend\.env` - Environment variables backend
- `C:\Windows\System32\drivers\etc\hosts` - Domain mapping

## Tips Development

1. **Hot Reload**: Semua perubahan code akan otomatis reload
2. **HTTPS**: Caddy otomatis generate self-signed certificates
3. **Logs**: Check console di setiap Command Prompt window untuk debugging
4. **Database**: Redis data tersimpan di memory, akan hilang saat restart

## Struktur Port

- Frontend (Vite): `localhost:5173`
- Backend (Express): `localhost:3001`
- Redis: `localhost:6379`
- Caddy: `localhost:80` & `localhost:443`

## Next Steps

1. Update `backend\.env` dengan konfigurasi yang sesuai
2. Setup reCAPTCHA keys
3. Konfigurasi faucet wallet credentials
4. Test semua functionality

Selamat coding! 🚀