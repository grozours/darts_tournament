import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type AutosaveModule = typeof import('../../src/services/tournament-service/autosave');

const loadAutosaveModule = async (snapshotDir: string): Promise<AutosaveModule> => {
  process.env.TOURNAMENT_SNAPSHOT_DIR = snapshotDir;
  jest.resetModules();
  return await import('../../src/services/tournament-service/autosave');
};

describe('tournament autosave', () => {
  let temporaryDir: string;

  beforeEach(async () => {
    temporaryDir = await mkdtemp(path.join(os.tmpdir(), 'tournament-autosave-'));
  });

  afterEach(async () => {
    delete process.env.TOURNAMENT_SNAPSHOT_DIR;
    await rm(temporaryDir, { recursive: true, force: true });
  });

  it('writes snapshot file when live view exists', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => ({ id: 't-1', status: 'OPEN' })),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    await autosave.saveTournamentSnapshot(tournamentModel, 't-1', {
      action: 'TEST_ACTION',
      trigger: 'admin',
      actorId: 'admin-1',
      actorEmail: 'admin@example.com',
    });

    const filePath = path.join(temporaryDir, 't-1.json');
    const content = JSON.parse(await readFile(filePath, 'utf8')) as {
      schemaVersion: number;
      snapshotId: string;
      tournamentId: string;
      savedAt: string;
      action: string;
      trigger: string;
      data: { id: string };
    };

    expect(content.schemaVersion).toBe(1);
    expect(content.snapshotId).toBeTruthy();
    expect(content.action).toBe('TEST_ACTION');
    expect(content.trigger).toBe('admin');
    expect(content.tournamentId).toBe('t-1');
    expect(content.data.id).toBe('t-1');
    expect(new Date(content.savedAt).toISOString()).toBe(content.savedAt);
  });

  it('defaults trigger to system when omitted', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => ({ id: 't-default-trigger', status: 'OPEN' })),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    await autosave.saveTournamentSnapshot(tournamentModel, 't-default-trigger', {
      action: 'NO_TRIGGER',
    });

    const content = JSON.parse(
      await readFile(path.join(temporaryDir, 't-default-trigger.json'), 'utf8')
    ) as { trigger: string };

    expect(content.trigger).toBe('system');
  });

  it('does not write snapshot file when tournament is missing', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => undefined),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    await autosave.saveTournamentSnapshot(tournamentModel, 't-missing', {
      action: 'TEST_ACTION',
      trigger: 'admin',
    });

    await expect(readFile(path.join(temporaryDir, 't-missing.json'), 'utf8')).rejects.toThrow();
  });

  it('reads valid snapshot and ignores invalid snapshot payload', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const validPayload = {
      schemaVersion: 1,
      snapshotId: 'snap-1',
      tournamentId: 't-2',
      savedAt: '2026-02-26T10:00:00.000Z',
      action: 'UPDATE_TOURNAMENT',
      trigger: 'admin' as const,
      data: { id: 't-2' },
    };
    await writeFile(path.join(temporaryDir, 't-2.json'), `${JSON.stringify(validPayload)}\n`, 'utf8');

    const parsed = await autosave.readTournamentSnapshot('t-2');
    expect(parsed).toEqual(validPayload);

    await writeFile(
      path.join(temporaryDir, 't-invalid.json'),
      JSON.stringify({ schemaVersion: 2, tournamentId: 'x' }),
      'utf8'
    );

    const invalid = await autosave.readTournamentSnapshot('t-invalid');
    expect(invalid).toBeUndefined();
  });

  it('normalizes legacy snapshot payloads when reading latest and by id', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const legacyPayload = {
      schemaVersion: 1,
      tournamentId: 't-legacy',
      savedAt: '2026-03-01T10:00:00.000Z',
      data: { id: 't-legacy' },
    };

    await writeFile(path.join(temporaryDir, 't-legacy.json'), JSON.stringify(legacyPayload), 'utf8');

    const historyDirectory = path.join(temporaryDir, 't-legacy', 'history');
    await mkdir(historyDirectory, { recursive: true });
    await writeFile(path.join(historyDirectory, 'legacy-snap.json'), JSON.stringify(legacyPayload), 'utf8');

    const latest = await autosave.readTournamentSnapshot('t-legacy');
    const byId = await autosave.readTournamentSnapshotById('t-legacy', 'legacy-snap');

    expect(latest?.snapshotId).toBeTruthy();
    expect(latest?.action).toBe('LEGACY_SNAPSHOT');
    expect(latest?.trigger).toBe('system');
    expect(byId?.snapshotId).toBeTruthy();
    expect(byId?.action).toBe('LEGACY_SNAPSHOT');
  });

  it('restores snapshot file and normalizes id and savedAt', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);

    await autosave.restoreTournamentSnapshot('t-target', {
      schemaVersion: 1,
      snapshotId: 'snap-source',
      tournamentId: 't-source',
      savedAt: '2026-01-01T00:00:00.000Z',
      action: 'UPDATE_TOURNAMENT',
      trigger: 'admin',
      data: { id: 't-target' } as never,
    });

    const restored = JSON.parse(
      await readFile(path.join(temporaryDir, 't-target.json'), 'utf8')
    ) as {
      tournamentId: string;
      savedAt: string;
    };

    expect(restored.tournamentId).toBe('t-target');
    expect(restored.savedAt).not.toBe('2026-01-01T00:00:00.000Z');
    expect((restored as { action?: string }).action).toBe('RESTORE_SNAPSHOT');
  });

  it('lists snapshot history and restores by snapshot id', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => ({ id: 't-history', status: 'OPEN' })),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    await autosave.saveTournamentSnapshot(tournamentModel, 't-history', {
      action: 'UPDATE_TOURNAMENT',
      trigger: 'admin',
    });

    const snapshots = await autosave.listTournamentSnapshots('t-history');
    expect(snapshots.length).toBeGreaterThan(0);
    const latest = snapshots[0];
    if (!latest) {
      throw new Error('Expected at least one snapshot');
    }

    const restored = await autosave.restoreTournamentSnapshotById(
      't-history',
      latest.snapshotId
    );
    expect(restored?.snapshotId).toBe(latest.snapshotId);

    const current = await autosave.readTournamentSnapshot('t-history');
    expect(current?.action).toBe('RESTORE_SNAPSHOT');
  });

  it('returns undefined when restoring by unknown snapshot id', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);

    const restored = await autosave.restoreTournamentSnapshotById('t-missing', 'unknown');

    expect(restored).toBeUndefined();
  });

  it('returns empty snapshot history when files are invalid json', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const historyDirectory = path.join(temporaryDir, 't-bad', 'history');
    await mkdir(historyDirectory, { recursive: true });
    await writeFile(path.join(historyDirectory, 'bad.json'), '{invalid-json', 'utf8');

    const snapshots = await autosave.listTournamentSnapshots('t-bad');

    expect(snapshots).toEqual([]);
  });

  it('deletes snapshot file when requested', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);

    await writeFile(path.join(temporaryDir, 't-3.json'), JSON.stringify({ ok: true }), 'utf8');
    await autosave.deleteTournamentSnapshot('t-3');

    await expect(readFile(path.join(temporaryDir, 't-3.json'), 'utf8')).rejects.toThrow();
  });

  it('retains only the 10 most recent snapshots in history', async () => {
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => ({ id: 't-retention', status: 'OPEN' })),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    for (let index = 0; index < 12; index += 1) {
      await autosave.saveTournamentSnapshot(tournamentModel, 't-retention', {
        action: `ACTION_${index}`,
        trigger: 'admin',
      });
    }

    const snapshots = await autosave.listTournamentSnapshots('t-retention');
    expect(snapshots).toHaveLength(10);
    expect(snapshots.every((snapshot) => snapshot.tournamentId === 't-retention')).toBe(true);

    const historyDirectory = path.join(temporaryDir, 't-retention', 'history');
    const historyEntries = await readdir(historyDirectory);
    const jsonHistoryEntries = historyEntries.filter((entry) => entry.endsWith('.json'));
    expect(jsonHistoryEntries).toHaveLength(10);
  });

  it('honors custom retention limit when environment variable is set', async () => {
    process.env.TOURNAMENT_SNAPSHOT_RETENTION = '3';
    const autosave = await loadAutosaveModule(temporaryDir);
    const tournamentModel = {
      findLiveView: jest.fn().mockImplementation(async () => ({ id: 't-custom-retention', status: 'OPEN' })),
    } as unknown as Parameters<typeof autosave.saveTournamentSnapshot>[0];

    for (let index = 0; index < 5; index += 1) {
      await autosave.saveTournamentSnapshot(tournamentModel, 't-custom-retention', {
        action: `ACTION_${index}`,
      });
    }

    const snapshots = await autosave.listTournamentSnapshots('t-custom-retention');
    expect(snapshots).toHaveLength(3);
  });
});
