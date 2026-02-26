# 🎯 Darts Tournament Manager

[![Playwright E2E](https://github.com/grozours/darts_tournament/actions/workflows/playwright-e2e.yml/badge.svg)](https://github.com/grozours/darts_tournament/actions/workflows/playwright-e2e.yml)
[![Coverage](https://github.com/grozours/darts_tournament/actions/workflows/coverage.yml/badge.svg)](https://github.com/grozours/darts_tournament/actions/workflows/coverage.yml)
[![Codecov](https://codecov.io/gh/grozours/darts_tournament/branch/main/graph/badge.svg)](https://codecov.io/gh/grozours/darts_tournament)

A full-stack application for managing darts tournaments with support for single elimination, double elimination, and team formats.

## 📚 Documentation Navigation

- Detailed project guide (EN): [README.md](README.md)
- Detailed project guide (FR): [README.fr.md](README.fr.md)
- Showcase guide (EN): [README.showcase.en.md](README.showcase.en.md)
- Showcase guide (FR): [README.showcase.fr.md](README.showcase.fr.md)
- Full docs index (EN): [docs/README.md](docs/README.md)
- Full docs index (FR): [docs/README.fr.md](docs/README.fr.md)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Commands Reference](#-commands-reference)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

## ✨ Features

### Tournament Management
- **Multiple Formats**: Single elimination, double elimination, and team (4-player) formats
- **Flexible Duration**: Half-day (morning/afternoon/night), full-day, or two-day tournaments
- **Status Workflow**: DRAFT → OPEN → SIGNATURE → LIVE → FINISHED
- **Visual Branding**: Upload tournament logos (JPG/PNG, max 5MB)
- **Target Management**: Configure and track dartboard targets with availability status

### Player & Team Management
- **Comprehensive Registration**: First name, last name, surname, team name, email, phone
- **Skill Level Assessment**: Beginner, Intermediate, Advanced, Expert
- **Check-in System**: Player signature/check-in tracking before tournament start
- **Person Linking**: Reusable player profiles across multiple tournaments
- **Orphan Player Management**: Handle players without tournament assignment

### Pool Stages
- **Multi-Stage Pools**: Configure multiple pool stages with varying pool counts
- **Intelligent Seeding**: Automatic player distribution based on skill levels
- **Pool Status Tracking**: NOT_STARTED, EDITION, IN_PROGRESS, COMPLETED
- **Advancement Rules**: Configurable number of players advancing from each pool
- **Loser Bracket Integration**: Optionally advance non-qualifiers to loser brackets
- **Ranking Destinations**: Route each rank to a bracket, another pool stage, or elimination

### Brackets
- **Single/Double Elimination**: Winner and loser bracket support
- **Configurable Rounds**: Flexible round configuration (1-10 rounds)
- **Automatic Seeding**: Bracket entries from pool stage results
- **Admin Populate**: Populate a bracket from pool results with a winner/loser role
- **Match Progression**: Automatic winner advancement through rounds

### Match & Scoring
- **Real-time Score Entry**: Update scores with immediate synchronization
- **Target Assignment**: Assign matches to specific dartboard targets
- **Match Status**: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- **Match Queue**: Intelligent queue showing next matches for available targets
- **Player Blocking**: Prevent same player from playing concurrent matches
- **Legs & Sets**: Configurable match format (best of X legs/sets)

### Live Tournament Views
- **Live Dashboard**: Real-time tournament status and ongoing matches
- **Pool Stages View**: Detailed pool standings and match results
- **Brackets View**: Visual bracket progression and results
- **Targets View**: Target availability and current match assignments
- **Match Queue**: Prioritized list of upcoming matches
- **Multi-Tournament**: View and manage multiple tournaments simultaneously

### Authentication & Authorization
- **OAuth 2.0**: Auth0 integration with Google/Facebook/Instagram login
- **Admin Roles**: Email-based admin access control
- **Protected Endpoints**: Secure API access with JWT bearer tokens
- **Optional Authentication**: Public views available without login

### Real-time Features
- **WebSocket Integration**: Live updates for match status changes
- **Match Notifications**: Real-time notifications when matches start
- **Target Status Updates**: Instant target availability changes
- **Score Synchronization**: Live score updates across all clients

### Data & Logging
- **Structured Logging**: Winston with daily rotation and correlation IDs
- **Request Tracking**: Unique correlation IDs for request tracing
- **Tournament History**: Permanent storage of completed tournaments
- **Statistics**: Tournament and player statistics tracking

## 🛠 Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|----------|
| **Frontend** | React | 18.2+ | UI framework |
| | TypeScript | 5.x | Type safety |
| | Vite | 5.x | Build tool & dev server |
| | TailwindCSS | 3.x | Styling framework |
| | React Router | 6.x | Client-side routing |
| | Auth0 React | 2.x | Authentication |
| | TanStack Query | 5.x | Server state management |
| | React Hook Form | 7.x | Form handling |
| | Zod | 3.x | Schema validation |
| | Socket.io Client | 4.x | Real-time communication |
| | Vitest | 1.x | Unit testing |
| | Axios | 1.x | HTTP client |
| **Backend** | Node.js | 20+ | Runtime environment |
| | Express | 4.x | Web framework |
| | TypeScript | 5.x | Type safety |
| | Prisma | 5.x | ORM & database toolkit |
| | PostgreSQL | 14+ | Primary database |
| | Redis | 6+ | Caching & sessions |
| | Socket.io | 4.x | WebSocket server |
| | Winston | 3.x | Structured logging |
| | Joi | 17.x | Request validation |
| | express-oauth2-jwt-bearer | 1.x | JWT authentication |
| | helmet | 7.x | Security headers |
| | express-rate-limit | 8.x | Rate limiting |
| | Jest | 29.x | Testing framework |
| **DevOps** | Docker | Latest | Containerization |
| | Docker Compose | Latest | Multi-container orchestration |
| | Playwright | Latest | E2E testing |
| | ESLint | 8.x | Code linting |
| | Prettier | 3.x | Code formatting |
| | SonarQube | LTS | Code quality analysis |

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL 14+
- Redis 6+
- Git

### One-Line Install (from GitHub)

```bash
curl -fsSL https://raw.githubusercontent.com/grozours/darts_tournament/main/install.sh | bash
```

Or clone and run manually:

```bash
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament
./install.sh
```

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure Environment

```bash
# Copy example environment file
cd backend
cp .env.example .env

# Edit with your settings
nano .env
```

Frontend auth (required for OAuth):

```bash
cd ../frontend
cp .env.example .env
```

Set your Auth0 credentials in frontend/.env to enable Google/Facebook/Instagram login:

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
# Optional: VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
# Optional: override connection names if you changed them in Auth0
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_INSTAGRAM=instagram
```

Backend Auth0 (optional):

```env
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
AUTH_AUDIENCE=https://api.yourdomain.com
```

**Required environment variables:**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/darts_tournament"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
NODE_ENV=development

# JWT (change in production!)
JWT_SECRET="your-secret-key"

# Auth0
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"
```

## 🚚 Transfer Docker Images to Production (preserve prod .env)

Use this workflow when you want to move Docker images from your machine to production without overwriting production environment files.

### 1) Build and export images on your machine

```bash
./scripts/export_docker_bundle.sh --tag 20260226
```

This creates a bundle like:

`dist/docker-bundles/darts-images-20260226.tar.gz`

### 2) Copy the bundle to production

```bash
scp dist/docker-bundles/darts-images-20260226.tar.gz user@prod:/tmp/
```

### 3) Import and deploy on production

```bash
cd /path/to/darts_tournament
./scripts/import_docker_bundle.sh --bundle /tmp/darts-images-20260226.tar.gz --tag 20260226
```

The import/deploy script:
- loads images locally on the server,
- starts services with `docker-compose.yml` + `docker-compose.images.yml`,
- verifies `backend/.env` and `frontend/.env` exist,
- never overwrites those env files.

### 4. Setup Database

```bash
cd backend

# Run migrations to create schema
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

### 5. Start the Application

```bash
# From project root
./restart.sh both
```

Access the application:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 📖 Commands Reference

### Service Management (`restart.sh`)

The `restart.sh` script manages backend and frontend services:

```bash
# Start both services in background
./restart.sh both

# Start individual services
./restart.sh backend    # Start backend only (port 3000)
./restart.sh frontend   # Start frontend only (port 3001)

# Stop services
./restart.sh stop       # Stop all services

# Check status
./restart.sh status     # Show running services and ports

# View logs
./restart.sh logs backend   # Tail backend logs
./restart.sh logs frontend  # Tail frontend logs

# Show help
./restart.sh help
```

### Database Commands (`backend/`)

Run these from the `backend/` directory:

```bash
# Apply pending migrations (production-safe)
npm run db:migrate

# Push schema changes directly (development)
npm run db:push

# Seed database with sample data
npm run db:seed

# Reset database (WARNING: deletes all data!)
npm run db:reset

# Open Prisma Studio (visual database browser)
npm run db:studio
```

### Development Commands

**Backend (`backend/`):**

```bash
npm run dev          # Start with hot-reload (ts-node-dev)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JavaScript
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run lint         # Check for linting errors
npm run lint:fix     # Auto-fix linting errors
npm run format       # Format code with Prettier
```

**Frontend (`frontend/`):**

```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run Vitest tests
npm run lint         # Check for linting errors
```

### SonarQube Scan

Run the SonarQube scan from the project root (requires `SONAR_TOKEN`):

```bash
export SONAR_TOKEN=your_token
# Optional: export SONAR_HOST_URL=http://localhost:9000
./scripts/sonar_scan.sh
```

If you store a token in `.sonar-token`, it will be used automatically by `scripts/ci_full.sh`.

### Installation Script (`install.sh`)

For fresh installations from GitHub:

```bash
# Install in current directory
./install.sh

# Install in specific directory
./install.sh /path/to/project

# Show help
./install.sh --help
```

The script will:
1. Check prerequisites (Node.js, npm, Git)
2. Clone the repository
3. Install all dependencies
4. Create default `.env` file
5. Optionally start Docker services
6. Run database migrations
7. Optionally seed sample data

## 📁 Project Structure

```
darts_tournament/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── app.ts          # Express app configuration
│   │   ├── server.ts       # Server entry point
│   │   ├── routes/         # API route handlers
│   │   ├── controllers/    # Request/response logic
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utilities (logger, etc.)
│   │   └── types/          # TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   ├── migrations/     # Migration files
│   │   └── seed.ts         # Seed data script
│   ├── tests/              # Jest tests
│   └── logs/               # Application logs
│
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main app component
│   └── dist/               # Production build
│
├── shared/                 # Shared types/utilities
├── specs/                  # Feature specifications
├── .specify/               # Project documentation
│
├── restart.sh              # Service management script
├── install.sh              # Installation script
├── docker-compose.yml      # Docker services config
└── README.md               # This file
```

## 🔌 API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/tournaments` | List all tournaments |
| POST | `/api/tournaments` | Create tournament |
| GET | `/api/tournaments/:id` | Get tournament details |
| PUT | `/api/tournaments/:id` | Update tournament |
| DELETE | `/api/tournaments/:id` | Delete tournament |
| GET | `/api/tournaments/:id/players` | List players |
| POST | `/api/tournaments/:id/players` | Register player |

### Example Requests

```bash
# Get all tournaments
curl http://localhost:3000/api/tournaments

# Create a tournament
curl -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spring Championship",
    "format": "SINGLE",
    "durationType": "FULL_DAY",
    "startTime": "2026-04-15T09:00:00Z",
    "endTime": "2026-04-15T18:00:00Z",
    "totalParticipants": 16,
    "targetCount": 4
  }'

# Health check
curl http://localhost:3000/health
```

## 🐳 Docker Support

Start PostgreSQL and Redis with Docker:

```bash
# Start all services
docker compose up -d

# Start specific services
docker compose up -d postgres redis

# Stop services
docker compose down

# View logs
docker compose logs -f postgres
```

## 🧪 Testing

```bash
# Run all backend tests
cd backend && npm test

# Run with coverage
npm run test:coverage

# Run frontend tests
cd frontend && npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## � Documentation

### Core Documentation

| Document | Description |
|----------|-------------|
| **[API Documentation](docs/API.md)** | Complete REST API reference with all endpoints, request/response examples, authentication, rate limiting, and WebSocket events |
| **[Architecture](docs/ARCHITECTURE.md)** | System architecture, design patterns, data flow, technology decisions, and scalability considerations |
| **[Frontend Guide](docs/FRONTEND.md)** | React component architecture, routing, state management, styling, forms, and testing |
| **[Deployment Guide](docs/DEPLOYMENT.md)** | Production deployment instructions, Docker setup, cloud deployment, database management, and monitoring |
| **[Testing Documentation](docs/TESTING.md)** | Testing strategy, unit tests, integration tests, E2E tests, coverage goals, and CI/CD integration |
| **[Commands Reference](docs/COMMANDS.md)** | Complete command reference for development, database management, and service management |
| **[Admin Setup](docs/ADMIN_SETUP.md)** | Admin authentication setup and email configuration |
| **[Auth0 Email Setup](docs/AUTH0_EMAIL_SETUP.md)** | Auth0 email claim configuration for admin verification |

### Specifications

The project specifications are located in `specs/001-tournament-manager/`:

| File | Description |
|------|-------------|
| [spec.md](specs/001-tournament-manager/spec.md) | User stories & requirements with prioritized acceptance criteria |
| [plan.md](specs/001-tournament-manager/plan.md) | Implementation plan and technology stack decisions |
| [data-model.md](specs/001-tournament-manager/data-model.md) | Database schema, entity relationships, and Prisma design |
| [research.md](specs/001-tournament-manager/research.md) | Technical research and design decision rationale |
| [quickstart.md](specs/001-tournament-manager/quickstart.md) | Test scenarios and validation cases |
| [tasks.md](specs/001-tournament-manager/tasks.md) | Development tasks breakdown with dependencies |

**Happy Darting! 🎯**
