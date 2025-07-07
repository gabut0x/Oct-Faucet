@echo off
echo 🚀 Setting up Octra Faucet Local Development Environment for Windows

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Running as administrator
) else (
    echo [ERROR] This script must be run as administrator
    echo Right-click on Command Prompt and select "Run as administrator"
    pause
    exit /b 1
)

echo.
echo [INFO] Step 1: Installing Caddy...

REM Check if Caddy is installed
caddy version >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Caddy is already installed
) else (
    echo [INFO] Downloading and installing Caddy...
    
    REM Check if chocolatey is installed
    choco --version >nul 2>&1
    if %errorLevel% == 0 (
        echo [INFO] Installing Caddy via Chocolatey...
        choco install caddy -y
    ) else (
        echo [WARNING] Chocolatey not found. Please install Caddy manually:
        echo 1. Download from: https://caddyserver.com/download
        echo 2. Extract to a folder in your PATH
        echo 3. Or install Chocolatey first: https://chocolatey.org/install
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Step 2: Adding local domains to hosts file...

REM Backup hosts file
copy C:\Windows\System32\drivers\etc\hosts C:\Windows\System32\drivers\etc\hosts.backup

REM Add domains to hosts file
findstr /C:"oct-faucet.local" C:\Windows\System32\drivers\etc\hosts >nul
if %errorLevel% neq 0 (
    echo 127.0.0.1 oct-faucet.local >> C:\Windows\System32\drivers\etc\hosts
    echo [SUCCESS] Added oct-faucet.local to hosts file
) else (
    echo [SUCCESS] oct-faucet.local already exists in hosts file
)

findstr /C:"api-oct-faucet.local" C:\Windows\System32\drivers\etc\hosts >nul
if %errorLevel% neq 0 (
    echo 127.0.0.1 api-oct-faucet.local >> C:\Windows\System32\drivers\etc\hosts
    echo [SUCCESS] Added api-oct-faucet.local to hosts file
) else (
    echo [SUCCESS] api-oct-faucet.local already exists in hosts file
)

echo.
echo [INFO] Step 3: Installing Node.js dependencies...

if exist package.json (
    echo [INFO] Installing frontend dependencies...
    npm install
    echo [SUCCESS] Frontend dependencies installed
) else (
    echo [ERROR] package.json not found in current directory
    pause
    exit /b 1
)

if exist backend\package.json (
    echo [INFO] Installing backend dependencies...
    cd backend
    npm install
    cd ..
    echo [SUCCESS] Backend dependencies installed
) else (
    echo [ERROR] backend\package.json not found
    pause
    exit /b 1
)

echo.
echo [INFO] Step 4: Setting up environment files...

REM Frontend environment
if not exist .env (
    copy .env.example .env
    powershell -Command "(gc .env) -replace 'VITE_API_URL=.*', 'VITE_API_URL=https://api-oct-faucet.local' | Out-File -encoding ASCII .env"
    echo [SUCCESS] Frontend .env file created
) else (
    echo [WARNING] Frontend .env file already exists
)

REM Backend environment
if not exist backend\.env (
    copy backend\.env.example backend\.env
    powershell -Command "(gc backend\.env) -replace 'FRONTEND_URL=.*', 'FRONTEND_URL=https://oct-faucet.local' | Out-File -encoding ASCII backend\.env"
    echo [SUCCESS] Backend .env file created
    echo [WARNING] Please update backend\.env with your actual configuration values
) else (
    echo [WARNING] Backend .env file already exists
)

echo.
echo [INFO] Step 5: Installing Redis...

REM Check if Redis is installed
redis-server --version >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Redis is already installed
) else (
    echo [INFO] Installing Redis via Chocolatey...
    choco install redis-64 -y
    if %errorLevel% == 0 (
        echo [SUCCESS] Redis installed successfully
    ) else (
        echo [WARNING] Failed to install Redis via Chocolatey
        echo Please install Redis manually from: https://github.com/microsoftarchive/redis/releases
    )
)

echo.
echo [SUCCESS] 🎉 Local development environment setup complete!
echo.
echo [INFO] Next steps:
echo 1. Update backend\.env with your actual configuration values
echo 2. Open 3 separate Command Prompt windows and run:
echo    - Frontend: npm run dev
echo    - Backend: cd backend ^&^& npm run dev  
echo    - Caddy: caddy run
echo.
echo [INFO] Your applications will be available at:
echo - Frontend: https://oct-faucet.local
echo - Backend API: https://api-oct-faucet.local
echo.
echo Press any key to continue...
pause >nul