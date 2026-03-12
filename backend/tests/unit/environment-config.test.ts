import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('dotenv', () => ({
  __esModule: true,
  default: {
    config: jest.fn(),
  },
}));

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

  it('clamps and falls back numeric settings and keeps prisma url unchanged when not parseable', async () => {
    process.env.DATABASE_URL = 'not-a-valid-url';
    process.env.DB_MAX_CONNECTIONS = '-1';
    process.env.DB_POOL_TIMEOUT = 'oops';
    process.env.DB_IDLE_TIMEOUT = '0';
    process.env.DB_CONNECTION_TIMEOUT = '-50';
    process.env.DB_HEALTH_MAX_CONNECTIONS = 'NaN';
    process.env.LIVE_ENDPOINT_CACHE_TTL_SECONDS = '999';
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.AUTH_DEV_AUTOLOGIN_MODE = 'unsupported-mode';
    process.env.AUTH_DEV_AUTOLOGIN_PLAYER_EMAIL = '   ';

    const { config } = await import('../../src/config/environment');

    expect(config.database.prismaUrl).toBe('not-a-valid-url');
    expect(config.database.maxConnections).toBe(20);
    expect(config.database.poolTimeout).toBe(10_000);
    expect(config.database.idleTimeout).toBe(30_000);
    expect(config.database.connectionTimeout).toBe(2_000);
    expect(config.database.healthCheckMaxConnections).toBe(1);
    expect(config.performance.liveEndpointCacheTtlSeconds).toBe(5);
    expect(config.performance.rateLimitEnabled).toBe(false);
    expect(config.auth.devAutoLoginMode).toBeUndefined();
    expect(config.auth.devAutoLoginPlayerEmail).toBeUndefined();
  });

  it('keeps explicit prisma query params and normalizes dev auto-login fields', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?connection_limit=9&pool_timeout=7&connect_timeout=8';
    process.env.LIVE_ENDPOINT_CACHE_TTL_SECONDS = '1';
    process.env.AUTH_DEV_AUTOLOGIN_MODE = '  PLAYER  ';
    process.env.AUTH_DEV_AUTOLOGIN_PLAYER_EMAIL = ' Player@Example.com ';
    process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL = ' Admin@Example.com ';
    delete process.env.RATE_LIMIT_ENABLED;

    const { config } = await import('../../src/config/environment');
    const prismaUrl = new URL(config.database.prismaUrl);

    expect(prismaUrl.searchParams.get('connection_limit')).toBe('9');
    expect(prismaUrl.searchParams.get('pool_timeout')).toBe('7');
    expect(prismaUrl.searchParams.get('connect_timeout')).toBe('8');
    expect(config.performance.liveEndpointCacheTtlSeconds).toBe(2);
    expect(config.performance.rateLimitEnabled).toBe(true);
    expect(config.auth.devAutoLoginMode).toBe('player');
    expect(config.auth.devAutoLoginPlayerEmail).toBe('player@example.com');
    expect(config.auth.devAutoLoginAdminEmail).toBe('admin@example.com');
  });

  it('uses built-in defaults when core env vars are fully unset', async () => {
    delete process.env.APP_NAME;
    delete process.env.APP_VERSION;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.UPLOAD_DIR;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
    delete process.env.MAX_RESPONSE_TIME;
    delete process.env.CORS_ORIGINS;
    process.env.LIVE_ENDPOINT_CACHE_TTL_SECONDS = 'NaN';

    const { config } = await import('../../src/config/environment');

    expect(config.app.name).toBe('Darts Tournament Manager');
    expect(config.app.version).toBe('1.0.0');
    expect(config.port).toBe(3000);
    expect(config.env).toBe('development');
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
    expect(config.upload.directory).toBe('./uploads');
    expect(config.logging.level).toBe('info');
    expect(config.logging.format).toBe('combined');
    expect(config.performance.maxResponseTime).toBe(2000);
    expect(config.performance.liveEndpointCacheTtlSeconds).toBe(3);
    expect(config.cors.origins.length).toBeGreaterThan(0);
  });

  it('parses positive DB values and injects missing prisma query params', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.DB_MAX_CONNECTIONS = '42';
    process.env.DB_POOL_TIMEOUT = '3500';
    process.env.DB_IDLE_TIMEOUT = '7000';
    process.env.DB_CONNECTION_TIMEOUT = '9000';
    process.env.DB_HEALTH_MAX_CONNECTIONS = '3';
    process.env.AUTH_DEV_AUTOLOGIN_ENABLED = 'true';
    process.env.AUTH_DEV_AUTOLOGIN_MODE = 'anonymous';
    process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL = '   ';
    process.env.AUTH_DEV_AUTOLOGIN_PLAYER_EMAIL = '   ';

    const { config } = await import('../../src/config/environment');
    const prismaUrl = new URL(config.database.prismaUrl);

    expect(config.database.maxConnections).toBe(42);
    expect(config.database.poolTimeout).toBe(3500);
    expect(config.database.idleTimeout).toBe(7000);
    expect(config.database.connectionTimeout).toBe(9000);
    expect(config.database.healthCheckMaxConnections).toBe(3);
    expect(prismaUrl.searchParams.get('connection_limit')).toBe('42');
    expect(prismaUrl.searchParams.get('pool_timeout')).toBe('4');
    expect(prismaUrl.searchParams.get('connect_timeout')).toBe('4');
    expect(config.auth.devAutoLoginEnabled).toBe(true);
    expect(config.auth.devAutoLoginMode).toBe('anonymous');
    expect(config.auth.devAutoLoginAdminEmail).toBeUndefined();
    expect(config.auth.devAutoLoginPlayerEmail).toBeUndefined();
  });
});
