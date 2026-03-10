#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';

const countAdvanced = async () => {
  const [players, doublettes, equipes] = await Promise.all([
    prisma.player.count({ where: { skillLevel: 'ADVANCED' } }),
    prisma.doublette.count({ where: { skillLevel: 'ADVANCED' } }),
    prisma.equipe.count({ where: { skillLevel: 'ADVANCED' } }),
  ]);

  return { players, doublettes, equipes };
};

const countExpert = async () => {
  const [players, doublettes, equipes] = await Promise.all([
    prisma.player.count({ where: { skillLevel: 'EXPERT' } }),
    prisma.doublette.count({ where: { skillLevel: 'EXPERT' } }),
    prisma.equipe.count({ where: { skillLevel: 'EXPERT' } }),
  ]);

  return { players, doublettes, equipes };
};

const printCounts = (label, counts) => {
  console.log(label);
  console.table([
    { table: 'players', count: counts.players },
    { table: 'doublettes', count: counts.doublettes },
    { table: 'equipes', count: counts.equipes },
  ]);
};

const main = async () => {
  try {
    console.log(`[skill-level-migration] Mode: ${mode}`);

    const before = await countAdvanced();
    printCounts('[skill-level-migration] ADVANCED counts before:', before);

    if (mode !== 'apply') {
      console.log('[skill-level-migration] Dry-run complete. Re-run with --apply to migrate.');
      return;
    }

    await prisma.$transaction([
      prisma.player.updateMany({ where: { skillLevel: 'ADVANCED' }, data: { skillLevel: 'EXPERT' } }),
      prisma.doublette.updateMany({ where: { skillLevel: 'ADVANCED' }, data: { skillLevel: 'EXPERT' } }),
      prisma.equipe.updateMany({ where: { skillLevel: 'ADVANCED' }, data: { skillLevel: 'EXPERT' } }),
    ]);

    const afterAdvanced = await countAdvanced();
    printCounts('[skill-level-migration] ADVANCED counts after:', afterAdvanced);

    const afterExpert = await countExpert();
    printCounts('[skill-level-migration] EXPERT counts after:', afterExpert);

    console.log('[skill-level-migration] Migration completed successfully.');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('[skill-level-migration] Failed:', error);
  process.exit(1);
});
