import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectRoot = path.resolve(import.meta.dirname, '..');
const seedSnapshotPath = path.join(projectRoot, 'prisma', 'current-seed-export.json');
const presetsExportPath = path.join(projectRoot, 'prisma', 'current-presets-export.json');

const readJsonFile = (filePath, fallbackValue) => {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  fs.writeFileSync(presetsExportPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');

  const existingSeedSnapshot = readJsonFile(seedSnapshotPath, {
    exportedAt: exportPayload.exportedAt,
    matchFormatPresets: [],
    tournamentPresets: [],
    tournaments: [],
    targets: [],
    players: [],
    doublettes: [],
    doubletteMembers: [],
  });

  const updatedSeedSnapshot = {
    ...existingSeedSnapshot,
    exportedAt: exportPayload.exportedAt,
    matchFormatPresets: matchFormatPresets.map(normalizeMatchFormatPreset),
    tournamentPresets: tournamentPresets.map(normalizeTournamentPreset),
  };

  fs.writeFileSync(seedSnapshotPath, `${JSON.stringify(updatedSeedSnapshot, null, 2)}\n`, 'utf8');

  console.log(
    `Synced seed from DB: ${tournamentPresets.length} tournament presets, ${matchFormatPresets.length} match formats.`
  );
  console.log(`Updated: ${path.relative(projectRoot, presetsExportPath)}`);
  console.log(`Updated: ${path.relative(projectRoot, seedSnapshotPath)}`);
};

try {
  await syncPresetsSeed();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
