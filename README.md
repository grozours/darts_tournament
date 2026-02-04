# 🎯 Darts Tournament Manager

A full-stack application for managing darts tournaments with support for single elimination, double elimination, and team formats.

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

- **Tournament Management**: Create and manage tournaments with various formats
- **Player Registration**: Register players with skill levels and contact info
- **Pool Stages**: Organize pool play with automatic bracket generation
- **Match Scheduling**: Automated scheduling with target assignment
- **Real-time Updates**: WebSocket support for live score updates
- **Structured Logging**: Comprehensive logging with correlation IDs

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Cache** | Redis |
| **Logging** | Winston with daily rotation |

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

Set your Auth0 credentials in frontend/.env to enable Google/Facebook login:

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
# Optional: VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
```

Backend Auth0 (required):

```env
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
- **Frontend**: http://localhost:5173
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
./restart.sh frontend   # Start frontend only (port 5173)

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

## 📋 Specifications

The project specifications are located in `specs/001-tournament-manager/`:

| File | Description |
|------|-------------|
| [spec.md](specs/001-tournament-manager/spec.md) | **User Stories & Requirements** - Complete functional requirements with prioritized user stories (P1, P2, P3), acceptance criteria, and use cases |
| [plan.md](specs/001-tournament-manager/plan.md) | **Implementation Plan** - Technology stack decisions, project structure, architectural patterns, and development approach |
| [data-model.md](specs/001-tournament-manager/data-model.md) | **Database Schema** - Entity definitions, relationships, enums, and Prisma schema design |
| [research.md](specs/001-tournament-manager/research.md) | **Technical Research** - Design decisions, alternatives considered, and rationale for key choices |
| [quickstart.md](specs/001-tournament-manager/quickstart.md) | **Test Scenarios** - Manual and automated test cases for validating functionality |
| [tasks.md](specs/001-tournament-manager/tasks.md) | **Development Tasks** - Detailed task breakdown with dependencies, organized by user story |

### Contracts (`specs/001-tournament-manager/contracts/`)

API contract definitions for each endpoint:
- Tournament CRUD operations
- Player registration
- Match scheduling
- Score tracking

### Checklists (`specs/001-tournament-manager/checklists/`)

Quality assurance checklists for:
- Code review
- Testing coverage
- Deployment readiness

**Happy Darting! 🎯**
