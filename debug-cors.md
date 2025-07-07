# Debug CORS Issue - Step by Step

## Step 1: Check if Backend is Running
```bash
# Check if your Node.js backend is running on port 3001
curl http://localhost:3001/health

# Expected response: JSON with status "ok"
```

## Step 2: Test Backend CORS Directly
```bash
# Test OPTIONS request directly to backend (bypass Nginx)
curl -X OPTIONS \
  -H "Origin: https://oct-faucet.xme.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v http://localhost:3001/api/faucet/claim

# Expected: Should return 200 with CORS headers
```

## Step 3: Test Through Nginx
```bash
# Test OPTIONS request through Nginx
curl -X OPTIONS \
  -H "Origin: https://oct-faucet.xme.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v https://api-oct-faucet.xme.my.id/api/faucet/claim

# This should also return 200 with CORS headers
```

## Step 4: Check Nginx Configuration
```bash
# Check if Nginx configuration is valid
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

## Step 5: Check Backend Logs
```bash
# If using PM2
pm2 logs faucet-backend

# If running directly
# Check your backend console output for CORS messages
```