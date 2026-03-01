# ⚔️ Documentación frontal

## Descripción general

La interfaz es una aplicación React 18 moderna creada con TypeScript, Vite y TailwindCSS. Proporciona una interfaz receptiva en tiempo real para gestionar torneos de dardos.

---

## Pila de tecnología

| Tecnología | Versión | Propósito |
|------------|---------|---------|
| Reaccionar | 18,2+ | Biblioteca de interfaz de usuario |
| Mecanografiado | 5.x | Tipo de seguridad |
| invitar | 5.x | Herramienta de compilación y servidor de desarrollo |
| Viento de colaCSS | 3.x | CSS de utilidad primero |
| Reaccionar enrutador DOM | 6.x | Enrutamiento del lado del cliente |
| SDK de reacción de Auth0 | 2.x | Autenticación |
| Consulta TanStack | 5.x | Gestión del estado del servidor |
| Forma de gancho de reacción | 7.x | Manejo y validación de formularios |
| Zod | 3.x | Validación de esquema |
| Cliente Socket.io | 4.x | Cliente WebSocket |
| Axios | 1.x | Cliente HTTP |
| Reacción lucida | Lo último | Biblioteca de iconos |
| Vitest | 1.x | Pruebas unitarias |
| Dramaturgo | Lo último | Pruebas E2E |

---

## Estructura del proyecto

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

## Estrategia de enrutamiento

## Localización (i18n)

- Todas las traducciones de la interfaz se almacenan como diccionarios TypeScript en `frontend/src/locales/*.ts`.
- `frontend/src/i18n.tsx` solo resuelve el idioma activo y fusiona diccionarios.
- Al agregar un nuevo idioma o clave, actualizar el archivo correspondiente en `src/locales/`.

La aplicación utiliza **enrutamiento basado en parámetros de consulta** en lugar de rutas URL:

### Rutas

| URL | Ver | Descripción |
|-----|------|-------------|
| `/` | `TournamentList` | Gestión principal del torneo |
| `/?view=live` | `LiveTournament` | Panel de control del torneo en vivo |
| `/?view=pool-stages` | `LiveTournament` | Vista de los escenarios de la piscina |
| `/?view=brackets` | `LiveTournament` | Vista entre paréntesis |
| `/?view=targets` | `TargetsView` | Gestión de objetivos |
| `/?view=players` | `PlayersView` | Todos los jugadores |
| `/?view=tournament-players` | `TournamentPlayersView` | Jugadores del torneo |
| `/?view=registration-players` | `RegistrationPlayers` | Registro de jugadores |
| `/?view=notifications` | `NotificationsView` | Notificaciones de partidos |
| `/?view=tournament-presets` | `TournamentPresetsView` | Administrador de presets (lista) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Editor de ajustes preestablecidos |
| `/?view=account` | `AccountView` | Cuenta de usuario |
| `/?view=create-tournament` | `CreateTournamentPage` | Crear torneo |

### Parámetros de consulta

| Parámetro | Valores | Propósito |
|-----------|--------|---------|
| `view` | (ver arriba) | Determina qué componente renderizar |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Filtrar torneos por estado |
| `tournamentId` | UUID | Seleccionar torneo específico |
| `edit` | verdadero/falso | Habilitar modo de edición |

### URL de ejemplo

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

## Arquitectura de componentes

### Componentes principales

#### 1. **Lista de torneos** (`TournamentList.tsx`)

El componente principal para la gestión de torneos.

**Responsabilidades:**
- Mostrar todos los torneos (filtrados por estado)
- Crear nuevos torneos
- Editar detalles del torneo
- Administrar jugadores (agregar, editar, eliminar, registrar)
- Configurar etapas de piscina
- Configurar soportes
- Subir logotipos de torneos
- Cambiar el estado del torneo

**Características clave:**
- Soporte multiestado (BORRADOR, ABIERTO, FIRMA, EN VIVO, TERMINADO)
- Edición en línea
- Recuento de jugadores en tiempo real
- Configuración del escenario de la piscina con asignaciones de arrastrar y soltar
- Configuración de soporte con siembra automática

**Gestión Estatal:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **Torneo en vivo** (`LiveTournament.tsx`)

Panel de torneos en tiempo real para eventos en vivo.

**Responsabilidades:**
- Muestra etapas de billar en vivo con partidos.
- Mostrar corchetes en vivo
- Mostrar cola de partidos
- Actualizar estados de partidos
- Completa partidos con puntuaciones.
- Soporte multitorneo

**Modos de visualización:**
- `live`: panel completo en vivo
- `pool-stages`: solo etapas de grupos
- `brackets`: solo corchetes

**Comportamiento de acción en el escenario de la piscina (en vivo):**
- Si una fase de grupos aún no tiene asignaciones de jugadores, la acción muestra **Rellenar**.
- **Rellenar** activa la asignación automática del backend en el modo EDICIÓN (equilibrado por niveles de habilidad) sin iniciar partidas.
- Una vez que existen las asignaciones, la acción muestra **Iniciar** y mueve la etapa a IN_PROGRESS.

**Actualizaciones en tiempo real:**
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

#### 3. **ObjetivosVer** (`TargetsView.tsx`)

Vista global de todos los objetivos y cola de partidos en todos los torneos.

**Responsabilidades:**
- Mostrar objetivos compartidos (agregados de múltiples torneos)
- Mostrar cola de partidos (orden inteligente)
- Asignar coincidencias a objetivos.
- Iniciar/completar partidos
- Seguimiento de la disponibilidad de objetivos

**Características clave:**
- **Objetivos compartidos**: objetivos con el mismo número de diferentes torneos mostrados juntos
- **Cola de partidos**: lista priorizada que muestra los próximos partidos por jugar
- **Bloqueo de jugadores**: evita que el mismo jugador participe en múltiples partidos simultáneos.
- **Estado objetivo**: DISPONIBLE, EN USO, MANTENIMIENTO

**Algoritmo de cola de coincidencias:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **Vista de jugadores** (`PlayersView.tsx`)

Ver todos los jugadores en todos los torneos.

**Responsabilidades:**
- Listar todos los jugadores en el sistema.
- Buscar/filtrar jugadores
- Ver detalles del jugador

#### 5. **Vista de jugadores del torneo** (`TournamentPlayersView.tsx`)

Ver jugadores para un torneo específico.

**Responsabilidades:**
- Mostrar lista de jugadores específicos del torneo
- Mostrar detalles del jugador (nombre, nivel de habilidad, estado de registro)

#### 6. **Vista de notificaciones** (`NotificationsView.tsx`)

Notificaciones de inicio de partido.

**Responsabilidades:**
- Mostrar notificaciones cuando comienzan los partidos.
- Filtrar por torneo
- Confirmar notificaciones
- Mostrar asignaciones de objetivos

**Integración de WebSocket:**
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

## Flujo de autenticación

### Autenticación opcional

La aplicación admite **autenticación opcional**: los usuarios pueden ver datos públicos sin iniciar sesión, pero deben autenticarse para las acciones administrativas.

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

### Verificación del estado del administrador

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

### Acciones protegidas

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## Gestión del Estado

### 1. Estado local (useState)

Utilizado para:
- Estado de la interfaz de usuario (modales, menús desplegables, carga)
- Entradas de formulario
- Selecciones temporales

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Estado del servidor (consulta TanStack)

Utilizado para:
- Obteniendo datos de API
- Almacenamiento en caché de respuestas
- Recuperación automática
- Actualizaciones optimistas

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. Estado del WebSocket

Utilizado para:
- Notificaciones en tiempo real
- Actualizaciones de estado de partidos
- Sincronización en vivo

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

## Estilo

### Clases de utilidad TailwindCSS

La aplicación utiliza ampliamente las clases de utilidad de Tailwind:

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

### Sistema de diseño

**Bandera:**
- `slate-950`: fondo oscuro
- `slate-900`: Fondos de tarjetas
- `slate-800`: Fronteras
- `slate-400`: texto secundario
- `white`: texto principal
- `emerald-500`: Éxito/acciones positivas
- `red-500`: Peligro/eliminar acciones
- `blue-500`: Acciones primarias

**Espaciado:**
- `p-4`, `p-6`: Relleno
- `mt-2`, `mb-4`: Márgenes
- `gap-4`: Flexiones/espacios de cuadrícula

**Fronteras:**
- `rounded-2xl`: Radio de borde grande
- `border`: borde de 1px
- `border-slate-800/60`: Bordes semitransparentes

### Diseño responsivo

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Puntos de interrupción:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Formularios y validación

### Reaccionar forma de gancho + Zod

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

## Pruebas

### Pruebas unitarias (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Pruebas E2E (Dramaturgo)

Ubicado en `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Construcción e implementación

### Desarrollo

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Construcción de producción

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Variables de entorno

Cree el archivo `.env`:

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

`VITE_AUTH0_CACHE_LOCATION` admite `memory` (recomendado) o `localstorage`.

**Nota:** Todas las variables deben tener el prefijo `VITE_` para estar expuestas al cliente.

### Implementación de Docker

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

## Mejores prácticas

1. **Tamaño del componente**: Mantenga los componentes por debajo de 300 líneas
2. **Accesorios**: use interfaces TypeScript para tipos de accesorios
3. **Estado**: Levante el estado solo cuando sea necesario
4. **Efectos**: Mantenga las dependencias de useEffect al mínimo
5. **Nombres**: utilice nombres semánticos y descriptivos
6. **Comentarios**: Documentar lógica compleja
7. **Accesibilidad**: utilice etiquetas HTML y ARIA semánticas
8. **Rendimiento**: Perfil antes de optimizar
