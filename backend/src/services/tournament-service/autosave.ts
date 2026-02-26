import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { TournamentModel } from '../../models/tournament-model';
import { config } from '../../config/environment';

export type TournamentSnapshot = {
  schemaVersion: 1;
  snapshotId: string;
  tournamentId: string;
  savedAt: string;
  action: string;
  actorId?: string;
  actorEmail?: string;
  trigger: 'admin' | 'system';
  data: Awaited<ReturnType<TournamentModel['findLiveView']>>;
};

type SaveTournamentSnapshotOptions = {
  action: string;
  actorId?: string;
  actorEmail?: string;
  trigger?: 'admin' | 'system';
};

export type TournamentSnapshotSummary = {
  snapshotId: string;
  tournamentId: string;
  savedAt: string;
  action: string;
  actorId?: string;
  actorEmail?: string;
  trigger: 'admin' | 'system';
};

const snapshotDirectory = path.resolve(
  process.cwd(),
  process.env.TOURNAMENT_SNAPSHOT_DIR ?? path.join(config.upload.directory, 'tournament-snapshots')
);

const getLatestSnapshotPath = (tournamentId: string): string =>
  path.join(snapshotDirectory, `${tournamentId}.json`);

const getTournamentSnapshotHistoryDirectory = (tournamentId: string): string =>
  path.join(snapshotDirectory, tournamentId, 'history');

const getSnapshotHistoryPath = (tournamentId: string, snapshotId: string): string =>
  path.join(getTournamentSnapshotHistoryDirectory(tournamentId), `${snapshotId}.json`);

const sanitizeToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/(^-)|(-$)/g, '')
    .slice(0, 48);

const generateSnapshotId = (action: string): string => {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const actionPart = sanitizeToken(action || 'mutation') || 'mutation';
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${actionPart}-${randomPart}`;
};

const isSnapshotPayload = (value: unknown): value is TournamentSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TournamentSnapshot>;
  return candidate.schemaVersion === 1
    && typeof candidate.snapshotId === 'string'
    && typeof candidate.tournamentId === 'string'
    && typeof candidate.savedAt === 'string'
    && typeof candidate.action === 'string'
    && (candidate.trigger === 'admin' || candidate.trigger === 'system')
    && candidate.data !== undefined;
};

const normalizeSnapshotPayload = (
  value: unknown,
  fallbackTournamentId: string
): TournamentSnapshot | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (isSnapshotPayload(value)) {
    return value;
  }

  const candidate = value as Partial<TournamentSnapshot>;
  if (
    candidate.schemaVersion !== 1
    || typeof candidate.tournamentId !== 'string'
    || typeof candidate.savedAt !== 'string'
    || candidate.data === undefined
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    snapshotId: generateSnapshotId('legacy-import'),
    tournamentId: candidate.tournamentId || fallbackTournamentId,
    savedAt: candidate.savedAt,
    action: typeof candidate.action === 'string' ? candidate.action : 'LEGACY_SNAPSHOT',
    ...(typeof candidate.actorId === 'string' ? { actorId: candidate.actorId } : {}),
    ...(typeof candidate.actorEmail === 'string' ? { actorEmail: candidate.actorEmail } : {}),
    trigger: candidate.trigger === 'admin' ? 'admin' : 'system',
    data: candidate.data,
  };
};

export const saveTournamentSnapshot = async (
  tournamentModel: TournamentModel,
  tournamentId: string,
  options: SaveTournamentSnapshotOptions
): Promise<void> => {
  const liveView = await tournamentModel.findLiveView(tournamentId);
  if (!liveView) {
    return;
  }

  const snapshotId = generateSnapshotId(options.action);
  const payload: TournamentSnapshot = {
    schemaVersion: 1,
    snapshotId,
    tournamentId,
    savedAt: new Date().toISOString(),
    action: options.action,
    ...(options.actorId ? { actorId: options.actorId } : {}),
    ...(options.actorEmail ? { actorEmail: options.actorEmail } : {}),
    trigger: options.trigger ?? 'system',
    data: liveView,
  };

  await fs.mkdir(snapshotDirectory, { recursive: true });
  await fs.mkdir(getTournamentSnapshotHistoryDirectory(tournamentId), { recursive: true });
  await Promise.all([
    fs.writeFile(
      getLatestSnapshotPath(tournamentId),
      `${JSON.stringify(payload, undefined, 2)}\n`,
      'utf8'
    ),
    fs.writeFile(
      getSnapshotHistoryPath(tournamentId, snapshotId),
      `${JSON.stringify(payload, undefined, 2)}\n`,
      'utf8'
    ),
  ]);
};

export const deleteTournamentSnapshot = async (tournamentId: string): Promise<void> => {
  await Promise.all([
    fs.rm(getLatestSnapshotPath(tournamentId), { force: true }),
    fs.rm(path.join(snapshotDirectory, tournamentId), { recursive: true, force: true }),
  ]);
};

export const readTournamentSnapshot = async (
  tournamentId: string
): Promise<TournamentSnapshot | undefined> => {
  try {
    const rawContent = await fs.readFile(getLatestSnapshotPath(tournamentId), 'utf8');
    return normalizeSnapshotPayload(JSON.parse(rawContent) as unknown, tournamentId);
  } catch {
    return undefined;
  }
};

export const listTournamentSnapshots = async (
  tournamentId: string
): Promise<TournamentSnapshotSummary[]> => {
  try {
    const historyDirectory = getTournamentSnapshotHistoryDirectory(tournamentId);
    const entries = await fs.readdir(historyDirectory, { withFileTypes: true });
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const fileContent = await fs.readFile(path.join(historyDirectory, entry.name), 'utf8');
          const parsed = normalizeSnapshotPayload(JSON.parse(fileContent) as unknown, tournamentId);
          if (!parsed) {
            return undefined;
          }
          return {
            snapshotId: parsed.snapshotId,
            tournamentId: parsed.tournamentId,
            savedAt: parsed.savedAt,
            action: parsed.action,
            ...(parsed.actorId ? { actorId: parsed.actorId } : {}),
            ...(parsed.actorEmail ? { actorEmail: parsed.actorEmail } : {}),
            trigger: parsed.trigger,
          } satisfies TournamentSnapshotSummary;
        })
    );

    return snapshots
      .filter((snapshot): snapshot is TournamentSnapshotSummary => snapshot !== undefined)
      .sort((first, second) => second.savedAt.localeCompare(first.savedAt));
  } catch {
    return [];
  }
};

export const readTournamentSnapshotById = async (
  tournamentId: string,
  snapshotId: string
): Promise<TournamentSnapshot | undefined> => {
  try {
    const rawContent = await fs.readFile(getSnapshotHistoryPath(tournamentId, snapshotId), 'utf8');
    return normalizeSnapshotPayload(JSON.parse(rawContent) as unknown, tournamentId);
  } catch {
    return undefined;
  }
};

export const restoreTournamentSnapshot = async (
  tournamentId: string,
  payload: TournamentSnapshot
): Promise<void> => {
  const snapshotId = generateSnapshotId(`restore-${payload.action || 'snapshot'}`);
  const normalizedPayload: TournamentSnapshot = {
    ...payload,
    snapshotId,
    tournamentId,
    savedAt: new Date().toISOString(),
    action: 'RESTORE_SNAPSHOT',
  };
  await fs.mkdir(getTournamentSnapshotHistoryDirectory(tournamentId), { recursive: true });
  await fs.mkdir(snapshotDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      getLatestSnapshotPath(tournamentId),
      `${JSON.stringify(normalizedPayload, undefined, 2)}\n`,
      'utf8'
    ),
    fs.writeFile(
      getSnapshotHistoryPath(tournamentId, snapshotId),
      `${JSON.stringify(normalizedPayload, undefined, 2)}\n`,
      'utf8'
    ),
  ]);
};

export const restoreTournamentSnapshotById = async (
  tournamentId: string,
  snapshotId: string
): Promise<TournamentSnapshot | undefined> => {
  const snapshot = await readTournamentSnapshotById(tournamentId, snapshotId);
  if (!snapshot) {
    return undefined;
  }

  await restoreTournamentSnapshot(tournamentId, snapshot);
  return snapshot;
};
