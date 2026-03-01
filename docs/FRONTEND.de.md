# ⚔️ Frontend-Dokumentation

## Übersicht

Das Frontend ist eine moderne React 18-Anwendung, die mit TypeScript, Vite und TailwindCSS erstellt wurde. Es bietet eine reaktionsfähige Echtzeitoberfläche für die Verwaltung von Dartturnieren.

---

## Technologie-Stack

| Technologie | Version | Zweck |
|------------|---------|---------|
| React | 18,2+ | UI-Bibliothek |
| TypeScript | 5.x | Typensicherheit |
| Vite | 5.x | Build-Tool und Entwicklungsserver |
| TailwindCSS | 3.x | Utility-First-CSS |
| React Router DOM | 6.x | Clientseitiges Routing |
| Auth0 React SDK | 2.x | Authentifizierung |
| TanStack Query | 5.x | Serverstatusverwaltung |
| React Hook Form | 7.x | Formularbearbeitung und -validierung |
| Zod | 3.x | Schemavalidierung |
| Socket.io-Client | 4.x | WebSocket-Client |
| Axios | 1.x | HTTP-Client |
| Lucide React | Neueste | Symbolbibliothek |
| Vitest | 1.x | Unit-Tests |
| Playwright | Neueste | E2E-Tests |

---

## Projektstruktur

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

## Routing-Strategie

## Lokalisierung (i18n)

- Alle Frontend-Übersetzungen werden als TypeScript-Wörterbücher in `frontend/src/locales/*.ts` gespeichert.
- `frontend/src/i18n.tsx` löst nur die aktive Sprache auf und führt Wörterbücher zusammen.
- Wenn Sie eine neue Sprache oder einen neuen Schlüssel hinzufügen, aktualisieren Sie die entsprechende Datei in `src/locales/`.

Die Anwendung verwendet **abfrageparameterbasiertes Routing** anstelle von URL-Pfaden:

### Routen

| URL | Anzeigen | Beschreibung |
|-----|------|-------------|
| `/` | `TournamentList` | Hauptturnierleitung |
| `/?view=live` | `LiveTournament` | Live-Turnier-Dashboard |
| `/?view=pool-stages` | `LiveTournament` | Blick auf die Poolbühnen |
| `/?view=brackets` | `LiveTournament` | Klammeransicht |
| `/?view=targets` | `TargetsView` | Zielmanagement |
| `/?view=players` | `PlayersView` | Alle Spieler |
| `/?view=tournament-players` | `TournamentPlayersView` | Turnierspieler |
| `/?view=registration-players` | `RegistrationPlayers` | Spielerregistrierung |
| `/?view=notifications` | `NotificationsView` | Spielbenachrichtigungen |
| `/?view=tournament-presets` | `TournamentPresetsView` | Preset-Manager (Liste) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Preset-Editor |
| `/?view=account` | `AccountView` | Benutzerkonto |
| `/?view=create-tournament` | `CreateTournamentPage` | Turnier erstellen |

### Abfrageparameter

| Parameter | Werte | Zweck |
|-----------|--------|---------|
| `view` | (siehe oben) | Bestimmt, welche Komponente gerendert werden soll |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Turniere nach Status filtern |
| `tournamentId` | UUID | Wählen Sie ein bestimmtes Turnier aus |
| `edit` | wahr/falsch | Bearbeitungsmodus aktivieren |

### Beispiel-URLs

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

## Komponentenarchitektur

### Hauptkomponenten

#### 1. **Turnierliste** (`TournamentList.tsx`)

Die Hauptkomponente für das Turniermanagement.

**Aufgaben:**
- Alle Turniere anzeigen (gefiltert nach Status)
- Erstellen Sie neue Turniere
- Turnierdetails bearbeiten
- Spieler verwalten (hinzufügen, bearbeiten, entfernen, einchecken)
- Konfigurieren Sie Poolstufen
- Klammern konfigurieren
- Turnierlogos hochladen
- Turnierstatus ändern

**Hauptmerkmale:**
- Unterstützung mehrerer Status (ENTWURF, OFFEN, UNTERZEICHNUNG, LIVE, FERTIG)
- Inline-Bearbeitung
- Spielerzählung in Echtzeit
- Pool-Stage-Konfiguration mit Drag-and-Drop-Zuweisungen
- Bracket-Konfiguration mit automatischer Aussaat

**Staatsverwaltung:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **LiveTurnier** (`LiveTournament.tsx`)

Echtzeit-Turnier-Dashboard für Live-Events.

**Aufgaben:**
- Zeigen Sie Live-Pool-Stufen mit Spielen an
- Live-Klammern anzeigen
- Match-Warteschlange anzeigen
- Aktualisieren Sie den Spielstatus
- Schließe Spiele mit Punktzahlen ab
- Unterstützung mehrerer Turniere

**Ansichtsmodi:**
- `live`: Vollständiges Live-Dashboard
- `pool-stages`: Nur Pool-Stufen
- `brackets`: Nur Klammern

**Aktionsverhalten auf der Poolbühne (live):**
- Wenn eine Pool-Phase noch keine Spielerzuweisungen hat, zeigt die Aktion **Füllen** an.
- **Füllen** löst die automatische Backend-Zuweisung im EDITION-Modus (ausgeglichen nach Fähigkeitsstufen) aus, ohne dass Spiele gestartet werden müssen.
– Sobald Zuweisungen vorhanden sind, zeigt die Aktion **Starten** an und verschiebt die Phase auf IN_PROGRESS.

**Echtzeit-Updates:**
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

Globale Ansicht aller Ziele und Spielwarteschlange über Turniere hinweg.

**Aufgaben:**
- Gemeinsame Ziele anzeigen (aggregiert aus mehreren Turnieren)
- Match-Warteschlange anzeigen (intelligente Bestellung)
- Weisen Sie den Zielen Übereinstimmungen zu
- Spiele starten/abschließen
- Verfolgen Sie die Zielverfügbarkeit

**Hauptmerkmale:**
- **Gemeinsame Ziele**: Ziele mit derselben Nummer aus verschiedenen Turnieren werden zusammen angezeigt
- **Spielwarteschlange**: Priorisierte Liste mit den nächsten zu spielenden Spielen
- **Spielerblockierung**: Verhindert, dass derselbe Spieler an mehreren gleichzeitigen Spielen teilnimmt
- **Zielstatus**: VERFÜGBAR, IN_VERWENDUNG, WARTUNG

**Match-Warteschlangen-Algorithmus:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **PlayersView** (`PlayersView.tsx`)

Alle Spieler aller Turniere anzeigen.

**Aufgaben:**
- Listen Sie alle Spieler im System auf
- Spieler suchen/filtern
- Spielerdetails anzeigen

#### 5. **TournamentPlayersView** (`TournamentPlayersView.tsx`)

Zeigen Sie Spieler für ein bestimmtes Turnier an.

**Aufgaben:**
- Turnierspezifische Spielerliste anzeigen
- Spielerdetails anzeigen (Name, Spielstärke, Check-in-Status)

#### 6. **NotificationsView** (`NotificationsView.tsx`)

Benachrichtigungen zum Spielbeginn.

**Aufgaben:**
- Benachrichtigungen anzeigen, wenn Spiele beginnen
- Nach Turnier filtern
- Benachrichtigungen bestätigen
- Zielzuweisungen anzeigen

**WebSocket-Integration:**
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

## Authentifizierungsablauf

### Optionale Authentifizierung

Die App unterstützt **optionale Authentifizierung** – Benutzer können öffentliche Daten anzeigen, ohne sich anzumelden, müssen sich jedoch für Administratoraktionen authentifizieren.

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

### Admin-Statusprüfung

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

### Geschützte Aktionen

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## Staatsverwaltung

### 1. Lokaler Status (useState)

Verwendet für:
- UI-Status (Modals, Dropdowns, Laden)
- Formulareingaben
- Temporäre Auswahl

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Serverstatus (TanStack Query)

Verwendet für:
- Abrufen von Daten von der API
- Antworten zwischenspeichern
- Automatisches erneutes Abrufen
- Optimistische Updates

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. WebSocket-Status

Verwendet für:
- Echtzeitbenachrichtigungen
- Match-Statusaktualisierungen
- Live-Synchronisation

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

##Styling

### TailwindCSS-Dienstprogrammklassen

Die App nutzt in großem Umfang die Utility-Klassen von Tailwind:

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

### Designsystem

**Farben:**
- `slate-950`: Dunkler Hintergrund
- `slate-900`: Kartenhintergründe
- `slate-800`: Grenzen
- `slate-400`: Sekundärtext
- `white`: Primärtext
- `emerald-500`: Erfolg/positive Maßnahmen
- `red-500`: Gefahren-/Löschaktionen
- `blue-500`: Primäre Aktionen

**Abstand:**
- `p-4`, `p-6`: Polsterung
- `mt-2`, `mb-4`: Ränder
- `gap-4`: Flex-/Gitterlücken

**Grenzen:**
- `rounded-2xl`: Großer Randradius
- `border`: 1px-Rand
- `border-slate-800/60`: Halbtransparente Ränder

### Responsives Design

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Haltepunkte:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Formulare und Validierung

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

### Unit-Tests (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### E2E-Tests (Playwright)

Befindet sich in `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Erstellen und Bereitstellen

### Entwicklung

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Produktionsaufbau

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Umgebungsvariablen

Erstellen Sie die Datei `.env`:

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

`VITE_AUTH0_CACHE_LOCATION` unterstützt `memory` (empfohlen) oder `localstorage`.

**Hinweis:** Allen Variablen muss das Präfix `VITE_` vorangestellt werden, damit sie dem Client angezeigt werden.

### Docker-Bereitstellung

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

1. **Komponentengröße**: Komponenten unter 300 Zeilen halten
2. **Requisiten**: Verwenden Sie TypeScript-Schnittstellen für Prop-Typen
3. **Status**: Status nur bei Bedarf anheben
4. **Effekte**: UseEffect-Abhängigkeiten minimal halten
5. **Benennung**: Verwenden Sie beschreibende, semantische Namen
6. **Kommentare**: Komplexe Logik dokumentieren
7. **Barrierefreiheit**: Verwenden Sie semantische HTML- und ARIA-Labels
8. **Leistung**: Profil vor der Optimierung
