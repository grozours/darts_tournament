import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const transactionMock = {
  tournamentPreset: {
    deleteMany: jest.fn(async () => undefined),
    upsert: jest.fn(async () => undefined),
  },
  matchFormatPreset: {
    deleteMany: jest.fn(async () => undefined),
    upsert: jest.fn(async () => undefined),
  },
};

const prismaMock = {
  $transaction: jest.fn(async (callback: (tx: typeof transactionMock) => Promise<void>) => callback(transactionMock)),
  $disconnect: jest.fn(async () => undefined),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  Prisma: {
    JsonNull: 'JSON_NULL_SENTINEL',
  },
}));

jest.mock('../../src/config/environment', () => ({
  config: {
    database: {
      prismaUrl: 'postgresql://test-db',
    },
  },
}));

import {
  asBoolean,
  asNumber,
  asObject,
  asString,
  DEFAULT_IMPORT_CANDIDATES,
  executeCli,
  main,
  normalizeMatchFormatPreset,
  normalizeTournamentPreset,
  readImportFile,
  resolveImportPath,
  runImport,
  validateMatchFormatPreset,
  validateTournamentPreset,
} from '../../src/scripts/import-presets';

describe('import-presets script', () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = originalArgv.slice(0, 2);
    process.exitCode = 0;
  });

  afterAll(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
  });

  it('covers primitive coercion helpers', () => {
    expect(asObject(null)).toEqual({});
    expect(asObject([])).toEqual({});
    expect(asObject({ a: 1 })).toEqual({ a: 1 });

    expect(asString('  BO3  ')).toBe('BO3');
    expect(asString(12)).toBe('');

    expect(asNumber('42')).toBe(42);
    expect(asNumber(7)).toBe(7);

    expect(asBoolean(true)).toBe(true);
    expect(asBoolean('true')).toBe(false);
  });

  it('resolves import path from argv and default candidates', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    process.argv = [...originalArgv.slice(0, 2), '--file=/tmp/custom.json'];
    expect(resolveImportPath()).toBe('/tmp/custom.json');

    process.argv = [...originalArgv.slice(0, 2), '--file=./relative.json'];
    expect(resolveImportPath()).toBe(path.resolve(process.cwd(), 'relative.json'));

    process.argv = [...originalArgv.slice(0, 2), '--file=   '];
    existsSpy.mockImplementation((candidate: fs.PathLike) => String(candidate).includes('/backend/prisma/current-presets-export.json'));
    expect(resolveImportPath()).toBe(path.resolve(process.cwd(), 'prisma', 'current-presets-export.json'));

    const defaultsSnapshot = [...DEFAULT_IMPORT_CANDIDATES];
    DEFAULT_IMPORT_CANDIDATES.length = 0;
    existsSpy.mockReturnValue(false);
    expect(resolveImportPath()).toBe(path.resolve(process.cwd(), 'prisma', 'current-presets-export.json'));
    DEFAULT_IMPORT_CANDIDATES.push(...defaultsSnapshot);

    existsSpy.mockReturnValue(false);
    expect(resolveImportPath()).toBe(path.resolve(process.cwd(), 'prisma', 'current-presets-export.json'));
  });

  it('reads import file and falls back to empty arrays', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{"tournamentPresets":{},"matchFormatPresets":null}' as never);

    expect(readImportFile('/tmp/presets.json')).toEqual({
      tournamentPresets: [],
      matchFormatPresets: [],
    });

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => readImportFile('/tmp/missing.json')).toThrow('Import file not found: /tmp/missing.json');
  });

  it('normalizes and validates presets including failure branches', () => {
    expect(normalizeTournamentPreset({
      name: 'Preset A',
      presetType: 'custom',
      totalParticipants: '16',
      targetCount: '4',
      templateConfig: null,
      isSystem: true,
    })).toEqual({
      name: 'Preset A',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: 'JSON_NULL_SENTINEL',
      isSystem: true,
    });

    expect(normalizeMatchFormatPreset({
      key: 'BO3',
      durationMinutes: '20',
      segments: [{ game: '501_DO', targetCount: 2 }],
      isSystem: false,
    })).toEqual({
      key: 'BO3',
      durationMinutes: 20,
      segments: [{ game: '501_DO', targetCount: 2 }],
      isSystem: false,
    });

    expect(normalizeTournamentPreset({
      name: 'Preset B',
      presetType: 'custom',
      totalParticipants: 8,
      targetCount: 2,
      isSystem: false,
    }).templateConfig).toBe('JSON_NULL_SENTINEL');

    expect(normalizeMatchFormatPreset({
      key: 'BO1',
      durationMinutes: 10,
      isSystem: false,
    }).segments).toEqual([]);

    expect(() => validateTournamentPreset({
      name: '',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: 'JSON_NULL_SENTINEL' as never,
      isSystem: false,
    })).toThrow('Invalid tournament preset: missing name');

    expect(() => validateTournamentPreset({
      name: 'Preset A',
      presetType: '',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: 'JSON_NULL_SENTINEL' as never,
      isSystem: false,
    })).toThrow('missing presetType');

    expect(() => validateTournamentPreset({
      name: 'Preset A',
      presetType: 'custom',
      totalParticipants: 0,
      targetCount: 4,
      templateConfig: 'JSON_NULL_SENTINEL' as never,
      isSystem: false,
    })).toThrow('totalParticipants must be > 0');

    expect(() => validateTournamentPreset({
      name: 'Preset A',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 0,
      templateConfig: 'JSON_NULL_SENTINEL' as never,
      isSystem: false,
    })).toThrow('targetCount must be > 0');

    expect(() => validateMatchFormatPreset({
      key: '',
      durationMinutes: 20,
      segments: [] as never,
      isSystem: false,
    })).toThrow('Invalid match format preset: missing key');

    expect(() => validateMatchFormatPreset({
      key: 'BO3',
      durationMinutes: 0,
      segments: [{}] as never,
      isSystem: false,
    })).toThrow('durationMinutes must be > 0');

    expect(() => validateMatchFormatPreset({
      key: 'BO3',
      durationMinutes: 20,
      segments: [] as never,
      isSystem: false,
    })).toThrow('segments must be a non-empty array');
  });

  it('runs import in replace mode and upsert mode', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      tournamentPresets: [
        {
          name: 'Preset A',
          presetType: 'custom',
          totalParticipants: 16,
          targetCount: 4,
          templateConfig: { format: 'SINGLE', stages: [], brackets: [], routingRules: [] },
          isSystem: true,
        },
      ],
      matchFormatPresets: [
        {
          key: 'BO3',
          durationMinutes: 20,
          segments: [{ game: '501_DO', targetCount: 2 }],
          isSystem: true,
        },
      ],
    }) as never);

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await runImport('/tmp/import.json', true);
    expect(transactionMock.matchFormatPreset.deleteMany).toHaveBeenCalled();
    expect(transactionMock.tournamentPreset.deleteMany).toHaveBeenCalled();
    expect(transactionMock.matchFormatPreset.upsert).toHaveBeenCalledTimes(1);
    expect(transactionMock.tournamentPreset.upsert).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('Mode: replace');

    await runImport('/tmp/import.json', false);
    expect(consoleLogSpy).toHaveBeenCalledWith('Mode: upsert');
  });

  it('covers main and executeCli success and error paths', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      tournamentPresets: [
        {
          name: 'Preset B',
          presetType: 'custom',
          totalParticipants: 16,
          targetCount: 4,
          templateConfig: { format: 'SINGLE', stages: [], brackets: [], routingRules: [] },
          isSystem: false,
        },
      ],
      matchFormatPresets: [
        {
          key: 'BO5',
          durationMinutes: 25,
          segments: [{ game: '501_DO', targetCount: 1 }],
          isSystem: false,
        },
      ],
    }) as never);

    process.argv = [...originalArgv.slice(0, 2), '--replace'];
    await main();
    expect(prismaMock.$transaction).toHaveBeenCalled();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    await executeCli();
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      tournamentPresets: [
        {
          name: 'Preset C',
          presetType: 'custom',
          totalParticipants: 16,
          targetCount: 4,
          templateConfig: { format: 'SINGLE', stages: [], brackets: [], routingRules: [] },
          isSystem: false,
        },
      ],
      matchFormatPresets: [
        {
          key: 'BO7',
          durationMinutes: 35,
          segments: [{ game: '501_DO', targetCount: 1 }],
          isSystem: false,
        },
      ],
    }) as never);
    prismaMock.$transaction.mockRejectedValueOnce('tx-fail');

    await executeCli();
    expect(errorSpy).toHaveBeenCalledWith('tx-fail');
    expect(process.exitCode).toBe(1);
    expect(prismaMock.$disconnect).toHaveBeenCalled();
  });
});
