@echo off
echo 🚀 Starting Octra Faucet Development Environment

REM Check if all required files exist
if not exist Caddyfile (
    echo [ERROR] Caddyfile not found
    echo Please make sure you're in the project root directory
    pause
    exit /b 1
)

if not exist .env (
    echo [ERROR] .env file not found
    echo Please run setup-local-dev-windows.bat first
    pause
    exit /b 1
)

if not exist backend\.env (
    echo [ERROR] backend\.env file not found
    echo Please run setup-local-dev-windows.bat first
    pause
    exit /b 1
)

echo [INFO] Starting development servers...
echo.
echo This will open 3 Command Prompt windows:
echo 1. Frontend (Vite dev server)
echo 2. Backend (Node.js API server)
echo 3. Caddy (Reverse proxy)
echo.

REM Start Redis if not running
echo [INFO] Starting Redis...
redis-server --service-start >nul 2>&1

REM Start frontend in new window
echo [INFO] Starting frontend server...
start "Frontend - Vite Dev Server" cmd /k "npm run dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start backend in new window
echo [INFO] Starting backend server...
start "Backend - API Server" cmd /k "cd backend && npm run dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start Caddy in new window
echo [INFO] Starting Caddy reverse proxy...
start "Caddy - Reverse Proxy" cmd /k "caddy run"

echo.
echo [SUCCESS] All development servers are starting...
echo.
echo [INFO] Your applications will be available at:
echo - Frontend: https://oct-faucet.local
echo - Backend API: https://api-oct-faucet.local
echo.
echo [INFO] To stop all servers, close all the Command Prompt windows
echo or press Ctrl+C in each window.
echo.
echo Press any key to exit this launcher...
pause >nul