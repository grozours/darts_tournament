# ⚔️ Frontend-documentatie

## Overzicht

De frontend is een moderne React 18-applicatie gebouwd met TypeScript, Vite en TailwindCSS. Het biedt een responsieve, realtime interface voor het beheren van darttoernooien.

---

## Technologiestapel

| Technologie | Versie | Doel |
|------------|---------|---------|
| React | 18,2+ | UI-bibliotheek |
| TypeScript | 5.x | Typeveiligheid |
| Vite | 5.x | Buildtool en ontwikkelserver |
| TailwindCSS | 3.x | Utility-eerste CSS |
| React Router DOM | 6.x | Routering aan clientzijde |
| Auth0 React-SDK | 2.x | Authenticatie |
| TanStack-query | 5.x | Beheer van serverstatus |
| React Hook Form | 7.x | Formulierafhandeling en validatie |
| Zod | 3.x | Schemavalidatie |
| Socket.io-client | 4.x | WebSocket-client |
| Axios | 1.x | HTTP-client |
| Lucide React | Nieuwste | Pictogrambibliotheek |
| Vitest | 1.x | Eenheidstesten |
| Playwright | Nieuwste | E2E-testen |

---

## Projectstructuur

```
frontend/
├── src/
│   ├── main.tsx                  # Application entry point
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                # Global styles & Tailwind imports
│   ├── i18n.ts                  # I18n provider (language resolution + message merge)
│   ├── locales/                 # Translation dictionaries by language
│   │   ├── en.ts
│   │   ├── fr.ts
│   │   ├── es.ts
│   │   ├── de.ts
│   │   ├── it.ts
│   │   ├── pt.ts
│   │   └── nl.ts
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

## Routingstrategie

## Lokalisatie (i18n)

- Alle frontend-vertalingen worden opgeslagen als TypeScript-woordenboeken in `frontend/src/locales/*.ts`.
- `frontend/src/i18n.tsx` lost alleen de actieve taal op en voegt woordenboeken samen.
- Wanneer u een nieuwe taal of sleutel toevoegt, update dan het overeenkomstige bestand in `src/locales/`.

De applicatie gebruikt **queryparametergebaseerde routering** in plaats van URL-paden:

### Routes

| URL | Bekijk | Beschrijving |
|-----|------|-------------|
| `/` | `TournamentList` | Hoofdtoernooibeheer |
| `/?view=live` | `LiveTournament` | Live toernooidashboard |
| `/?view=pool-stages` | `LiveTournament` | Pooletappes bekijken |
| `/?view=brackets` | `LiveTournament` | Beugels bekijken |
| `/?view=targets` | `TargetsView` | Doelbeheer |
| `/?view=players` | `PlayersView` | Alle spelers |
| `/?view=tournament-players` | `TournamentPlayersView` | Toernooispelers |
| `/?view=registration-players` | `RegistrationPlayers` | Spelerregistratie |
| `/?view=notifications` | `NotificationsView` | Wedstrijdmeldingen |
| `/?view=tournament-presets` | `TournamentPresetsView` | Beheer van voorinstellingen (lijst) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Voorinstellingeneditor |
| `/?view=account` | `AccountView` | Gebruikersaccount |
| `/?view=create-tournament` | `CreateTournamentPage` | Toernooi aanmaken |

### Queryparameters

| Parameter | Waarden | Doel |
|-----------|--------|---------|
| `view` | (zie hierboven) | Bepaalt welk onderdeel moet worden weergegeven |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Toernooien filteren op status |
| `tournamentId` | UUID | Selecteer specifiek toernooi |
| `edit` | waar/onwaar | Bewerkingsmodus inschakelen |

### Voorbeeld-URL's

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

## Componentarchitectuur

### Hoofdcomponenten

#### 1. **Toernooilijst** (`TournamentList.tsx`)

Het primaire onderdeel voor toernooibeheer.

**Verantwoordelijkheden:**
- Toon alle toernooien (gefilterd op status)
- Creëer nieuwe toernooien
- Toernooidetails bewerken
- Beheer spelers (toevoegen, bewerken, verwijderen, inchecken)
- Configureer poolfasen
- Configureer beugels
- Upload toernooilogo's
- Verander de toernooistatus

**Belangrijkste kenmerken:**
- Ondersteuning voor meerdere statussen (DRAFT, OPEN, HANDTEKENING, LIVE, KLAAR)
- Inline bewerken
- Realtime spelerstellingen
- Poolpodiumconfiguratie met drag-and-drop-opdrachten
- Beugelconfiguratie met automatisch zaaien

**Staatsbeheer:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **Livetoernooi** (`LiveTournament.tsx`)

Realtime toernooidashboard voor live-evenementen.

**Verantwoordelijkheden:**
- Geef live poulefasen met wedstrijden weer
- Geef live haakjes weer
- Toon wedstrijdwachtrij
- Update wedstrijdstatussen
- Voltooi wedstrijden met scores
- Ondersteuning voor meerdere toernooien

**Bekijkmodi:**
- `live`: volledig live-dashboard
- `pool-stages`: alleen poulefasen
- `brackets`: alleen beugels

**Poolfase-actiegedrag (live):**
- Als een poolfase nog geen spelerstoewijzingen heeft, wordt in de actie **Vullen** weergegeven.
- **Vul** activeert de automatische toewijzing van de backend in de EDITION-modus (gebalanceerd op vaardigheidsniveaus) zonder wedstrijden te starten.
- Zodra er opdrachten zijn, wordt bij de actie **Launch** weergegeven en wordt het podium verplaatst naar IN_PROGRESS.

**Realtime updates:**
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

#### 3. **Doelweergave** (`TargetsView.tsx`)

Globaal overzicht van alle doelen en wedstrijdwachtrijen voor toernooien.

**Verantwoordelijkheden:**
- Geef gedeelde doelen weer (samengevoegd uit meerdere toernooien)
- Toon wedstrijdwachtrij (intelligent bestellen)
- Wijs wedstrijden toe aan doelen
- Wedstrijden starten/voltooien
- Volg de beschikbaarheid van doelen

**Belangrijkste kenmerken:**
- **Gedeelde doelen**: doelen met hetzelfde nummer uit verschillende toernooien worden samen weergegeven
- **Wedstrijdwachtrij**: Prioritaire lijst met de volgende te spelen wedstrijden
- **Spelerblokkering**: voorkomt dat dezelfde speler meerdere gelijktijdige wedstrijden speelt
- **Doelstatus**: BESCHIKBAAR, IN_USE, ONDERHOUD

**Match wachtrij-algoritme:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **Spelersweergave** (`PlayersView.tsx`)

Bekijk alle spelers van alle toernooien.

**Verantwoordelijkheden:**
- Maak een lijst van alle spelers in het systeem
- Zoek/filter spelers
- Bekijk spelerdetails

#### 5. **Toernooispelersweergave** (`TournamentPlayersView.tsx`)

Bekijk spelers voor een specifiek toernooi.

**Verantwoordelijkheden:**
- Toon toernooispecifieke spelerslijst
- Toon spelergegevens (naam, vaardigheidsniveau, check-instatus)

#### 6. **Meldingenweergave** (`NotificationsView.tsx`)

Matchstartmeldingen.

**Verantwoordelijkheden:**
- Geef meldingen weer wanneer wedstrijden beginnen
- Filter op toernooi
- Bevestig meldingen
- Toon doeltoewijzingen

**WebSocket-integratie:**
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

## Authenticatiestroom

### Optionele authenticatie

De app ondersteunt **optionele authenticatie** - gebruikers kunnen openbare gegevens bekijken zonder in te loggen, maar moeten zich authenticeren voor beheerdersacties.

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

### Controle van de beheerdersstatus

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

### Beschermde acties

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## Staatsbeheer

### 1. Lokale staat (useState)

Gebruikt voor:
- UI-status (modalen, vervolgkeuzelijsten, laden)
- Formulierinvoer
- Tijdelijke selecties

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Serverstatus (TanStack-query)

Gebruikt voor:
- Gegevens ophalen uit API
- Reacties in cache opslaan
- Automatisch opnieuw ophalen
- Optimistische updates

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. WebSocket-status

Gebruikt voor:
- Realtime meldingen
- Matchstatusupdates
- Live-synchronisatie

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

### TailwindCSS-hulpprogrammaklassen

De app maakt uitgebreid gebruik van de hulpprogrammaklassen van Tailwind:

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

### Ontwerpsysteem

**Kleuren:**
- `slate-950`: donkere achtergrond
- `slate-900`: kaartachtergronden
- `slate-800`: grenzen
- `slate-400`: secundaire tekst
- `white`: Primaire tekst
- `emerald-500`: Succes/positieve acties
- `red-500`: Gevaar/verwijder acties
- `blue-500`: Primaire acties

** Afstand:**
- `p-4`, `p-6`: opvulling
- `mt-2`, `mb-4`: marges
- `gap-4`: Flex-/grid-hiaten

**Grenzen:**
- `rounded-2xl`: Grote randradius
- `border`: 1px rand
- `border-slate-800/60`: Semi-transparante randen

### Responsief ontwerp

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Breekpunten:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Formulieren en validatie

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

## Testen

### Eenheidstests (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### E2E-tests (Playwright)

Gelegen in `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Bouw en implementatie

### Ontwikkeling

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Productieopbouw

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Omgevingsvariabelen

Maak een `.env`-bestand:

```env
# Auth0 Configuration
VITE_AUTH_ENABLED=true
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
VITE_AUTH0_CACHE_LOCATION=memory

# Optional: Override connection names
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_INSTAGRAM=instagram
```

`VITE_AUTH0_CACHE_LOCATION` ondersteunt `memory` (aanbevolen) of `localstorage`.

**Opmerking:** Alle variabelen moeten worden voorafgegaan door `VITE_` om zichtbaar te zijn voor de client.

### Docker-implementatie

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

## Beste praktijken

1. **Componentgrootte**: Houd componenten onder de 300 regels
2. **Rekwisieten**: gebruik TypeScript-interfaces voor rekwisietentypen
3. **State**: Til de status alleen op wanneer dat nodig is
4. **Effecten**: Houd de afhankelijkheden van useEffect minimaal
5. **Naamgeving**: gebruik beschrijvende, semantische namen
6. **Opmerkingen**: Documenteer complexe logica
7. **Toegankelijkheid**: gebruik semantische HTML- en ARIA-labels
8. **Prestaties**: profiel vóór optimaliseren
