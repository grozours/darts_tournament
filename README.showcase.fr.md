<h1 align="center">🎯</h1>

# 🎯 Darts Tournament Manager

[![Version](https://img.shields.io/github/v/release/grozours/darts_tournament)](https://github.com/grozours/darts_tournament/releases)
[![License](https://img.shields.io/github/license/grozours/darts_tournament)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-Node%2020+-3C873A)](backend/package.json)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-646CFF)](frontend/package.json)
[![Docker](https://img.shields.io/badge/deploy-Docker-2496ED)](docker-compose.yml)

Application full-stack pour piloter des tournois de fléchettes (poules, tableaux, cibles, scoring live), avec interface admin, vues opérateur et planification temps réel.

---

## 🚀 Aperçu rapide

- Gestion complète du cycle tournoi: `DRAFT → OPEN → SIGNATURE → LIVE → FINISHED`
- Phases de poules multi-étapes avec règles d’avancement configurables
- Tableaux simple/double élimination avec progression automatique
- Attribution de cibles, anti-conflits joueurs, et file de matchs intelligente
- Vues live (poules, brackets, cibles) avec mises à jour en temps réel
- Presets de tournois + presets de formats de match

---

## 🧭 Voir le projet

### Interface & docs

- Guide admin (FR): [docs/ADMIN_GUIDE.fr.md](docs/ADMIN_GUIDE.fr.md)
- API (FR): [docs/API.fr.md](docs/API.fr.md)
- Architecture (FR): [docs/ARCHITECTURE.fr.md](docs/ARCHITECTURE.fr.md)
- Frontend (FR): [docs/FRONTEND.fr.md](docs/FRONTEND.fr.md)

### Endpoints locaux (dev)

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/health`

---

## ⚡ Démarrage express

### Option 1 — Script projet

```bash
./restart.sh both
```

### Option 2 — Docker Compose

```bash
docker compose up -d --build
```

### Option 3 — Installation manuelle

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Run
cd .. && ./restart.sh both
```

---

## 🐳 Déploiement Docker (prod)

Exemple d’approche:

1. Construire les images
2. Lancer les services
3. Exécuter les migrations Prisma
4. Importer les presets si nécessaire

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate
docker compose -f docker-compose.prod.yml exec backend npm run db:import-presets
```

Pour une réimportation complète des presets:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:import-presets -- --replace
```

### 🌐 Hébergement VPS + Nginx reverse proxy

Le projet peut être hébergé sans problème sur un VPS classique, avec:

- un Nginx système en frontal (reverse proxy TLS)
- les conteneurs Docker backend/frontend en réseau privé
- exposition publique uniquement via Nginx (ports 80/443)

Schéma recommandé:

1. `Nginx (host)` termine TLS (`https://`)
2. reverse proxy vers le service frontend Docker (et `/api` vers backend si besoin)
3. backend et base non exposés publiquement

Référence de config frontend container: [frontend/nginx.conf](frontend/nginx.conf)

Pour un guide détaillé de prod: [docs/DEPLOYMENT.fr.md](docs/DEPLOYMENT.fr.md)

---

## ✨ Fonctionnalités clés

### 🏆 Gestion tournoi

- Formats: simple, double, équipe 4 joueurs
- Durées: demi-journée, journée, deux jours
- Branding tournoi: logo + métadonnées (dont lieu)
- Historisation et suivi des états

### 🎯 Poules & progression

- Plusieurs phases de poules
- Routage de classement vers autre phase, bracket ou élimination
- Phases parallèles (`inParallelWith`) et estimation horaire optimiste
- Respect des contraintes joueurs/cibles/concurrence

### 🧩 Brackets

- Brackets winners/losers
- Formats de match par round (`roundMatchFormats`)
- Dépendances avec phases de poules pour l’horaire de départ
- Outils admin pour compléter/réinitialiser des rounds

### 🎮 Matchs & arbitrage

- Statuts match: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Affectation manuelle de cibles + suggestions via file
- Saisie de score live et propagation immédiate
- Prévention des conflits de joueurs en simultané
- Notification du lancement des matchs pour les joueurs concernés
- Indication claire de la cible/board assignée au match

#### Les 2 types de presets

**1) Presets de tournoi (`tournamentPresets`)**

Ces presets décrivent la **structure complète** d’un tournoi réutilisable:

- type de preset (ex: single-pool-stage, three-pool-stages)
- nombre de participants et de cibles
- template de phases de poules (stages, poolCount, playersPerPool, advanceCount)
- routing de classement (vers phase suivante, bracket, élimination)
- templates de brackets associés

En pratique: tu choisis un preset tournoi à la création, et l’app préremplit automatiquement l’architecture du tournoi.

**2) Presets de format de match (`matchFormatPresets`)**

Ces presets décrivent le **format d’un match individuel**:

- clé de format (ex: `BO3`, `BO5_501_701`)
- durée estimée en minutes
- segments de jeu (ex: `501_DO`, `CRICKET`, `701_DO`) et leurs paramètres

La **durée** portée par ces presets est un élément critique: c’est elle qui alimente les calculs d’ETA de match, d’ETA de phase (poules/brackets) et l’estimation de fin globale du tournoi.

Ils sont ensuite référencés:

- au niveau phase de poules (`matchFormatKey`)
- au niveau tours de bracket (`roundMatchFormats`)

En pratique: ils servent à standardiser le scoring **et** à améliorer les horaires prévisionnels (durée/ETA) affichés dans les vues live.

Sans durées de format cohérentes, les projections horaires des différentes phases perdent en fiabilité.

**Relation entre les deux**

- Le preset tournoi définit **où** les matchs se jouent dans la structure.
- Le preset format de match définit **comment** chaque match se joue.
- Les deux sont complémentaires: structure + format = planning cohérent et réutilisable.

### 🔔 Temps réel

- WebSocket pour statut match/cibles
- Vues live orientées exploitation
- Notifications de démarrage de matchs

### ⏱️ Horaires prévisionnels

- Affichage d’une **heure prévisionnelle de début** pour les matchs à venir
- Estimations visibles à chaque étape: phases de poules, transitions de phases, tableaux
- Calculs alignés avec les contraintes réelles (cibles disponibles, conflits joueurs, parallélisme)
- Mise à jour dynamique en fonction de l’avancement réel des matchs

---

## 🔐 Authentification & rôles

### Modèle d’accès

- Auth basée sur Auth0 (OAuth/OIDC)
- Deux profils principaux:
	- **Administrateur**: configuration tournoi, structures, presets, actions sensibles
	- **Utilisateur / joueur**: consultation live, inscription, interactions autorisées selon les écrans
- Une partie de l’application peut rester accessible en lecture selon la configuration

### Vue visiteur (non authentifié)

La vue visiteur permet un accès **sans connexion** pour suivre le tournoi en lecture seule.

Typiquement accessible:

- vues live (états de matchs, progression des phases, brackets, cibles)
- informations publiques utiles au suivi en salle
- horaires prévisionnels et avancement global

Typiquement restreint (authentification requise):

- actions d’administration (édition tournoi, structure, presets, reset, actions sensibles)
- opérations modifiant les données métier

Cette séparation permet de diffuser l’information tournoi au public tout en protégeant les opérations de pilotage.

### Flux de connexion

- Frontend: login via providers configurés:

	![Google](https://img.shields.io/badge/Google-4285F4?logo=google&logoColor=white)
	![Facebook](https://img.shields.io/badge/Facebook-1877F2?logo=facebook&logoColor=white)
	![Discord](https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white)

- Backend: validation JWT Bearer sur les routes protégées
- Contrôle admin appliqué côté API sur les endpoints d’administration

### Variables d’environnement (exemple)

Frontend (`frontend/.env`):

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_DISCORD=discord
VITE_AUTH0_CACHE_LOCATION=memory
```

Backend (`backend/.env`):

```env
AUTH_ENABLED=true
AUTH_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
AUTH_AUDIENCE=https://api.yourdomain.com
```

Mode dev local (optionnel):

```env
AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL=your-email@example.com
```

Utiliser ce mode uniquement en local, jamais en production.

---

## 🏗️ Stack technique

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Node.js, Express, TypeScript, Prisma
- Data: PostgreSQL, Redis
- QA: ESLint, Jest/Vitest, Playwright, SonarQube
- Infra: Docker, Docker Compose

Détails complets: [README.md](README.md) et [README.fr.md](README.fr.md)

---

## 🧪 Couche dev & qualité

### Lancement en mode dev

```bash
./restart.sh -dev both
```

Mode `-dev` recommandé pour le workflow local (hot-reload et outillage dev).

### Linters & checks

- Lint global: `./scripts/lint_all.sh`
- Lint backend: `./scripts/lint_backend.sh`
- Lint frontend: `./scripts/lint_frontend.sh`
- Vérification des artefacts shared: `./scripts/check_shared_source_artifacts.sh`

### Validation backend

```bash
npm --prefix backend run typecheck
npm --prefix backend run lint
```

### Non-régression / CI locale

- Pipeline local: `./scripts/ci_full.sh`
- Non-régression: `./scripts/non_regression.sh`
- Vérification des liens: `./scripts/verify_nav_links.sh`

### Analyse SonarQube

- Initialisation (dev): `./scripts/sonar_init.sh`
- Scan: `./scripts/sonar_scan.sh`
- Configuration projet: [sonar-project.properties](sonar-project.properties)

En CI, le scan peut être déclenché automatiquement si `SONAR_TOKEN` est défini.

---

## 💾 Données, migrations & presets

- Migrations Prisma: `backend/prisma/migrations`
- Seed global (inclut aussi données de démo): `npm --prefix backend run db:seed`
- Import presets uniquement (recommandé en prod):

```bash
npm --prefix backend run db:import-presets
```

Source d’import par défaut: [backend/prisma/current-presets-export.json](backend/prisma/current-presets-export.json)

---

## 🛠️ Dépannage rapide

- Vérifier l’état API: `curl -i http://localhost:3000/health`
- Vérifier Prisma/migrations:

```bash
cd backend
npm run db:migrate
```

- Si problème de CLI Prisma en conteneur, reconstruire l’image backend sans cache.

---

## 📚 Liens utiles

- README principal: [README.md](README.md)
- README français: [README.fr.md](README.fr.md)
- Commandes: [docs/COMMANDS.fr.md](docs/COMMANDS.fr.md)
- Déploiement: [docs/DEPLOYMENT.fr.md](docs/DEPLOYMENT.fr.md)
- Tests: [docs/TESTING.fr.md](docs/TESTING.fr.md)
