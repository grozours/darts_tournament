import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const REDIS_TEST_SECRET = ['cache', '-', 'token'].join('');

describe('environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test/test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads defaults when optional env vars are missing', async () => {
    process.env.AUTH_ENABLED = 'false';
    delete process.env.REDIS_PASSWORD;
    delete process.env.CORS_ORIGINS;
    process.env.AUTH_ISSUER_BASE_URL = '';
    process.env.AUTH_AUDIENCE = '';
    process.env.AUTH_ADMIN_EMAILS = '';
    delete process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { config } = await import('../../src/config/environment');

    expect(config.redis.password).toBeUndefined();
    expect(config.cors.origins.length).toBeGreaterThan(0);
    expect(config.auth.enabled).toBe(false);
    expect(config.auth.adminEmails).toEqual([]);
    expect(config.auth.enabled).toBe(false);

    warnSpy.mockRestore();
  });

  it('parses configured values and enables auth when fully configured', async () => {
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'development';
    process.env.DB_SSL = 'true';
    process.env.REDIS_PASSWORD = REDIS_TEST_SECRET;
    process.env.CORS_ORIGINS = 'https://a.example.com,https://b.example.com';
    process.env.UPLOAD_DIR = '/tmp/uploads';
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_FORMAT = 'json';
    process.env.MAX_RESPONSE_TIME = '1500';
    process.env.ENABLE_METRICS = 'true';
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_ISSUER_BASE_URL = 'https://issuer.example.com';
    process.env.AUTH_AUDIENCE = 'api://aud';
    process.env.AUTH_ADMIN_EMAILS = 'Admin@Example.com, second@example.com ';
    process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL = ' Admin@Example.com ';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { config } = await import('../../src/config/environment');

    expect(config.port).toBe(4000);
    expect(config.isDevelopment).toBe(true);
    expect(config.database.ssl).toBe(true);
    expect(config.redis.password).toBe(REDIS_TEST_SECRET);
    expect(config.cors.origins).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(config.upload.directory).toBe('/tmp/uploads');
    expect(config.logging.level).toBe('debug');
    expect(config.logging.format).toBe('json');
    expect(config.performance.maxResponseTime).toBe(1500);
    expect(config.performance.enableMetrics).toBe(true);
    expect(config.auth.enabled).toBe(true);
    expect(config.auth.adminEmails).toEqual(['admin@example.com', 'second@example.com']);
    expect(config.auth.devAutoLoginAdminEmail).toBe('admin@example.com');
    expect(config.auth.enabled).toBe(true);

    warnSpy.mockRestore();
  });

  it('keeps auth disabled when required auth fields are missing', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_ISSUER_BASE_URL = '';
    process.env.AUTH_AUDIENCE = 'api://aud';

    const { config } = await import('../../src/config/environment');

    expect(config.auth.enabled).toBe(false);
  });

  it('throws when DATABASE_URL is empty', async () => {
    process.env.DATABASE_URL = '';

    await expect(import('../../src/config/environment')).rejects.toThrow(
      'DATABASE_URL environment variable is required'
    );
  });
});
