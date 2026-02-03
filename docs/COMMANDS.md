# 📖 Commands Documentation

Complete reference for all scripts and commands in the Darts Tournament Manager.

## Table of Contents

- [Service Management (restart.sh)](#service-management-restartsh)
- [Database Commands](#database-commands)
- [Development Commands](#development-commands)
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
