# 📖 Commands Documentation

Complete reference for all scripts and commands in the Darts Tournament Manager.

## Table of Contents

- [Service Management (restart.sh)](#service-management-restartsh)
- [Database Commands](#database-commands)
- [Development Commands](#development-commands)
- [Code Quality (SonarQube)](#code-quality-sonarqube)
- [Installation Script (install.sh)](#installation-script-installsh)
- [Docker Commands](#docker-commands)
- [Troubleshooting](#troubleshooting)

---

## Service Management (`restart.sh`)

The main script for managing backend and frontend services. Located in the project root.

### Usage

```bash
./restart.sh <command> [service]
```

### Commands

| Command | Description |
|---------|-------------|
| `both` | Start both backend and frontend services |
| `backend` | Start only the backend service |
| `frontend` | Start only the frontend service |
| `stop` | Stop all running services |
| `status` | Show status of all services |
| `logs <service>` | Tail logs for a service |
| `help` | Show help message |

### Examples

```bash
# Start everything (most common)
./restart.sh both

# Output:
# [INFO] Starting backend...
# [SUCCESS] Backend started on port 3000 (PID: 12345)
# [INFO] Starting frontend...
# [SUCCESS] Frontend started on port 5173 (PID: 12346)
```

```bash
# Check what's running
./restart.sh status

# Output:
# Backend: RUNNING (PID: 12345, Port: 3000)
# Frontend: RUNNING (PID: 12346, Port: 5173)
```

```bash
# View live backend logs
./restart.sh logs backend

# Press Ctrl+C to stop following logs
```

```bash
# Stop everything
./restart.sh stop

# Output:
# [INFO] Stopping backend (PID: 12345)...
# [SUCCESS] Backend stopped
# [INFO] Stopping frontend (PID: 12346)...
# [SUCCESS] Frontend stopped
```

### How It Works

- Services run in background using `nohup`
- PIDs are stored in `.backend.pid` and `.frontend.pid` files
- Logs are written to `backend/logs/` and `frontend/logs/`
- The script checks for port conflicts before starting

### Ports

| Service | Port | URL |
|---------|------|-----|
| Backend | 3000 | http://localhost:3000 |
| Frontend | 5173 | http://localhost:5173 |

---

## Database Commands

Run these commands from the `backend/` directory.

### Migrations

```bash
# Apply all pending migrations (safe for production)
npm run db:migrate

# What it does:
# - Reads migration files from prisma/migrations/
# - Applies any unapplied migrations to the database
# - Updates the _prisma_migrations table
```

```bash
# Push schema directly without migrations (development only)
npm run db:push

# What it does:
# - Syncs the database with schema.prisma
# - Does NOT create migration files
# - May cause data loss if columns are removed
# - Use only in development!
```

### Seeding

```bash
# Seed database with sample data
npm run db:seed

# What it does:
# - Runs prisma/seed.ts
# - Creates sample tournaments (Single, Double, Team formats)
# - Creates sample players for the first tournament
# - Uses skipDuplicates to avoid errors on re-run
```

### Reset

```bash
# Reset database completely (DANGER!)
npm run db:reset

# What it does:
# - Drops all tables
# - Re-runs all migrations
# - Optionally runs seed script
# - ALL DATA WILL BE LOST!
```

### Prisma Studio

```bash
# Open visual database browser
npm run db:studio

# What it does:
# - Opens a web UI at http://localhost:5555
# - Browse and edit data visually
# - Great for debugging and quick edits
```

### Direct Prisma Commands

```bash
# Generate Prisma client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Check migration status
npx prisma migrate status

# Pull schema from existing database
npx prisma db pull
```

---

## Development Commands

### Backend (`backend/`)

```bash
# Start development server with hot-reload
npm run dev

# What it does:
# - Uses ts-node-dev for TypeScript execution
# - Watches for file changes
# - Auto-restarts on changes
# - Output includes structured logging
```

```bash
# Build for production
npm run build

# What it does:
# - Compiles TypeScript to JavaScript
# - Output goes to dist/ folder
# - Creates source maps for debugging
```

```bash
# Start production server
npm run start

# What it does:
# - Runs compiled JavaScript from dist/
# - No file watching
# - Use after npm run build
```

```bash
# Run tests
npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

```bash
# Code quality
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
npm run format         # Format with Prettier
```

### Frontend (`frontend/`)

```bash
# Start development server
npm run dev

# What it does:
# - Starts Vite dev server on port 5173
# - Hot Module Replacement (HMR)
# - Fast refresh on changes
```

```bash
# Build for production
npm run build

# What it does:
# - Bundles and minifies code
# - Output goes to dist/ folder
# - Optimized for production
```

```bash
# Preview production build locally
npm run preview

# What it does:
# - Serves the dist/ folder
# - Simulates production environment
# - Use after npm run build
```

---

## Code Quality (SonarQube)

Run the scan from the project root:

```bash
export SONAR_TOKEN=your_token
# Optional: export SONAR_HOST_URL=http://localhost:9000
./scripts/sonar_scan.sh
```

Notes:
- `SONAR_TOKEN` is required. Generate it in SonarQube: User > My Account > Security.
- `SONAR_HOST_URL` defaults to `http://localhost:9000`.
- `scripts/ci_full.sh` will auto-load a token from `.sonar-token` if present and skip the scan if no token is available.

---

## Installation Script (`install.sh`)

Automated installation for fresh setups.

### Usage

```bash
./install.sh [options] [directory]
```

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help message |
| `-y, --yes` | Auto-confirm all prompts |

### Examples

```bash
# Install in default directory (./darts_tournament)
./install.sh

# Install in specific directory
./install.sh my_tournament

# Install in absolute path
./install.sh /home/user/projects/darts

# Show help
./install.sh --help
```

### What It Does

1. **Checks Prerequisites**
   - Node.js >= 18
   - npm
   - Git
   - Optional: Docker, PostgreSQL, Redis

2. **Clones Repository**
   - Tries SSH first (`git@github.com:...`)
   - Falls back to HTTPS if SSH fails

3. **Sets Up Backend**
   - Installs npm dependencies
   - Creates `.env` from template
   - Generates Prisma client
   - Builds TypeScript

4. **Sets Up Frontend**
   - Installs npm dependencies
   - Builds production bundle

5. **Database Setup** (optional)
   - Starts Docker containers
   - Runs migrations
   - Seeds sample data

---

## Docker Commands

### Starting Services

```bash
# Start all services defined in docker-compose.yml
docker compose up -d

# Start specific services
docker compose up -d postgres redis

# Start with build
docker compose up -d --build
```

### Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (deletes data!)
docker compose down -v
```

### Viewing Logs

```bash
# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f postgres

# Show last 100 lines
docker compose logs --tail=100 postgres
```

### Managing Containers

```bash
# List running containers
docker compose ps

# Restart a service
docker compose restart postgres

# Execute command in container
docker compose exec postgres psql -U postgres -d darts_tournament
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using a port
lsof -i :3000  # or :5173

# Kill process on port
kill -9 $(lsof -t -i :3000)

# Or use restart.sh which handles this
./restart.sh stop
./restart.sh both
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker compose ps postgres
# or
systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d darts_tournament

# Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL
```

### Prisma Client Out of Sync

```bash
cd backend

# Regenerate client
npx prisma generate

# If schema changed, push or migrate
npm run db:push  # development
# or
npm run db:migrate  # production
```

### Frontend Can't Connect to Backend

```bash
# Check backend is running
curl http://localhost:3000/health

# Check CORS settings in backend
grep CORS backend/.env

# Check frontend API URL
grep VITE_API frontend/.env
```

### Logs Location

| Service | Log Location |
|---------|-------------|
| Backend | `backend/logs/combined-*.log` |
| Backend Errors | `backend/logs/error-*.log` |
| Frontend | `frontend/logs/` |
| Docker PostgreSQL | `docker compose logs postgres` |

### Clean Restart

```bash
# Nuclear option - full reset
./restart.sh stop
rm -rf backend/node_modules frontend/node_modules
rm -rf backend/dist frontend/dist
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
cd ..
./restart.sh both
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    QUICK COMMANDS                           │
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

## Testing Commands

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tournament.test.ts

# Run integration tests only
npm test -- --testPathPattern=integration

# Run unit tests only
npm test -- --testPathPattern=unit

# Run contract tests only
npm test -- --testPathPattern=contract
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- TournamentCard.test.tsx
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/players-view.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug mode
npx playwright test --debug

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Generate report
npx playwright show-report
```

---

## Code Quality Commands

### Linting

```bash
# Backend
cd backend
npm run lint              # Check for errors
npm run lint:fix          # Auto-fix errors

# Frontend
cd frontend
npm run lint              # Check for errors
npm run lint:fix          # Auto-fix errors
```

### Formatting

```bash
# Backend
cd backend
npm run format            # Format all TypeScript files

# Frontend
cd frontend
npm run format            # Format all TypeScript/React files
```

### Type Checking

```bash
# Backend
cd backend
npx tsc --noEmit         # Type check without building

# Frontend
cd frontend
npx tsc --noEmit         # Type check without building
```

### Code Analysis

```bash
# Run SonarQube analysis
./scripts/sonar_scan.sh

# Start SonarQube server (if using local)
docker compose up -d sonarqube

# Access SonarQube at http://localhost:9000
```

---

## CI/CD Scripts

The `scripts/` directory contains useful CI/CD scripts:

### Full CI Pipeline

```bash
# Run complete CI checks (lint, test, build)
./scripts/ci_full.sh

# What it does:
# 1. Lints backend and frontend
# 2. Runs all tests with coverage
# 3. Builds both projects
# 4. Reports success/failure
```

### Individual Scripts

```bash
# Lint backend only
./scripts/lint_backend.sh

# Lint frontend only
./scripts/lint_frontend.sh

# Lint everything
./scripts/lint_all.sh

# Run non-regression tests
./scripts/non_regression.sh

# Verify navigation links
./scripts/verify_nav_links.sh
```

---

## Environment Management

### Backend Environment

```bash
cd backend

# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env  # or vim, code, etc.

# Verify environment
cat .env

# Required variables:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - AUTH_ISSUER_BASE_URL
# - AUTH_AUDIENCE
```

### Frontend Environment

```bash
cd frontend

# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env

# Required variables:
# - VITE_AUTH0_DOMAIN
# - VITE_AUTH0_CLIENT_ID
# - VITE_AUTH0_AUDIENCE
```

---

## Process Management (PM2)

For production deployments using PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
pm2 start npm --name "darts-backend" -- start

# Manage processes
pm2 status                # List all processes
pm2 logs darts-backend    # View logs
pm2 restart darts-backend # Restart
pm2 stop darts-backend    # Stop
pm2 delete darts-backend  # Remove from PM2

# Monitor
pm2 monit                 # Real-time dashboard
pm2 describe darts-backend # Detailed info

# Startup script (survive reboots)
pm2 startup               # Follow instructions
pm2 save                  # Save current process list

# Update app
git pull
npm ci --production
npm run build
pm2 reload darts-backend
```

---

## Database Administration

### PostgreSQL Commands

```bash
# Connect to database
psql -h localhost -U darts_user -d darts_tournament

# From within psql:
\dt                    # List tables
\d tournaments         # Describe table
\l                     # List databases
\du                    # List users
\q                     # Quit

# Backup database
pg_dump -U darts_user darts_tournament > backup.sql

# Restore database
psql -U darts_user darts_tournament < backup.sql

# Create backup with timestamp
pg_dump -U darts_user darts_tournament > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Prisma Database Commands

```bash
cd backend

# View current schema
npx prisma db pull

# Validate schema
npx prisma validate

# Format schema file
npx prisma format

# Introspect database
npx prisma db pull

# Reset (danger!)
npx prisma migrate reset --force
```

---

## Redis Commands

### Connect to Redis

```bash
# Using Docker
docker compose exec redis redis-cli

# Local Redis
redis-cli

# With auth
redis-cli -a your-password

# Remote Redis
redis-cli -h hostname -p 6379 -a password
```

### Common Redis Commands

```bash
# From redis-cli:
PING                   # Test connection
INFO                   # Server info
KEYS *                 # List all keys (dev only!)
GET key_name           # Get value
SET key_name value     # Set value
DEL key_name           # Delete key
FLUSHDB                # Clear current database
FLUSHALL               # Clear all databases
```

---

## Logs Management

### View Logs

```bash
# Backend logs
tail -f backend/logs/combined-*.log
tail -f backend/logs/error-*.log

# Frontend logs (if applicable)
tail -f frontend/logs/*.log

# PM2 logs
pm2 logs darts-backend
pm2 logs darts-backend --lines 100
pm2 logs darts-backend --err      # Error logs only
pm2 logs darts-backend --out      # Output logs only

# Docker logs
docker compose logs -f backend
docker compose logs -f postgres --tail=100
```

### Clear Logs

```bash
# Backend logs
rm backend/logs/*.log

# PM2 logs
pm2 flush darts-backend

# Docker logs
docker compose logs --no-log-prefix > /dev/null
```

---

## Network & Port Management

### Check Port Usage

```bash
# Check if port is in use
lsof -i :3000          # Backend
lsof -i :5173          # Frontend
lsof -i :5432          # PostgreSQL
lsof -i :6379          # Redis

# Kill process on port
kill -9 $(lsof -t -i :3000)

# Alternative (using netstat)
netstat -tuln | grep :3000
```

### Firewall (UFW)

```bash
# Enable firewall
sudo ufw enable

# Allow specific ports
sudo ufw allow 22         # SSH
sudo ufw allow 80         # HTTP
sudo ufw allow 443        # HTTPS
sudo ufw allow 3000       # Backend (dev)
sudo ufw allow 5173       # Frontend (dev)

# Check status
sudo ufw status

# Delete rule
sudo ufw delete allow 3000
```

---

## Git Workflows

### Update Local Repository

```bash
# Fetch and pull latest changes
git fetch origin
git pull origin main

# Stash local changes before pull
git stash
git pull origin main
git stash pop
```

### Create Feature Branch

```bash
# Create and switch to new branch
git checkout -b feature/my-feature

# Make changes, then commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/my-feature
```

### Tag Release

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tags to remote
git push origin --tags

# List tags
git tag -l

# Checkout specific tag
git checkout v1.0.0
```

---

## Performance Monitoring

### Backend Performance

```bash
# Using PM2
pm2 describe darts-backend
pm2 monit

# Node.js memory usage
node --expose-gc backend/dist/server.js

# Profile with clinic
npm install -g clinic
clinic doctor -- node dist/server.js
```

### Database Performance

```sql
-- From psql:

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
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

## Maintenance Tasks

### Regular Maintenance

```bash
# Weekly: Update dependencies
cd backend && npm update
cd frontend && npm update

# Monthly: Security audit
npm audit
npm audit fix

# Database vacuum (PostgreSQL)
psql -U darts_user -d darts_tournament -c "VACUUM ANALYZE;"

# Clear old logs (older than 30 days)
find backend/logs -name "*.log" -mtime +30 -delete
```

### Backup Strategy

```bash
# Daily backup script (add to crontab)
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d)

# Database backup
pg_dump -U darts_user darts_tournament > $BACKUP_DIR/db_$DATE.sql

# Code backup (if needed)
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/darts_tournament

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

---

## Additional Resources

- [API Documentation](./API.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Frontend Documentation](./FRONTEND.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Testing Documentation](./TESTING.md)

**Happy Darting! 🎯**
