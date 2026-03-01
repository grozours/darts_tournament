# \ud83c\udfdb\ufe0f Architecture Documentation

## System Overview

The Darts Tournament Manager is a full-stack web application built with a modern TypeScript-based architecture, featuring real-time updates and comprehensive tournament management capabilities.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   React     │  │  WebSocket  │  │   Auth0     │          │
│  │  Frontend   │◄─┤   Client    ├──┤   SDK       │          │
│  └──────┬──────┘  └─────────────┘  └─────────────┘          │
└─────────┼────────────────────────────────────────────────────┘
          │ HTTP/REST
          │
┌─────────▼────────────────────────────────────────────────────┐
│                      Application Layer                        │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Express.js Backend                     │     │
│  │  ┌──────────┐  ┌───────────┐  ┌─────────────┐     │     │
│  │  │  Routes  │──│Controllers│──│  Services   │     │     │
│  │  └──────────┘  └───────────┘  └──────┬──────┘     │     │
│  └──────────────────────────────────────┼────────────┘     │
│                                          │                    │
│  ┌──────────────────┐      ┌────────────▼──────────┐        │
│  │  WebSocket       │      │     Middleware         │        │
│  │  Server          │      │  - Auth                │        │
│  │  (Socket.io)     │      │  - Validation          │        │
│  └──────────────────┘      │  - Error Handling      │        │
│                             │  - Security            │        │
│                             └────────────────────────┘        │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                       Persistence Layer                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  PostgreSQL  │◄───┤    Prisma    │    │    Redis     │   │
│  │   Database   │    │     ORM      │    │    Cache     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Layered Architecture Pattern

The backend follows a clean, layered architecture:

```
┌─────────────────────────────────────────────┐
│              Routes Layer                   │  HTTP route definitions
│  Define endpoints & attach middleware       │  and middleware attachment
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           Controllers Layer                 │  Request/response handling
│  Parse requests, call services,             │  and HTTP concerns
│  format responses                           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│            Services Layer                   │  Business logic and
│  Business rules, orchestration,             │  orchestration
│  complex operations                         │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│             Models Layer                    │  Data access and
│  Database queries, data transformations,    │  persistence logic
│  Prisma interactions                        │
└─────────────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # Server entry point
│   │
│   ├── routes/                   # Route definitions
│   │   ├── auth.ts              # Authentication routes
│   │   └── tournaments.ts        # Tournament routes
│   │
│   ├── controllers/              # Request handlers
│   │   └── TournamentController.ts
│   │
│   ├── services/                 # Business logic
│   │   └── TournamentService.ts
│   │
│   ├── models/                   # Data access layer
│   │   └── TournamentModel.ts
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts              # Authentication & authorization
│   │   ├── validation.ts         # Request validation
│   │   ├── errorHandler.ts      # Error handling
│   │   ├── security.ts          # Security headers
│   │   ├── upload.ts            # File upload handling
│   │   └── correlationId.ts     # Request tracking
│   │
│   ├── config/                   # Configuration
│   │   ├── database.ts          # Database connection
│   │   ├── environment.ts       # Environment variables
│   │   └── redis.ts             # Redis connection
│   │
│   ├── utils/                    # Utilities
│   │   ├── logger.ts            # Winston logger
│   │   └── tournamentLogger.ts   # Tournament-specific logging
│   │
│   ├── websocket/                # WebSocket server
│   │   └── server.ts
│   │
│   └── types/                    # TypeScript type definitions
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── seed.ts                  # Seed data script
│   └── migrations/              # Database migrations
│
└── tests/                        # Test suites
    ├── unit/
    ├── integration/
    └── contract/
```

### Key Components

#### 1. **TournamentController**
- Handles HTTP requests/responses
- Validates input parameters
- Delegates to service layer
- Formats JSON responses

#### 2. **TournamentService**
- Implements business logic
- Orchestrates complex operations
- Manages transactions
- Enforces business rules

#### 3. **TournamentModel**
- Encapsulates data access
- Performs Prisma queries
- Handles data transformations
- Manages database operations

#### 4. **Middleware Pipeline**

```
Request
  │
  ├──► correlationId    (assigns unique request ID)
  │
  ├──► security         (helmet, CORS)
  │
  ├──► auth            (optional/required authentication)
  │
  ├──► validation      (Zod schema validation)
  │
  ├──► route handler   (controller method)
  │
  └──► errorHandler    (catches and formats errors)
  │
Response
```

---

## Frontend Architecture

### Component-Based Architecture

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

### State Management

The application uses multiple state management strategies:

#### 1. **React State (useState)**
- Component-local UI state
- Form inputs
- Modal visibility
- Temporary selections

#### 2. **TanStack Query (React Query)**
- Server state caching
- Automatic refetching
- Optimistic updates
- Background synchronization

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['tournaments', tournamentId],
  queryFn: () => fetchTournament(tournamentId),
  refetchInterval: 30000, // Refetch every 30s
});
```

#### 3. **WebSocket State**
- Real-time updates
- Event-driven state changes
- Live notifications

```typescript
useEffect(() => {
  socket.on('match:started', (data) => {
    // Update local state
    setMatches(prev => updateMatchStatus(prev, data));
  });
}, []);
```

### Directory Structure

```
frontend/
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component & routing
│   ├── index.css               # Global styles
│   │
│   ├── components/              # React components
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
│   ├── auth/                    # Authentication
│   │   ├── optionalAuth.tsx    # Optional auth hook
│   │   ├── useAdminStatus.tsx  # Admin status hook
│   │   └── SignInPanel.tsx     # Login UI
│   │
│   ├── services/                # API client services
│   │   └── tournamentService.ts
│   │
│   ├── utils/                   # Utility functions
│   │   └── liveViewHelpers.ts
│   │
│   ├── types/                   # TypeScript types
│   │
│   └── i18n.ts                 # Internationalization
│
└── tests/
    ├── unit/
    └── e2e/
```

---

## Database Schema

### Entity Relationship Diagram

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
│   ├──> Person (optional link)
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

### Key Relationships

1. **Tournament ↔ PoolStage**: One-to-many
   - A tournament has multiple pool stages
   - Pool stages cascade delete with tournament

2. **PoolStage ↔ Pool**: One-to-many
   - Each stage contains multiple pools
   - Pools cascade delete with stage

3. **Pool ↔ PoolAssignment ↔ Player**: Many-to-many
   - Players assigned to pools with metadata
   - Assignment type (seeded, random, bye)

4. **Tournament ↔ Bracket**: One-to-many
   - Winner and loser brackets
   - Brackets cascade delete with tournament

5. **Match ↔ Player**: Many-to-many (via PlayerMatch)
   - Two players per match
   - Scores, wins, position tracked

6. **Match ↔ Target**: Many-to-one (optional)
   - Matches assigned to physical targets
   - Target tracks current match

---

<a id="authentication--authorization"></a>
## Authentication & Authorization

### Auth0 Integration

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. Redirect to Auth0
       ▼
┌──────────────┐
│    Auth0     │
│   Universal  │
│   Login      │
└──────┬───────┘
       │
       │ 2. Google/Facebook/Instagram OAuth
       ▼
┌──────────────┐
│   Identity   │
│   Provider   │
└──────┬───────┘
       │
       │ 3. Return with code
       ▼
┌──────────────┐
│    Auth0     │  4. Exchange code for tokens
└──────┬───────┘
       │
       │ 5. Return access token + ID token
       ▼
┌──────────────┐
│   Browser    │  6. Store tokens in memory (default)
└──────┬───────┘
       │
       │ 7. API requests with Bearer token
       ▼
┌──────────────┐
│   Backend    │  8. Validate JWT & check admin status
└──────────────┘
```

### Admin Role Implementation

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

### Security Features

1. **JWT Validation**: All protected endpoints validate JWT tokens
2. **Admin-only Operations**: Tournament creation, deletion, status changes
3. **Rate Limiting**: Prevent API abuse
4. **CORS**: Configured for frontend origin
5. **Helmet**: Security headers (CSP, XSS protection, etc.)
6. **Input Validation**: Zod schemas for all requests

---

## Real-Time Communication

### WebSocket Architecture

```
Backend WebSocket Server (Socket.io)
│
├── Event: 'match:started'
│   └── Broadcast to all connected clients
│
├── Event: 'match:completed'
│   └── Broadcast winner and scores
│
├── Event: 'target:status'
│   └── Notify target availability changes
│
└── Event: 'tournament:status'
    └── Notify tournament status transitions
```

### Event Flow Example

```
Admin starts match
       │
       ▼
Backend: updateMatchStatus()
       │
       ├──► Update database
       ├──► Emit 'match:started' event
       │
       ▼
WebSocket broadcasts to clients
       │
       ▼
Frontend receives event
       │
       ├──► Update local state
       └──► Show notification
```

---

## Logging & Monitoring

### Structured Logging

```typescript
logger.info('Tournament created', {
  tournamentId: 'uuid',
  name: 'Spring Championship',
  format: 'SINGLE',
  correlationId: 'req-123'
});
```

**Log Levels:**
- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug-level messages (development only)

**Log Rotation:**
- Daily rotation
- Max file size: 20MB
- Keep last 14 days
- Location: `backend/logs/`

### Correlation IDs

Every request gets a unique correlation ID for tracing:

```
Request → correlationId middleware → req.correlationId = uuid
└──► All logs include correlationId
└──► Appears in response headers: X-Correlation-ID
```

---

## Data Flow Examples

### Creating a Tournament

```
1. User fills form
         │
2. POST /api/tournaments (with Bearer token)
         │
3. Middleware: auth → requireAdmin
         │
4. Middleware: validate createTournamentSchema
         │
5. Controller: tournamentController.createTournament()
         │
6. Service: tournamentService.createTournament()
         │   ├─ Validate business rules
         │   ├─ Create tournament in database
         │   └─ Create default targets
         │
7. Model: prisma.tournament.create()
         │
8. Response: 201 Created with tournament data
```

### Starting a Match

```
1. Admin clicks "Start Match"
         │
2. PATCH /api/tournaments/:id/matches/:matchId/status
         │   body: { status: "IN_PROGRESS", targetId: "uuid" }
         │
3. Service: updateMatchStatus()
         │   ├─ Validate target is available
         │   ├─ Update match status
         │   ├─ Assign match to target
         │   └─ Emit WebSocket event
         │
4. WebSocket: socket.emit('match:started', data)
         │
5. Frontend: Receives event
         │   ├─ Updates match list
         │   ├─ Updates target status
         │   └─ Shows notification
```

---

## Performance Optimizations

### Backend

1. **Database Indexing**
   - UUID primary keys indexed
   - Foreign keys indexed
   - Composite unique constraints

2. **Query Optimization**
   - Prisma select (fetch only needed fields)
   - Include relations efficiently
   - Pagination for large datasets

3. **Caching (Redis)**
   - Session storage
   - Frequently accessed data
   - Rate limit counters

### Frontend

1. **Code Splitting**
   - Route-based code splitting (Vite)
   - Lazy loading components

2. **Memoization**
   - useMemo for expensive computations
   - useCallback for event handlers

3. **Optimistic Updates**
   - Immediate UI feedback
   - Rollback on error

4. **Debouncing**
   - Search inputs
   - Auto-save operations

---

## Testing Strategy

### Backend Testing

```
Unit Tests (Jest)
  └─ Services, utilities, helpers

Integration Tests
  └─ API endpoints with database

Contract Tests
  └─ API contract validation
```

### Frontend Testing

```
Unit Tests (Vitest)
  └─ Components, hooks, utilities

E2E Tests (Playwright)
  └─ User workflows, critical paths
```

---

## Deployment Architecture

### Development

```
Docker Compose
  ├─ PostgreSQL (port 5432)
  ├─ Redis (port 6379)
  ├─ Backend (port 3000)
  └─ Frontend (port 5173)
```

### Production (Recommended)

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

## Technology Decisions

### Why TypeScript?
- Type safety reduces runtime errors
- Better IDE support & intellisense
- Self-documenting code
- Easier refactoring

### Why Prisma?
- Type-safe database queries
- Automatic migrations
- Great developer experience
- Schema as source of truth

### Why React + Vite?
- Fast development server
- Hot module replacement
- Optimized production builds
- Modern React features (hooks, suspense)

### Why PostgreSQL?
- ACID compliance
- Complex queries & joins
- JSON support for flexible data
- Mature ecosystem

### Why Redis?
- High-performance caching
- Session storage
- Rate limiting
- Pub/sub for real-time features

### Why Socket.io?
- Cross-browser WebSocket support
- Automatic reconnection
- Room-based broadcasting
- Fallback to long-polling

---

## Security Considerations

1. **Authentication**: OAuth 2.0 via Auth0
2. **Authorization**: Role-based (admin vs. user)
3. **Input Validation**: Zod schemas on all inputs
4. **SQL Injection**: Prevented by Prisma parameterized queries
5. **XSS**: React auto-escaping + CSP headers
6. **CSRF**: SameSite cookies + CORS configuration
7. **Rate Limiting**: Prevent brute force & DoS
8. **Secrets Management**: Environment variables, never committed
9. **HTTPS**: Required in production
10. **Logging**: No sensitive data in logs

---

## Scalability Considerations

### Horizontal Scaling

- Backend: Stateless architecture enables multiple instances
- Load balancer distributes requests
- WebSocket: Sticky sessions or Redis adapter for multi-instance

### Database Scaling

- Read replicas for query performance
- Connection pooling (Prisma)
- Indexes on frequently queried fields

### Caching Strategy

- Redis for frequently accessed data
- CDN for static assets
- Browser caching headers

### File Storage

- Tournament logos stored in `/uploads` (development)
- Production: Move to S3/CloudStorage for scalability

---

## Future Enhancements

1. **GraphQL API**: Alternative to REST for flexible queries
2. **Mobile App**: React Native app for mobile devices
3. **AI Seeding**: Machine learning for optimal tournament seeding
4. **Video Streaming**: Live stream integration for matches
5. **Analytics Dashboard**: Advanced statistics and insights
6. **Multi-language**: Full i18n support beyond FR/EN
7. **Offline Mode**: Progressive Web App with offline capability
8. **Tournament Templates**: Pre-configured tournament formats
