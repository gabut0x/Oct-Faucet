# Security Guide for Production Deployment

## 🔐 Private Key Security

### Environment Variables
Never hardcode private keys in your source code. Use environment variables:

```bash
# Backend .env file
FAUCET_PRIVATE_KEY=your-base64-encoded-private-key
FAUCET_PUBLIC_KEY=your-hex-encoded-public-key
FAUCET_ADDRESS=oct1234567890abcdef
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
```

### Key Management Best Practices

1. **Use a dedicated faucet wallet** - Never use your main wallet
2. **Limit faucet wallet balance** - Only keep enough for daily operations
3. **Regular key rotation** - Change keys periodically
4. **Secure storage** - Use cloud secret managers (AWS Secrets Manager, Azure Key Vault, etc.)
5. **Access control** - Limit who has access to production keys

### Hardware Security Modules (HSM)
For maximum security, consider using HSM for key storage:

```typescript
// Example with AWS KMS
import { KMSClient, DecryptCommand } from "@aws-sdk/client-kms";

async function getDecryptedPrivateKey(): Promise<string> {
  const kmsClient = new KMSClient({ region: "us-east-1" });
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(process.env.ENCRYPTED_PRIVATE_KEY!, 'base64')
  });
  
  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}
```

## 🛡️ Production Security Checklist

### Server Security
- [ ] Use HTTPS with valid SSL certificates
- [ ] Enable firewall (only allow necessary ports)
- [ ] Regular security updates
- [ ] Use non-root user for application
- [ ] Implement proper logging and monitoring
- [ ] Set up intrusion detection

### Application Security
- [ ] Rate limiting on all endpoints
- [ ] Input validation and sanitization
- [ ] CORS configuration
- [ ] Security headers (helmet.js)
- [ ] Error handling (don't leak sensitive info)
- [ ] Regular dependency updates

### Database Security
- [ ] Redis authentication
- [ ] Network isolation
- [ ] Regular backups
- [ ] Data encryption at rest

### Monitoring & Alerts
- [ ] Set up alerts for:
  - High error rates
  - Unusual traffic patterns
  - Low faucet balance
  - Failed authentication attempts
  - Server resource usage

## 🚨 Incident Response

### If Private Key is Compromised
1. **Immediately** stop the faucet service
2. Transfer remaining funds to a new secure wallet
3. Generate new wallet credentials
4. Update environment variables
5. Investigate how the compromise occurred
6. Implement additional security measures

### Emergency Contacts
- Maintain a list of emergency contacts
- Document incident response procedures
- Regular security drills

## 📊 Security Monitoring

### Log Analysis
Monitor logs for:
- Multiple failed reCAPTCHA attempts
- Unusual IP patterns
- High-frequency requests
- Error spikes

### Metrics to Track
- Request rates per IP
- Success/failure ratios
- Geographic distribution of requests
- Faucet balance trends

## 🔄 Regular Security Tasks

### Daily
- [ ] Check faucet balance
- [ ] Review error logs
- [ ] Monitor request patterns

### Weekly
- [ ] Security log analysis
- [ ] Dependency vulnerability scan
- [ ] Backup verification

### Monthly
- [ ] Security audit
- [ ] Key rotation consideration
- [ ] Update security documentation
- [ ] Penetration testing

## 🛠️ Deployment Security

### Docker Security
```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S faucet -u 1001
USER faucet

# Minimal base image
FROM node:18-alpine

# Security scanning
RUN npm audit --audit-level high
```

### Nginx Security
```nginx
# Security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

# Rate limiting
limit_req_zone $binary_remote_addr zone=faucet:10m rate=1r/m;
limit_req zone=faucet burst=5 nodelay;
```

Remember: Security is an ongoing process, not a one-time setup!