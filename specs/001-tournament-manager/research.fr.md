# Recherche : Gestionnaire de Tournois de Fléchettes

**Généré** : 2026-02-03  
**But** : Clarifications techniques et choix de technologie

## Décisions de stack

### Backend

**Décision** : Node.js 20 LTS avec TypeScript 5.3+ et Express.js 4.18+  
**Rationale** : capacités temps réel, écosystème mature, langage partagé  
**Alternatives** : Python FastAPI (complexité temps réel), Java Spring (sur-dimensionné)

### Frontend

**Décision** : React 18+ avec TypeScript  
**Rationale** : architecture composants idéale pour formulaires, écosystème accessibilité, patterns temps réel  
**Alternatives** : Vue.js (écosystème plus petit), Vanilla JS (maintenance élevée)

### Base de données & stockage

**Décision** : PostgreSQL 15+ + Redis  
**Rationale** : ACID, support JSON, Redis pour temps réel/sessions  
**Alternatives** : MongoDB (transactions limitées), SQLite (scalabilité)

### Framework de tests

**Décision** : Jest 29+ + React Testing Library + Playwright  
**Rationale** : écosystème complet TDD, accessibilité, tests web robustes  
**Alternatives** : Vitest (moins mature), Cypress (plus lourd)

## Architecture de performance

### Mises à jour temps réel

- **WebSockets** : Socket.io 4.7+ pour communication bidirectionnelle
- **Traitement en arrière-plan** : Bull Queue pour scheduling complexe (< 30s)
- **Mises à jour optimistes** : React Query pour < 2s perçues
- **Optimisation DB** : pooling + index pour < 1s dispo cibles

### Upload de fichiers

- **Multer 1.4+** : upload robuste, limite 5 Mo JPG/PNG
- **Image processing** : Sharp pour validation/optimisation
- **Stockage** : filesystem local avec option cloud

## Workflow de développement

### Qualité de code

- **ESLint + Prettier** : formatage et style
- **Husky + lint-staged** : hooks pre-commit
- **TypeScript strict** : sécurité de type accrue

### Stratégie de tests

- **Unitaires** : Jest pour logique métier
- **Intégration** : Supertest pour API
- **Contrats** : MSW pour contrats front/back
- **E2E** : Playwright pour parcours critiques
- **Accessibilité** : @axe-core/playwright pour WCAG

## Sécurité & conformité

### Protection des données (modèle sans auth)

- **Rate limiting** : express-rate-limit
- **Validation** : Joi pour configurations
- **Sécurité upload** : validation MIME + antivirus envisagé
- **Audit logging** : Winston pour actions

### RGPD (stockage permanent)

- **Minimisation** : stocker uniquement le nécessaire
- **Transparence** : documentation claire
- **Export** : export des données tournois

## Architecture de déploiement

### Développement

- **Docker Compose** : environnement local cohérent
- **Hot reloading** : Vite (frontend), nodemon (backend)
- **Migrations** : Prisma

### Production

- **Conteneurs** : Docker + Postgres + Redis
- **Reverse proxy** : Nginx
- **Monitoring** : health checks + logs
- **Backups** : PostgreSQL automatisé

## Résumé des dépendances

### Backend core

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "prisma": "^5.6.0",
  "multer": "^1.4.5",
  "bull": "^4.11.3",
  "joi": "^17.10.2",
  "winston": "^3.10.0"
}
```

### Frontend core

```json
{
  "react": "^18.2.0",
  "@tanstack/react-query": "^4.29.0",
  "react-hook-form": "^7.45.0",
  "socket.io-client": "^4.7.2",
  "@chakra-ui/react": "^2.8.0",
  "react-router-dom": "^6.15.0"
}
```

### Tests & dev

```json
{
  "jest": "^29.6.0",
  "@testing-library/react": "^13.4.0",
  "playwright": "^1.37.0",
  "supertest": "^6.3.3",
  "msw": "^1.3.0"
}
```

## Mitigation des risques

- **Scheduling complexe** : Bull Queue pour traitement asynchrone
- **Échelle temps réel** : Redis pub/sub pour multi-tournois
- **Intégrité des données** : transactions PostgreSQL
- **Compatibilité navigateur** : React + TypeScript
- **Maintenance** : outils LTS
