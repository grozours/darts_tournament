import { defineConfig } from '@playwright/test';

const FRONTEND_PORT = 3311;

export default defineConfig({
  testDir: './tests/e2e-docs',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
    cwd: '.',
    port: FRONTEND_PORT,
    reuseExistingServer: true,
  },
});
