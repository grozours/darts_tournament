import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectRoot = path.resolve(import.meta.dirname, '..');
const defaultImportPath = path.join(projectRoot, 'prisma', 'current-presets-export.json');

const resolveImportPath = () => {
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  if (!fileArg) {
    return defaultImportPath;
  }

  const filePath = fileArg.slice('--file='.length).trim();
  if (!filePath) {
    return defaultImportPath;
  }

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
};

const readImportFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Import file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(content);

  const tournamentPresets = Array.isArray(payload.tournamentPresets)
    ? payload.tournamentPresets
    : [];
  const matchFormatPresets = Array.isArray(payload.matchFormatPresets)
    ? payload.matchFormatPresets
    : [];

  return { tournamentPresets, matchFormatPresets };
};

const normalizeTournamentPreset = (preset) => ({
  name: String(preset.name ?? '').trim(),
  presetType: String(preset.presetType ?? '').trim(),
  totalParticipants: Number(preset.totalParticipants ?? 0),
  targetCount: Number(preset.targetCount ?? 0),
  templateConfig: preset.templateConfig ?? null,
  isSystem: Boolean(preset.isSystem),
});

const normalizeMatchFormatPreset = (preset) => ({
  key: String(preset.key ?? '').trim(),
  durationMinutes: Number(preset.durationMinutes ?? 0),
  segments: preset.segments ?? [],
  isSystem: Boolean(preset.isSystem),
});

const validateTournamentPreset = (preset) => {
  if (!preset.name) {
    throw new Error('Invalid tournament preset: missing name');
  }
  if (!preset.presetType) {
    throw new Error(`Invalid tournament preset (${preset.name}): missing presetType`);
  }
  if (!Number.isInteger(preset.totalParticipants) || preset.totalParticipants <= 0) {
    throw new Error(`Invalid tournament preset (${preset.name}): totalParticipants must be > 0`);
  }
  if (!Number.isInteger(preset.targetCount) || preset.targetCount <= 0) {
    throw new Error(`Invalid tournament preset (${preset.name}): targetCount must be > 0`);
  }
};

const validateMatchFormatPreset = (preset) => {
  if (!preset.key) {
    throw new Error('Invalid match format preset: missing key');
  }
  if (!Number.isInteger(preset.durationMinutes) || preset.durationMinutes <= 0) {
    throw new Error(`Invalid match format preset (${preset.key}): durationMinutes must be > 0`);
  }
  if (!Array.isArray(preset.segments) || preset.segments.length === 0) {
    throw new Error(`Invalid match format preset (${preset.key}): segments must be a non-empty array`);
  }
};

const importPresets = async ({ filePath, replace = false }) => {
  const { tournamentPresets, matchFormatPresets } = readImportFile(filePath);

  const normalizedTournamentPresets = tournamentPresets.map(normalizeTournamentPreset);
  const normalizedMatchFormatPresets = matchFormatPresets.map(normalizeMatchFormatPreset);

  for (const preset of normalizedTournamentPresets) {
    validateTournamentPreset(preset);
  }

  for (const preset of normalizedMatchFormatPresets) {
    validateMatchFormatPreset(preset);
  }

  await prisma.$transaction(async (transaction) => {
    if (replace) {
      await transaction.tournamentPreset.deleteMany();
      await transaction.matchFormatPreset.deleteMany();
    }

    for (const preset of normalizedMatchFormatPresets) {
      await transaction.matchFormatPreset.upsert({
        where: { key: preset.key },
        update: {
          durationMinutes: preset.durationMinutes,
          segments: preset.segments,
          isSystem: preset.isSystem,
        },
        create: preset,
      });
    }

    for (const preset of normalizedTournamentPresets) {
      await transaction.tournamentPreset.upsert({
        where: { name: preset.name },
        update: {
          presetType: preset.presetType,
          totalParticipants: preset.totalParticipants,
          targetCount: preset.targetCount,
          templateConfig: preset.templateConfig,
          isSystem: preset.isSystem,
        },
        create: preset,
      });
    }
  });

  console.log(`Imported ${normalizedMatchFormatPresets.length} match format presets`);
  console.log(`Imported ${normalizedTournamentPresets.length} tournament presets`);
  console.log(`Source: ${filePath}`);
  console.log(replace ? 'Mode: replace' : 'Mode: upsert');
};

try {
  const filePath = resolveImportPath();
  const replace = process.argv.includes('--replace');
  await importPresets({ filePath, replace });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
