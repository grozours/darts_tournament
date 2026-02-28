import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

const vitestArgs = [
  '--max-old-space-size=8192',
  './node_modules/vitest/vitest.mjs',
  'run',
  'tests/unit',
  '--coverage',
  ...process.argv.slice(2),
];

const coverageRun = spawnSync(process.execPath, vitestArgs, {
  cwd: frontendRoot,
  stdio: 'inherit',
});

if ((coverageRun.status ?? 1) !== 0) {
  process.exit(coverageRun.status ?? 1);
}

const checkRun = spawnSync(process.execPath, ['./scripts/check-coverage-thresholds.mjs'], {
  cwd: frontendRoot,
  stdio: 'inherit',
});

process.exit(checkRun.status ?? 1);
