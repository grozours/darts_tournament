import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../config/environment';


type ImportPayload = {
  tournamentPresets?: unknown[];
  matchFormatPresets?: unknown[];
};

type NormalizedTournamentPreset = {
  name: string;
  presetType: string;
  totalParticipants: number;
  targetCount: number;
  templateConfig: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  isSystem: boolean;
};

type NormalizedMatchFormatPreset = {
  key: string;
  durationMinutes: number;
  segments: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
  isSystem: boolean;
};

const toPrismaJson = (value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput => (
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
);

const toPrismaNullableJson = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => (
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.prismaUrl,
    },
  },
});

export const DEFAULT_IMPORT_CANDIDATES = [
  path.resolve(process.cwd(), 'prisma', 'current-presets-export.json'),
  path.resolve(process.cwd(), 'backend', 'prisma', 'current-presets-export.json'),
];

export const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
export const asNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
export const asBoolean = (value: unknown): boolean => value === true;

export const resolveImportPath = (): string => {
  const fileArgument = process.argv.find((argument) => argument.startsWith('--file='));
  if (fileArgument) {
    const filePath = fileArgument.slice('--file='.length).trim();
    if (filePath.length > 0) {
      return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    }
  }

  for (const candidate of DEFAULT_IMPORT_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_IMPORT_CANDIDATES[0] ?? path.resolve(process.cwd(), 'prisma', 'current-presets-export.json');
};

export const readImportFile = (filePath: string): { tournamentPresets: unknown[]; matchFormatPresets: unknown[] } => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Import file not found: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(rawContent) as ImportPayload;

  return {
    tournamentPresets: Array.isArray(payload.tournamentPresets) ? payload.tournamentPresets : [],
    matchFormatPresets: Array.isArray(payload.matchFormatPresets) ? payload.matchFormatPresets : [],
  };
};

export const normalizeTournamentPreset = (value: unknown): NormalizedTournamentPreset => {
  const candidate = asObject(value);
  const templateConfig = candidate.templateConfig as Prisma.InputJsonValue | undefined;
  return {
    name: asString(candidate.name),
    presetType: asString(candidate.presetType),
    totalParticipants: asNumber(candidate.totalParticipants),
    targetCount: asNumber(candidate.targetCount),
    templateConfig: templateConfig === undefined
      ? Prisma.JsonNull
      : toPrismaNullableJson(templateConfig),
    isSystem: asBoolean(candidate.isSystem),
  };
};

export const normalizeMatchFormatPreset = (value: unknown): NormalizedMatchFormatPreset => {
  const candidate = asObject(value);
  return {
    key: asString(candidate.key),
    durationMinutes: asNumber(candidate.durationMinutes),
    segments: toPrismaJson(candidate.segments ?? []),
    isSystem: asBoolean(candidate.isSystem),
  };
};

export const validateTournamentPreset = (preset: NormalizedTournamentPreset): void => {
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

export const validateMatchFormatPreset = (preset: NormalizedMatchFormatPreset): void => {
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

export const runImport = async (filePath: string, replace: boolean): Promise<void> => {
  const { tournamentPresets, matchFormatPresets } = readImportFile(filePath);

  const normalizedTournamentPresets = tournamentPresets.map((value) => normalizeTournamentPreset(value));
  const normalizedMatchFormatPresets = matchFormatPresets.map((value) => normalizeMatchFormatPreset(value));

  for (const preset of normalizedTournamentPresets) {
    validateTournamentPreset(preset);
  }
  for (const preset of normalizedMatchFormatPresets) {
    validateMatchFormatPreset(preset);
  }

  await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
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
        create: {
          name: preset.name,
          presetType: preset.presetType,
          totalParticipants: preset.totalParticipants,
          targetCount: preset.targetCount,
          templateConfig: preset.templateConfig,
          isSystem: preset.isSystem,
        },
      });
    }
  });

  console.log(`Imported ${normalizedMatchFormatPresets.length} match format presets`);
  console.log(`Imported ${normalizedTournamentPresets.length} tournament presets`);
  console.log(`Source: ${filePath}`);
  console.log(replace ? 'Mode: replace' : 'Mode: upsert');
};

export const main = async (): Promise<void> => {
  const filePath = resolveImportPath();
  const replace = process.argv.includes('--replace');
  await runImport(filePath, replace);
};

export const executeCli = async (): Promise<void> => {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

/* istanbul ignore next */
// eslint-disable-next-line unicorn/prefer-module
if (require.main === module) {
  void executeCli();
}
