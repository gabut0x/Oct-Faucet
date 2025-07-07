@echo off
echo 🧪 Testing Environment Variable Loading

echo [INFO] Current directory: %CD%
echo [INFO] Testing different methods to load .env...

echo.
echo [TEST 1] Running debug script...
node debug-env.js

echo.
echo [TEST 2] Testing tsx with explicit env file...
cd backend
echo [INFO] Current backend directory: %CD%
echo [INFO] Checking if .env exists in backend folder...
if exist .env (
    echo [SUCCESS] .env exists in backend folder
    echo [INFO] Content:
    type .env
) else (
    echo [ERROR] .env does not exist in backend folder
)

echo.
echo [TEST 3] Testing environment loading in Node.js...
node -e "require('dotenv').config(); console.log('FAUCET_PRIVATE_KEY exists:', !!process.env.FAUCET_PRIVATE_KEY);"

echo.
echo [TEST 4] Testing with explicit path...
node -e "require('dotenv').config({path: '.env'}); console.log('FAUCET_PRIVATE_KEY exists:', !!process.env.FAUCET_PRIVATE_KEY);"

cd ..
echo.
echo [INFO] Tests complete. Check output above for issues.
pause