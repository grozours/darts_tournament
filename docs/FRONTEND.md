# ⚔️ Frontend Documentation

## Overview

The frontend is a modern React 18 application built with TypeScript, Vite, and TailwindCSS. It provides a responsive, real-time interface for managing darts tournaments.

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2+ | UI library |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | Utility-first CSS |
| React Router DOM | 6.x | Client-side routing |
| Auth0 React SDK | 2.x | Authentication |
| TanStack Query | 5.x | Server state management |
| React Hook Form | 7.x | Form handling & validation |
| Zod | 3.x | Schema validation |
| Socket.io Client | 4.x | WebSocket client |
| Axios | 1.x | HTTP client |
| Lucide React | Latest | Icon library |
| Vitest | 1.x | Unit testing |
| Playwright | Latest | E2E testing |

---

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                  # Application entry point
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                # Global styles & Tailwind imports
│   ├── i18n.ts                  # Internationalization (FR/EN)
│   │
│   ├── components/              # React components
│   │   ├── TournamentList.tsx   # Main view: tournament management
│   │   ├── LiveTournament.tsx   # Live tournament view
│   │   ├── TargetsView.tsx      # Targets & match queue view
│   │   ├── PlayersView.tsx      # All players view
│   │   ├── TournamentPlayersView.tsx  # Tournament-specific players
│   │   ├── RegistrationPlayers.tsx    # Player registration
│   │   ├── NotificationsView.tsx      # Match notifications
│   │   ├── AccountView.tsx      # User account & profile
│   │   └── tournaments/
│   │       └── CreateTournamentPage.tsx
│   │
│   ├── auth/                    # Authentication utilities
│   │   ├── optionalAuth.tsx    # Optional Auth0 hook
│   │   ├── useAdminStatus.tsx  # Admin status hook
│   │   └── SignInPanel.tsx     # Sign-in UI component
│   │
│   ├── services/                # API client services
│   │   └── tournamentService.ts # Tournament API calls
│   │
│   ├── utils/                   # Utility functions
│   │   └── liveViewHelpers.ts  # Live view helpers
│   │
│   └── types/                   # TypeScript type definitions
│
├── tests/
│   ├── unit/                    # Vitest unit tests
│   └── e2e/                     # Playwright E2E tests
│
├── public/                      # Static assets
├── dist/                        # Production build output
│
├── index.html                   # HTML entry point
├── vite.config.ts              # Vite configuration
├── vitest.config.ts            # Vitest configuration
├── tailwind.config.js          # TailwindCSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies & scripts
```

---

## Routing Strategy

The application uses **query parameter-based routing** instead of URL paths:

### Routes

| URL | View | Description |
|-----|------|-------------|
| `/` | `TournamentList` | Main tournament management |
| `/?view=live` | `LiveTournament` | Live tournament dashboard |
| `/?view=pool-stages` | `LiveTournament` | Pool stages view |
| `/?view=brackets` | `LiveTournament` | Brackets view |
| `/?view=targets` | `TargetsView` | Target management |
| `/?view=players` | `PlayersView` | All players |
| `/?view=tournament-players` | `TournamentPlayersView` | Tournament players |
| `/?view=registration-players` | `RegistrationPlayers` | Player registration |
| `/?view=notifications` | `NotificationsView` | Match notifications |
| `/?view=tournament-presets` | `TournamentPresetsView` | Preset manager (list) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Preset editor |
| `/?view=account` | `AccountView` | User account |
| `/?view=create-tournament` | `CreateTournamentPage` | Create tournament |

### Query Parameters

| Parameter | Values | Purpose |
|-----------|--------|---------|
| `view` | (see above) | Determines which component to render |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Filter tournaments by status |
| `tournamentId` | UUID | Select specific tournament |
| `edit` | true/false | Enable edit mode |

### Example URLs

```
# Main view showing all tournaments
/?status=DRAFT

# Edit specific tournament
/?status=DRAFT&edit=true&tournamentId=uuid

# Live view for specific tournament
/?view=live&tournamentId=uuid

# Pool stages for finished tournament
/?view=pool-stages&tournamentId=uuid&status=FINISHED

# Global targets view
/?view=targets

# Presets list
/?view=tournament-presets

# Preset editor (specific preset)
/?view=tournament-preset-editor&presetId=uuid
```

---

## Component Architecture

### Main Components

#### 1. **TournamentList** (`TournamentList.tsx`)

The primary component for tournament management.

**Responsibilities:**
- Display all tournaments (filtered by status)
- Create new tournaments
- Edit tournament details
- Manage players (add, edit, remove, check-in)
- Configure pool stages
- Configure brackets
- Upload tournament logos
- Change tournament status

**Key Features:**
- Multi-status support (DRAFT, OPEN, SIGNATURE, LIVE, FINISHED)
- Inline editing
- Real-time player counts
- Pool stage configuration with drag-and-drop assignments
- Bracket configuration with auto-seeding

**State Management:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **LiveTournament** (`LiveTournament.tsx`)

Real-time tournament dashboard for live events.

**Responsibilities:**
- Display live pool stages with matches
- Display live brackets
- Show match queue
- Update match statuses
- Complete matches with scores
- Multi-tournament support

**View Modes:**
- `live`: Full live dashboard
- `pool-stages`: Pool stages only
- `brackets`: Brackets only

**Pool stage action behavior (live):**
- If a pool stage has no player assignments yet, the action shows **Fill**.
- **Fill** triggers the backend auto-assignment in EDITION mode (balanced by skill levels) without starting matches.
- Once assignments exist, the action shows **Launch** and moves the stage to IN_PROGRESS.

**Real-time Updates:**
```typescript
useEffect(() => {
  const fetchData = async () => {
    const views = await Promise.all(
      selectedTournamentIds.map(id => fetchTournamentLiveView(id))
    );
    setLiveViews(views);
  };
  
  fetchData();
  const interval = setInterval(fetchData, 30000); // Poll every 30s
  return () => clearInterval(interval);
}, [selectedTournamentIds]);
```

#### 3. **TargetsView** (`TargetsView.tsx`)

Global view of all targets and match queue across tournaments.

**Responsibilities:**
- Display shared targets (aggregated from multiple tournaments)
- Show match queue (intelligent ordering)
- Assign matches to targets
- Start/complete matches
- Track target availability

**Key Features:**
- **Shared Targets**: Targets with same number from different tournaments shown together
- **Match Queue**: Prioritized list showing next matches to play
- **Player Blocking**: Prevents same player from multiple concurrent matches
- **Target Status**: AVAILABLE, IN_USE, MAINTENANCE

**Match Queue Algorithm:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **PlayersView** (`PlayersView.tsx`)

View all players across all tournaments.

**Responsibilities:**
- List all players in the system
- Search/filter players
- View player details

#### 5. **TournamentPlayersView** (`TournamentPlayersView.tsx`)

View players for a specific tournament.

**Responsibilities:**
- Display tournament-specific player list
- Show player details (name, skill level, check-in status)

#### 6. **NotificationsView** (`NotificationsView.tsx`)

Match start notifications.

**Responsibilities:**
- Display notifications when matches start
- Filter by tournament
- Acknowledge notifications
- Show target assignments

**WebSocket Integration:**
```typescript
useEffect(() => {
  socket.on('match:started', (data) => {
    const notification = {
      id: generateId(),
      matchId: data.matchId,
      tournamentId: data.tournamentId,
      timestamp: new Date().toISOString(),
    };
    addNotification(notification);
  });
}, []);
```

---

## Authentication Flow

### Optional Authentication

The app supports **optional authentication** - users can view public data without logging in, but must authenticate for admin actions.

```typescript
// optionalAuth.tsx
export const useOptionalAuth = () => {
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
  
  if (!authEnabled) {
    return {
      isAuthenticated: false,
      user: null,
      loginWithRedirect: () => {},
      logout: () => {},
    };
  }
  
  const auth = useAuth0();
  return auth;
};
```

### Admin Status Check

```typescript
// useAdminStatus.tsx
export const useAdminStatus = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { getAccessTokenSilently } = useOptionalAuth();
  
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const token = await getAccessTokenSilently();
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, []);
  
  return { isAdmin };
};
```

### Protected Actions

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## State Management

### 1. Local State (useState)

Used for:
- UI state (modals, dropdowns, loading)
- Form inputs
- Temporary selections

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Server State (TanStack Query)

Used for:
- Fetching data from API
- Caching responses
- Automatic refetching
- Optimistic updates

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. WebSocket State

Used for:
- Real-time notifications
- Match status updates
- Live synchronization

```typescript
useEffect(() => {
  const socket = io('http://localhost:3000');
  
  socket.on('match:started', (data) => {
    setMatches(prev => updateMatchStatus(prev, data));
  });
  
  return () => socket.disconnect();
}, []);
```

---

## Styling

### TailwindCSS Utility Classes

The app extensively uses Tailwind's utility classes:

```tsx
<div className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-6">
  <h2 className="text-2xl font-bold text-white">
    Tournament Name
  </h2>
  <p className="mt-2 text-sm text-slate-400">
    Description text
  </p>
</div>
```

### Design System

**Colors:**
- `slate-950`: Dark background
- `slate-900`: Card backgrounds
- `slate-800`: Borders
- `slate-400`: Secondary text
- `white`: Primary text
- `emerald-500`: Success/positive actions
- `red-500`: Danger/delete actions
- `blue-500`: Primary actions

**Spacing:**
- `p-4`, `p-6`: Padding
- `mt-2`, `mb-4`: Margins
- `gap-4`: Flex/grid gaps

**Borders:**
- `rounded-2xl`: Large border radius
- `border`: 1px border
- `border-slate-800/60`: Semi-transparent borders

### Responsive Design

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Breakpoints:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Forms & Validation

### React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Invalid email'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});

const onSubmit = (data) => {
  // Submit to API
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input {...register('name')} />
    {errors.name && <span>{errors.name.message}</span>}
  </form>
);
```

---

## Testing

### Unit Tests (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### E2E Tests (Playwright)

Located in `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Build & Deployment

### Development

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Production Build

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Environment Variables

Create `.env` file:

```env
# Auth0 Configuration
VITE_AUTH_ENABLED=true
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com

# Optional: Override connection names
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_INSTAGRAM=instagram
```

**Note:** All variables must be prefixed with `VITE_` to be exposed to the client.

### Docker Deployment

```dockerfile
# Production Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Best Practices

1. **Component Size**: Keep components under 300 lines
2. **Props**: Use TypeScript interfaces for prop types
3. **State**: Lift state only when necessary
4. **Effects**: Keep useEffect dependencies minimal
5. **Naming**: Use descriptive, semantic names
6. **Comments**: Document complex logic
7. **Accessibility**: Use semantic HTML and ARIA labels
8. **Performance**: Profile before optimizing
