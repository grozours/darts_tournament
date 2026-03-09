#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, [
  './node_modules/typescript/bin/tsc',
  'prisma/seed.mts',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  '--target',
  'ES2022',
  '--outDir',
  '.tmp-seed',
  '--esModuleInterop',
  '--skipLibCheck',
]);

run(process.execPath, ['.tmp-seed/seed.mjs']);
