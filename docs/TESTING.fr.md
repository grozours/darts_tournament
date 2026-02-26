# 🧪 Documentation des tests

## Vue d’ensemble

Le Gestionnaire de Tournois de Fléchettes utilise une stratégie de tests complète : tests unitaires, intégration, contrat et end-to-end.

---

## Table des matières

- [Stratégie de tests](#stratégie-de-tests)
- [Tests backend](#tests-backend)
- [Tests frontend](#tests-frontend)
- [Tests end-to-end](#tests-end-to-end)
- [Couverture de tests](#couverture-de-tests)
- [Intégration CI/CD](#intégration-cicd)
- [Bonnes pratiques](#bonnes-pratiques)

---

## Stratégie de tests

### Pyramide de tests

```
          /\
         /  \     Tests E2E (Playwright)
        /____\    - Parcours critiques
       /      \   - Tests multi-navigateurs
      /        \
     /__________\ Tests d’intégration (Jest)
    /            \ - Endpoints API avec DB
   /              \ - Services avec dépendances
  /________________\
 /                  \ Tests unitaires (Jest/Vitest)
/____________________\ - Fonctions pures, utilitaires
                       - Composants, hooks
                       - Services, models
```

### Types de tests

| Type | Framework | Portée | Vitesse | Couverture |
|------|-----------|--------|---------|-----------|
| **Unitaire** | Jest/Vitest | Fonctions/composants | Rapide | Élevée |
| **Intégration** | Jest + Prisma | Composants intégrés | Moyen | Moyenne |
| **Contrat** | Jest | Contrats et réponses API | Rapide | Moyenne |
| **E2E** | Playwright | Parcours utilisateur | Lent | Faible |

---

## Tests backend

### Setup

```bash
cd backend
npm install
npm test
```

### Structure des tests

```
backend/tests/
├── unit/                    # Tests unitaires
│   ├── services/
│   ├── utils/
│   └── helpers/
│
├── integration/             # Tests d’intégration
│   ├── tournament.test.ts
│   ├── player-registration.test.ts
│   ├── pool-stage-bracket.test.ts
│   └── person-linking.test.ts
│
├── contract/                # Tests de contrat API
│   ├── tournament.test.ts
│   └── tournament-logo.test.ts
│
├── fixtures/                # Fixtures & helpers
│   └── uuid.ts
│
├── setup.ts                 # Setup global
└── teardown.ts              # Teardown global
```

### Configuration Jest (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globalTeardown: '<rootDir>/tests/teardown.ts',
};
```

### Tests unitaires

#### Exemple : test de service

```typescript
// backend/tests/unit/services/TournamentService.test.ts
import { TournamentService } from '../../../src/services/TournamentService';
import { TournamentModel } from '../../../src/models/TournamentModel';

jest.mock('../../../src/models/TournamentModel');

describe('TournamentService', () => {
  let service: TournamentService;
  let model: jest.Mocked<TournamentModel>;

  beforeEach(() => {
    model = new TournamentModel(prisma) as jest.Mocked<TournamentModel>;
    service = new TournamentService(model);
  });

  describe('createTournament', () => {
    it('should create tournament with valid data', async () => {
      const input = {
        name: 'Spring Championship',
        format: 'SINGLE',
        durationType: 'FULL_DAY',
        startTime: new Date('2026-04-15T09:00:00Z'),
        endTime: new Date('2026-04-15T18:00:00Z'),
        totalParticipants: 16,
        targetCount: 4,
      };

      model.createTournament.mockResolvedValue({
        id: 'uuid',
        ...input,
        status: 'DRAFT',
        createdAt: new Date(),
      });

      const result = await service.createTournament(input);

      expect(result).toBeDefined();
      expect(result.name).toBe('Spring Championship');
      expect(model.createTournament).toHaveBeenCalledWith(input);
    });

    it('should throw error for invalid date range', async () => {
      const input = {
        name: 'Invalid Tournament',
        format: 'SINGLE',
        durationType: 'FULL_DAY',
        startTime: new Date('2026-04-15T18:00:00Z'),
        endTime: new Date('2026-04-15T09:00:00Z'), // Before start
        totalParticipants: 16,
        targetCount: 4,
      };

      await expect(service.createTournament(input))
        .rejects
        .toThrow('End time must be after start time');
    });
  });
});
```

### Tests d’intégration

Les tests d’intégration utilisent une DB de test.

#### Setup DB de test

```bash
# Créer la DB de test (docker-compose inclut ce service)
docker compose up -d postgres_test

# Variable d’environnement de test
DATABASE_URL="postgresql://test:testpassword@localhost:5433/darts_tournament_test"
```

#### Exemple : test d’intégration

```typescript
// backend/tests/integration/tournament.test.ts
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../../src/app';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL,
    },
  },
});

describe('Tournament API Integration', () => {
  beforeAll(async () => {
    // Run migrations on test database
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
    // Run migrations (via npm run db:migrate:test)
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.tournament.deleteMany();
  });

  describe('POST /api/tournaments', () => {
    it('should create tournament with valid data', async () => {
      const response = await request(app)
        .post('/api/tournaments')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          name: 'Spring Championship',
          format: 'SINGLE',
          durationType: 'FULL_DAY',
          startTime: '2026-04-15T09:00:00Z',
          endTime: '2026-04-15T18:00:00Z',
          totalParticipants: 16,
          targetCount: 4,
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Spring Championship');
      expect(response.body.id).toBeDefined();

      // Verify in database
      const tournament = await prisma.tournament.findUnique({
        where: { id: response.body.id },
      });
      expect(tournament).toBeDefined();
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/tournaments')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          name: 'A', // Too short
          format: 'INVALID',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/tournaments/:id', () => {
    it('should return tournament by ID', async () => {
      const created = await prisma.tournament.create({
        data: {
          name: 'Test Tournament',
          format: 'SINGLE',
          durationType: 'FULL_DAY',
          startTime: new Date('2026-04-15T09:00:00Z'),
          endTime: new Date('2026-04-15T18:00:00Z'),
          totalParticipants: 16,
          targetCount: 4,
          status: 'DRAFT',
        },
      });

      const response = await request(app)
        .get(`/api/tournaments/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
      expect(response.body.name).toBe('Test Tournament');
    });

    it('should return 404 for non-existent tournament', async () => {
      const response = await request(app)
        .get('/api/tournaments/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });
});
```

### Tests de contrat

Les tests de contrat vérifient la structure des réponses.

```typescript
// backend/tests/contract/tournament.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('Tournament API Contract', () => {
  describe('GET /api/tournaments', () => {
    it('should return tournaments with correct structure', async () => {
      const response = await request(app)
        .get('/api/tournaments');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tournaments');
      expect(response.body).toHaveProperty('pagination');
      
      if (response.body.tournaments.length > 0) {
        const tournament = response.body.tournaments[0];
        
        // Verify structure
        expect(tournament).toHaveProperty('id');
        expect(tournament).toHaveProperty('name');
        expect(tournament).toHaveProperty('format');
        expect(tournament).toHaveProperty('status');
        expect(tournament).toHaveProperty('startTime');
        expect(tournament).toHaveProperty('endTime');
        
        // Verify types
        expect(typeof tournament.id).toBe('string');
        expect(typeof tournament.name).toBe('string');
        expect(['SINGLE', 'DOUBLE', 'TEAM_4_PLAYER']).toContain(tournament.format);
        expect(['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'])
          .toContain(tournament.status);
      }
      
      // Verify pagination structure
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(typeof response.body.pagination.total).toBe('number');
    });
  });
});
```

### Lancer les tests backend

```bash
# Lancer tous les tests
npm test

# Fichier spécifique
npm test -- tournament.test.ts

# Couverture
npm run test:coverage

# Mode watch
npm run test:watch

# Tests d’intégration uniquement
npm test -- --testPathPattern=integration

# Tests unitaires uniquement
npm test -- --testPathPattern=unit
```

---

## Tests frontend

### Setup

```bash
cd frontend
npm install
npm test
```

### Structure des tests

```
frontend/tests/
├── unit/                    # Tests unitaires Vitest
│   ├── components/
│   ├── hooks/
│   └── utils/
│
└── e2e/                     # Tests E2E Playwright
    ├── players-view.spec.ts
    ├── pool-stages-view.spec.ts
    └── targets-view.spec.ts
```

### Configuration Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
});
```

### Tests unitaires (Vitest)

#### Exemple : test de composant

```typescript
// frontend/tests/unit/components/TournamentCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TournamentCard from '../../../src/components/TournamentCard';

describe('TournamentCard', () => {
  const mockTournament = {
    id: '123',
    name: 'Spring Championship',
    format: 'SINGLE',
    status: 'DRAFT',
    startTime: '2026-04-15T09:00:00Z',
    endTime: '2026-04-15T18:00:00Z',
    totalParticipants: 16,
    targetCount: 4,
  };

  it('renders tournament name', () => {
    render(<TournamentCard tournament={mockTournament} />);
    expect(screen.getByText('Spring Championship')).toBeInTheDocument();
  });

  it('displays format and status', () => {
    render(<TournamentCard tournament={mockTournament} />);
    expect(screen.getByText(/SINGLE/i)).toBeInTheDocument();
    expect(screen.getByText(/DRAFT/i)).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    render(<TournamentCard tournament={mockTournament} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### Exemple : test de hook

```typescript
// frontend/tests/unit/hooks/useAdminStatus.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAdminStatus } from '../../../src/auth/useAdminStatus';

global.fetch = vi.fn();

describe('useAdminStatus', () => {
  it('returns admin status from API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isAdmin: true }),
    });

    const { result } = renderHook(() => useAdminStatus());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });
  });

  it('handles API error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useAdminStatus());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(false);
    });
  });
});
```

### Lancer les tests frontend

```bash
# Lancer tous les tests
npm test

# UI
npm run test:ui

# Couverture
npm run test:coverage

# Mode watch
npm test -- --watch
```

---

## Tests end-to-end

### Configuration Playwright

```typescript
// frontend/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      cwd: '.',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

### Exemples de tests E2E

#### Exemple : Vue joueurs

```typescript
// tests/e2e/players-view.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Players View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=players');
  });

  test('should display players list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Players');
    
    // Wait for players to load
    await page.waitForSelector('[data-testid="player-card"]');
    
    const playerCards = page.locator('[data-testid="player-card"]');
    await expect(playerCards).toHaveCountGreaterThan(0);
  });

  test('should search players', async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', 'John');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    const results = page.locator('[data-testid="player-card"]');
    const firstResult = results.first();
    
    await expect(firstResult).toContainText('John');
  });
});
```

#### Exemple : Vue phases de poules

```typescript
// tests/e2e/pool-stages-view.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Pool Stages View', () => {
  test('should display pool stages for tournament', async ({ page }) => {
    // Assume tournament already exists
    await page.goto('/?view=pool-stages&tournamentId=test-id');
    
    await expect(page.locator('h1')).toContainText('Pool Stages');
    
    // Check for pool stages
    const stages = page.locator('[data-testid="pool-stage"]');
    await expect(stages).toHaveCountGreaterThan(0);
  });

  test('should allow admin to create pool stage', async ({ page }) => {
    // Login as admin (you'd need to implement this)
    await page.goto('/?view=pool-stages&tournamentId=test-id');
    
    // Click create button
    await page.click('button:has-text("Create Pool Stage")');
    
    // Fill form
    await page.fill('input[name="name"]', 'Group Stage');
    await page.fill('input[name="poolCount"]', '4');
    await page.fill('input[name="playersPerPool"]', '4');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify creation
    await expect(page.locator('text=Group Stage')).toBeVisible();
  });
});
```

### Lancer les tests E2E

```bash
# Installer les navigateurs Playwright
npm --prefix frontend exec -- playwright install

# Lancer tous les tests E2E
npm --prefix frontend run test:e2e

# Navigateur spécifique
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --project=chromium

# Mode headed
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --headed

# Mode debug
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --debug

# Générer le rapport
npm --prefix frontend exec -- playwright show-report
```

---

## Couverture de tests

### Mesurer la couverture

#### Backend

```bash
cd backend
npm run test:coverage
```

**Rapport de couverture :**
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   78.5  |   72.3   |   80.1  |   78.2  |
 controllers/       |   82.1  |   75.4   |   85.3  |   81.9  |
 services/          |   88.7  |   82.1   |   91.2  |   88.5  |
 models/            |   75.3  |   68.7   |   77.9  |   75.1  |
 utils/             |   65.2  |   58.3   |   70.1  |   64.8  |
--------------------|---------|----------|---------|---------|
```

#### Frontend

```bash
cd frontend
npm run test:coverage
```

### Objectifs de couverture

| Type | Cible | Actuel |
|------|-------|--------|
| Statements | 80% | 78.5% |
| Branches | 75% | 72.3% |
| Functions | 80% | 80.1% |
| Lines | 80% | 78.2% |

---

## Intégration CI/CD

### Workflow GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        working-directory: backend
        run: npm ci
      
      - name: Run migrations
        working-directory: backend
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
      
      - name: Run tests
        working-directory: backend
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      
      - name: Run tests
        working-directory: frontend
        run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm --prefix frontend ci
      
      - name: Install Playwright
        run: npm --prefix frontend exec -- playwright install --with-deps
      
      - name: Run E2E tests
        run: npm --prefix frontend run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Bonnes pratiques

### 1. Nommage des tests

```typescript
// Bien
describe('TournamentService.createTournament', () => {
  it('should create tournament with valid data', () => {});
  it('should throw error for invalid date range', () => {});
  it('should require admin authentication', () => {});
});

// Mauvais
describe('Tournament', () => {
  it('works', () => {});
  it('test2', () => {});
});
```

### 2. Arrange-Act-Assert (AAA)

```typescript
it('should update tournament name', async () => {
  // Arrange
  const tournament = await createTestTournament();
  const newName = 'Updated Name';
  
  // Act
  const result = await service.updateTournament(tournament.id, { name: newName });
  
  // Assert
  expect(result.name).toBe(newName);
});
```

### 3. Factories de données

```typescript
// tests/fixtures/factories.ts
export const createTestTournament = (overrides = {}) => ({
  name: 'Test Tournament',
  format: 'SINGLE',
  durationType: 'FULL_DAY',
  startTime: new Date('2026-04-15T09:00:00Z'),
  endTime: new Date('2026-04-15T18:00:00Z'),
  totalParticipants: 16,
  targetCount: 4,
  ...overrides,
});

export const createTestPlayer = (overrides = {}) => ({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  skillLevel: 'INTERMEDIATE',
  ...overrides,
});
```

### 4. Nettoyage

```typescript
afterEach(async () => {
  // Nettoyer la DB
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 5. Mock des dépendances externes

```typescript
// Mock Auth0
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: { email: 'admin@example.com' },
    getAccessTokenSilently: jest.fn(() => 'mock-token'),
  }),
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  })
);
```

### 6. Isolation des tests

- Chaque test doit être indépendant
- Ne pas dépendre de l’ordre d’exécution
- Nettoyer après chaque test
- Utiliser des transactions pour les tests DB

### 7. Assertions significatives

```typescript
// Bien
expect(tournament.name).toBe('Spring Championship');
expect(tournament.status).toBe('DRAFT');
expect(tournament.totalParticipants).toBeGreaterThan(0);

// Mauvais
expect(tournament).toBeTruthy();
expect(result).toBeDefined();
```

---

## Dépannage des tests

### Problèmes courants

#### 1. Timeout de test

```typescript
// Augmenter le timeout
it('should complete large operation', async () => {
  // ...
}, 10000); // 10 secondes
```

#### 2. Problèmes async

```typescript
// Utiliser async/await
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// Ou callback done
it('should call callback', (done) => {
  fetchData((result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

#### 3. Problèmes DB

```bash
# S’assurer que la DB de test tourne
docker compose up -d postgres_test

# Reset DB de test
cd backend
npm run db:reset:test
```

---

## Ressources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
