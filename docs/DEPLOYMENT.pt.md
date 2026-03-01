# 🚀 Guia de implantação

## Visão geral

Este guia aborda a implantação do aplicativo Darts Tournament Manager desde os ambientes de desenvolvimento até a produção.

---

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Implantação de desenvolvimento](#implantação-de-desenvolvimento)
- [Implantação de produção](#implantação-de-produção)
- [Implantação do Docker](#implantação-do-docker)
- [Implantação em nuvem](#implantação-em-nuvem)
- [Configuração do banco de dados](#configuração-do-banco-de-dados)
- [Monitoramento e Manutenção](#monitoramento-e-manutenção)
- [Solução de problemas](#solução-de-problemas)

---

## Pré-requisitos

### Software necessário

| Programas | Versão Mínima | Finalidade |
|----------|----------------|---------|
| Node.js | 20.0.0 | Ambiente de execução |
| npm | 10.0.0 | Gerenciador de pacotes |
| PostgreSQL | 14,0 | Banco de dados |
| Redis | 6,0 | Cache e sessões |
| Docker (opcional) | 20,0 | Conteinerização |
| Git | 2h30 | Controle de versão |

### Requisitos do sistema

**Desenvolvimento:**
- Mínimo de 4 GB de RAM
- 10 GB de espaço em disco
-CPU dual-core

**Produção:**
- 8 GB de RAM recomendado
- Recomenda-se 50 GB de espaço em disco
- CPU quad-core recomendada
- Certificado SSL

---

## Configuração do ambiente

### Variáveis ​​de ambiente de back-end (`backend/.env`)

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

### Variáveis ​​de ambiente de front-end (`frontend/.env`)

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

**⚠️ Aviso de segurança:**
- Nunca envie arquivos `.env` para o Git
- Use `.env.example` como modelo
- Alterne segredos regularmente na produção
- Use configurações específicas do ambiente
- Mantenha `VITE_AUTH0_CACHE_LOCATION=memory`, a menos que sejam necessárias sessões persistentes do navegador

---

## Implantação de desenvolvimento

### Início rápido (recomendado)

```bash
# 1. Clone repository
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament

# 2. Run installation script
./install.sh

# 3. Start services
./restart.sh both
```

### Configuração manual

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

### Desenvolvimento Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend frontend

# Stop services
docker compose down
```

Nota: o docker-compose de desenvolvimento monta volumes nomeados para persistir logs de torneio de back-end em `/app/backend/logs` e uploads (logotipos de torneio) em `/app/backend/uploads`.

---

## Implantação de produção

### 1. Configuração do servidor

####Ubuntu/Debian

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

### 2. Clonar e construir

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

### 3. Configuração do banco de dados

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

### 4. Configurar ambiente

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

### 5. Configurar o Nginx

Crie `/etc/nginx/sites-available/darts_tournament`:

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

Ativar site:

```bash
sudo ln -s /etc/nginx/sites-available/darts_tournament /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Certificado SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

### 7. Inicie o back-end com PM2

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

#### Arquivo do ecossistema PM2 (`ecosystem.config.js`)

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

Uso:

```bash
pm2 start ecosystem.config.js
```

---

## Implantação do Docker

### Produção Docker Compose

Crie `docker-compose.prod.yml`:

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

Implantar:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Implantação em nuvem

###Implantação AWS

#### 1. Configuração da instância EC2

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

#### 4. S3 para armazenamento de arquivos

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

### Implantação digital no oceano

#### Plataforma de aplicativos

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

Implantar:

```bash
doctl apps create --spec app.yaml
```

### Implantação do Heroku

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

## Configuração do banco de dados

### Migração inicial

```bash
cd backend
npm run db:migrate
```

### Semeando dados

```bash
# Development
npm run db:seed

# Production (careful!)
NODE_ENV=production npm run db:seed
```

### Backup e restauração

#### Cópia de segurança

```bash
# Local PostgreSQL
pg_dump -U darts_user -h localhost darts_tournament > backup_$(date +%Y%m%d).sql

# Remote PostgreSQL
pg_dump -U username -h your-rds-endpoint darts_tournament > backup.sql
```

#### Restaurar

```bash
# Local
psql -U darts_user -h localhost darts_tournament < backup.sql

# Remote
psql -U username -h your-rds-endpoint darts_tournament < backup.sql
```

### Backups automatizados (Cron)

```bash
# Edit crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * pg_dump -U darts_user darts_tournament > /backups/darts_$(date +\%Y\%m\%d).sql

# Weekly cleanup (keep last 30 days)
0 3 * * 0 find /backups -name "darts_*.sql" -mtime +30 -delete
```

---

## Monitoramento e Manutenção

### Monitoramento de aplicativos

#### Monitoramento PM2

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

#### Gerenciamento de registros

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

### Manutenção de banco de dados

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

### Verificações de saúde

```bash
# Backend health
curl http://localhost:3000/health

# Database connection
psql -U darts_user -h localhost -c "SELECT 1"

# Redis connection
redis-cli ping
```

### Monitoramento de tempo de atividade

Use serviços como:
- **UptimeRobot**: monitoramento gratuito do tempo de atividade
- **Pingdom**: monitoramento avançado
- **Datadog**: monitoramento de desempenho de aplicativos
- **New Relic**: observabilidade full-stack

---

## Solução de problemas

### Problemas comuns

#### 1. O back-end não inicia

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

#### 2. Erros 404 de front-end

```bash
# Check nginx configuration
sudo nginx -t

# Verify build files exist
ls -la /var/www/darts_tournament/frontend/dist

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

#### 3. Erros de conexão com o banco de dados

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify firewall rules
sudo ufw status

# Test connection
psql -U darts_user -h localhost -d darts_tournament
```

#### 4. Erros de conexão do Redis

```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

#### 5. Problemas de conexão WebSocket

```nginx
# Ensure nginx WebSocket proxy is configured
location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Problemas de desempenho

#### Alto uso de CPU

```bash
# Check PM2 status
pm2 status

# Restart app
pm2 restart darts-backend

# Increase instances
pm2 scale darts-backend 4
```

#### Vazamentos de memória

```bash
# Monitor memory
pm2 monit

# Set max memory restart
pm2 start ecosystem.config.js --max-memory-restart 1G
```

#### Consultas lentas ao banco de dados

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

## Atualizações contínuas

### Implantação com tempo de inatividade zero

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

### Estratégia de reversão

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

## Lista de verificação de segurança

- [] Variáveis ​​de ambiente protegidas
- [] certificados SSL instalados
- [ ] Firewall configurado (UFW/iptables)
- [] Somente autenticação baseada em chave SSH
- [] Senha do banco de dados forte e rotacionada
- [] Atualizações de segurança regulares aplicadas
- [] Detecção de intrusão habilitada
- [] Monitoramento de log configurado
- [] Backups automatizados e testados
- [] Limitação de taxa habilitada
- [] CORS configurado corretamente
- [] Conjunto de cabeçalhos de segurança do capacete

---

## Recursos Adicionais

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Digital Ocean Tutorials](https://www.digitalocean.com/community/tutorials)
- [AWS Documentation](https://docs.aws.amazon.com/)
