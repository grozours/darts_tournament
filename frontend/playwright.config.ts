import { defineConfig } from '@playwright/test';

const PLAYWRIGHT_BACKEND_PORT = 3310;
const PLAYWRIGHT_FRONTEND_PORT = 3311;

const databaseUser = process.env.DATABASE_USER ?? 'darts_user';
const databasePassword = process.env.DATABASE_PASSWORD ?? '';
const databaseHost = process.env.DATABASE_HOST ?? 'localhost';
const databasePort = process.env.DATABASE_PORT ?? '5432';
const databaseName = process.env.DATABASE_NAME ?? 'darts_tournament';

const databaseCredentials = `${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@`;

const defaultDatabaseUrl = `postgresql://${databaseCredentials}${databaseHost}:${databasePort}/${databaseName}`;

function normalizePostgresUrlPassword(url: string): string {
	const userWithoutPasswordPattern = /^(postgres(?:ql)?:\/\/)([^/@:]+)@(.+)$/i;
	if (userWithoutPasswordPattern.test(url)) {
		return url.replace(userWithoutPasswordPattern, '$1$2:@$3');
	}
	return url;
}

const resolvedDatabaseUrl = normalizePostgresUrlPassword(process.env.DATABASE_URL ?? defaultDatabaseUrl);

const backendWebServerEnv = {
	...process.env,
	NODE_ENV: process.env.NODE_ENV ?? 'test',
	PORT: process.env.PORT ?? String(PLAYWRIGHT_BACKEND_PORT),
	DATABASE_URL: resolvedDatabaseUrl,
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

export default defineConfig({
	testDir: '../tests/e2e',
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
			cwd: '../backend',
			port: PLAYWRIGHT_BACKEND_PORT,
			env: backendWebServerEnv,
			reuseExistingServer: !process.env.CI,
		},
		{
			command: `npm run dev -- --host 127.0.0.1 --port ${PLAYWRIGHT_FRONTEND_PORT}`,
			cwd: '.',
			port: PLAYWRIGHT_FRONTEND_PORT,
			env: frontendWebServerEnv,
			reuseExistingServer: !process.env.CI,
		},
	],
});