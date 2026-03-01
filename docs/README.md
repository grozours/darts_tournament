# 📚 Documentation Index

[![Playwright E2E](https://github.com/grozours/darts_tournament/actions/workflows/playwright-e2e.yml/badge.svg)](https://github.com/grozours/darts_tournament/actions/workflows/playwright-e2e.yml)
[![Coverage](https://github.com/grozours/darts_tournament/actions/workflows/coverage.yml/badge.svg)](https://github.com/grozours/darts_tournament/actions/workflows/coverage.yml)
[![Codecov](https://codecov.io/gh/grozours/darts_tournament/branch/main/graph/badge.svg)](https://codecov.io/gh/grozours/darts_tournament)

Welcome to the Darts Tournament Manager documentation! This index will help you find the information you need.

---

<a id="installation"></a>
## 🚀 Quick Start

**New to the project?** Start here:

1. **[README](../README.md)** - Project overview and quick start guide
2. **[Installation](#installation)** - Get the project running locally
3. **[Commands Reference](./COMMANDS.md)** - Essential commands for daily use

---

## 📄 Markdown Files Summary

### Root
- [README.md](../README.md)
- [README.fr.md](../README.fr.md)
- [README.showcase.en.md](../README.showcase.en.md)
- [README.showcase.fr.md](../README.showcase.fr.md)
- [LICENSE](../LICENSE)

### Docs
- [docs/ADMIN_GUIDE.fr.md](./ADMIN_GUIDE.fr.md)
- [docs/APP_WALKTHROUGH.md](./APP_WALKTHROUGH.md)
- [docs/APP_WALKTHROUGH.fr.md](./APP_WALKTHROUGH.fr.md)
- [docs/APP_WALKTHROUGH.es.md](./APP_WALKTHROUGH.es.md)
- [docs/APP_WALKTHROUGH.de.md](./APP_WALKTHROUGH.de.md)
- [docs/APP_WALKTHROUGH.it.md](./APP_WALKTHROUGH.it.md)
- [docs/APP_WALKTHROUGH.pt.md](./APP_WALKTHROUGH.pt.md)
- [docs/APP_WALKTHROUGH.nl.md](./APP_WALKTHROUGH.nl.md)
- [docs/PLAYER_GUIDE.md](./PLAYER_GUIDE.md)
- [docs/PLAYER_GUIDE.fr.md](./PLAYER_GUIDE.fr.md)
- [docs/COMMANDS.md](./COMMANDS.md)
- [docs/COMMANDS.fr.md](./COMMANDS.fr.md)
- [docs/DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/DEPLOYMENT.fr.md](./DEPLOYMENT.fr.md)
- [docs/FRONTEND.md](./FRONTEND.md)
- [docs/FRONTEND.fr.md](./FRONTEND.fr.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/ARCHITECTURE.fr.md](./ARCHITECTURE.fr.md)
- [docs/API.md](./API.md)
- [docs/API.fr.md](./API.fr.md)
- [docs/TESTING.md](./TESTING.md)
- [docs/TESTING.fr.md](./TESTING.fr.md)
- [docs/ADMIN_SETUP.md](./ADMIN_SETUP.md)
- [docs/ADMIN_SETUP.fr.md](./ADMIN_SETUP.fr.md)
- [docs/AUTH0_EMAIL_SETUP.md](./AUTH0_EMAIL_SETUP.md)
- [docs/AUTH0_EMAIL_SETUP.fr.md](./AUTH0_EMAIL_SETUP.fr.md)
- [docs/README.md](./README.md)
- [docs/README.fr.md](./README.fr.md)

### Specs
- [specs/001-tournament-manager/spec.md](../specs/001-tournament-manager/spec.md)
- [specs/001-tournament-manager/spec.fr.md](../specs/001-tournament-manager/spec.fr.md)
- [specs/001-tournament-manager/plan.md](../specs/001-tournament-manager/plan.md)
- [specs/001-tournament-manager/plan.fr.md](../specs/001-tournament-manager/plan.fr.md)
- [specs/001-tournament-manager/quickstart.md](../specs/001-tournament-manager/quickstart.md)
- [specs/001-tournament-manager/quickstart.fr.md](../specs/001-tournament-manager/quickstart.fr.md)
- [specs/001-tournament-manager/data-model.md](../specs/001-tournament-manager/data-model.md)
- [specs/001-tournament-manager/data-model.fr.md](../specs/001-tournament-manager/data-model.fr.md)
- [specs/001-tournament-manager/research.md](../specs/001-tournament-manager/research.md)
- [specs/001-tournament-manager/research.fr.md](../specs/001-tournament-manager/research.fr.md)
- [specs/001-tournament-manager/tasks.md](../specs/001-tournament-manager/tasks.md)
- [specs/001-tournament-manager/tasks.fr.md](../specs/001-tournament-manager/tasks.fr.md)

---

## 📖 Core Documentation

### For Developers

| Document | Description | When to Use |
|----------|-------------|-------------|
| **[Architecture](./ARCHITECTURE.md)** | System design, patterns, and data flow | Understanding how the system works, making architectural decisions |
| **[API Documentation](./API.md)** | Complete REST API reference | Integrating with the backend, understanding endpoints |
| **[Frontend Guide](./FRONTEND.md)** | React architecture and components | Building UI features, understanding frontend patterns |
| **[App Walkthrough](./APP_WALKTHROUGH.md)** | Visual user journeys by role (anonymous/player/admin) with screenshots | Explaining how the app works to end users |
| **[Testing](./TESTING.md)** | Testing strategy and examples | Writing tests, understanding coverage goals |
| **[Commands Reference](./COMMANDS.md)** | All available commands | Daily development tasks, troubleshooting |

### For DevOps/Deployment

| Document | Description | When to Use |
|----------|-------------|-------------|
| **[Deployment Guide](./DEPLOYMENT.md)** | Production deployment instructions | Deploying to servers, cloud platforms, Docker |
| **[Admin Setup](./ADMIN_SETUP.md)** | Admin authentication configuration | Setting up admin users |
| **[Auth0 Email Setup](./AUTH0_EMAIL_SETUP.md)** | Auth0 email claim configuration | Configuring authentication |

---

## 🎯 By Task

### I want to...

#### Anonymous flow (quick)
- **Understand the app without an account** → [Application walkthrough: anonymous](./APP_WALKTHROUGH.md#anonymous-scenarios)
- **Browse public tournaments** → [Public views screenshots](./APP_WALKTHROUGH.md#anonymous-scenarios)
- **Review registered participants then sign in** → [Anonymous scenarios](./APP_WALKTHROUGH.md#anonymous-scenarios)

#### Get Started
- **Install the project locally** → [README Quick Start](../README.md#-quick-start)
- **Understand the project structure** → [Architecture: Project Structure](./ARCHITECTURE.md#directory-structure)
- **Run the development server** → [Commands: Development](./COMMANDS.md#development-commands)

#### Development
- **Create a new feature** → [Architecture](./ARCHITECTURE.md) + [Testing](./TESTING.md)
- **Add a new API endpoint** → [API Documentation](./API.md) + [Backend Structure](./ARCHITECTURE.md#backend-architecture)
- **Build a new component** → [Frontend Guide](./FRONTEND.md) + [Component Architecture](./FRONTEND.md#component-architecture)
- **Write tests** → [Testing Documentation](./TESTING.md)

#### Database
- **Run migrations** → [Commands: Database](./COMMANDS.md#database-commands)
- **Seed test data** → [Commands: Seeding](./COMMANDS.md#seeding)
- **Understand the schema** → [Architecture: Database Schema](./ARCHITECTURE.md#database-schema)
- **Backup the database** → [Deployment: Database Setup](./DEPLOYMENT.md#database-setup)

#### API Integration
- **List all endpoints** → [API Documentation](./API.md)
- **Understand authentication** → [API: Authentication](./API.md#authentication) + [Admin Setup](./ADMIN_SETUP.md)
- **Handle errors** → [API: Validation & Errors](./API.md#validation--errors)
- **Use WebSockets** → [API: WebSocket Events](./API.md#websocket-events)

#### Deployment
- **Deploy to production** → [Deployment Guide](./DEPLOYMENT.md)
- **Use Docker** → [Docker Deployment](./DEPLOYMENT.md#docker-deployment)
- **Deploy to AWS/DigitalOcean** → [Cloud Deployment](./DEPLOYMENT.md#cloud-deployment)
- **Setup monitoring** → [Deployment: Monitoring](./DEPLOYMENT.md#monitoring--maintenance)

#### Troubleshooting
- **Debug issues** → [Commands: Troubleshooting](./COMMANDS.md#troubleshooting)
- **Check logs** → [Commands: Logs Management](./COMMANDS.md#logs-management)
- **Performance issues** → [Deployment: Troubleshooting](./DEPLOYMENT.md#troubleshooting)

---

## 📁 Documentation by Component

### Backend

- **Architecture** → [Backend Architecture](./ARCHITECTURE.md#backend-architecture)
- **API Endpoints** → [API Documentation](./API.md)
- **Database Schema** → [Database Schema](./ARCHITECTURE.md#database-schema)
- **Authentication** → [Authentication Flow](./ARCHITECTURE.md#authentication--authorization)
- **WebSockets** → [Real-Time Communication](./ARCHITECTURE.md#real-time-communication)
- **Testing** → [Backend Testing](./TESTING.md#backend-testing)

### Frontend

- **Architecture** → [Frontend Architecture](./FRONTEND.md#component-architecture)
- **Routing** → [Routing Strategy](./FRONTEND.md#routing-strategy)
- **Components** → [Main Components](./FRONTEND.md#main-components)
- **State Management** → [State Management](./FRONTEND.md#state-management)
- **Authentication** → [Authentication Flow](./FRONTEND.md#authentication-flow)
- **Testing** → [Frontend Testing](./TESTING.md#frontend-testing)

### Database

- **Schema Design** → [Database Schema](./ARCHITECTURE.md#database-schema)
- **Migrations** → [Database Commands](./COMMANDS.md#migrations)
- **Seeding** → [Database Commands](./COMMANDS.md#seeding)
- **Backup/Restore** → [Database Administration](./COMMANDS.md#database-administration)

### DevOps

- **Production Deployment** → [Deployment Guide](./DEPLOYMENT.md#production-deployment)
- **Docker Setup** → [Docker Deployment](./DEPLOYMENT.md#docker-deployment)
- **CI/CD** → [CI/CD Integration](./TESTING.md#cicd-integration)
- **Monitoring** → [Monitoring & Maintenance](./DEPLOYMENT.md#monitoring--maintenance)

---

## 🔍 Search by Topic

### Technology Stack

- **React** → [Frontend Guide](./FRONTEND.md), [Tech Stack](../README.md#-tech-stack)
- **Node.js/Express** → [Backend Architecture](./ARCHITECTURE.md#backend-architecture)
- **TypeScript** → All documentation
- **PostgreSQL** → [Database Schema](./ARCHITECTURE.md#database-schema)
- **Prisma** → [Database Commands](./COMMANDS.md#database-commands)
- **Redis** → [Architecture: Redis](./ARCHITECTURE.md#backend-architecture)
- **Auth0** → [Admin Setup](./ADMIN_SETUP.md), [Auth0 Setup](./AUTH0_EMAIL_SETUP.md)
- **Docker** → [Docker Deployment](./DEPLOYMENT.md#docker-deployment)
- **WebSocket (Socket.io)** → [Real-Time Features](./ARCHITECTURE.md#real-time-communication)

### Features

- **Tournaments** → [API: Tournaments](./API.md#tournaments)
- **Players** → [API: Players](./API.md#players)
- **Pool Stages** → [API: Pool Stages](./API.md#pool-stages)
- **Brackets** → [API: Brackets](./API.md#brackets)
- **Matches** → [API: Matches](./API.md#matches)
- **Targets** → [Frontend: TargetsView](./FRONTEND.md#main-components)
- **Authentication** → [Admin Setup](./ADMIN_SETUP.md)
- **Real-time Updates** → [WebSocket Events](./API.md#websocket-events)

---

## 📚 Specifications

Project specifications and planning documents:

| Document | Description |
|----------|-------------|
| [spec.md](../specs/001-tournament-manager/spec.md) | User stories and requirements |
| [plan.md](../specs/001-tournament-manager/plan.md) | Implementation plan |
| [data-model.md](../specs/001-tournament-manager/data-model.md) | Database schema design |
| [research.md](../specs/001-tournament-manager/research.md) | Technical research |
| [quickstart.md](../specs/001-tournament-manager/quickstart.md) | Test scenarios |
| [tasks.md](../specs/001-tournament-manager/tasks.md) | Development tasks |

---

## 🎓 Learning Path

### Beginner (New to the Project)

1. Read [README](../README.md) - Get overview
2. Follow [Quick Start](../README.md#-quick-start) - Install and run
3. Review [Commands](./COMMANDS.md) - Learn essential commands
4. Explore [API Documentation](./API.md) - Understand endpoints

### Intermediate (Building Features)

1. Study [Architecture](./ARCHITECTURE.md) - Understand system design
2. Read [Frontend Guide](./FRONTEND.md) - Learn component structure
3. Review [Testing Documentation](./TESTING.md) - Write tests
4. Follow [Development Workflow](#development) - Build features

### Advanced (Production & Optimization)

1. Study [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
2. Review [Performance Optimizations](./ARCHITECTURE.md#performance-optimizations)
3. Understand [Security](./DEPLOYMENT.md#security-checklist)
4. Setup [Monitoring](./DEPLOYMENT.md#monitoring--maintenance)

---

## 🔗 External Resources

### Official Documentation

- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

### Testing

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

### DevOps

- [Docker Documentation](https://docs.docker.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## 💡 Tips

### Quick Wins

- **Use the restart script**: `./restart.sh both` handles everything
- **Keep Prisma Studio open**: `npm run db:studio` for database browsing
- **Watch the logs**: `./restart.sh logs backend` for debugging
- **Use code snippets**: Check documentation for copy-paste examples

### Common Gotchas

- **Prisma client out of sync**: Run `npx prisma generate` after schema changes
- **Port conflicts**: Use `./restart.sh stop` before starting
- **Environment variables**: Check `.env` files when things don't work
- **Database migrations**: Always run `npm run db:migrate` after pulling changes

---

## 🤝 Contributing

When contributing documentation:

1. Keep it concise and practical
2. Include code examples
3. Add to this index when creating new docs
4. Use Markdown formatting consistently
5. Test all commands/examples before documenting

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) file for details.

---

**Need help?** Check the [Troubleshooting](./COMMANDS.md#troubleshooting) section or review the relevant documentation above.

**Happy Coding! 🎯**
