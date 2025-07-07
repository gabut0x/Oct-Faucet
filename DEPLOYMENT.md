# Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Redis
- Docker (optional)
- SSL certificate
- Domain name

### 1. Backend Setup

```bash
# Clone and setup backend
cd backend
npm install
cp .env.example .env

# Configure environment variables
nano .env
```

### 2. Environment Configuration

```bash
# Backend .env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
REDIS_URL=redis://localhost:6379

# Faucet Configuration (SECURE THESE!)
FAUCET_PRIVATE_KEY=your-base64-private-key
FAUCET_PUBLIC_KEY=your-hex-public-key
FAUCET_ADDRESS=oct1234567890abcdef

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your-secret-key

# Frontend .env
VITE_API_URL=https://api.your-domain.com
VITE_RECAPTCHA_SITE_KEY=your-site-key
```

### 3. Database Setup

```bash
# Install and start Redis
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Secure Redis
sudo nano /etc/redis/redis.conf
# Add: requirepass your-strong-password
sudo systemctl restart redis-server
```

### 4. SSL Certificate

```bash
# Using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com -d api.your-domain.com
```

### 5. Nginx Configuration

```nginx
# /etc/nginx/sites-available/faucet
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=faucet:10m rate=10r/m;
    limit_req zone=faucet burst=20 nodelay;
    
    location / {
        root /var/www/faucet;
        try_files $uri $uri/ /index.html;
    }
}

# API server
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. Process Management

```bash
# Install PM2
npm install -g pm2

# Backend process
cd backend
pm2 start dist/server.js --name "faucet-backend"
pm2 save
pm2 startup
```

### 7. Frontend Build & Deploy

```bash
# Build frontend
npm run build

# Deploy to web server
sudo cp -r dist/* /var/www/faucet/
sudo chown -R www-data:www-data /var/www/faucet
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Clone repository
git clone <your-repo>
cd octra-faucet

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Individual Docker Commands

```bash
# Build backend
cd backend
docker build -t octra-faucet-backend .

# Run with environment file
docker run -d \
  --name faucet-backend \
  --env-file .env \
  -p 3001:3001 \
  octra-faucet-backend

# Run Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

## 🔧 Monitoring Setup

### Health Checks

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3001/health || echo "Faucet backend down" | mail -s "Alert" admin@your-domain.com
```

### Log Rotation

```bash
# /etc/logrotate.d/faucet
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 faucet faucet
    postrotate
        pm2 reload faucet-backend
    endscript
}
```

### Monitoring with Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'faucet-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

## 🔐 Security Hardening

### Firewall Setup

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Fail2Ban

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure for nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-req-limit]
enabled = true
filter = nginx-req-limit
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

## 📊 Performance Optimization

### Redis Optimization

```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Nginx Caching

```nginx
# Add to nginx config
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🔄 Backup Strategy

### Database Backup

```bash
#!/bin/bash
# backup-redis.sh
DATE=$(date +%Y%m%d_%H%M%S)
redis-cli --rdb /backup/redis_backup_$DATE.rdb
find /backup -name "redis_backup_*.rdb" -mtime +7 -delete
```

### Application Backup

```bash
#!/bin/bash
# backup-app.sh
tar -czf /backup/faucet_app_$(date +%Y%m%d).tar.gz /app
find /backup -name "faucet_app_*.tar.gz" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check Redis memory
   redis-cli info memory
   
   # Optimize if needed
   redis-cli flushdb
   ```

2. **Rate Limit Issues**
   ```bash
   # Check nginx error logs
   tail -f /var/log/nginx/error.log
   
   # Adjust rate limits if needed
   ```

3. **SSL Certificate Renewal**
   ```bash
   # Test renewal
   sudo certbot renew --dry-run
   
   # Add to crontab
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Log Analysis

```bash
# Backend logs
pm2 logs faucet-backend

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# System logs
journalctl -u nginx -f
```

## 📈 Scaling Considerations

### Load Balancing

```nginx
upstream faucet_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    location / {
        proxy_pass http://faucet_backend;
    }
}
```

### Database Clustering

```bash
# Redis Cluster setup
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

Remember to test everything in a staging environment first!