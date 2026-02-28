# 🏛️ Documentation d’architecture

## Vue d’ensemble

Le Gestionnaire de Tournois de Fléchettes est une application web full-stack construite sur une architecture moderne TypeScript, avec mises à jour temps réel et gestion complète des tournois.

### Architecture haut niveau

```
┌──────────────────────────────────────────────────────────────┐
│                         Couche Client                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   React     │  │  WebSocket  │  │   Auth0     │          │
│  │  Frontend   │◄─┤   Client    ├──┤   SDK       │          │
│  └──────┬──────┘  └─────────────┘  └─────────────┘          │
└─────────┼────────────────────────────────────────────────────┘
          │ HTTP/REST
          │
┌─────────▼────────────────────────────────────────────────────┐
│                    Couche Application                         │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                Backend Express.js                   │     │
│  │  ┌──────────┐  ┌───────────┐  ┌─────────────┐     │     │
│  │  │  Routes  │──│Controllers│──│  Services   │     │     │
│  │  └──────────┘  └───────────┘  └──────┬──────┘     │     │
│  └──────────────────────────────────────┼────────────┘     │
│                                          │                    │
│  ┌──────────────────┐      ┌────────────▼──────────┐        │
│  │  WebSocket       │      │     Middleware         │        │
│  │  Server          │      │  - Auth                │        │
│  │  (Socket.io)     │      │  - Validation          │        │
│  └──────────────────┘      │  - Gestion d’erreurs   │        │
│                             │  - Sécurité            │        │
│                             └────────────────────────┘        │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                     Couche Persistance                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  PostgreSQL  │◄───┤    Prisma    │    │    Redis     │   │
│  │   Database   │    │     ORM      │    │    Cache     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## Architecture backend

### Pattern d’architecture en couches

Le backend suit une architecture claire en couches :

```
┌─────────────────────────────────────────────┐
│              Couche Routes                  │  Définitions des routes HTTP
│  Déclare les endpoints & middleware         │  et branchements middleware
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           Couche Controllers                │  Gestion des requêtes/réponses
│  Parse les requêtes, appelle les services,  │  et préoccupations HTTP
│  formate les réponses                       │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│            Couche Services                  │  Logique métier et orchestration
│  Règles métier, orchestration,              │
│  opérations complexes                       │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│             Couche Models                   │  Accès aux données et persistance
│  Requêtes BD, transformations,              │
│  interactions Prisma                        │
└─────────────────────────────────────────────┘
```

### Structure des dossiers

```
backend/
├── src/
│   ├── app.ts                    # Configuration Express
│   ├── server.ts                 # Point d’entrée serveur
│   │
│   ├── routes/                   # Définition des routes
│   │   ├── auth.ts              # Routes d’authentification
│   │   └── tournaments.ts        # Routes tournois
│   │
│   ├── controllers/              # Handlers de requêtes
│   │   └── TournamentController.ts
│   │
│   ├── services/                 # Logique métier
│   │   └── TournamentService.ts
│   │
│   ├── models/                   # Couche accès données
│   │   └── TournamentModel.ts
│   │
│   ├── middleware/               # Middleware Express
│   │   ├── auth.ts              # Authentification & autorisation
│   │   ├── validation.ts         # Validation des requêtes
│   │   ├── errorHandler.ts      # Gestion d’erreurs
│   │   ├── security.ts          # En-têtes de sécurité
│   │   ├── upload.ts            # Upload de fichiers
│   │   └── correlationId.ts     # Traçage des requêtes
│   │
│   ├── config/                   # Configuration
│   │   ├── database.ts          # Connexion DB
│   │   ├── environment.ts       # Variables d’environnement
│   │   └── redis.ts             # Connexion Redis
│   │
│   ├── utils/                    # Utilitaires
│   │   ├── logger.ts            # Logger Winston
│   │   └── tournamentLogger.ts   # Logger spécifique tournois
│   │
│   ├── websocket/                # Serveur WebSocket
│   │   └── server.ts
│   │
│   └── types/                    # Types TypeScript
│
├── prisma/
│   ├── schema.prisma            # Schéma DB
│   ├── seed.ts                  # Script de seed
│   └── migrations/              # Migrations
│
└── tests/                        # Suites de tests
    ├── unit/
    ├── integration/
    └── contract/
```

### Composants clés

#### 1. **TournamentController**
- Gère requêtes/réponses HTTP
- Valide les paramètres d’entrée
- Délègue à la couche service
- Formate les réponses JSON

#### 2. **TournamentService**
- Implémente la logique métier
- Orchestration d’opérations complexes
- Gère les transactions
- Applique les règles métier

#### 3. **TournamentModel**
- Encapsule l’accès aux données
- Exécute des requêtes Prisma
- Transforme les données
- Gère les opérations DB

#### 4. **Pipeline middleware**

```
Request
  │
  ├──► correlationId    (assigne un ID de requête)
  │
  ├──► security         (helmet, CORS)
  │
  ├──► auth             (auth optionnelle/obligatoire)
  │
  ├──► validation       (validation Zod)
  │
  ├──► route handler    (méthode controller)
  │
  └──► errorHandler     (capture et formate les erreurs)
  │
Response
```

---

## Architecture frontend

### Architecture basée composants

```
App (Root Component)
│
├── Navigation
│
├── Route: / (TournamentList)
│   ├── TournamentCard
│   ├── CreateTournamentForm
│   ├── EditTournamentForm
│   ├── PlayerList
│   └── PoolStageEditor
│
├── Route: ?view=live (LiveTournament)
│   ├── PoolStagesSection
│   ├── BracketsSection
│   ├── MatchQueue
│   └── TournamentSelector
│
├── Route: ?view=targets (TargetsView)
│   ├── TargetCard
│   ├── MatchQueueGlobal
│   └── TargetAssignment
│
├── Route: ?view=players (PlayersView)
│   └── PlayerCard
│
├── Route: ?view=tournament-players (TournamentPlayersView)
│   └── PlayerList
│
└── Route: ?view=account (AccountView)
    └── UserProfile
```

### Gestion de l’état

L’application utilise plusieurs stratégies :

#### 1. **React State (useState)**
- État local UI
- Inputs de formulaire
- Visibilité des modales
- Sélections temporaires

#### 2. **TanStack Query (React Query)**
- Cache de l’état serveur
- Refetch automatique
- Mises à jour optimistes
- Synchronisation en arrière-plan

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['tournaments', tournamentId],
  queryFn: () => fetchTournament(tournamentId),
  refetchInterval: 30000, // Refetch toutes les 30s
});
```

#### 3. **État WebSocket**
- Mises à jour temps réel
- Modèle événementiel
- Notifications live

```typescript
useEffect(() => {
  socket.on('match:started', (data) => {
    // Mise à jour de l’état local
    setMatches(prev => updateMatchStatus(prev, data));
  });
}, []);
```

### Structure des dossiers

```
frontend/
├── src/
│   ├── main.tsx                 # Point d’entrée app
│   ├── App.tsx                  # Composant racine & routing
│   ├── index.css               # Styles globaux
│   │
│   ├── components/              # Composants React
│   │   ├── TournamentList.tsx
│   │   ├── LiveTournament.tsx
│   │   ├── TargetsView.tsx
│   │   ├── PlayersView.tsx
│   │   ├── TournamentPlayersView.tsx
│   │   ├── RegistrationPlayers.tsx
│   │   ├── NotificationsView.tsx
│   │   ├── AccountView.tsx
│   │   └── tournaments/
│   │       └── CreateTournamentPage.tsx
│   │
│   ├── auth/                    # Authentification
│   │   ├── optionalAuth.tsx    # Hook auth optionnelle
│   │   ├── useAdminStatus.tsx  # Hook statut admin
│   │   └── SignInPanel.tsx     # UI connexion
│   │
│   ├── services/                # Services API
│   │   └── tournamentService.ts
│   │
│   ├── utils/                   # Utilitaires
│   │   └── liveViewHelpers.ts
│   │
│   ├── types/                   # Types TypeScript
│   │
│   └── i18n.ts                 # Internationalisation
│
└── tests/
    ├── unit/
    └── e2e/
```

---

## Schéma de base de données

### Diagramme entité-relation

```
Tournament
│
├──< PoolStage
│   └──< Pool
│       └──< PoolAssignment >── Player
│           └──< Match
│
├──< Bracket
│   ├──< BracketEntry >── Player
│   └──< Match
│
├──< Target
│   └──< Match
│
├──< Player
│   ├──> Person (lien optionnel)
│   └──< PlayerMatch >── Match
│
├──< Match
│   ├──< PlayerMatch >── Player
│   └──< Score >── Player
│
└──< Schedule
    └──< ScheduledMatch >─┬─> Match
                          └─> Target
```

### Relations clés

1. **Tournament ↔ PoolStage** : un-à-plusieurs
   - Un tournoi a plusieurs phases de poules
   - Suppression en cascade

2. **PoolStage ↔ Pool** : un-à-plusieurs
   - Chaque phase contient plusieurs poules
   - Suppression en cascade

3. **Pool ↔ PoolAssignment ↔ Player** : plusieurs-à-plusieurs
   - Joueurs assignés avec métadonnées
   - Type d’assignation (seeded, random, bye)

4. **Tournament ↔ Bracket** : un-à-plusieurs
   - Winner/loser brackets
   - Suppression en cascade

5. **Match ↔ Player** : plusieurs-à-plusieurs (via PlayerMatch)
   - Deux joueurs par match
   - Scores, victoire, position

6. **Match ↔ Target** : plusieurs-à-un (optionnel)
   - Matchs assignés aux cibles
   - Cible suit le match courant

---

## Authentification & autorisation

### Intégration Auth0

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. Redirection vers Auth0
       ▼
┌──────────────┐
│    Auth0     │
│   Universal  │
│   Login      │
└──────┬───────┘
       │
       │ 2. OAuth Google/Facebook/Instagram
       ▼
┌──────────────┐
│  Fournisseur │
│  d’identité  │
└──────┬───────┘
       │
       │ 3. Retour avec code
       ▼
┌──────────────┐
│    Auth0     │  4. Échange code → tokens
└──────┬───────┘
       │
       │ 5. Retour access token + ID token
       ▼
┌──────────────┐
│   Browser    │  6. Stockage tokens en mémoire (par défaut)
└──────┬───────┘
       │
       │ 7. Requêtes API avec Bearer token
       ▼
┌──────────────┐
│   Backend    │  8. Validation JWT & check admin
└──────────────┘
```

### Rôle admin

```typescript
// Backend middleware
export const isAdmin = (req: Request): boolean => {
  const userEmail = req.auth?.payload?.email;
  const adminEmails = process.env.AUTH_ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(userEmail);
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

### Fonctionnalités de sécurité

1. **Validation JWT** : tous les endpoints protégés
2. **Opérations admin** : création/suppression de tournoi, changements de statut
3. **Rate limiting** : protection contre l’abus
4. **CORS** : configuré pour l’origine frontend
5. **Helmet** : en-têtes de sécurité
6. **Validation d’entrée** : schémas Zod

---

## Communication temps réel

### Architecture WebSocket

```
Backend WebSocket Server (Socket.io)
│
├── Event: 'match:started'
│   └── Broadcast à tous les clients connectés
│
├── Event: 'match:completed'
│   └── Broadcast gagnant et scores
│
├── Event: 'target:status'
│   └── Notifie les changements de disponibilité
│
└── Event: 'tournament:status'
    └── Notifie les transitions de statut
```

### Exemple de flux d’événements

```
Admin démarre un match
       │
       ▼
Backend: updateMatchStatus()
       │
       ├──► Mise à jour DB
       ├──► Émet 'match:started'
       │
       ▼
WebSocket broadcast aux clients
       │
       ▼
Frontend reçoit l’événement
       │
       ├──► Met à jour l’état local
       └──► Affiche une notification
```

---

## Logging & monitoring

### Logs structurés

```typescript
logger.info('Tournament created', {
  tournamentId: 'uuid',
  name: 'Spring Championship',
  format: 'SINGLE',
  correlationId: 'req-123'
});
```

**Niveaux de logs :**
- `error` : erreurs critiques
- `warn` : avertissements
- `info` : informations
- `debug` : debug (dev uniquement)

**Rotation des logs :**
- Quotidienne
- Taille max : 20 Mo
- Conserver 14 jours
- Emplacement : `backend/logs/`

### Correlation IDs

Chaque requête reçoit un ID unique :

```
Request → middleware correlationId → req.correlationId = uuid
└──► Tous les logs incluent correlationId
└──► Apparaît dans l’en-tête de réponse : X-Correlation-ID
```

---

## Exemples de flux de données

### Créer un tournoi

```
1. L’utilisateur remplit le formulaire
         │
2. POST /api/tournaments (avec Bearer token)
         │
3. Middleware: auth → requireAdmin
         │
4. Middleware: validate createTournamentSchema
         │
5. Controller: tournamentController.createTournament()
         │
6. Service: tournamentService.createTournament()
         │   ├─ Valide les règles métier
         │   ├─ Crée le tournoi en DB
         │   └─ Crée les targets par défaut
         │
7. Model: prisma.tournament.create()
         │
8. Réponse: 201 Created avec données tournoi
```

### Démarrer un match

```
1. Admin clique "Start Match"
         │
2. PATCH /api/tournaments/:id/matches/:matchId/status
         │   body: { status: "IN_PROGRESS", targetId: "uuid" }
         │
3. Service: updateMatchStatus()
         │   ├─ Vérifie que la cible est disponible
         │   ├─ Met à jour le statut du match
         │   ├─ Assigne le match à la cible
         │   └─ Émet un événement WebSocket
         │
4. WebSocket: socket.emit('match:started', data)
         │
5. Frontend: reçoit l’événement
         │   ├─ Met à jour la liste des matchs
         │   ├─ Met à jour le statut des cibles
         │   └─ Affiche une notification
```

---

## Optimisations de performance

### Backend

1. **Indexation DB**
   - Clés primaires UUID indexées
   - Clés étrangères indexées
   - Contraintes uniques composées

2. **Optimisation des requêtes**
   - Prisma select (champs nécessaires seulement)
   - Include des relations efficacement
   - Pagination pour grands volumes

3. **Cache (Redis)**
   - Stockage de sessions
   - Données fréquemment consultées
   - Compteurs de rate limiting

### Frontend

1. **Code splitting**
   - Découpage par routes (Vite)
   - Lazy loading des composants

2. **Mémoïsation**
   - useMemo pour calculs coûteux
   - useCallback pour handlers

3. **Mises à jour optimistes**
   - UI immédiate
   - Rollback en cas d’erreur

4. **Debounce**
   - Champs de recherche
   - Auto-save

---

## Stratégie de tests

### Tests backend

```
Unit Tests (Jest)
  └─ Services, utilitaires, helpers

Integration Tests
  └─ Endpoints API avec DB

Contract Tests
  └─ Validation de contrats API
```

### Tests frontend

```
Unit Tests (Vitest)
  └─ Composants, hooks, utilitaires

E2E Tests (Playwright)
  └─ Parcours utilisateurs, chemins critiques
```

---

## Architecture de déploiement

### Développement

```
Docker Compose
  ├─ PostgreSQL (port 5432)
  ├─ Redis (port 6379)
  ├─ Backend (port 3000)
  └─ Frontend (port 5173)
```

### Production (recommandée)

```
┌─────────────────────────────────────────┐
│           Load Balancer / CDN           │
└───────────┬─────────────────────────────┘
            │
    ┌───────▼────────┐
    │  Nginx/Caddy   │  (Reverse proxy)
    └───────┬────────┘
            │
    ┌───────┴────────┐
    │                │
┌───▼────┐      ┌───▼────┐
│Frontend│      │Backend │
│ (dist/)│      │ (PM2)  │
└────────┘      └───┬────┘
                    │
            ┌───────┴────────┐
            │                │
      ┌─────▼─────┐   ┌─────▼─────┐
      │PostgreSQL │   │   Redis   │
      │ (managed) │   │ (managed) │
      └───────────┘   └───────────┘
```

---

## Décisions technologiques

### Pourquoi TypeScript ?
- Typage réduit les erreurs runtime
- Meilleur support IDE
- Code auto-documenté
- Refactoring plus simple

### Pourquoi Prisma ?
- Requêtes type-safe
- Migrations automatiques
- Excellente DX
- Schéma source de vérité

### Pourquoi React + Vite ?
- Dev server rapide
- HMR
- Builds production optimisés
- Fonctionnalités React modernes

### Pourquoi PostgreSQL ?
- ACID
- Requêtes complexes & joins
- Support JSON
- Écosystème mature

### Pourquoi Redis ?
- Cache haute performance
- Stockage sessions
- Rate limiting
- Pub/sub temps réel

### Pourquoi Socket.io ?
- Support WebSocket cross-browser
- Reconnexion automatique
- Broadcast par rooms
- Fallback long-polling

---

## Considérations de sécurité

1. **Authentification** : OAuth 2.0 via Auth0
2. **Autorisation** : rôles (admin vs utilisateur)
3. **Validation d’entrée** : schémas Zod
4. **Injection SQL** : évitée par Prisma
5. **XSS** : échappement React + CSP
6. **CSRF** : cookies SameSite + CORS
7. **Rate limiting** : anti brute force & DoS
8. **Secrets** : variables d’environnement, jamais commit
9. **HTTPS** : requis en production
10. **Logs** : pas de données sensibles

---

## Considérations de scalabilité

### Scalabilité horizontale

- Backend stateless : multi-instances possibles
- Load balancer distribue les requêtes
- WebSocket : sticky sessions ou Redis adapter

### Scalabilité DB

- Réplicas de lecture
- Pooling de connexions (Prisma)
- Index sur champs fréquemment consultés

### Stratégie de cache

- Redis pour données fréquentes
- CDN pour assets statiques
- Cache navigateur

### Stockage fichiers

- Logos stockés dans `/uploads` (dev)
- Production : migrer vers S3/CloudStorage

---

## Améliorations futures

1. **API GraphQL** : alternative à REST
2. **App mobile** : React Native
3. **Seeding IA** : ML pour tirage optimal
4. **Streaming vidéo** : live des matchs
5. **Dashboard analytics** : statistiques avancées
6. **Multi-langues** : i18n complet au-delà FR/EN
7. **Mode hors-ligne** : PWA
8. **Templates de tournois** : formats préconfigurés
