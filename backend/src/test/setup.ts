// Backend test setup for Jest
import 'reflect-metadata';

// Global test configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/darts_tournament_test';
process.env.REDIS_URL = 'redis://localhost:6380';

// Global test timeout
jest.setTimeout(30000);

// Setup global mocks if needed
beforeAll(async () => {
  // Database setup for integration tests
});

afterAll(async () => {
  // Cleanup
});