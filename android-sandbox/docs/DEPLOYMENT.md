# Deployment Guide

This guide covers various deployment scenarios for the Android Virtual Sandbox system, from single-node development setups to multi-node production clusters.

## 📋 Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 8 cores with hardware virtualization support
- RAM: 16GB (4GB per sandbox minimum)
- Storage: 100GB SSD (20GB per sandbox)
- OS: Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)

**Recommended Requirements:**
- CPU: 16+ cores with VT-x/AMD-V
- RAM: 32GB+ (for 10 concurrent sandboxes)
- Storage: 200GB+ NVMe SSD
- Network: Gigabit Ethernet

### Software Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git 2.0+
- KVM support (hardware virtualization)
- Root/sudo privileges

## 🚀 Quick Deployment

### 1. Single-Node Development Setup

```bash
# Clone repository
git clone <repository-url>
cd android-sandbox

# Configure environment
cp .env.example .env
nano .env  # Edit configuration

# Initialize system
./scripts/deployment/quick-setup.sh

# Start services
docker-compose up -d

# Verify deployment
./scripts/deployment/health-check.sh
```

### 2. Production Setup

```bash
# Clone repository
git clone <repository-url>
cd android-sandbox

# Production configuration
cp .env.production .env
nano .env  # Edit production settings

# Secure setup
./scripts/deployment/production-setup.sh

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Post-deployment verification
./scripts/deployment/production-health-check.sh
```

## 📁 Directory Structure

```
android-sandbox/
├── docker-compose.yml           # Development orchestration
├── docker-compose.prod.yml      # Production orchestration
├── .env.example                 # Environment template
├── Dockerfile                   # Base Android image
├── dashboard/                   # Web interface
│   ├── src/                    # React frontend source
│   ├── server/                 # Node.js backend
│   └── Dockerfile              # Frontend container
├── config/                     # Configuration templates
│   ├── device-templates/       # Device profiles
│   ├── network-profiles/       # Network configurations
│   └── security-policies/      # Security policies
├── network/                    # Network management
│   ├── setup-networks.sh       # Network setup
│   ├── simulate-conditions.sh  # Traffic simulation
│   └── capture-traffic.sh      # Packet capture
├── scripts/                    # Management utilities
│   ├── create-sandbox.sh       # Create sandbox
│   ├── list-sandboxes.sh       # List sandboxes
│   └── delete-sandbox.sh       # Delete sandbox
├── tools/                      # Analysis tools
│   ├── frida-scripts/          # Frida scripts
│   ├── tcpdump-filters/        # Packet filters
│   └── analysis-templates/     # Analysis templates
└── docs/                       # Documentation
```

## 🔧 Configuration

### Environment Variables

**Required Variables:**
```bash
# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://redis:6379

# API Configuration
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

**Optional Variables:**
```bash
# Performance
MAX_CONCURRENT_SANDBOXES=10
SANDBOX_TIMEOUT=300

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Features
ENABLE_REGISTRATION=true
DEFAULT_USER_ROLE=analyst
```

### Production Configuration

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  api:
    image: android-sandbox/api:latest
    restart: always
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  dashboard:
    image: android-sandbox/dashboard:latest
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_DB=android_sandbox
      - POSTGRES_USER=sandbox_admin
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

## 🌐 Network Configuration

### Production Network Setup

```bash
# Create production networks
./network/setup-networks.sh init

# Create dedicated management network
docker network create \
  --driver bridge \
  --subnet=172.21.0.0/16 \
  --gateway=172.21.0.1 \
  android-sandbox-prod

# Create analysis network
docker network create \
  --driver bridge \
  --subnet=172.22.0.0/16 \
  android-sandbox-analysis
```

### Firewall Configuration

```bash
# UFW Configuration
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # API (internal)
sudo ufw allow 3001/tcp    # Dashboard (internal)

# Enable firewall
sudo ufw enable
```

## 🔒 Security Hardening

### 1. SSL/TLS Configuration

```bash
# Generate SSL certificates
./scripts/deployment/setup-ssl.sh your-domain.com

# Configure Nginx reverse proxy
./scripts/deployment/setup-nginx.sh
```

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Security Headers

```javascript
// In server.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3. Database Security

```sql
-- Create dedicated database user
CREATE USER sandbox_app WITH PASSWORD 'secure_password';

-- Grant minimal permissions
GRANT CONNECT ON DATABASE android_sandbox TO sandbox_app;
GRANT USAGE ON SCHEMA public TO sandbox_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sandbox_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO sandbox_app;

-- Revoke unnecessary permissions
REVOKE CREATE ON SCHEMA public FROM sandbox_app;
REVOKE ALL ON DATABASE android_sandbox FROM sandbox_app;
```

## 📊 Monitoring & Logging

### 1. Application Monitoring

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro

volumes:
  prometheus_data:
  grafana_data:
```

### 2. Log Management

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logging/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

volumes:
  elasticsearch_data:
```

## 🔧 Backup & Recovery

### 1. Database Backup

```bash
#!/bin/bash
# scripts/backup/backup-database.sh

BACKUP_DIR="/opt/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/android_sandbox_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U sandbox_admin android_sandbox > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
```

### 2. Configuration Backup

```bash
#!/bin/bash
# scripts/backup/backup-config.sh

BACKUP_DIR="/opt/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/config_$DATE.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup configuration files
tar -czf $BACKUP_FILE \
  config/ \
  scripts/ \
  tools/ \
  docker-compose.yml \
  .env

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Configuration backup completed: $BACKUP_FILE"
```

### 3. Automated Backups

```bash
# Add to crontab
# crontab -e

# Database backup (daily at 2 AM)
0 2 * * * /path/to/android-sandbox/scripts/backup/backup-database.sh

# Configuration backup (weekly on Sunday at 3 AM)
0 3 * * 0 /path/to/android-sandbox/scripts/backup/backup-config.sh

# Health check (every 5 minutes)
*/5 * * * * /path/to/android-sandbox/scripts/deployment/health-check.sh
```

## 🚀 Scaling

### 1. Horizontal Scaling

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  api:
    image: android-sandbox/api:latest
    deploy:
      replicas: 3

  dashboard:
    image: android-sandbox/dashboard:latest
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
```

### 2. Load Balancer Configuration

```nginx
# nginx.conf
upstream api_backend {
    server api_1:3000;
    server api_2:3000;
    server api_3:3000;
}

upstream dashboard_backend {
    server dashboard_1:3000;
    server dashboard_2:3000;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    location /api {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://dashboard_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🔍 Troubleshooting

### Common Deployment Issues

1. **Permission Denied Errors**
   ```bash
   # Fix Docker permissions
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3000

   # Change ports in .env
   API_PORT=3001
   DASHBOARD_PORT=3002
   ```

3. **Memory Issues**
   ```bash
   # Check available memory
   free -h

   # Adjust Docker limits
   echo '{"default-runtime": "nvidia"}' | sudo tee /etc/docker/daemon.json
   ```

4. **Network Issues**
   ```bash
   # Reset Docker networks
   docker network prune

   # Reinitialize networks
   ./network/setup-networks.sh cleanup
   ./network/setup-networks.sh init
   ```

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f api
docker-compose logs -f dashboard

# Check resource usage
docker stats

# Health check
curl -f http://localhost:3000/api/v1/health || echo "Health check failed"

# Database connection test
docker-compose exec postgres psql -U sandbox_admin -d android_sandbox -c "SELECT 1;"
```

## 📚 Additional Resources

- [API Documentation](./api.md)
- [Network Configuration](./network-config.md)
- [Security Guidelines](./security-guidelines.md)
- [Troubleshooting Guide](./troubleshooting.md)

---

For support, please refer to the main [README.md](./README.md) or create an issue in the repository.