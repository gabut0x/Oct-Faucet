@echo off
echo 🚀 Quick Fix untuk Environment Variables

echo [INFO] Installing required dependencies...
cd backend
npm install tweetnacl
cd ..

echo [INFO] Generating development keys...
node generate-dev-keys.js

echo.
echo [INFO] Creating backend .env file...
copy backend\.env.development backend\.env

echo.
echo [SUCCESS] ✅ Environment setup complete!
echo.
echo [INFO] Sekarang Anda bisa menjalankan:
echo   1. cd backend ^&^& npm run dev
echo   2. npm run dev (di terminal lain)
echo   3. caddy run (di terminal lain)
echo.
echo [WARNING] Keys yang di-generate hanya untuk development!
echo.
pause