import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const resolveTournamentLogosDirectory = () => {
  const currentDirectory = process.cwd();
  if (path.basename(currentDirectory) === 'backend') {
    return path.resolve(currentDirectory, 'uploads/tournament-logos');
  }

  return path.resolve(currentDirectory, 'backend/uploads/tournament-logos');
};

const TOURNAMENT_LOGOS_DIRECTORY = resolveTournamentLogosDirectory();

const normalizeLogoUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const deduplicateLogoUrls = (logoUrls: string[]): string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const logoUrl of logoUrls) {
    if (!seen.has(logoUrl)) {
      seen.add(logoUrl);
      ordered.push(logoUrl);
    }
  }

  return ordered;
};

const normalizeLogoUrls = (logoUrls: string[]): string[] => {
  const normalized: string[] = [];

  for (const logoUrl of logoUrls) {
    const normalizedLogoUrl = normalizeLogoUrl(logoUrl);
    if (normalizedLogoUrl) {
      normalized.push(normalizedLogoUrl);
    }
  }

  return deduplicateLogoUrls(normalized);
};

const getTournamentLogosFilePath = (tournamentId: string) => (
  path.join(TOURNAMENT_LOGOS_DIRECTORY, `${tournamentId}.json`)
);

const parseLogoUrlsPayload = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  for (const entry of value) {
    const normalizedEntry = normalizeLogoUrl(entry);
    if (normalizedEntry) {
      normalized.push(normalizedEntry);
    }
  }

  return deduplicateLogoUrls(normalized);
};

const writeTournamentLogoUrls = async (tournamentId: string, logoUrls: string[]): Promise<void> => {
  await mkdir(TOURNAMENT_LOGOS_DIRECTORY, { recursive: true });
  const filePath = getTournamentLogosFilePath(tournamentId);
  await writeFile(filePath, JSON.stringify(logoUrls, undefined, 2), 'utf8');
};

export const readTournamentLogoUrls = async (tournamentId: string): Promise<string[]> => {
  try {
    const content = await readFile(getTournamentLogosFilePath(tournamentId), 'utf8');
    return parseLogoUrlsPayload(JSON.parse(content));
  } catch {
    return [];
  }
};

export const appendTournamentLogoUrl = async (tournamentId: string, logoUrl: string): Promise<string[]> => {
  const normalizedLogoUrl = normalizeLogoUrl(logoUrl);
  if (!normalizedLogoUrl) {
    return readTournamentLogoUrls(tournamentId);
  }

  const current = await readTournamentLogoUrls(tournamentId);
  const next = normalizeLogoUrls([...current, normalizedLogoUrl]);
  await writeTournamentLogoUrls(tournamentId, next);
  return next;
};

export const removeTournamentLogoUrl = async (tournamentId: string, logoUrl: string): Promise<string[]> => {
  const normalizedLogoUrl = normalizeLogoUrl(logoUrl);
  if (!normalizedLogoUrl) {
    return readTournamentLogoUrls(tournamentId);
  }

  const current = await readTournamentLogoUrls(tournamentId);
  const next = normalizeLogoUrls(current.filter((entry) => entry !== normalizedLogoUrl));
  await writeTournamentLogoUrls(tournamentId, next);
  return next;
};

export const getTournamentLogoUrls = async (
  tournamentId: string,
  primaryLogoUrl: string | undefined
): Promise<string[]> => {
  const normalizedPrimary = normalizeLogoUrl(primaryLogoUrl);
  const persisted = await readTournamentLogoUrls(tournamentId);

  if (!normalizedPrimary) {
    return persisted;
  }

  return deduplicateLogoUrls([normalizedPrimary, ...persisted]);
};
