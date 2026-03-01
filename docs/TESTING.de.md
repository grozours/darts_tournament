# 🧪 Dokumentation testen

## Übersicht

Der Darts Tournament Manager verwendet eine umfassende Teststrategie, einschließlich Unit-Tests, Integrationstests, Vertragstests und End-to-End-Tests.

---

## Inhaltsverzeichnis

- [Teststrategie](#teststrategie)
- [Backend-Tests](#backend-tests)
- [Frontend-Tests](#frontend-tests)
- [End-to-End-Tests](#end-to-end-tests)
- [Testabdeckung](#testabdeckung)
- [CI/CD-Integration](#cicd-integration)
- [Bewährte Praktiken](#bewährte-praktiken)

---

## Teststrategie

### Testpyramide

```
          /\
         /  \     E2E Tests (Playwright)
        /____\    - Critical user flows
       /      \   - Cross-browser testing
      /        \
     /__________\ Integration Tests (Jest)
    /            \ - API endpoints with database
   /              \ - Service layer with dependencies
  /________________\
 /                  \ Unit Tests (Jest/Vitest)
/____________________\ - Pure functions, utilities
                       - Components, hooks
                       - Services, models
```

### Testtypen

| Typ | Framework | Geltungsbereich | Geschwindigkeit | Abdeckung |
|------|-----------|-------|-------|----------|
| **Einheit** | Jest/Vitest | Einzelne Funktionen/Komponenten | Schnell | Hoch |
| **Integration** | Jest + Prisma | Mehrere Komponenten arbeiten zusammen | Mittel | Mittel |
| **Vertrag** | Supertest | API-Verträge und -Antworten | Schnell | Mittel |
| **E2E** | Playwright | Vollständige Benutzerworkflows | Langsam | Niedrig |

---

## Backend-Tests

### Aufstellen

```bash
cd backend
npm install
npm test
```

### Teststruktur

```
backend/tests/
├── unit/                    # Unit tests
│   ├── services/
│   ├── utils/
│   └── helpers/
│
├── integration/             # Integration tests
│   ├── tournament.test.ts
│   ├── player-registration.test.ts
│   ├── pool-stage-bracket.test.ts
│   └── person-linking.test.ts
│
├── contract/                # API contract tests
│   ├── tournament.test.ts
│   └── tournament-logo.test.ts
│
├── fixtures/                # Test fixtures & helpers
│   └── uuid.ts
│
├── setup.ts                 # Global test setup
└── teardown.ts              # Global test teardown
```

### Jest-Konfiguration (`jest.config.js`)

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

### Unit-Tests

#### Beispiel: Service-Unit-Test

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

### Integrationstests

Integrationstests verwenden eine Testdatenbank und testen echte Datenbankinteraktionen.

#### Datenbank-Setup testen

```bash
# Create test database (docker-compose includes this)
docker compose up -d postgres_test

# Environment variable for tests
DATABASE_URL="postgresql://test:testpassword@localhost:5433/darts_tournament_test"
```

#### Beispiel: Integrationstest

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

### Vertragstests

Vertragstests überprüfen die API-Antwortstruktur und Datentypen.

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

### Ausführen von Backend-Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tournament.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run integration tests only
npm test -- --testPathPattern=integration

# Run unit tests only
npm test -- --testPathPattern=unit
```

---

## Frontend-Tests

### Aufstellen

```bash
cd frontend
npm install
npm test
```

### Teststruktur

```
frontend/tests/
├── unit/                    # Vitest unit tests
│   ├── components/
│   ├── hooks/
│   └── utils/
│
└── e2e/                     # Playwright E2E tests
    ├── players-view.spec.ts
    ├── pool-stages-view.spec.ts
    └── targets-view.spec.ts
```

### Vitest-Konfiguration (`vitest.config.ts`)

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

### Unit-Tests (Vitest)

#### Beispiel: Komponententest

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

#### Beispiel: Hook-Test

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

### Ausführen von Frontend-Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch
```

---

## End-to-End-Tests

### Playwright-Konfiguration

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

### E2E-Testbeispiele

#### Beispiel: Players View Test

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

#### Beispiel: Pool-Stufentest

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

### Ausführen von E2E-Tests

```bash
# Install Playwright browsers
npm --prefix frontend exec -- playwright install

# Run all E2E tests
npm --prefix frontend run test:e2e

# Run specific browser
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --project=chromium

# Run in headed mode (see browser)
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --headed

# Debug mode
npm --prefix frontend exec -- playwright test -c ./frontend/playwright.config.ts --debug

# Generate test report
npm --prefix frontend exec -- playwright show-report
```

---

## Testabdeckung

### Messung der Abdeckung

#### Backend

```bash
cd backend
npm run test:coverage
```

**Abdeckungsbericht:**
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

### Abdeckungsziele

| Geben Sie | ein Ziel | Aktuell |
|------|--------|---------|
| Aussagen | 80 % | 78,5 % |
| Zweige | 75 % | 72,3 % |
| Funktionen | 80 % | 80,1 % |
| Linien | 80 % | 78,2 % |

---

## CI/CD-Integration

### GitHub-Aktionsworkflow

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

## Bewährte Praktiken

### 1. Benennung testen

```typescript
// Good
describe('TournamentService.createTournament', () => {
  it('should create tournament with valid data', () => {});
  it('should throw error for invalid date range', () => {});
  it('should require admin authentication', () => {});
});

// Bad
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

### 3. Testen Sie Datenfabriken

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

### 4. Aufräumen

```typescript
afterEach(async () => {
  // Clean up database
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 5. Externe Abhängigkeiten verspotten

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

### 6. Testen Sie die Isolation

- Jeder Test sollte unabhängig sein
- Verlassen Sie sich nicht auf die Reihenfolge der Testausführung
- Nach jedem Test aufräumen
- Verwenden Sie Transaktionen für Datenbanktests

### 7. Aussagekräftige Behauptungen

```typescript
// Good
expect(tournament.name).toBe('Spring Championship');
expect(tournament.status).toBe('DRAFT');
expect(tournament.totalParticipants).toBeGreaterThan(0);

// Bad
expect(tournament).toBeTruthy();
expect(result).toBeDefined();
```

---

## Fehlerbehebungstests

### Häufige Probleme

#### 1. Test-Timeout

```typescript
// Increase timeout for slow tests
it('should complete large operation', async () => {
  // ...
}, 10000); // 10 seconds
```

#### 2. Asynchrone Probleme

```typescript
// Use async/await
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// Or use done callback
it('should call callback', (done) => {
  fetchData((result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

#### 3. Probleme mit der Datenbankverbindung

```bash
# Ensure test database is running
docker compose up -d postgres_test

# Reset test database
cd backend
npm run db:reset:test
```

---

## Ressourcen

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
