# 📖 Documentation des commandes

Référence complète de tous les scripts et commandes du Gestionnaire de Tournois de Fléchettes.

## Table des matières

- [Gestion des services (restart.sh)](#gestion-des-services-restartsh)
- [Scripts bash (scripts/)](#scripts-bash-scripts)
- [Commandes base de données](#commandes-base-de-données)
- [Commandes de développement](#commandes-de-développement)
- [Script d’installation (install.sh)](#script-dinstallation-installsh)
- [Commandes Docker](#commandes-docker)
- [Dépannage](#dépannage)

---

## Gestion des services (`restart.sh`)

Script principal pour gérer backend et frontend. Situé à la racine.

### Utilisation

```bash
./restart.sh <command> [service]
```

### Commandes

| Commande | Description |
|---------|-------------|
| `both` | Démarrer backend et frontend |
| `backend` | Démarrer uniquement le backend |
| `frontend` | Démarrer uniquement le frontend |
| `stop` | Arrêter tous les services |
| `status` | Afficher le statut des services |
| `logs <service>` | Suivre les logs d’un service |
| `help` | Afficher l’aide |

### Exemples

```bash
# Démarrer tout (cas le plus courant)
./restart.sh both

# Output :
# [INFO] Starting backend...
# [SUCCESS] Backend started on port 3000 (PID: 12345)
# [INFO] Starting frontend...
# [SUCCESS] Frontend started on port 5173 (PID: 12346)
```

```bash
# Vérifier ce qui tourne
./restart.sh status

# Output :
# Backend: RUNNING (PID: 12345, Port: 3000)
# Frontend: RUNNING (PID: 12346, Port: 5173)
```

```bash
# Suivre les logs backend
./restart.sh logs backend

# Ctrl+C pour arrêter
```

```bash
# Arrêter tout
./restart.sh stop

# Output :
# [INFO] Stopping backend (PID: 12345)...
# [SUCCESS] Backend stopped
# [INFO] Stopping frontend (PID: 12346)...
# [SUCCESS] Frontend stopped
```

### Fonctionnement

- Services lancés en arrière-plan via `nohup`
- PIDs stockés dans `.backend.pid` et `.frontend.pid`
- Logs écrits dans `backend/logs/` et `frontend/logs/`
- Vérification des conflits de ports avant démarrage

### Ports

| Service | Port | URL |
|---------|------|-----|
| Backend | 3000 | http://localhost:3000 |
| Frontend | 5173 | http://localhost:5173 |

---

## Scripts bash (`scripts/`)

Scripts utilitaires pour CI, lint, tests et seed. Lancer depuis la racine du projet.

### Liste rapide

| Script | Description |
|--------|-------------|
| `scripts/autofill_players.sh` | Remplit des joueurs de démo et active un tournoi |
| `scripts/ci_full.sh` | Lance lint, tests, e2e et Sonar si token dispo |
| `scripts/lint_all.sh` | Lint + typecheck frontend et backend |
| `scripts/lint_backend.sh` | Lint + typecheck backend (+ Sonar) |
| `scripts/lint_frontend.sh` | Lint + typecheck frontend (+ Sonar) |
| `scripts/non_regression.sh` | Lance tests backend + frontend |
| `scripts/redeploy_seed.sh` | Reboot stack, migrations, seed de démo |
| `scripts/sonar_scan.sh` | Scan SonarQube (SONAR_TOKEN requis) |
| `scripts/verify_nav_links.sh` | Vérifie les liens du menu principal |

### Exemples

```bash
# Remplir des joueurs de démo
./scripts/autofill_players.sh

# Lint complet
./scripts/lint_all.sh

# Suite de non-regression
./scripts/non_regression.sh
```

---

## Commandes base de données

À exécuter depuis le dossier `backend/`.

### Migrations

```bash
# Appliquer les migrations en attente (safe prod)
npm run db:migrate

# Ce que ça fait :
# - Lit les migrations depuis prisma/migrations/
# - Applique celles non exécutées
# - Met à jour la table _prisma_migrations
```

```bash
# Pousser le schéma directement (dev uniquement)
npm run db:push

# Ce que ça fait :
# - Synchronise la DB avec schema.prisma
# - Ne crée pas de migration
# - Peut provoquer des pertes de données
# - À utiliser uniquement en dev
```

### Seeding

```bash
# Peupler la DB avec des données d’exemple
npm run db:seed

# Ce que ça fait :
# - Exécute prisma/seed.ts
# - Crée des tournois d’exemple
# - Crée des joueurs d’exemple
# - Utilise skipDuplicates pour éviter les erreurs
```

### Reset

```bash
# Reset complet (DANGER !)
npm run db:reset

# Ce que ça fait :
# - Supprime toutes les tables
# - Ré-exécute les migrations
# - Optionnellement re-seed
# - TOUTES LES DONNÉES SERONT PERDUES
```

### Prisma Studio

```bash
# Ouvrir l’outil visuel
npm run db:studio

# Ce que ça fait :
# - Ouvre http://localhost:5555
# - Naviguer/éditer les données
# - Utile pour debug
```

### Commandes Prisma directes

```bash
# Générer le client Prisma (après changement de schéma)
npx prisma generate

# Créer une migration
npx prisma migrate dev --name migration_name

# Vérifier l’état des migrations
npx prisma migrate status

# Récupérer le schéma depuis la DB
npx prisma db pull
```

---

## Commandes de développement

### Backend (`backend/`)

```bash
# Démarrer le serveur de dev (hot-reload)
npm run dev

# Ce que ça fait :
# - ts-node-dev pour TypeScript
# - Rechargement auto
# - Logs structurés
```

```bash
# Build production
npm run build

# Ce que ça fait :
# - Compile TypeScript vers JavaScript
# - Sortie dist/
# - Source maps pour debug
```

```bash
# Démarrer le serveur prod
npm run start

# Ce que ça fait :
# - Exécute dist/
# - Pas de watch
# - Utiliser après build
```

```bash
# Tests
npm run test           # Exécution unique
npm run test:watch     # Mode watch
npm run test:coverage  # Rapport de couverture
```

```bash
# Qualité de code
npm run lint           # Vérifier erreurs
npm run lint:fix       # Corriger automatiquement
npm run format         # Formatage Prettier
```

### Frontend (`frontend/`)

```bash
# Démarrer le dev server
npm run dev

# Ce que ça fait :
# - Vite sur port 5173
# - HMR
# - Fast refresh
```

```bash
# Build production
npm run build

# Ce que ça fait :
# - Bundle et minify
# - Sortie dist/
# - Optimisé prod
```

```bash
# Prévisualiser le build
npm run preview

# Ce que ça fait :
# - Sert dist/
# - Simule la prod
# - À utiliser après build
```

---

## Script d’installation (`install.sh`)

Installation automatisée pour nouveaux setups.

### Utilisation

```bash
./install.sh [options] [directory]
```

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Afficher l’aide |
| `-y, --yes` | Confirmer toutes les invites |

### Exemples

```bash
# Installer dans le dossier par défaut (./darts_tournament)
./install.sh

# Installer dans un dossier spécifique
./install.sh my_tournament

# Installer via chemin absolu
./install.sh /home/user/projects/darts

# Afficher l’aide
./install.sh --help
```

### Ce que fait le script

1. **Vérifie les prérequis**
   - Node.js >= 18
   - npm
   - Git
   - Optionnel : Docker, PostgreSQL, Redis

2. **Clone le dépôt**
   - Essaie SSH (`git@github.com:...`)
   - Bascule en HTTPS si besoin

3. **Configure le backend**
   - Installe les dépendances
   - Crée `.env`
   - Génère le client Prisma
   - Build TypeScript

4. **Configure le frontend**
   - Installe les dépendances
   - Build production

5. **Base de données** (optionnel)
   - Démarre Docker
   - Migrations
   - Seed de données d’exemple

---

## Commandes Docker

### Démarrer les services

```bash
# Démarrer tous les services docker-compose
docker compose up -d

# Démarrer des services spécifiques
docker compose up -d postgres redis

# Démarrer avec build
docker compose up -d --build
```

### Arrêter les services

```bash
# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes (supprime les données !)
docker compose down -v
```

### Voir les logs

```bash
# Suivre tous les logs
docker compose logs -f

# Suivre un service
docker compose logs -f postgres

# Voir les 100 dernières lignes
docker compose logs --tail=100 postgres
```

### Gestion des conteneurs

```bash
# Liste des conteneurs
docker compose ps

# Redémarrer un service
docker compose restart postgres

# Exécuter une commande dans un conteneur
docker compose exec postgres psql -U postgres -d darts_tournament
```

---

## Dépannage

### Port déjà utilisé

```bash
# Vérifier le port
lsof -i :3000  # ou :5173

# Tuer le process
kill -9 $(lsof -t -i :3000)

# Ou utiliser restart.sh
./restart.sh stop
./restart.sh both
```

### Échec de connexion DB

```bash
# Vérifier PostgreSQL
docker compose ps postgres
# ou
systemctl status postgresql

# Tester la connexion
psql -h localhost -U postgres -d darts_tournament

# Vérifier DATABASE_URL
cat backend/.env | grep DATABASE_URL
```

### Client Prisma désynchronisé

```bash
cd backend

# Régénérer le client
npx prisma generate

# Si schéma modifié, push ou migrate
npm run db:push  # dev
# ou
npm run db:migrate  # prod
```

### Frontend ne se connecte pas au backend

```bash
# Vérifier backend
curl http://localhost:3000/health

# Vérifier CORS
grep CORS backend/.env

# Vérifier URL API frontend
grep VITE_API frontend/.env
```

### Emplacements des logs

| Service | Emplacement |
|---------|-------------|
| Backend | `backend/logs/combined-*.log` |
| Erreurs backend | `backend/logs/error-*.log` |
| Frontend | `frontend/logs/` |
| Docker PostgreSQL | `docker compose logs postgres` |

---

## Carte de référence rapide

```
┌─────────────────────────────────────────────────────────────┐
│                      COMMANDES RAPIDES                      │
├─────────────────────────────────────────────────────────────┤
│ START ALL:        ./restart.sh both                         │
│ STOP ALL:         ./restart.sh stop                         │
│ STATUS:           ./restart.sh status                       │
│ VIEW LOGS:        ./restart.sh logs backend                 │
├─────────────────────────────────────────────────────────────┤
│ MIGRATE DB:       cd backend && npm run db:migrate          │
│ SEED DB:          cd backend && npm run db:seed             │
│ DB BROWSER:       cd backend && npm run db:studio           │
├─────────────────────────────────────────────────────────────┤
│ DEV BACKEND:      cd backend && npm run dev                 │
│ DEV FRONTEND:     cd frontend && npm run dev                │
│ BUILD:            cd backend && npm run build               │
├─────────────────────────────────────────────────────────────┤
│ DOCKER UP:        docker compose up -d                      │
│ DOCKER DOWN:      docker compose down                       │
│ DOCKER LOGS:      docker compose logs -f postgres           │
└─────────────────────────────────────────────────────────────┘
```

---

## Commandes de test

### Tests backend

```bash
cd backend

# Lancer tous les tests
npm test

# Mode watch
npm run test:watch

# Couverture
npm run test:coverage

# Fichier spécifique
npm test -- tournament.test.ts

# Tests d’intégration uniquement
npm test -- --testPathPattern=integration

# Tests unitaires uniquement
npm test -- --testPathPattern=unit

# Tests de contrat uniquement
npm test -- --testPathPattern=contract
```

### Tests frontend

```bash
cd frontend

# Lancer tous les tests
npm test

# Mode watch
npm test -- --watch

# UI
npm run test:ui

# Couverture
npm run test:coverage

# Test spécifique
npm test -- TournamentCard.test.tsx
```

### Tests E2E

```bash
# Installer les navigateurs Playwright (première fois)
npx playwright install

# Lancer tous les tests E2E
npm run test:e2e

# Fichier spécifique
npx playwright test tests/e2e/players-view.spec.ts

# Mode headed (voir le navigateur)
npx playwright test --headed

# Mode debug
npx playwright test --debug

# Navigateur spécifique
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Générer le rapport
npx playwright show-report
```

---

## Commandes qualité de code

### Linting

```bash
# Backend
cd backend
npm run lint              # Vérifier erreurs
npm run lint:fix          # Corriger automatiquement

# Frontend
cd frontend
npm run lint              # Vérifier erreurs
npm run lint:fix          # Corriger automatiquement
```

### Formatage

```bash
# Backend
cd backend
npm run format            # Formater tous les fichiers TS

# Frontend
cd frontend
npm run format            # Formater TS/React
```

### Vérification des types

```bash
# Backend
cd backend
npx tsc --noEmit         # Type check sans build

# Frontend
cd frontend
npx tsc --noEmit         # Type check sans build
```

### Analyse de code

```bash
# Lancer SonarQube
./scripts/sonar_scan.sh

# Démarrer un serveur SonarQube local
docker compose up -d sonarqube

# Accéder à SonarQube : http://localhost:9000
```

---

## Scripts CI/CD

Le dossier `scripts/` contient des scripts utiles :

### Pipeline CI complet

```bash
# Lancer les checks complets (lint, tests, build)
./scripts/ci_full.sh

# Ce que ça fait :
# 1. Lint backend & frontend
# 2. Tests avec couverture
# 3. Builds
# 4. Rapport succès/échec
```

### Scripts individuels

```bash
# Linter le backend
./scripts/lint_backend.sh

# Linter le frontend
./scripts/lint_frontend.sh

# Linter tout
./scripts/lint_all.sh

# Tests de non-régression
./scripts/non_regression.sh

# Vérifier les liens de navigation
./scripts/verify_nav_links.sh
```

---

## Gestion des environnements

### Environnement backend

```bash
cd backend

# Copier l’exemple
cp .env.example .env

# Éditer les variables
nano .env  # ou vim, code, etc.

# Vérifier l’environnement
cat .env

# Variables requises :
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - AUTH_ISSUER_BASE_URL
# - AUTH_AUDIENCE
```

### Environnement frontend

```bash
cd frontend

# Copier l’exemple
cp .env.example .env

# Éditer les variables
nano .env

# Variables requises :
# - VITE_AUTH0_DOMAIN
# - VITE_AUTH0_CLIENT_ID
# - VITE_AUTH0_AUDIENCE
```

---

## Gestion des processus (PM2)

Pour la production avec PM2 :

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer le backend
cd backend
pm2 start npm --name "darts-backend" -- start

# Gérer les processus
pm2 status                # Liste des processus
pm2 logs darts-backend    # Logs
pm2 restart darts-backend # Redémarrer
pm2 stop darts-backend    # Stop
pm2 delete darts-backend  # Supprimer

# Monitoring
pm2 monit                 # Dashboard temps réel
pm2 describe darts-backend # Infos détaillées

# Démarrage automatique
pm2 startup               # Suivre les instructions
pm2 save                  # Sauvegarder la liste

# Mettre à jour l’app
git pull
npm ci --production
npm run build
pm2 reload darts-backend
```

---

## Administration base de données

### Commandes PostgreSQL

```bash
# Se connecter
psql -h localhost -U darts_user -d darts_tournament

# Dans psql :
\dt                    # Lister les tables
\d tournaments         # Décrire une table
\l                     # Lister les bases
\du                    # Lister les users
\q                     # Quitter

# Backup DB
pg_dump -U darts_user darts_tournament > backup.sql

# Restaurer
psql -U darts_user darts_tournament < backup.sql

# Backup avec timestamp
pg_dump -U darts_user darts_tournament > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Commandes Prisma

```bash
cd backend

# Voir le schéma actuel
npx prisma db pull

# Valider le schéma
npx prisma validate

# Formater le schéma
npx prisma format

# Introspection DB
npx prisma db pull

# Reset (danger !)
npx prisma migrate reset --force
```

---

## Commandes Redis

### Connexion à Redis

```bash
# Docker
docker compose exec redis redis-cli

# Redis local
redis-cli

# Avec auth
redis-cli -a your-password

# Redis distant
redis-cli -h hostname -p 6379 -a password
```

### Commandes Redis courantes

```bash
# Dans redis-cli :
PING                   # Tester la connexion
INFO                   # Info serveur
KEYS *                 # Lister les clés (dev uniquement !)
GET key_name           # Lire une valeur
SET key_name value     # Définir une valeur
DEL key_name           # Supprimer une clé
FLUSHDB                # Vider la DB
FLUSHALL               # Vider toutes les DB
```

---

## Gestion des logs

### Voir les logs

```bash
# Logs backend
tail -f backend/logs/combined-*.log
tail -f backend/logs/error-*.log

# Logs frontend (si applicable)
tail -f frontend/logs/*.log

# Logs PM2
pm2 logs darts-backend
pm2 logs darts-backend --lines 100
pm2 logs darts-backend --err      # Erreurs uniquement
pm2 logs darts-backend --out      # Sorties uniquement

# Logs Docker
docker compose logs -f backend
docker compose logs -f postgres --tail=100
```

### Nettoyer les logs

```bash
# Logs backend
rm backend/logs/*.log

# Logs PM2
pm2 flush darts-backend

# Logs Docker
docker compose logs --no-log-prefix > /dev/null
```

---

## Réseau & ports

### Vérifier l’utilisation des ports

```bash
# Vérifier si un port est utilisé
lsof -i :3000          # Backend
lsof -i :5173          # Frontend
lsof -i :5432          # PostgreSQL
lsof -i :6379          # Redis

# Tuer un process sur le port
kill -9 $(lsof -t -i :3000)

# Alternative (netstat)
netstat -tuln | grep :3000
```

### Firewall (UFW)

```bash
# Activer le firewall
sudo ufw enable

# Autoriser des ports
sudo ufw allow 22         # SSH
sudo ufw allow 80         # HTTP
sudo ufw allow 443        # HTTPS
sudo ufw allow 3000       # Backend (dev)
sudo ufw allow 5173       # Frontend (dev)

# Statut
sudo ufw status

# Supprimer une règle
sudo ufw delete allow 3000
```

---

## Workflows Git

### Mettre à jour le repo local

```bash
# Fetch + pull
git fetch origin
git pull origin main

# Stash avant pull
git stash
git pull origin main
git stash pop
```

### Créer une branche feature

```bash
# Créer et switcher
git checkout -b feature/my-feature

# Modifier, puis commit
git add .
git commit -m "feat: add new feature"

# Push
git push origin feature/my-feature
```

### Taguer une release

```bash
# Tag annoté
git tag -a v1.0.0 -m "Release version 1.0.0"

# Pousser les tags
git push origin --tags

# Lister les tags
git tag -l

# Checkout un tag
git checkout v1.0.0
```

---

## Monitoring des performances

### Performance backend

```bash
# PM2
pm2 describe darts-backend
pm2 monit

# Usage mémoire Node.js
node --expose-gc backend/dist/server.js

# Profiling avec clinic
npm install -g clinic
clinic doctor -- node dist/server.js
```

### Performance base de données

```sql
-- Depuis psql :

-- Requêtes lentes
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Taille des tables
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Utilisation des index
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

## Tâches de maintenance

### Maintenance régulière

```bash
# Hebdo : mettre à jour les dépendances
cd backend && npm update
cd frontend && npm update

# Mensuel : audit sécurité
npm audit
npm audit fix

# Vacuum DB
psql -U darts_user -d darts_tournament -c "VACUUM ANALYZE;"

# Nettoyer vieux logs (>30 jours)
find backend/logs -name "*.log" -mtime +30 -delete
```

### Stratégie de backup

```bash
# Script backup quotidien (crontab)
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d)

# Backup DB
pg_dump -U darts_user darts_tournament > $BACKUP_DIR/db_$DATE.sql

# Backup code (si besoin)
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/darts_tournament

# Nettoyer vieux backups (30 jours)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

---

## Ressources additionnelles

- [Documentation API](./API.fr.md)
- [Documentation Architecture](./ARCHITECTURE.fr.md)
- [Documentation Frontend](./FRONTEND.fr.md)
- [Guide de déploiement](./DEPLOYMENT.fr.md)
- [Documentation tests](./TESTING.fr.md)

**Bon tournoi ! 🎯**
