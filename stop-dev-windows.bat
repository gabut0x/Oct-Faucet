@echo off
echo 🛑 Stopping Octra Faucet Development Environment

echo [INFO] Stopping development servers...

REM Kill Node.js processes (frontend and backend)
taskkill /f /im node.exe >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Node.js processes stopped
) else (
    echo [INFO] No Node.js processes were running
)

REM Kill Caddy processes
taskkill /f /im caddy.exe >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Caddy processes stopped
) else (
    echo [INFO] No Caddy processes were running
)

REM Stop Redis service
redis-server --service-stop >nul 2>&1
if %errorLevel__ == 0 (
    echo [SUCCESS] Redis service stopped
) else (
    echo [INFO] Redis service was not running or failed to stop
)

echo.
echo [SUCCESS] All development servers have been stopped
echo.
pause