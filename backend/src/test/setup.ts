// Backend test setup for Jest
import 'reflect-metadata';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config({ path: '.env' });

// Global test configuration
process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';
process.env.AUTH_ISSUER_BASE_URL = '';
process.env.AUTH_AUDIENCE = '';

// Only set defaults if not already defined
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/darts_tournament';
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

// Global test timeout
jest.setTimeout(30000);

// Setup global mocks if needed
beforeAll(async () => {
  // Database setup for integration tests
});

afterAll(async () => {
  // Cleanup handled in Jest globalTeardown.
});
