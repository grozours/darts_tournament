import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectRoot = path.resolve(import.meta.dirname, '..');
const seedPath = path.join(projectRoot, 'prisma', 'seed.mts');
const exportPath = path.join(projectRoot, 'prisma', 'current-presets-export.json');

const indentBlock = (value, spaces) => {
  const pad = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
};

const replaceDataBlock = (seedContent, blockName, dataArray) => {
  const escapedBlockName = blockName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(
    String.raw`(${escapedBlockName}\s*=\s*await\s*prisma\.[\w.]+\.createMany\(\{\n\s*data:\s*)\[[\s\S]*?\](,\n\s*skipDuplicates:\s*true,\n\s*\}\);)`
  );
  const nextDataLiteral = indentBlock(JSON.stringify(dataArray, null, 2), 4);
  if (!pattern.test(seedContent)) {
    throw new Error(`Unable to locate data block for ${blockName}`);
  }
  return seedContent.replace(pattern, `$1${nextDataLiteral}$2`);
};

const normalizeTournamentPreset = (preset) => ({
  name: preset.name,
  presetType: preset.presetType,
  totalParticipants: preset.totalParticipants,
  targetCount: preset.targetCount,
  templateConfig: preset.templateConfig,
  isSystem: preset.isSystem,
});

const normalizeMatchFormatPreset = (preset) => ({
  key: preset.key,
  durationMinutes: preset.durationMinutes,
  segments: preset.segments,
  isSystem: preset.isSystem,
});

const syncPresetsSeed = async () => {
  const tournamentPresets = await prisma.tournamentPreset.findMany({
    orderBy: { name: 'asc' },
  });
  const matchFormatPresets = await prisma.matchFormatPreset.findMany({
    orderBy: { key: 'asc' },
  });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    tournamentPresets,
    matchFormatPresets,
  };
  fs.writeFileSync(exportPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');

  const seedContent = fs.readFileSync(seedPath, 'utf8');
  const seedWithMatchFormats = replaceDataBlock(
    seedContent,
    'const matchFormatPresets',
    matchFormatPresets.map(normalizeMatchFormatPreset)
  );
  const seedWithPresets = replaceDataBlock(
    seedWithMatchFormats,
    'const tournamentPresets',
    tournamentPresets.map(normalizeTournamentPreset)
  );

  fs.writeFileSync(seedPath, seedWithPresets, 'utf8');

  console.log(
    `Synced seed from DB: ${tournamentPresets.length} tournament presets, ${matchFormatPresets.length} match formats.`
  );
  console.log(`Updated: ${path.relative(projectRoot, exportPath)}`);
  console.log(`Updated: ${path.relative(projectRoot, seedPath)}`);
};

try {
  await syncPresetsSeed();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
