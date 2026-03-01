# 🚀 Guida alla distribuzione

## Panoramica

Questa guida illustra la distribuzione dell'applicazione Darts Tournament Manager dagli ambienti di sviluppo a quelli di produzione.

---

## Sommario

- [Prerequisiti](#prerequisiti)
- [Configurazione dell'ambiente](#configurazione-dellambiente)
- [Distribuzione dello sviluppo](#distribuzione-dello-sviluppo)
- [Distribuzione della produzione](#distribuzione-della-produzione)
- [Distribuzione Docker](#distribuzione-docker)
- [Distribuzione sul cloud](#distribuzione-sul-cloud)
- [Configurazione del database](#configurazione-del-database)
- [Monitoraggio e manutenzione](#monitoraggio-e-manutenzione)
- [Risoluzione dei problemi](#risoluzione-dei-problemi)

---

## Prerequisiti

### Software richiesto

| Software | Versione minima | Scopo |
|----------|----------------|---------|
| Node.js | 20.0.0 | Ambiente di esecuzione |
| npm | 10.0.0 | Gestore pacchetti |
| PostgreSQL | 14.0| Banca dati |
| Redis | 6.0 | Caching e sessioni |
| Docker (facoltativo) | 20.0| Containerizzazione |
| Git | 2.30| Controllo della versione |

### Requisiti di sistema

**Sviluppo:**
- Minimo 4 GB di RAM
- Spazio su disco 10 GB
-CPU dual-core

**Produzione:**
- Si consigliano 8 GB di RAM
- Si consigliano 50 GB di spazio su disco
- Consigliata CPU quad-core
-Certificato SSL

---

## Configurazione dell'ambiente

### Variabili di ambiente backend (`backend/.env`)

```env
# ===== Database =====
DATABASE_URL="postgresql://user:password@localhost:5432/darts_tournament"

# ===== Redis =====
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379

# ===== Server =====
NODE_ENV="production"           # development | production | test
PORT=3000
HOST="0.0.0.0"

# ===== Security =====
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# ===== Auth0 Authentication =====
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"
AUTH_ADMIN_EMAILS="admin1@example.com,admin2@example.com"

# ===== CORS =====
CORS_ORIGIN="https://yourdomain.com"

# ===== File Upload =====
UPLOAD_MAX_FILE_SIZE=5242880                # 5MB in bytes
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png"
UPLOAD_DIR="./uploads"

# ===== Logging =====
LOG_LEVEL="info"                # error | warn | info | debug
LOG_FILE_MAX_SIZE="20m"
LOG_FILE_MAX_FILES="14d"

# ===== Rate Limiting =====
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Variabili di ambiente frontend (`frontend/.env`)

```env
# ===== Auth0 =====
VITE_AUTH_ENABLED=true
VITE_AUTH0_DOMAIN="your-tenant.eu.auth0.com"
VITE_AUTH0_CLIENT_ID="your_client_id"
VITE_AUTH0_AUDIENCE="https://api.yourdomain.com"
VITE_AUTH0_CACHE_LOCATION="memory"

# ===== OAuth Connections =====
VITE_AUTH0_CONNECTION_GOOGLE="google-oauth2"
VITE_AUTH0_CONNECTION_FACEBOOK="facebook"
VITE_AUTH0_CONNECTION_INSTAGRAM="instagram"

# ===== API =====
VITE_API_URL="https://api.yourdomain.com"
```

**⚠️ Avviso di sicurezza:**
- Non inviare mai file `.env` a Git
- Utilizza `.env.example` come modello
- Ruota regolarmente i segreti nella produzione
- Utilizzare configurazioni specifiche dell'ambiente
- Conserva `VITE_AUTH0_CACHE_LOCATION=memory` a meno che non siano necessarie sessioni del browser persistenti

---

## Distribuzione dello sviluppo

### Avvio rapido (consigliato)

```bash
# 1. Clone repository
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament

# 2. Run installation script
./install.sh

# 3. Start services
./restart.sh both
```

### Configurazione manuale

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Setup database
npm run db:migrate
npm run db:seed  # Optional: sample data

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Start backend
cd ../backend
npm run dev         # Runs on http://localhost:3000

# 5. Start frontend (new terminal)
cd ../frontend
npm run dev         # Runs on http://localhost:5173
```

### Sviluppo Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend frontend

# Stop services
docker compose down
```

Nota: lo sviluppo docker-compose monta volumi denominati per rendere persistenti i registri dei tornei di backend su `/app/backend/logs` e carica i loghi dei tornei su `/app/backend/uploads`.

---

## Distribuzione della produzione

### 1. Configurazione del server

#### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install nginx (reverse proxy)
sudo apt install -y nginx

# Install certbot (SSL certificates)
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2. Clona e costruisci

```bash
# Create app directory
sudo mkdir -p /var/www/darts_tournament
sudo chown $USER:$USER /var/www/darts_tournament

# Clone repository
cd /var/www/darts_tournament
git clone https://github.com/grozours/darts_tournament.git .

# Install dependencies
cd backend
npm ci --production
cd ../frontend
npm ci

# Build frontend
npm run build
```

### 3. Impostazione del database

```bash
# Create database user
sudo -u postgres psql
CREATE USER darts_user WITH PASSWORD 'secure_password';
CREATE DATABASE darts_tournament;
GRANT ALL PRIVILEGES ON DATABASE darts_tournament TO darts_user;
\q

# Run migrations
cd /var/www/darts_tournament/backend
npm run db:migrate
```

### 4. Configura l'ambiente

```bash
# Backend environment
cd /var/www/darts_tournament/backend
cp .env.example .env
nano .env  # Edit with production values

# Frontend environment (if needed for build)
cd /var/www/darts_tournament/frontend
cp .env.example .env.production
nano .env.production
```

### 5. Configura Nginx

Crea `/etc/nginx/sites-available/darts_tournament`:

```nginx
# Backend API server
upstream backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Frontend static files
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend static files
    location / {
        root /var/www/darts_tournament/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/www/darts_tournament/backend/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

Abilita sito:

```bash
sudo ln -s /etc/nginx/sites-available/darts_tournament /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Certificato SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

### 7. Avvia il backend con PM2

```bash
cd /var/www/darts_tournament/backend

# Start backend
pm2 start npm --name "darts-backend" -- start

# Setup PM2 startup script
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs darts-backend
```

#### File dell'ecosistema PM2 (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'darts-backend',
    script: 'dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

Utilizzo:

```bash
pm2 start ecosystem.config.js
```

---

## Distribuzione Docker

### Produzione Docker Componi

Crea `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: darts_tournament
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/darts_tournament
      REDIS_HOST: redis
      REDIS_PORT: 6379
    env_file:
      - ./backend/.env.production
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
      - web

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    networks:
      - web

volumes:
  postgres_data:
  redis_data:

networks:
  internal:
    driver: bridge
  web:
    driver: bridge
```

Distribuire:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Distribuzione sul cloud

### Distribuzione AWS

#### 1. Configurazione dell'istanza EC2

```bash
# Launch EC2 instance (Ubuntu 22.04, t3.medium)
# Security groups: Allow 22, 80, 443

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Follow standard server setup above
```

#### 2. RDS (PostgreSQL)

```bash
# Create RDS PostgreSQL instance
# Update DATABASE_URL in backend/.env
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/darts_tournament"
```

#### 3. ElastiCache (Redis)

```bash
# Create ElastiCache Redis cluster
# Update REDIS_HOST in backend/.env
REDIS_HOST="your-redis-endpoint.cache.amazonaws.com"
REDIS_PORT=6379
```

#### 4. S3 per l'archiviazione di file

```bash
# Create S3 bucket for uploads
# Configure IAM role for EC2

# Install AWS SDK
npm install aws-sdk

# Update upload middleware to use S3
```

#### 5. CloudFront (CDN)

```bash
# Create CloudFront distribution
# Origin: EC2 instance
# Alternate domain: yourdomain.com
# SSL certificate: ACM
```

### Distribuzione nell'oceano digitale

#### Piattaforma dell'app

```yaml
# app.yaml
name: darts-tournament
region: nyc

databases:
  - name: db
    engine: PG
    version: "14"
    size: db-s-1vcpu-1gb
    
services:
  - name: backend
    github:
      repo: grozours/darts_tournament
      branch: main
      deploy_on_push: true
    build_command: cd backend && npm ci && npm run build
    run_command: cd backend && npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
      - key: NODE_ENV
        value: production
    
  - name: frontend
    github:
      repo: grozours/darts_tournament
      branch: main
    build_command: cd frontend && npm ci && npm run build
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
    routes:
      - path: /
```

Distribuire:

```bash
doctl apps create --spec app.yaml
```

### Distribuzione di Heroku

```bash
# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set AUTH_ISSUER_BASE_URL=https://your-tenant.auth0.com

# Deploy
git push heroku main

# Run migrations
heroku run npm run db:migrate --app your-app-name
```

---

## Configurazione del database

### Migrazione iniziale

```bash
cd backend
npm run db:migrate
```

### Semina dei dati

```bash
# Development
npm run db:seed

# Production (careful!)
NODE_ENV=production npm run db:seed
```

### Backup e ripristino

#### Backup

```bash
# Local PostgreSQL
pg_dump -U darts_user -h localhost darts_tournament > backup_$(date +%Y%m%d).sql

# Remote PostgreSQL
pg_dump -U username -h your-rds-endpoint darts_tournament > backup.sql
```

#### Ripristina

```bash
# Local
psql -U darts_user -h localhost darts_tournament < backup.sql

# Remote
psql -U username -h your-rds-endpoint darts_tournament < backup.sql
```

### Backup automatici (Cron)

```bash
# Edit crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * pg_dump -U darts_user darts_tournament > /backups/darts_$(date +\%Y\%m\%d).sql

# Weekly cleanup (keep last 30 days)
0 3 * * 0 find /backups -name "darts_*.sql" -mtime +30 -delete
```

---

## Monitoraggio e manutenzione

### Monitoraggio delle applicazioni

#### Monitoraggio PM2

```bash
# Status
pm2 status

# Logs
pm2 logs darts-backend

# Real-time monitoring
pm2 monit

# Resource usage
pm2 describe darts-backend
```

#### Gestione dei registri

```bash
# View logs
cd /var/www/darts_tournament/backend/logs

# Rotate logs (logrotate)
sudo nano /etc/logrotate.d/darts_tournament
```

```
/var/www/darts_tournament/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
}
```

### Manutenzione del database

```sql
-- Vacuum tables
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('darts_tournament'));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Reindex
REINDEX DATABASE darts_tournament;
```

### Controlli sanitari

```bash
# Backend health
curl http://localhost:3000/health

# Database connection
psql -U darts_user -h localhost -c "SELECT 1"

# Redis connection
redis-cli ping
```

### Monitoraggio del tempo di attività

Utilizza servizi come:
- **UptimeRobot**: monitoraggio gratuito del tempo di attività
- **Pingdom**: monitoraggio avanzato
- **Datadog**: monitoraggio delle prestazioni dell'applicazione
- **Nuova reliquia**: osservabilità dello stack completo

---

## Risoluzione dei problemi

### Problemi comuni

#### 1. Il backend non si avvia

```bash
# Check logs
pm2 logs darts-backend --lines 50

# Check port availability
sudo lsof -i :3000

# Verify environment variables
cat backend/.env

# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Errori 404 del frontend

```bash
# Check nginx configuration
sudo nginx -t

# Verify build files exist
ls -la /var/www/darts_tournament/frontend/dist

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

#### 3. Errori di connessione al database

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify firewall rules
sudo ufw status

# Test connection
psql -U darts_user -h localhost -d darts_tournament
```

#### 4. Errori di connessione Redis

```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

#### 5. Problemi di connessione WebSocket

```nginx
# Ensure nginx WebSocket proxy is configured
location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Problemi di prestazioni

#### Utilizzo elevato della CPU

```bash
# Check PM2 status
pm2 status

# Restart app
pm2 restart darts-backend

# Increase instances
pm2 scale darts-backend 4
```

#### Perdite di memoria

```bash
# Monitor memory
pm2 monit

# Set max memory restart
pm2 start ecosystem.config.js --max-memory-restart 1G
```

#### Query lente sul database

```sql
-- Enable query logging
ALTER DATABASE darts_tournament SET log_statement = 'all';

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
```

---

## Aggiornamenti continui

### Distribuzione senza tempi di inattività

```bash
# Pull latest code
cd /var/www/darts_tournament
git pull origin main

# Install dependencies
cd backend && npm ci --production
cd ../frontend && npm ci && npm run build

# Reload PM2 (graceful restart)
pm2 reload darts-backend

# Reload nginx
sudo nginx -s reload
```

### Strategia di ripristino

```bash
# Tag releases
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0

# Rollback
git checkout v1.0.0
npm ci --production
npm run build
pm2 reload darts-backend
```

---

## Lista di controllo della sicurezza

- [ ] Variabili d'ambiente protette
- [ ] Certificati SSL installati
- [] Firewall configurato (UFW/iptables)
- [ ] Solo autenticazione basata su chiave SSH
- [] Password del database forte e ruotata
- [ ] Sono stati applicati aggiornamenti di sicurezza regolari
- [ ] Rilevamento intrusioni abilitato
- [ ] Monitoraggio registro configurato
- [ ] Backup automatizzati e testati
- [ ] Limitazione della velocità abilitata
- [ ] CORS configurato correttamente
- [ ] Set di intestazioni di sicurezza del casco

---

## Risorse aggiuntive

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Digital Ocean Tutorials](https://www.digitalocean.com/community/tutorials)
- [AWS Documentation](https://docs.aws.amazon.com/)
