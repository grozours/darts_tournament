# 🎯 Gestionnaire de Tournois de Fléchettes

Une application full-stack pour gérer des tournois de fléchettes avec prise en charge des formats simple élimination, double élimination et équipes.

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Démarrage rapide](#-démarrage-rapide)
- [Installation](#-installation)
- [Référence des commandes](#-référence-des-commandes)
- [Structure du projet](#-structure-du-projet)
- [Documentation API](#-documentation-api)
- [Contribuer](#-contribuer)

## ✨ Fonctionnalités

### Gestion des tournois
- **Formats multiples** : simple élimination, double élimination et équipes (4 joueurs)
- **Durée flexible** : demi-journée (matin/après-midi/nuit), journée complète ou deux jours
- **Workflow d’état** : DRAFT → OPEN → SIGNATURE → LIVE → FINISHED
- **Identité visuelle** : téléversement des logos de tournoi (JPG/PNG, max 5 Mo)
- **Gestion des cibles** : configuration et suivi des cibles avec statut de disponibilité

### Gestion des joueurs & équipes
- **Inscription complète** : prénom, nom, surnom, nom d’équipe, email, téléphone
- **Évaluation du niveau** : Débutant, Intermédiaire, Avancé, Expert
- **Système de check-in** : suivi de la signature/présence avant le démarrage
- **Lien de personne** : profils réutilisables sur plusieurs tournois
- **Gestion des joueurs orphelins** : joueurs sans affectation à un tournoi

### Phases de poules
- **Poules multi-phases** : plusieurs phases avec nombre de poules configurable
- **Tirage intelligent** : distribution automatique selon le niveau
- **Suivi de l’état des poules** : NOT_STARTED, EDITION, IN_PROGRESS, COMPLETED
- **Règles d’avancement** : nombre de qualifiés configurable par poule
- **Intégration loser bracket** : option pour qualifier des non-qualifiés en loser bracket

### Tableaux
- **Simple/double élimination** : winner et loser bracket
- **Tours configurables** : configuration flexible (1 à 10 tours)
- **Tirage automatique** : entrées de tableau depuis les résultats des poules
- **Progression des matchs** : avancement automatique des gagnants

### Matchs & scores
- **Saisie en temps réel** : scores synchronisés immédiatement
- **Affectation de cibles** : assignation des matchs à des cibles spécifiques
- **Statut des matchs** : SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- **File d’attente** : file intelligente des prochains matchs
- **Blocage des joueurs** : empêche un joueur de jouer deux matchs en parallèle
- **Sets & legs** : format configurable (best of X legs/sets)

### Vues en direct
- **Tableau de bord live** : état en temps réel et matchs en cours
- **Vue poules** : classements et résultats détaillés
- **Vue tableaux** : progression visuelle des tableaux
- **Vue cibles** : disponibilité et affectations en cours
- **File d’attente** : liste priorisée des matchs à venir
- **Multi-tournois** : gestion et affichage de plusieurs tournois

### Authentification & autorisation
- **OAuth 2.0** : intégration Auth0 (Google/Facebook/Instagram)
- **Rôles admin** : contrôle d’accès par email
- **Endpoints protégés** : sécurisation par JWT bearer tokens
- **Auth optionnelle** : vues publiques sans connexion

### Temps réel
- **WebSocket** : mises à jour live des états de match
- **Notifications** : alertes lors du démarrage des matchs
- **Statut des cibles** : disponibilité instantanée
- **Synchronisation des scores** : mise à jour live côté clients

### Données & logs
- **Logs structurés** : Winston avec rotation quotidienne et correlation IDs
- **Traçage des requêtes** : IDs de corrélation uniques
- **Historique des tournois** : stockage permanent
- **Statistiques** : suivi des stats tournoi et joueur

## 🛠 Stack technique

| Couche | Technologie | Version | Rôle |
|-------|------------|---------|------|
| **Frontend** | React | 18.2+ | Framework UI |
| | TypeScript | 5.x | Typage |
| | Vite | 5.x | Build tool & dev server |
| | TailwindCSS | 3.x | Framework de styles |
| | React Router | 6.x | Routing côté client |
| | Auth0 React | 2.x | Authentification |
| | TanStack Query | 5.x | Gestion d’état serveur |
| | React Hook Form | 7.x | Gestion des formulaires |
| | Zod | 3.x | Validation de schémas |
| | Socket.io Client | 4.x | Communication temps réel |
| | Vitest | 1.x | Tests unitaires |
| | Axios | 1.x | Client HTTP |
| **Backend** | Node.js | 20+ | Runtime |
| | Express | 4.x | Framework web |
| | TypeScript | 5.x | Typage |
| | Prisma | 5.x | ORM & base de données |
| | PostgreSQL | 14+ | Base de données principale |
| | Redis | 6+ | Cache & sessions |
| | Socket.io | 4.x | WebSocket server |
| | Winston | 3.x | Logs structurés |
| | Joi | 17.x | Validation des requêtes |
| | express-oauth2-jwt-bearer | 1.x | Auth JWT |
| | helmet | 7.x | En-têtes de sécurité |
| | express-rate-limit | 8.x | Rate limiting |
| | Jest | 29.x | Tests |
| **DevOps** | Docker | Latest | Conteneurisation |
| | Docker Compose | Latest | Orchestration multi-conteneurs |
| | Playwright | Latest | Tests E2E |
| | ESLint | 8.x | Linting |
| | Prettier | 3.x | Formatage |
| | SonarQube | LTS | Qualité de code |

## 🚀 Démarrage rapide

### Prérequis

- Node.js >= 18
- PostgreSQL 14+
- Redis 6+
- Git

### Installation en une ligne (depuis GitHub)

```bash
curl -fsSL https://raw.githubusercontent.com/grozours/darts_tournament/main/install.sh | bash
```

Ou cloner et lancer manuellement :

```bash
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament
./install.sh
```

## 📦 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/grozours/darts_tournament.git
cd darts_tournament
```

### 2. Installer les dépendances

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurer l’environnement

```bash
# Copier le fichier d’exemple
cd backend
cp .env.example .env

# Éditer avec vos valeurs
nano .env
```

Auth frontend (requis pour OAuth) :

```bash
cd ../frontend
cp .env.example .env
```

Renseignez vos identifiants Auth0 dans frontend/.env pour activer Google/Facebook/Instagram :

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
# Optionnel : VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
# Optionnel : override des connexions si modifiées dans Auth0
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_INSTAGRAM=instagram
```

Auth0 backend (optionnel) :

```env
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
AUTH_AUDIENCE=https://api.yourdomain.com
```

Mode local sans callback Auth0 (optionnel, développement uniquement) :

```env
# Permet un autologin admin backend si aucun Bearer token n’est fourni
AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL=your-email@gmail.com
```

Utilisez ce mode uniquement en local/dev, et laissez cette variable vide en production.

**Variables d’environnement requises :**

```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/darts_tournament"

# Redis
REDIS_URL="redis://localhost:6379"

# Serveur
PORT=3000
NODE_ENV=development

# JWT (à changer en production !)
JWT_SECRET="your-secret-key"

# Auth0
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"
```

### 4. Initialiser la base de données

```bash
cd backend

# Appliquer les migrations
npm run db:migrate

# (Optionnel) Peupler avec des données d’exemple
npm run db:seed
```

### 5. Démarrer l’application

```bash
# Depuis la racine
./restart.sh both
```

Accès à l’application :
- **Frontend** : http://localhost:3001
- **Backend API** : http://localhost:3000
- **Health Check** : http://localhost:3000/health

## 📖 Référence des commandes

### Gestion des services (`restart.sh`)

Le script `restart.sh` gère les services backend et frontend :

```bash
# Démarrer les deux services en arrière-plan
./restart.sh both

# Démarrer un service
./restart.sh backend    # Backend seulement (port 3000)
./restart.sh frontend   # Frontend seulement (port 3001)

# Arrêter les services
./restart.sh stop       # Arrêter tous les services

# Vérifier le statut
./restart.sh status     # Affiche les services et ports

# Voir les logs
./restart.sh logs backend   # Suivre les logs backend
./restart.sh logs frontend  # Suivre les logs frontend

# Aide
./restart.sh help
```

### Commandes base de données (`backend/`)

À exécuter depuis `backend/` :

```bash
# Appliquer les migrations (prod-safe)
npm run db:migrate

# Pousser le schéma (dev)
npm run db:push

# Peupler la base de données
npm run db:seed

# Réinitialiser (ATTENTION : supprime tout !)
npm run db:reset

# Ouvrir Prisma Studio
npm run db:studio
```

### Commandes de développement

**Backend (`backend/`) :**

```bash
npm run dev           # Démarrer avec hot-reload (ts-node-dev)
npm run build         # Compiler TypeScript vers dist/
npm run start         # Exécuter le build
npm run test          # Lancer les tests Jest
npm run test:watch    # Tests en mode watch
npm run test:coverage # Couverture de tests
npm run lint          # Linting
npm run lint:fix      # Auto-correction lint
npm run format        # Formatage Prettier
```

**Frontend (`frontend/`) :**

```bash
npm run dev           # Démarrer Vite
npm run build         # Build de production
npm run preview       # Prévisualiser le build
npm run test          # Lancer Vitest
npm run lint          # Linting
```

### Script d’installation (`install.sh`)

Pour une installation fraîche depuis GitHub :

```bash
# Installer dans le dossier courant
./install.sh

# Installer dans un dossier spécifique
./install.sh /path/to/project

# Afficher l’aide
./install.sh --help
```

Le script :
1. Vérifie les prérequis (Node.js, npm, Git)
2. Clone le dépôt
3. Installe les dépendances
4. Crée un `.env` par défaut
5. Démarre Docker si demandé
6. Applique les migrations
7. (Optionnel) seed des données d’exemple

## 📁 Structure du projet

```
darts_tournament/
├── backend/                 # Serveur API Express
│   ├── src/
│   │   ├── app.ts          # Configuration Express
│   │   ├── server.ts       # Point d’entrée serveur
│   │   ├── routes/         # Routes API
│   │   ├── controllers/    # Logique requête/réponse
│   │   ├── services/       # Logique métier
│   │   ├── middleware/     # Middleware Express
│   │   ├── utils/          # Utilitaires (logger, etc.)
│   │   └── types/          # Types TypeScript
│   ├── prisma/
│   │   ├── schema.prisma   # Schéma BD
│   │   ├── migrations/     # Migrations
│   │   └── seed.ts         # Données de seed
│   ├── tests/              # Tests Jest
│   └── logs/               # Logs application
│
├── frontend/               # SPA React
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── types/          # Types TypeScript
│   │   └── App.tsx         # Composant racine
│   └── dist/               # Build de production
│
├── shared/                 # Types/utilitaires partagés
├── specs/                  # Spécifications
├── .specify/               # Documentation projet
│
├── restart.sh              # Script gestion services
├── install.sh              # Script d’installation
├── docker-compose.yml      # Configuration Docker
└── README.md               # Ce fichier
```

## 🔌 Documentation API

### Endpoints

| Méthode | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/tournaments` | Lister tous les tournois |
| POST | `/api/tournaments` | Créer un tournoi |
| GET | `/api/tournaments/:id` | Détails d’un tournoi |
| PUT | `/api/tournaments/:id` | Mettre à jour un tournoi |
| DELETE | `/api/tournaments/:id` | Supprimer un tournoi |
| GET | `/api/tournaments/:id/players` | Lister les joueurs |
| POST | `/api/tournaments/:id/players` | Inscrire un joueur |

### Exemples de requêtes

```bash
# Lister tous les tournois
curl http://localhost:3000/api/tournaments

# Créer un tournoi
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

## 🐳 Support Docker

Démarrer PostgreSQL et Redis avec Docker :

```bash
# Démarrer tous les services
docker compose up -d

# Démarrer des services spécifiques
docker compose up -d postgres redis

# Arrêter les services
docker compose down

# Voir les logs
docker compose logs -f postgres
```

## 🧪 Tests

```bash
# Lancer tous les tests backend
cd backend && npm test

# Avec couverture
npm run test:coverage

# Tests frontend
cd frontend && npm test
```

## 🤝 Contribuer

1. Forker le dépôt
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 📚 Documentation

### Documentation principale

| Document | Description |
|----------|-------------|
| **[Documentation API](docs/API.fr.md)** | Référence REST complète avec endpoints, exemples, auth, rate limiting et événements WebSocket |
| **[Architecture](docs/ARCHITECTURE.fr.md)** | Architecture, patterns, flux de données, choix techniques, scalabilité |
| **[Guide Frontend](docs/FRONTEND.fr.md)** | Architecture React, routing, state management, styles, formulaires, tests |
| **[Guide de déploiement](docs/DEPLOYMENT.fr.md)** | Déploiement production, Docker, cloud, base de données, monitoring |
| **[Documentation tests](docs/TESTING.fr.md)** | Stratégie de tests, unitaires, intégration, E2E, couverture, CI/CD |
| **[Référence des commandes](docs/COMMANDS.fr.md)** | Référence complète des commandes dev, base de données, services |
| **[Configuration admin](docs/ADMIN_SETUP.fr.md)** | Setup authentification admin et email |
| **[Configuration email Auth0](docs/AUTH0_EMAIL_SETUP.fr.md)** | Configuration des claims email Auth0 |

### Spécifications

Les spécifications se trouvent dans `specs/001-tournament-manager/` :

| Fichier | Description |
|------|-------------|
| [spec.fr.md](specs/001-tournament-manager/spec.fr.md) | User stories & exigences avec critères d’acceptation |
| [plan.fr.md](specs/001-tournament-manager/plan.fr.md) | Plan d’implémentation et choix technos |
| [data-model.fr.md](specs/001-tournament-manager/data-model.fr.md) | Schéma BD, relations, design Prisma |
| [research.fr.md](specs/001-tournament-manager/research.fr.md) | Recherche technique et rationale |
| [quickstart.fr.md](specs/001-tournament-manager/quickstart.fr.md) | Scénarios de test et validation |
| [tasks.fr.md](specs/001-tournament-manager/tasks.fr.md) | Découpage des tâches |

**Bon tournoi ! 🎯**
