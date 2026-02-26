const backendWebServerEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  DATABASE_URL:
    process.env.DATABASE_URL
    ?? 'postgresql://darts_user:darts_password@localhost:5432/darts_tournament',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:3001',
  AUTH_ENABLED: process.env.AUTH_ENABLED ?? 'false',
};

export default {
  testDir: './tests/e2e',
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
      cwd: './backend',
      port: 3000,
      env: backendWebServerEnv,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      cwd: './frontend',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
};