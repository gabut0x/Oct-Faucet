@echo off
echo 🔧 Fixing Environment Variable Loading Issue

echo [INFO] Step 1: Debugging current environment...
node debug-env.js

echo.
echo [INFO] Step 2: Checking if backend/.env exists...
if exist backend\.env (
    echo [SUCCESS] backend\.env file exists
    echo [INFO] Content preview:
    type backend\.env | findstr /C:"FAUCET_"
) else (
    echo [ERROR] backend\.env file does not exist!
    echo [INFO] Creating from template...
    copy backend\.env.development backend\.env
    echo [SUCCESS] Created backend\.env from template
)

echo.
echo [INFO] Step 3: Installing required dependencies...
cd backend
npm install dotenv tweetnacl
cd ..

echo.
echo [INFO] Step 4: Generating fresh development keys...
node generate-dev-keys.js > temp-keys.txt

echo.
echo [INFO] Step 5: Updating backend/.env with generated keys...
for /f "tokens=1,2 delims==" %%a in (temp-keys.txt) do (
    if "%%a"=="FAUCET_PRIVATE_KEY" (
        powershell -Command "(gc backend\.env) -replace 'FAUCET_PRIVATE_KEY=.*', 'FAUCET_PRIVATE_KEY=%%b' | Out-File -encoding ASCII backend\.env"
    )
    if "%%a"=="FAUCET_PUBLIC_KEY" (
        powershell -Command "(gc backend\.env) -replace 'FAUCET_PUBLIC_KEY=.*', 'FAUCET_PUBLIC_KEY=%%b' | Out-File -encoding ASCII backend\.env"
    )
    if "%%a"=="FAUCET_ADDRESS" (
        powershell -Command "(gc backend\.env) -replace 'FAUCET_ADDRESS=.*', 'FAUCET_ADDRESS=%%b' | Out-File -encoding ASCII backend\.env"
    )
)

echo.
echo [INFO] Step 6: Verifying environment setup...
echo [INFO] Final backend/.env content:
type backend\.env

echo.
echo [SUCCESS] ✅ Environment fix complete!
echo.
echo [INFO] Now try running the backend:
echo   cd backend
echo   npm run dev
echo.
echo [INFO] If still having issues, check the debug output above
echo.
del temp-keys.txt 2>nul
pause