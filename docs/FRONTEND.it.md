# ⚔️ Documentazione frontend

## Panoramica

Il frontend è una moderna applicazione React 18 creata con TypeScript, Vite e TailwindCSS. Fornisce un'interfaccia reattiva e in tempo reale per la gestione dei tornei di freccette.

---

## Pila tecnologica

| Tecnologia | Versione | Scopo |
|------------|---------|---------|
| React | 18.2+ | Libreria dell'interfaccia utente |
| TypeScript | 5.x | Sicurezza dei tipi |
| Vite | 5.x | Strumento di creazione e server di sviluppo |
| TailwindCSS | 3.x | CSS di utilità prima |
| React Router DOM | 6.x | Routing lato client |
| Auth0 React SDK | 2.x | Autenticazione |
| TanStack Query | 5.x | Gestione dello stato del server |
| React Hook Form | 7.x | Gestione e convalida dei moduli |
| Zod | 3.x | Convalida dello schema |
| Client Socket.io | 4.x | Client WebSocket |
| Axios | 1.x | Client HTTP |
| Lucide React | Ultimi | Libreria di icone |
| Vitest | 1.x | Test unitario |
| Playwright | Ultimi | Test E2E |

---

## Struttura del progetto

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

## Strategia di routing

## Localizzazione (i18n)

- Tutte le traduzioni del frontend sono archiviate come dizionari TypeScript in `frontend/src/locales/*.ts`.
- `frontend/src/i18n.tsx` risolve solo la lingua attiva e unisce i dizionari.
- Quando aggiungi una nuova lingua o chiave, aggiorna il file corrispondente in `src/locales/`.

L'applicazione utilizza il **routing basato su parametri di query** invece dei percorsi URL:

### Percorsi

| URL | Visualizza | Descrizione |
|-----|------|-------------|
| `/` | `TournamentList` | Gestione del torneo principale |
| `/?view=live` | `LiveTournament` | Dashboard del torneo dal vivo |
| `/?view=pool-stages` | `LiveTournament` | Visualizzazione delle fasi della piscina |
| `/?view=brackets` | `LiveTournament` | Visualizzazione tra parentesi |
| `/?view=targets` | `TargetsView` | Gestione degli obiettivi |
| `/?view=players` | `PlayersView` | Tutti i giocatori |
| `/?view=tournament-players` | `TournamentPlayersView` | Giocatori del torneo |
| `/?view=registration-players` | `RegistrationPlayers` | Registrazione del giocatore |
| `/?view=notifications` | `NotificationsView` | Notifiche delle partite |
| `/?view=tournament-presets` | `TournamentPresetsView` | Gestione preimpostazioni (lista) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Editor preimpostato |
| `/?view=account` | `AccountView` | Conto utente |
| `/?view=create-tournament` | `CreateTournamentPage` | Crea torneo |

### Parametri della query

| Parametro | Valori | Scopo |
|-----------|--------|---------|
| `view` | (vedi sopra) | Determina quale componente eseguire il rendering |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Filtra i tornei per stato |
| `tournamentId` | UUID | Seleziona torneo specifico |
| `edit` | vero/falso | Abilita modalità modifica |

### URL di esempio

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

## Architettura dei componenti

### Componenti principali

#### 1. **Elenco tornei** (`TournamentList.tsx`)

Il componente principale per la gestione dei tornei.

**Responsabilità:**
- Visualizza tutti i tornei (filtrati per stato)
- Creare nuovi tornei
- Modifica i dettagli del torneo
- Gestisci i giocatori (aggiungi, modifica, rimuovi, effettua il check-in)
- Configurare le fasi del pool
- Configurare le parentesi
- Carica i loghi dei tornei
- Cambia lo stato del torneo

**Caratteristiche principali:**
- Supporto multistato (BOZZA, APERTO, FIRMA, LIVE, FINITO)
- Modifica in linea
- Conteggio dei giocatori in tempo reale
- Configurazione della fase del pool con assegnazioni drag-and-drop
- Configurazione staffa con auto-seeding

**Gestione dello Stato:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **Torneo dal vivo** (`LiveTournament.tsx`)

Dashboard dei tornei in tempo reale per eventi dal vivo.

**Responsabilità:**
- Visualizza le fasi del pool dal vivo con le partite
- Visualizza parentesi live
- Mostra la coda delle partite
- Aggiorna gli stati delle partite
- Completa le partite con i punteggi
- Supporto multi-torneo

**Modalità di visualizzazione:**
- `live`: dashboard live completa
- `pool-stages`: solo fasi girone
- `brackets`: solo parentesi

**Comportamento dell'azione sul palco della piscina (dal vivo):**
- Se una fase del girone non ha ancora assegnazioni di giocatori, l'azione mostra **Riempi**.
- **Riempimento** attiva l'assegnazione automatica del backend in modalità EDIZIONE (bilanciata in base ai livelli di abilità) senza avviare partite.
- Una volta esistenti le assegnazioni, l'azione mostra **Avvia** e sposta la fase su IN_PROGRESS.

**Aggiornamenti in tempo reale:**
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

#### 3. **VisualizzazioneObiettivi** (`TargetsView.tsx`)

Visualizzazione globale di tutti gli obiettivi e coda delle partite nei tornei.

**Responsabilità:**
- Visualizza obiettivi condivisi (aggregati da più tornei)
- Mostra la coda delle partite (ordine intelligente)
- Assegnare corrispondenze agli obiettivi
- Inizia/completa le partite
- Tieni traccia della disponibilità del target

**Caratteristiche principali:**
- **Bersagli condivisi**: bersagli con lo stesso numero provenienti da tornei diversi mostrati insieme
- **Coda partite**: elenco con priorità che mostra le prossime partite da giocare
- **Blocco giocatore**: impedisce allo stesso giocatore di partecipare a più partite simultanee
- **Stato target**: DISPONIBILE, IN_USO, MANUTENZIONE

**Algoritmo della coda delle partite:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **Visualizzazione giocatori** (`PlayersView.tsx`)

Visualizza tutti i giocatori in tutti i tornei.

**Responsabilità:**
- Elenca tutti i giocatori nel sistema
- Cerca/filtra i giocatori
- Visualizza i dettagli del giocatore

#### 5. **VisualizzazioneGiocatoriTorneo** (`TournamentPlayersView.tsx`)

Visualizza i giocatori per un torneo specifico.

**Responsabilità:**
- Visualizza l'elenco dei giocatori specifico del torneo
- Mostra i dettagli del giocatore (nome, livello di abilità, stato del check-in)

#### 6. **Visualizzazione notifiche** (`NotificationsView.tsx`)

Notifiche di inizio partita.

**Responsabilità:**
- Visualizza le notifiche all'inizio delle partite
- Filtra per torneo
- Riconoscere le notifiche
- Mostra assegnazioni di destinazione

**Integrazione WebSocket:**
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

## Flusso di autenticazione

### Autenticazione facoltativa

L'app supporta l'**autenticazione facoltativa**: gli utenti possono visualizzare i dati pubblici senza effettuare l'accesso, ma devono autenticarsi per le azioni di amministrazione.

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

### Controllo dello stato dell'amministratore

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

### Azioni protette

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## Gestione statale

### 1. Stato locale (useState)

Utilizzato per:
- Stato dell'interfaccia utente (modali, menu a discesa, caricamento)
- Modulo input
- Selezioni temporanee

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Stato del server (query TanStack)

Utilizzato per:
- Recupero dei dati dall'API
- Memorizzazione nella cache delle risposte
- Recupero automatico
- Aggiornamenti ottimistici

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. Stato del WebSocket

Utilizzato per:
- Notifiche in tempo reale
- Aggiornamenti sullo stato delle partite
- Sincronizzazione in tempo reale

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

##Stile

### Classi di utilità TailwindCSS

L'app utilizza ampiamente le classi di utilità di Tailwind:

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

### Sistema di progettazione

**Colori:**
- `slate-950`: sfondo scuro
- `slate-900`: sfondi delle carte
- `slate-800`: Confini
- `slate-400`: testo secondario
- `white`: testo principale
- `emerald-500`: successo/azioni positive
- `red-500`: azioni di pericolo/eliminazione
- `blue-500`: azioni primarie

**Spaziatura:**
- `p-4`, `p-6`: imbottitura
- `mt-2`, `mb-4`: margini
- `gap-4`: spazi flessibili/griglia

**Confini:**
- `rounded-2xl`: ampio raggio del bordo
- `border`: bordo 1px
- `border-slate-800/60`: bordi semitrasparenti

### Design reattivo

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Punti di interruzione:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Moduli e convalida

### Reagisci alla forma del gancio + Zod

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

## Test

### Test unitari (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Test E2E (Playwright)

Situato a `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Creazione e distribuzione

### Sviluppo

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Costruzione di produzione

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Variabili d'ambiente

Crea il file `.env`:

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

`VITE_AUTH0_CACHE_LOCATION` supporta `memory` (consigliato) o `localstorage`.

**Nota:** tutte le variabili devono avere il prefisso `VITE_` per essere esposte al client.

### Distribuzione Docker

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

## Migliori pratiche

1. **Dimensione componente**: mantieni i componenti sotto le 300 righe
2. **Props**: utilizza le interfacce TypeScript per i tipi di prop
3. **Stato**: stato del sollevamento solo quando necessario
4. **Effetti**: mantieni minime le dipendenze useEffect
5. **Denominazione**: utilizzare nomi descrittivi e semantici
6. **Commenti**: documenta la logica complessa
7. **Accessibilità**: utilizza etichette semantiche HTML e ARIA
8. **Prestazioni**: profilo prima dell'ottimizzazione
