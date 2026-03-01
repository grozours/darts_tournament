# ⚔️ Documentation Frontend

## Vue d’ensemble

Le frontend est une application React 18 moderne construite avec TypeScript, Vite et TailwindCSS. Elle fournit une interface réactive et temps réel pour la gestion des tournois de fléchettes.

---

## Stack technique

| Technologie | Version | Rôle |
|------------|---------|------|
| React | 18.2+ | Bibliothèque UI |
| TypeScript | 5.x | Typage |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | CSS utilitaire |
| React Router DOM | 6.x | Routing côté client |
| Auth0 React SDK | 2.x | Authentification |
| TanStack Query | 5.x | Gestion d’état serveur |
| React Hook Form | 7.x | Formulaires & validation |
| Zod | 3.x | Validation de schémas |
| Socket.io Client | 4.x | Client WebSocket |
| Axios | 1.x | Client HTTP |
| Lucide React | Latest | Icônes |
| Vitest | 1.x | Tests unitaires |
| Playwright | Latest | Tests E2E |

---

## Structure du projet

```
frontend/
├── src/
│   ├── main.tsx                  # Point d’entrée de l’application
│   ├── App.tsx                   # Composant racine et routing
│   ├── index.css                # Styles globaux & imports Tailwind
│   ├── i18n.ts                  # Provider i18n (résolution langue + fusion des messages)
│   ├── locales/                 # Dictionnaires de traduction par langue
│   │   ├── en.ts
│   │   ├── fr.ts
│   │   ├── es.ts
│   │   ├── de.ts
│   │   ├── it.ts
│   │   ├── pt.ts
│   │   └── nl.ts
│   │
│   ├── components/              # Composants React
│   │   ├── TournamentList.tsx   # Vue principale : gestion des tournois
│   │   ├── LiveTournament.tsx   # Vue live des tournois
│   │   ├── TargetsView.tsx      # Vue cibles & file d’attente
│   │   ├── PlayersView.tsx      # Vue de tous les joueurs
│   │   ├── TournamentPlayersView.tsx  # Joueurs d’un tournoi
│   │   ├── RegistrationPlayers.tsx    # Inscription joueurs
│   │   ├── NotificationsView.tsx      # Notifications de match
│   │   ├── AccountView.tsx      # Compte utilisateur
│   │   └── tournaments/
│   │       └── CreateTournamentPage.tsx
│   │
│   ├── auth/                    # Utilitaires d’authentification
│   │   ├── optionalAuth.tsx    # Hook Auth0 optionnel
│   │   ├── useAdminStatus.tsx  # Hook statut admin
│   │   └── SignInPanel.tsx     # UI de connexion
│   │
│   ├── services/                # Services client API
│   │   └── tournamentService.ts # Appels API tournoi
│   │
│   ├── utils/                   # Fonctions utilitaires
│   │   └── liveViewHelpers.ts  # Helpers vue live
│   │
│   └── types/                   # Types TypeScript
│
├── tests/
│   ├── unit/                    # Tests unitaires Vitest
│   └── e2e/                     # Tests E2E Playwright
│
├── public/                      # Assets statiques
├── dist/                        # Build de production
│
├── index.html                   # Entrée HTML
├── vite.config.ts              # Configuration Vite
├── vitest.config.ts            # Configuration Vitest
├── tailwind.config.js          # Configuration TailwindCSS
├── tsconfig.json               # Configuration TypeScript
└── package.json                # Dépendances & scripts
```

---

## Stratégie de routing

## Localisation (i18n)

- Toutes les traductions frontend sont stockées en dictionnaires TypeScript dans `frontend/src/locales/*.ts`.
- `frontend/src/i18n.tsx` se limite à résoudre la langue active et fusionner les dictionnaires.
- Lorsqu’une langue ou une clé est ajoutée, mettre à jour le fichier correspondant dans `src/locales/`.

L’application utilise un **routing basé sur les paramètres de requête** plutôt que des chemins d’URL.

### Routes

| URL | Vue | Description |
|-----|------|-------------|
| `/` | `TournamentList` | Gestion principale des tournois |
| `/?view=live` | `LiveTournament` | Dashboard live |
| `/?view=pool-stages` | `LiveTournament` | Vue des poules |
| `/?view=brackets` | `LiveTournament` | Vue des tableaux |
| `/?view=targets` | `TargetsView` | Gestion des cibles |
| `/?view=players` | `PlayersView` | Tous les joueurs |
| `/?view=tournament-players` | `TournamentPlayersView` | Joueurs d’un tournoi |
| `/?view=registration-players` | `RegistrationPlayers` | Inscription joueurs |
| `/?view=notifications` | `NotificationsView` | Notifications de match |
| `/?view=tournament-presets` | `TournamentPresetsView` | Gestionnaire de presets (liste) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Éditeur de preset |
| `/?view=account` | `AccountView` | Compte utilisateur |
| `/?view=create-tournament` | `CreateTournamentPage` | Création de tournoi |

### Paramètres de requête

| Paramètre | Valeurs | Rôle |
|-----------|--------|------|
| `view` | (voir ci-dessus) | Détermine le composant affiché |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Filtrer par statut |
| `tournamentId` | UUID | Sélectionner un tournoi |
| `edit` | true/false | Activer le mode édition |

### Exemples d’URL

```
# Vue principale avec filtrage
/?status=DRAFT

# Éditer un tournoi
/?status=DRAFT&edit=true&tournamentId=uuid

# Vue live d’un tournoi
/?view=live&tournamentId=uuid

# Vue poules pour un tournoi terminé
/?view=pool-stages&tournamentId=uuid&status=FINISHED

# Vue cibles globale
/?view=targets

# Liste des presets
/?view=tournament-presets

# Éditeur de preset (preset spécifique)
/?view=tournament-preset-editor&presetId=uuid
```

---

## Architecture des composants

### Composants principaux

#### 1. **TournamentList** (`TournamentList.tsx`)

Composant principal de gestion des tournois.

**Responsabilités :**
- Afficher tous les tournois (filtrés par statut)
- Créer de nouveaux tournois
- Éditer les détails
- Gérer les joueurs (ajout, édition, suppression, check-in)
- Configurer les phases de poules
- Configurer les tableaux
- Téléverser les logos
- Changer le statut du tournoi

**Fonctionnalités clés :**
- Support multi-statut (DRAFT, OPEN, SIGNATURE, LIVE, FINISHED)
- Édition inline
- Compteurs de joueurs en temps réel
- Configuration des poules par drag-and-drop
- Configuration des tableaux avec seeding automatique

**Gestion d’état :**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **LiveTournament** (`LiveTournament.tsx`)

Dashboard temps réel pour les événements live.

**Responsabilités :**
- Afficher les poules en direct
- Afficher les tableaux en direct
- Afficher la file d’attente des matchs
- Mettre à jour les statuts de match
- Terminer les matchs avec scores
- Support multi-tournois

**Modes d’affichage :**
- `live` : dashboard complet
- `pool-stages` : poules uniquement
- `brackets` : tableaux uniquement

**Comportement de l’action des phases de poules (live) :**
- Si une phase de poules n’a encore aucune affectation de joueurs, l’action affiche **Remplir**.
- **Remplir** déclenche l’auto-affectation backend en mode EDITION (équilibrage par niveaux) sans démarrer les matchs.
- Une fois des affectations présentes, l’action affiche **Lancer** et passe la phase en IN_PROGRESS.

**Mises à jour temps réel :**
```typescript
useEffect(() => {
  const fetchData = async () => {
    const views = await Promise.all(
      selectedTournamentIds.map(id => fetchTournamentLiveView(id))
    );
    setLiveViews(views);
  };
  
  fetchData();
  const interval = setInterval(fetchData, 30000); // Rafraîchit toutes les 30s
  return () => clearInterval(interval);
}, [selectedTournamentIds]);
```

#### 3. **TargetsView** (`TargetsView.tsx`)

Vue globale des cibles et de la file d’attente des matchs.

**Responsabilités :**
- Afficher les cibles partagées (agrégées entre tournois)
- Montrer la file d’attente (ordre intelligent)
- Assigner les matchs aux cibles
- Démarrer/terminer les matchs
- Suivre la disponibilité des cibles

**Fonctionnalités clés :**
- **Cibles partagées** : cibles avec le même numéro regroupées
- **File d’attente** : liste priorisée des prochains matchs
- **Blocage joueurs** : empêche les matchs en parallèle d’un même joueur
- **Statut cibles** : AVAILABLE, IN_USE, MAINTENANCE

**Algorithme de file d’attente :**
```typescript
// Ordre de priorité :
1. Matchs de poules (phase 1, puis 2, etc.)
2. Matchs de tableaux (par tour)
3. Matchs non bloqués en priorité
4. Séquence au sein d’une poule
```

#### 4. **PlayersView** (`PlayersView.tsx`)

Vue de tous les joueurs.

**Responsabilités :**
- Lister tous les joueurs du système
- Rechercher/filtrer
- Voir les détails

#### 5. **TournamentPlayersView** (`TournamentPlayersView.tsx`)

Vue des joueurs d’un tournoi.

**Responsabilités :**
- Afficher la liste des joueurs d’un tournoi
- Montrer les détails (nom, niveau, check-in)

#### 6. **NotificationsView** (`NotificationsView.tsx`)

Notifications de démarrage de match.

**Responsabilités :**
- Afficher les notifications de matchs
- Filtrer par tournoi
- Accuser réception
- Afficher les affectations de cibles

**Intégration WebSocket :**
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

<a id="flux-d-authentification"></a>
## Flux d’authentification

### Authentification optionnelle

L’app supporte une **authentification optionnelle** : les utilisateurs peuvent voir les données publiques sans se connecter, mais doivent s’authentifier pour les actions admin.

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

### Vérification du statut admin

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

### Actions protégées

```typescript
// Exemple : seuls les admins peuvent créer un tournoi
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

<a id="gestion-de-l-état"></a>
## Gestion de l’état

### 1. État local (useState)

Utilisé pour :
- État UI (modales, dropdowns, loading)
- Champs de formulaire
- Sélections temporaires

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. État serveur (TanStack Query)

Utilisé pour :
- Récupérer les données API
- Cache des réponses
- Refetch automatique
- Mises à jour optimistes

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Rafraîchit toutes les 30s
  staleTime: 10000, // Considéré frais pendant 10s
});
```

### 3. État WebSocket

Utilisé pour :
- Notifications temps réel
- Statuts de match
- Synchronisation live

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

## Styles

### Classes utilitaires TailwindCSS

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

### Design system

**Couleurs :**
- `slate-950` : fond sombre
- `slate-900` : fonds de cartes
- `slate-800` : bordures
- `slate-400` : texte secondaire
- `white` : texte principal
- `emerald-500` : actions positives
- `red-500` : actions dangereuses
- `blue-500` : actions principales

**Espacement :**
- `p-4`, `p-6` : padding
- `mt-2`, `mb-4` : marges
- `gap-4` : écarts grid/flex

**Bordures :**
- `rounded-2xl` : grand rayon
- `border` : bordure 1px
- `border-slate-800/60` : bordures semi-transparentes

### Responsive design

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Grille responsive */}
</div>
```

**Breakpoints :**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Formulaires & validation

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

## Tests

### Tests unitaires (Vitest)

```bash
npm run test             # Exécution unique
npm run test:watch       # Mode watch
npm run test:coverage    # Rapport de couverture
```

### Tests E2E (Playwright)

Dans `tests/e2e/` :

```bash
npm run test:e2e         # Lancer les tests E2E
```

---

## Build & déploiement

### Développement

```bash
npm run dev              # Démarre le dev server (http://localhost:5173)
```

### Build de production

```bash
npm run build            # Build prod → dist/
npm run preview          # Prévisualiser le build
```

### Variables d’environnement

Créer un fichier `.env` :

```env
# Configuration Auth0
VITE_AUTH_ENABLED=true
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
VITE_AUTH0_CACHE_LOCATION=memory

# Optionnel : override des connexions
VITE_AUTH0_CONNECTION_GOOGLE=google-oauth2
VITE_AUTH0_CONNECTION_FACEBOOK=facebook
VITE_AUTH0_CONNECTION_INSTAGRAM=instagram
```

`VITE_AUTH0_CACHE_LOCATION` accepte `memory` (recommandé) ou `localstorage`.

**Note :** Toutes les variables doivent commencer par `VITE_` pour être exposées au client.

### Déploiement Docker

```dockerfile
# Dockerfile production
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

## Bonnes pratiques

1. **Taille des composants** : rester sous 300 lignes
2. **Props** : utiliser des interfaces TypeScript
3. **State** : remonter l’état seulement si nécessaire
4. **Effects** : limiter les dépendances de `useEffect`
5. **Nommage** : noms descriptifs et sémantiques
6. **Commentaires** : documenter la logique complexe
7. **Accessibilité** : HTML sémantique et ARIA
8. **Performance** : profiler avant d’optimiser
