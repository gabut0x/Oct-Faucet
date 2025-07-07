@echo off
echo 🔧 Setting up development environment variables...

REM Check if we're in the right directory
if not exist backend\package.json (
    echo [ERROR] Please run this script from the project root directory
    pause
    exit /b 1
)

echo [INFO] Generating development keys...
node generate-dev-keys.js > temp-keys.txt

echo.
echo [INFO] Setting up backend environment file...

REM Create backend .env from development template
copy backend\.env.development backend\.env

echo [SUCCESS] Backend .env file created with development configuration
echo.
echo [INFO] Generated keys saved to temp-keys.txt
echo [WARNING] These are DEVELOPMENT KEYS ONLY - do not use in production!
echo.
echo [INFO] You can now start the development servers:
echo   1. npm run dev (frontend)
echo   2. cd backend ^&^& npm run dev (backend)
echo   3. caddy run (reverse proxy)
echo.
pause