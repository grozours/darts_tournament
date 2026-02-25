<h1 align="center">🎯</h1>

# 🎯 Darts Tournament Manager

[![Version](https://img.shields.io/github/v/release/grozours/darts_tournament)](https://github.com/grozours/darts_tournament/releases)
[![License](https://img.shields.io/github/license/grozours/darts_tournament)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-Node%2020+-3C873A)](backend/package.json)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-646CFF)](frontend/package.json)
[![Docker](https://img.shields.io/badge/deploy-Docker-2496ED)](docker-compose.yml)

A full-stack application to run darts tournaments (pool stages, brackets, targets, live scoring), with an admin interface, operator/live views, and real-time scheduling.

---

## 🚀 Quick overview

- Full tournament lifecycle management: DRAFT → OPEN → SIGNATURE → LIVE → FINISHED
- Multi-stage pool phases with configurable advancement rules
- Single/double elimination brackets with automatic progression
- Target assignment, player conflict prevention, and smart match queue
- Live views (pools, brackets, targets) with real-time updates
- Tournament presets + match format presets

---

## 🧭 Project access

### Interface & docs

- Admin guide (EN): [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)
- API (EN): [docs/API.md](docs/API.md)
- Architecture (EN): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Frontend (EN): [docs/FRONTEND.md](docs/FRONTEND.md)

### Local endpoints (dev)

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Healthcheck: http://localhost:3000/health

---

## ⚡ Quick start

### Option 1 — Project script

```bash
./restart.sh both
```

### Option 2 — Docker Compose

```bash
docker compose up -d --build
```

### Option 3 — Manual install

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Run
cd .. && ./restart.sh both
```

---

## 🐳 Docker deployment (prod)

Suggested flow:

1. Build images
2. Start services
3. Run Prisma migrations
4. Import presets when needed

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate
docker compose -f docker-compose.prod.yml exec backend npm run db:import-presets
```

For a full preset reimport:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:import-presets -- --replace
```

### 🌐 VPS hosting + Nginx reverse proxy

The project can be hosted on a standard VPS with:

- host-level Nginx in front (TLS reverse proxy)
- backend/frontend Docker containers on a private network
- public exposure only through Nginx (ports 80/443)

Recommended architecture:

1. Nginx (host) terminates TLS (https)
2. Reverse proxy to frontend container service (and /api to backend if needed)
3. Backend and database are not publicly exposed

Frontend container Nginx reference: [frontend/nginx.conf](frontend/nginx.conf)

For a detailed production guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## ✨ Key features

### 🏆 Tournament management

- Formats: single, double, 4-player team
- Duration modes: half-day, full day, two-day
- Tournament branding: logo + metadata (including location)
- History and state tracking

### 🎯 Pools & progression

- Multiple pool phases
- Rank routing to another phase, bracket, or elimination
- Parallel phases (inParallelWith) with optimistic time estimates
- Constraints-aware scheduling (players, targets, concurrency)

### 🧩 Brackets

- Winner/loser brackets
- Match format per round (roundMatchFormats)
- Pool-phase dependency for bracket start forecast
- Admin tools to complete/reset rounds

### 🎮 Matches & officiating

- Match statuses: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- Manual target assignment + queue-based suggestions
- Live score entry with immediate propagation
- Same-player concurrency prevention
- Player notifications when matches start
- Clear indication of assigned target/board

#### The 2 preset types

1) Tournament presets (tournamentPresets)

These presets define a reusable tournament structure:

- preset type (for example single-pool-stage, three-pool-stages)
- participant and target counts
- pool stage templates (stages, poolCount, playersPerPool, advanceCount)
- rank routing (to next stage, bracket, elimination)
- associated bracket templates

In practice: select a tournament preset at creation time and the app pre-fills the full tournament structure.

2) Match format presets (matchFormatPresets)

These presets define how an individual match is played:

- format key (for example BO3, BO5_501_701)
- estimated duration in minutes
- game segments (for example 501_DO, CRICKET, 701_DO) and parameters

Duration in these presets is critical: it directly drives match ETA, phase ETA (pools/brackets), and the global tournament end-time forecast.

They are referenced at:

- pool stage level (matchFormatKey)
- bracket round level (roundMatchFormats)

In practice: they standardize scoring and improve live forecast quality (duration/ETA).

Without coherent match format durations, schedule projections across tournament phases become unreliable.

Relationship between both

- Tournament preset defines where matches are played in the structure.
- Match format preset defines how each match is played.
- Both are complementary: structure + format = coherent, reusable planning.

### 🔔 Real-time

- WebSocket updates for match/target statuses
- Operations-oriented live views
- Match-start notifications

### ⏱️ Forecast times

- Estimated start times for upcoming matches
- Forecasts across each step: pool phases, phase transitions, brackets
- Calculations aligned with real constraints (available targets, player conflicts, parallelism)
- Dynamic updates based on actual match progress

---

## 🔐 Authentication & roles

### Access model

- Auth0-based authentication (OAuth/OIDC)
- Two main profiles:
  - Administrator: tournament configuration, structures, presets, sensitive actions
  - User/player: live viewing, registration, allowed interactions by screen
- Part of the app can remain publicly readable depending on configuration

### Visitor view (non-authenticated)

Visitor mode allows read-only access without login.

Typically available:

- live views (match status, phase progression, brackets, targets)
- public information useful for on-site tracking
- forecast times and global progress

Typically restricted (authentication required):

- admin actions (editing tournament, structure, presets, reset, sensitive operations)
- any business-data write operation

This separation makes public visibility possible while protecting operational control.

### Sign-in flow

- Frontend login via configured providers:

  ![Google](https://img.shields.io/badge/Google-4285F4?logo=google&logoColor=white)
  ![Facebook](https://img.shields.io/badge/Facebook-1877F2?logo=facebook&logoColor=white)
  ![Discord](https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white)

- Backend JWT Bearer validation on protected routes
- Admin guard enforced on administrative API endpoints

### Environment variables (example)

Frontend (frontend/.env):

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_DISCORD=discord
```

Backend (backend/.env):

```env
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
AUTH_AUDIENCE=https://api.yourdomain.com
```

Local dev mode (optional):

```env
AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL=your-email@example.com
```

Use this mode only locally, never in production.

---

## 🏗️ Tech stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Node.js, Express, TypeScript, Prisma
- Data: PostgreSQL, Redis
- QA: ESLint, Jest/Vitest, Playwright, SonarQube
- Infra: Docker, Docker Compose

More details: [README.md](README.md) and [README.fr.md](README.fr.md)

---

## 🧪 Dev quality layer

### Run in dev mode

```bash
./restart.sh -dev both
```

The -dev mode is recommended for local workflow (hot-reload and dev tooling).

### Linters & checks

- Global lint: ./scripts/lint_all.sh
- Backend lint: ./scripts/lint_backend.sh
- Frontend lint: ./scripts/lint_frontend.sh
- Shared artifact guard: ./scripts/check_shared_source_artifacts.sh

### Backend validation

```bash
npm --prefix backend run typecheck
npm --prefix backend run lint
```

### Local CI / regression checks

- Local pipeline: ./scripts/ci_full.sh
- Non-regression suite: ./scripts/non_regression.sh
- Navigation link verification: ./scripts/verify_nav_links.sh

### SonarQube analysis

- Init (dev): ./scripts/sonar_init.sh
- Scan: ./scripts/sonar_scan.sh
- Project config: [sonar-project.properties](sonar-project.properties)

In CI, scan can run automatically when SONAR_TOKEN is set.

---

## 💾 Data, migrations & presets

- Prisma migrations: backend/prisma/migrations
- Global seed (also includes demo data): npm --prefix backend run db:seed
- Presets-only import (recommended for prod):

```bash
npm --prefix backend run db:import-presets
```

Default import source: [backend/prisma/current-presets-export.json](backend/prisma/current-presets-export.json)

---

## 🛠️ Quick troubleshooting

- Check API health: curl -i http://localhost:3000/health
- Check Prisma/migrations:

```bash
cd backend
npm run db:migrate
```

- If Prisma CLI fails in container, rebuild backend image without cache.

---

## 📚 Useful links

- Main README: [README.md](README.md)
- French README: [README.fr.md](README.fr.md)
- Commands: [docs/COMMANDS.md](docs/COMMANDS.md)
- Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Testing: [docs/TESTING.md](docs/TESTING.md)
