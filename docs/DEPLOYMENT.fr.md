# 🚀 Guide de déploiement

## Vue d’ensemble

Ce guide couvre le déploiement du Gestionnaire de Tournois de Fléchettes en environnements de développement et de production.

---

## Table des matières

- [Prérequis](#prérequis)
- [Configuration de l’environnement](#configuration-de-l-environnement)
- [Déploiement en développement](#déploiement-en-développement)
- [Déploiement en production](#déploiement-en-production)
- [Déploiement Docker](#déploiement-docker)
- [Déploiement cloud](#déploiement-cloud)
- [Configuration de la base de données](#configuration-de-la-base-de-données)
- [Monitoring & maintenance](#monitoring--maintenance)
- [Dépannage](#dépannage)

---

## Prérequis

### Logiciels requis

| Logiciel | Version minimum | Rôle |
|----------|------------------|------|
| Node.js | 20.0.0 | Runtime |
| npm | 10.0.0 | Gestionnaire de paquets |
| PostgreSQL | 14.0 | Base de données |
| Redis | 6.0 | Cache & sessions |
| Docker (optionnel) | 20.0 | Conteneurisation |
| Git | 2.30 | Versioning |

### Exigences système

**Développement :**
- 4 Go RAM minimum
- 10 Go espace disque
- CPU dual-core

**Production :**
- 8 Go RAM recommandé
- 50 Go espace disque recommandé
- CPU quad-core recommandé
- Certificat SSL

---

## Configuration de l’environnement

### Variables d’environnement backend (`backend/.env`)

```env
# ===== Base de données =====
DATABASE_URL="postgresql://user:password@localhost:5432/darts_tournament"

# ===== Redis =====
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379

# ===== Serveur =====
NODE_ENV="production"           # development | production | test
PORT=3000
HOST="0.0.0.0"

# ===== Sécurité =====
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# ===== Authentification Auth0 =====
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"
AUTH_ADMIN_EMAILS="admin1@example.com,admin2@example.com"

# ===== CORS =====
CORS_ORIGIN="https://yourdomain.com"

# ===== Upload fichiers =====
UPLOAD_MAX_FILE_SIZE=5242880                # 5 Mo en octets
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png"
UPLOAD_DIR="./uploads"

# ===== Logs =====
LOG_LEVEL="info"                # error | warn | info | debug
LOG_FILE_MAX_SIZE="20m"
LOG_FILE_MAX_FILES="14d"

# ===== Rate Limiting =====
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Variables d’environnement frontend (`frontend/.env`)

```env
# ===== Auth0 =====
VITE_AUTH_ENABLED=true
VITE_AUTH0_DOMAIN="your-tenant.eu.auth0.com"
VITE_AUTH0_CLIENT_ID="your_client_id"
VITE_AUTH0_AUDIENCE="https://api.yourdomain.com"

# ===== Connexions OAuth =====
VITE_AUTH0_CONNECTION_GOOGLE="google-oauth2"
VITE_AUTH0_CONNECTION_FACEBOOK="facebook"
VITE_AUTH0_CONNECTION_INSTAGRAM="instagram"

# ===== API =====
VITE_API_URL="https://api.yourdomain.com"
```

**⚠️ Alerte sécurité :**
- Ne jamais committer les fichiers `.env`
- Utiliser `.env.example` comme template
- Renouveler les secrets en production
- Utiliser des configs spécifiques par environnement

---

## Déploiement en développement

### Démarrage rapide (recommandé)

```bash
# 1. Cloner le dépôt
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament

# 2. Lancer le script d’installation
./install.sh

# 3. Démarrer les services
./restart.sh both
```

### Installation manuelle

```bash
# 1. Installer les dépendances backend
cd backend
npm install

# 2. Initialiser la base de données
npm run db:migrate
npm run db:seed  # Optionnel : données d’exemple

# 3. Installer les dépendances frontend
cd ../frontend
npm install

# 4. Démarrer le backend
cd ../backend
npm run dev         # http://localhost:3000

# 5. Démarrer le frontend (nouveau terminal)
cd ../frontend
npm run dev         # http://localhost:5173
```

### Développement Docker

```bash
# Démarrer tous les services
docker compose up -d

# Voir les logs
docker compose logs -f backend frontend

# Arrêter les services
docker compose down
```

Note : le docker-compose de développement monte des volumes nommés pour conserver les logs des tournois dans `/app/backend/logs` et les uploads (logos) dans `/app/backend/uploads`.

---

## Déploiement en production

### 1. Préparer le serveur

#### Ubuntu/Debian

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Installer Redis
sudo apt install -y redis-server

# Installer nginx (reverse proxy)
sudo apt install -y nginx

# Installer certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# Installer PM2 (process manager)
sudo npm install -g pm2
```

### 2. Cloner & build

```bash
# Créer le dossier applicatif
sudo mkdir -p /var/www/darts_tournament
sudo chown $USER:$USER /var/www/darts_tournament

# Cloner le dépôt
cd /var/www/darts_tournament
git clone https://github.com/grozours/darts_tournament.git .

# Installer les dépendances
cd backend
npm ci --production
cd ../frontend
npm ci

# Build frontend
npm run build
```

### 3. Configuration base de données

```bash
# Créer un utilisateur DB
sudo -u postgres psql
CREATE USER darts_user WITH PASSWORD 'secure_password';
CREATE DATABASE darts_tournament;
GRANT ALL PRIVILEGES ON DATABASE darts_tournament TO darts_user;
\q

# Exécuter les migrations
cd /var/www/darts_tournament/backend
npm run db:migrate
```

### 4. Configurer l’environnement

```bash
# Backend
cd /var/www/darts_tournament/backend
cp .env.example .env
nano .env

# Frontend (si nécessaire pour build)
cd /var/www/darts_tournament/frontend
cp .env.example .env.production
nano .env.production
```

### 5. Configurer Nginx

Créer `/etc/nginx/sites-available/darts_tournament` :

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

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/darts_tournament /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Certificat SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

### 7. Démarrer le backend avec PM2

```bash
cd /var/www/darts_tournament/backend

# Démarrer le backend
pm2 start npm --name "darts-backend" -- start

# Installer le script de démarrage
pm2 startup
pm2 save

# Monitorer
pm2 status
pm2 logs darts-backend
```

#### Fichier PM2 (`ecosystem.config.js`)

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

Utilisation :

```bash
pm2 start ecosystem.config.js
```

---

## Déploiement Docker

### Docker Compose production

Créer `docker-compose.prod.yml` :

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

Déployer :

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Déploiement cloud

### Déploiement AWS

#### 1. EC2

```bash
# Lancer une instance EC2 (Ubuntu 22.04, t3.medium)
# Security groups : 22, 80, 443

# Connexion à l’instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Suivre la préparation serveur ci-dessus
```

#### 2. RDS (PostgreSQL)

```bash
# Créer une instance RDS
# Mettre à jour DATABASE_URL dans backend/.env
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/darts_tournament"
```

#### 3. ElastiCache (Redis)

```bash
# Créer un cluster Redis
# Mettre à jour REDIS_HOST dans backend/.env
REDIS_HOST="your-redis-endpoint.cache.amazonaws.com"
REDIS_PORT=6379
```

#### 4. S3 pour les fichiers

```bash
# Créer un bucket S3
# Configurer IAM pour EC2

# Installer AWS SDK
npm install aws-sdk

# Adapter le middleware d’upload pour S3
```

#### 5. CloudFront (CDN)

```bash
# Créer une distribution CloudFront
# Origine : instance EC2
# Domaine alternatif : yourdomain.com
# Certificat SSL : ACM
```

### Déploiement DigitalOcean

#### App Platform

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

Déployer :

```bash
doctl apps create --spec app.yaml
```

### Déploiement Heroku

```bash
# Créer l’app
heroku create your-app-name

# Ajouter PostgreSQL
heroku addons:create heroku-postgresql:mini

# Ajouter Redis
heroku addons:create heroku-redis:mini

# Définir les variables d’env
heroku config:set NODE_ENV=production
heroku config:set AUTH_ISSUER_BASE_URL=https://your-tenant.auth0.com

# Déployer
git push heroku main

# Exécuter les migrations
heroku run npm run db:migrate --app your-app-name
```

---

## Configuration de la base de données

### Migration initiale

```bash
cd backend
npm run db:migrate
```

### Seeding

```bash
# Développement
npm run db:seed

# Production (avec prudence !)
NODE_ENV=production npm run db:seed
```

### Sauvegarde & restauration

#### Sauvegarde

```bash
# PostgreSQL local
pg_dump -U darts_user -h localhost darts_tournament > backup_$(date +%Y%m%d).sql

# PostgreSQL distant
pg_dump -U username -h your-rds-endpoint darts_tournament > backup.sql
```

#### Restauration

```bash
# Local
psql -U darts_user -h localhost darts_tournament < backup.sql

# Distant
psql -U username -h your-rds-endpoint darts_tournament < backup.sql
```

### Backups automatisés (Cron)

```bash
# Éditer la crontab
crontab -e

# Backup quotidien à 2h
0 2 * * * pg_dump -U darts_user darts_tournament > /backups/darts_$(date +\%Y\%m\%d).sql

# Nettoyage hebdo (conserver 30 jours)
0 3 * * 0 find /backups -name "darts_*.sql" -mtime +30 -delete
```

---

## Monitoring & maintenance

### Monitoring applicatif

#### Monitoring PM2

```bash
# Statut
pm2 status

# Logs
pm2 logs darts-backend

# Monitoring temps réel
pm2 monit

# Utilisation ressources
pm2 describe darts-backend
```

#### Gestion des logs

```bash
# Voir les logs
cd /var/www/darts_tournament/backend/logs

# Rotation des logs (logrotate)
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

### Maintenance base de données

```sql
-- Vacuum tables
VACUUM ANALYZE;

-- Taille de la base
SELECT pg_size_pretty(pg_database_size('darts_tournament'));

-- Taille des tables
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

### Health checks

```bash
# Backend
curl http://localhost:3000/health

# Base de données
psql -U darts_user -h localhost -c "SELECT 1"

# Redis
redis-cli ping
```

### Monitoring d’uptime

Services possibles :
- **UptimeRobot** : monitoring gratuit
- **Pingdom** : monitoring avancé
- **Datadog** : APM
- **New Relic** : observabilité full-stack

---

## Dépannage

### Problèmes fréquents

#### 1. Backend ne démarre pas

```bash
# Voir les logs
pm2 logs darts-backend --lines 50

# Vérifier ports
sudo lsof -i :3000

# Vérifier env
cat backend/.env

# Tester la DB
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Erreurs 404 frontend

```bash
# Vérifier config nginx
sudo nginx -t

# Vérifier build
ls -la /var/www/darts_tournament/frontend/dist

# Logs nginx
sudo tail -f /var/log/nginx/error.log
```

#### 3. Erreurs DB

```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql

# Vérifier firewall
sudo ufw status

# Tester la connexion
psql -U darts_user -h localhost -d darts_tournament
```

#### 4. Erreurs Redis

```bash
# Vérifier Redis
sudo systemctl status redis

# Tester Redis
redis-cli ping

# Logs Redis
sudo tail -f /var/log/redis/redis-server.log
```

#### 5. Problèmes WebSocket

```nginx
# Vérifier le proxy WebSocket
location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Problèmes de performance

#### CPU élevé

```bash
# Statut PM2
pm2 status

# Redémarrer l’app
pm2 restart darts-backend

# Augmenter les instances
pm2 scale darts-backend 4
```

#### Fuites mémoire

```bash
# Monitoring mémoire
pm2 monit

# Redémarrage auto à 1G
pm2 start ecosystem.config.js --max-memory-restart 1G
```

#### Requêtes DB lentes

```sql
-- Activer logs des requêtes
ALTER DATABASE darts_tournament SET log_statement = 'all';

-- Requêtes lentes
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Index
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
```

---

## Rolling updates

### Déploiement sans downtime

```bash
# Pull code
cd /var/www/darts_tournament
git pull origin main

# Dépendances
cd backend && npm ci --production
cd ../frontend && npm ci && npm run build

# Reload PM2
pm2 reload darts-backend

# Reload nginx
sudo nginx -s reload
```

### Stratégie de rollback

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

## Checklist de sécurité

- [ ] Variables d’environnement sécurisées
- [ ] Certificats SSL installés
- [ ] Firewall configuré (UFW/iptables)
- [ ] Auth SSH par clé uniquement
- [ ] Mot de passe DB robuste & renouvelé
- [ ] Mises à jour sécurité régulières
- [ ] Détection d’intrusion activée
- [ ] Monitoring des logs configuré
- [ ] Backups automatisés et testés
- [ ] Rate limiting activé
- [ ] CORS correctement configuré
- [ ] En-têtes Helmet en place

---

## Ressources additionnelles

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Digital Ocean Tutorials](https://www.digitalocean.com/community/tutorials)
- [AWS Documentation](https://docs.aws.amazon.com/)
