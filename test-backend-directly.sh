#!/bin/bash

echo "=== Testing Backend Directly ==="

echo "1. Testing health endpoint..."
curl -v http://localhost:3001/health
echo -e "\n"

echo "2. Testing OPTIONS request to backend..."
curl -X OPTIONS \
  -H "Origin: https://oct-faucet.xme.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v http://localhost:3001/api/faucet/claim
echo -e "\n"

echo "3. Testing POST request to backend..."
curl -X POST \
  -H "Origin: https://oct-faucet.xme.my.id" \
  -H "Content-Type: application/json" \
  -d '{"address":"oct9gTHVFW4f1LnuAy6btBWowA6QYCmPcGXmbKbNiuVSzFZ","recaptchaToken":"test"}' \
  -v http://localhost:3001/api/faucet/claim
echo -e "\n"

echo "=== Testing Through Nginx ==="

echo "4. Testing health through Nginx..."
curl -v https://api-oct-faucet.xme.my.id/health
echo -e "\n"

echo "5. Testing OPTIONS through Nginx..."
curl -X OPTIONS \
  -H "Origin: https://oct-faucet.xme.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v https://api-oct-faucet.xme.my.id/api/faucet/claim
echo -e "\n"