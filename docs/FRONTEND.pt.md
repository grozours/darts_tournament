# ⚔️ Documentação de front-end

## Visão geral

O frontend é um aplicativo React 18 moderno desenvolvido com TypeScript, Vite e TailwindCSS. Ele fornece uma interface responsiva e em tempo real para gerenciar torneios de dardos.

---

## Pilha de tecnologia

| Tecnologia | Versão | Finalidade |
|------------|---------|---------|
| React | 18,2+ | Biblioteca de IU |
| TypeScript | 5.x | Segurança de tipo |
| Vite | 5.x | Ferramenta de construção e servidor de desenvolvimento |
| Tailwind CSS | 3.x | CSS utilitário em primeiro lugar |
| React Router DOM | 6.x | Roteamento do lado do cliente |
| Auth0 React SDK | 2.x | Autenticação |
| TanStack Query | 5.x | Gerenciamento de estado do servidor |
| React Hook Form | 7.x | Tratamento e validação de formulários |
| Zod | 3.x | Validação de esquema |
| Cliente Socket.io | 4.x | Cliente WebSocket |
| Axios | 1.x | Cliente HTTP |
| Lucide React | Mais recentes | Biblioteca de ícones |
| Vitest | 1.x | Teste de unidade |
| Playwright | Mais recentes | Teste E2E |

---

## Estrutura do Projeto

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

## Estratégia de roteamento

## Localização (i18n)

- Todas as traduções de frontend são armazenadas como dicionários TypeScript em `frontend/src/locales/*.ts`.
- `frontend/src/i18n.tsx` resolve apenas o idioma ativo e mescla dicionários.
- Ao adicionar um novo idioma ou chave, atualize o arquivo correspondente em `src/locales/`.

O aplicativo usa **roteamento baseado em parâmetros de consulta** em vez de caminhos de URL:

### Rotas

| URL | Ver | Descrição |
|-----|------|-------------|
| `/` | `TournamentList` | Gestão do torneio principal |
| `/?view=live` | `LiveTournament` | Painel do torneio ao vivo |
| `/?view=pool-stages` | `LiveTournament` | Visualização dos estágios da piscina |
| `/?view=brackets` | `LiveTournament` | Visualização de colchetes |
| `/?view=targets` | `TargetsView` | Gestão de metas |
| `/?view=players` | `PlayersView` | Todos os jogadores |
| `/?view=tournament-players` | `TournamentPlayersView` | Jogadores de torneio |
| `/?view=registration-players` | `RegistrationPlayers` | Cadastro de jogadores |
| `/?view=notifications` | `NotificationsView` | Notificações de partidas |
| `/?view=tournament-presets` | `TournamentPresetsView` | Gerenciador de predefinições (lista) |
| `/?view=tournament-preset-editor` | `TournamentPresetsView` | Editor predefinido |
| `/?view=account` | `AccountView` | Conta de usuário |
| `/?view=create-tournament` | `CreateTournamentPage` | Criar torneio |

### Parâmetros de consulta

| Parâmetro | Valores | Finalidade |
|-----------|--------|---------|
| `view` | (veja acima) | Determina qual componente renderizar |
| `status` | `DRAFT`, `OPEN`, `SIGNATURE`, `LIVE`, `FINISHED` | Filtrar torneios por status |
| `tournamentId` | UUID | Selecione torneio específico |
| `edit` | verdadeiro/falso | Habilitar modo de edição |

### URLs de exemplo

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

## Arquitetura de Componentes

### Componentes Principais

#### 1. **Lista de Torneios** (`TournamentList.tsx`)

O principal componente para gerenciamento de torneios.

**Responsabilidades:**
- Exibir todos os torneios (filtrados por status)
- Crie novos torneios
- Editar detalhes do torneio
- Gerenciar jogadores (adicionar, editar, remover, fazer check-in)
- Configurar estágios do pool
- Configurar colchetes
- Carregar logotipos de torneios
- Alterar o status do torneio

**Principais recursos:**
- Suporte a vários status (DRAFT, OPEN, SIGNATURE, LIVE, FINISHED)
- Edição embutida
- Contagens de jogadores em tempo real
- Configuração do estágio do pool com atribuições de arrastar e soltar
- Configuração de suporte com propagação automática

**Gestão Estadual:**
```typescript
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
const [players, setPlayers] = useState<TournamentPlayer[]>([]);
const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
const [brackets, setBrackets] = useState<BracketConfig[]>([]);
```

#### 2. **Torneio ao vivo** (`LiveTournament.tsx`)

Painel de torneio em tempo real para eventos ao vivo.

**Responsabilidades:**
- Exibir fases do pool ao vivo com partidas
- Exibir colchetes ao vivo
- Mostrar fila de partidas
- Atualizar status de partida
- Partidas completas com pontuações
- Suporte multi-torneio

**Modos de visualização:**
- `live`: Painel completo ao vivo
- `pool-stages`: somente estágios do pool
- `brackets`: apenas colchetes

**Comportamento de ação no palco do pool (ao vivo):**
- Se uma fase de pool ainda não tiver atribuições de jogadores, a ação mostrará **Preencher**.
- **Preencher** aciona a atribuição automática de back-end no modo EDIÇÃO (balanceado por níveis de habilidade) sem iniciar partidas.
- Assim que existirem atribuições, a ação mostra **Launch** e move o estágio para IN_PROGRESS.

**Atualizações em tempo real:**
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

#### 3. **Visualização de alvos** (`TargetsView.tsx`)

Visão global de todos os alvos e fila de partidas nos torneios.

**Responsabilidades:**
- Exibir metas compartilhadas (agregadas de vários torneios)
- Mostrar fila de partidas (ordenação inteligente)
- Atribuir correspondências aos alvos
- Iniciar/concluir partidas
- Rastreie a disponibilidade da meta

**Principais recursos:**
- **Alvos Compartilhados**: Alvos com o mesmo número de torneios diferentes mostrados juntos
- **Fila de partidas**: lista priorizada mostrando as próximas partidas a serem disputadas
- **Bloqueio de Jogador**: Impede o mesmo jogador de múltiplas partidas simultâneas
- **Status alvo**: DISPONÍVEL, EM_USE, MANUTENÇÃO

**Algoritmo da fila de correspondência:**
```typescript
// Priority order:
1. Pool matches (stage 1, then 2, etc.)
2. Bracket matches (by round)
3. Unblocked matches first
4. Sequential within pools
```

#### 4. **Visualização de jogadores** (`PlayersView.tsx`)

Veja todos os jogadores em todos os torneios.

**Responsabilidades:**
- Liste todos os jogadores do sistema
- Pesquisar/filtrar jogadores
- Ver detalhes do jogador

#### 5. **Visualização de jogadores do torneio** (`TournamentPlayersView.tsx`)

Veja os jogadores de um torneio específico.

**Responsabilidades:**
- Exibir lista de jogadores específicos do torneio
- Mostrar detalhes do jogador (nome, nível de habilidade, status de check-in)

#### 6. **Visualização de notificações** (`NotificationsView.tsx`)

Notificações de início de partida.

**Responsabilidades:**
- Exibir notificações quando as partidas começarem
- Filtrar por torneio
- Reconhecer notificações
- Mostrar atribuições de destino

**Integração WebSocket:**
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

## Fluxo de autenticação

### Autenticação Opcional

O aplicativo suporta **autenticação opcional** - os usuários podem visualizar dados públicos sem fazer login, mas devem se autenticar para ações administrativas.

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

### Verificação de status do administrador

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

### Ações protegidas

```typescript
// Example: Only admins can create tournaments
{isAdmin && (
  <button onClick={handleCreateTournament}>
    Create Tournament
  </button>
)}
```

---

## Gestão de Estado

### 1. Estado local (useState)

Usado para:
- Estado da UI (modais, menus suspensos, carregamento)
- Entradas de formulário
- Seleções temporárias

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### 2. Estado do servidor (consulta TanStack)

Usado para:
- Buscando dados da API
- Respostas em cache
- Busca automática
- Atualizações otimistas

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['tournaments'],
  queryFn: fetchTournaments,
  refetchInterval: 30000, // Refetch every 30s
  staleTime: 10000, // Consider fresh for 10s
});
```

### 3. Estado do WebSocket

Usado para:
- Notificações em tempo real
- Atualizações de status da partida
- Sincronização ao vivo

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

### Classes de utilitário TailwindCSS

O aplicativo usa extensivamente as classes utilitárias do Tailwind:

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

### Sistema de Projeto

**Cores:**
- `slate-950`: Fundo escuro
- `slate-900`: Planos de fundo do cartão
- `slate-800`: Fronteiras
- `slate-400`: Texto secundário
- `white`: Texto primário
- `emerald-500`: Sucesso/ações positivas
- `red-500`: Ações de perigo/exclusão
- `blue-500`: Ações primárias

**Espaçamento:**
- `p-4`, `p-6`: Preenchimento
- `mt-2`, `mb-4`: Margens
- `gap-4`: lacunas flexíveis/de grade

**Fronteiras:**
- `rounded-2xl`: Grande raio de borda
- `border`: borda de 1px
- `border-slate-800/60`: Bordas semitransparentes

### Design Responsivo

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards responsive grid */}
</div>
```

**Pontos de interrupção:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## Formulários e validação

### Formulário de gancho de reação + Zod

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

## Teste

### Testes unitários (Vitest)

```bash
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Testes E2E (Playwright)

Localizado em `tests/e2e/`:

```bash
npm run test:e2e         # Run E2E tests
```

---

## Construção e implantação

### Desenvolvimento

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Construção de produção

```bash
npm run build            # Build for production → dist/
npm run preview          # Preview production build
```

### Variáveis ​​de Ambiente

Crie o arquivo `.env`:

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

`VITE_AUTH0_CACHE_LOCATION` suporta `memory` (recomendado) ou `localstorage`.

**Observação:** Todas as variáveis ​​devem ser prefixadas com `VITE_` para serem expostas ao cliente.

### Implantação do Docker

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

## Melhores práticas

1. **Tamanho do componente**: Mantenha os componentes abaixo de 300 linhas
2. **Props**: Use interfaces TypeScript para tipos de prop
3. **Estado**: Levante o estado somente quando necessário
4. **Efeitos**: Mantenha as dependências de useEffect mínimas
5. **Nomeação**: use nomes descritivos e semânticos
6. **Comentários**: Documente lógica complexa
7. **Acessibilidade**: Use rótulos semânticos HTML e ARIA
8. **Desempenho**: perfil antes da otimização
