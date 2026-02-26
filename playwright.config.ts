const PLAYWRIGHT_BACKEND_PORT = 3310;
const PLAYWRIGHT_FRONTEND_PORT = 3311;

const backendWebServerEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  PORT: process.env.PORT ?? String(PLAYWRIGHT_BACKEND_PORT),
  DATABASE_URL:
    process.env.DATABASE_URL
    ?? 'postgresql://darts_user:darts_password@localhost:5432/darts_tournament',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? `http://localhost:${PLAYWRIGHT_FRONTEND_PORT}`,
  AUTH_ENABLED: process.env.AUTH_ENABLED ?? 'false',
};

const frontendWebServerEnv = {
  ...process.env,
  VITE_API_PROXY_TARGET:
    process.env.VITE_API_PROXY_TARGET ?? `http://localhost:${PLAYWRIGHT_BACKEND_PORT}`,
};

export default {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PLAYWRIGHT_FRONTEND_PORT}`,
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
      cwd: './backend',
      port: PLAYWRIGHT_BACKEND_PORT,
      env: backendWebServerEnv,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${PLAYWRIGHT_FRONTEND_PORT}`,
      cwd: './frontend',
      port: PLAYWRIGHT_FRONTEND_PORT,
      env: frontendWebServerEnv,
      reuseExistingServer: !process.env.CI,
    },
  ],
};