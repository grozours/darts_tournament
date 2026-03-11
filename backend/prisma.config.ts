import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  seed: 'node scripts/run-seed.cjs',
});
