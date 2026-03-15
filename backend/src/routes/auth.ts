import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  DEVELOPMENT_AUTOLOGIN_COOKIE_NAME,
  DEVELOPMENT_AUTOLOGIN_MODES,
  getActiveDevelopmentAutologinMode,
  isAdmin,
  parseDevelopmentAutologinMode,
  requireAuth,
  resolveUserEmailFromPayload,
} from '../middleware/auth';
import { config } from '../config/environment';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.prismaUrl,
    },
  },
});

const normalizeDisplayName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNamePart = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return undefined;
  }
  return trimmed;
};

const resolvePersonNameFromPayload = (
  payload: Record<string, unknown>,
  email: string
): { firstName: string; lastName: string } => {
  const displayName = normalizeDisplayName(payload.name);
  if (displayName) {
    const [firstNameCandidate, ...lastNameParts] = displayName.split(/\s+/).filter(Boolean);
    const firstName = firstNameCandidate ?? 'Authenticated';
    const lastName = lastNameParts.join(' ').trim() || 'User';
    return { firstName, lastName };
  }

  const localPart = (email.split('@')[0] ?? 'authenticated.user').replaceAll(/[._-]+/g, ' ').trim();
  const [firstNameCandidate, ...lastNameParts] = localPart.split(/\s+/).filter(Boolean);
  const firstName = firstNameCandidate ?? 'Authenticated';
  const lastName = lastNameParts.join(' ').trim() || 'User';
  return { firstName, lastName };
};

const ensurePersonForAuthenticatedUser = async (
  payload: Record<string, unknown>,
  email: string,
  correlationId: string | undefined
) => {
  const existingPerson = await prisma.person.findFirst({
    where: { email },
    select: { id: true, firstName: true, lastName: true, surname: true, email: true },
  });

  if (existingPerson) {
    return existingPerson;
  }

  const { firstName, lastName } = resolvePersonNameFromPayload(payload, email);
  const createdPerson = await prisma.person.create({
    data: {
      firstName,
      lastName,
      email,
    },
    select: { id: true, firstName: true, lastName: true, surname: true, email: true },
  });

  logger.info('Created Person record from authenticated user', {
    correlationId,
    metadata: {
      email,
    },
  });

  return createdPerson;
};

const buildDisplayName = (person: { firstName: string; lastName: string; surname: string | null }) => {
  const base = `${person.firstName} ${person.lastName}`.trim();
  if (person.surname) {
    return `${base} (${person.surname})`;
  }
  return base;
};

const resolveSearchQuery = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 100) : undefined;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveTournamentFilterId = (value: unknown): { tournamentId?: string; errorMessage?: string } => {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== 'string') {
    return { errorMessage: 'Invalid tournamentId' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  if (!UUID_PATTERN.test(trimmed)) {
    return { errorMessage: 'Invalid tournamentId' };
  }

  return { tournamentId: trimmed };
};

const resolveOptionalEmail = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  if (!trimmed.includes('@') || trimmed.length > 255) {
    return undefined;
  }
  return trimmed;
};

const hasAdminAccess = (request: Request): boolean => {
  const payload = request.auth?.payload;
  if (!payload) {
    return false;
  }
  return isAdmin(request);
};

const ADMIN_EMAILS_SET = new Set(config.auth.adminEmails.map((email) => email.toLowerCase()));
const SKILL_LEVEL_CLEAR = '__CLEAR__' as const;

const isAdminEmail = (email: string | null): boolean => {
  if (!email) {
    return false;
  }
  return ADMIN_EMAILS_SET.has(email.trim().toLowerCase());
};

type AdminAccountUpdatePayload = {
  firstName?: string;
  lastName?: string;
  surname?: string;
  email?: string | null;
  skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | null;
};

const applyNormalizedNameField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>,
  field: 'firstName' | 'lastName'
): string | undefined => {
  if (body[field] === undefined) {
    return undefined;
  }

  const normalized = normalizeNamePart(body[field]);
  if (!normalized) {
    return `Invalid ${field}`;
  }

  updates[field] = normalized;
  return undefined;
};

const applySurnameField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.surname === undefined) {
    return undefined;
  }

  if (typeof body.surname !== 'string') {
    return 'Invalid surname';
  }

  updates.surname = body.surname.trim().slice(0, 50);
  return undefined;
};

const applyEmailField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.email === undefined) {
    return undefined;
  }

  const email = resolveOptionalEmail(body.email);
  if (email === undefined) {
    return 'Invalid email';
  }

  if (email !== '') {
    updates.email = email;
  }

  return undefined;
};

const applySkillLevelField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.skillLevel === undefined) {
    return undefined;
  }

  const skillLevel = parseOptionalSkillLevel(body.skillLevel);
  if (skillLevel === undefined) {
    return 'Invalid skillLevel';
  }

  // eslint-disable-next-line unicorn/no-null
  updates.skillLevel = skillLevel === SKILL_LEVEL_CLEAR ? null : skillLevel;
  return undefined;
};

const parseOptionalSkillLevel = (
  value: unknown
): 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | typeof SKILL_LEVEL_CLEAR | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return SKILL_LEVEL_CLEAR;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'BEGINNER'
    || normalized === 'INTERMEDIATE'
    || normalized === 'EXPERT'
  ) {
    return normalized;
  }

  return undefined;
};

const parseAdminAccountUpdatePayload = (
  body: Record<string, unknown>
): { updates?: AdminAccountUpdatePayload; errorMessage?: string } => {
  const updates: AdminAccountUpdatePayload = {};

  const fieldError =
    applyNormalizedNameField(updates, body, 'firstName')
    || applyNormalizedNameField(updates, body, 'lastName')
    || applySurnameField(updates, body)
    || applyEmailField(updates, body)
    || applySkillLevelField(updates, body);

  if (fieldError) {
    return { errorMessage: fieldError };
  }

  if (Object.keys(updates).length === 0) {
    return { errorMessage: 'No updatable fields provided' };
  }

  return { updates };
};

const handleAdminAccountUpdateError = (
  request: Request,
  response: Response,
  userId: string,
  error: unknown
): void => {
  const code = typeof error === 'object' && error !== null
    ? (error as { code?: string }).code
    : undefined;

  if (code === 'P2025') {
    response.status(404).json({ error: 'Not Found', message: 'User account not found' });
    return;
  }

  if (code === 'P2002') {
    response.status(409).json({ error: 'Conflict', message: 'Email is already used by another account' });
    return;
  }

  logger.error('Failed to update user account', {
    correlationId: request.correlationId,
    metadata: {
      userId,
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
  response.status(500).json({ error: 'Internal Server Error' });
};

type AdminUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  surname: string | null;
  email: string | null;
  skillLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TournamentLinkRow = {
  personId: string | null;
  tournamentId: string | null;
};

type ActivePlayerLinkRow = {
  personId: string | null;
  skillLevel: string | null;
};

type ImportSkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

type ImportedUserCandidate = {
  firstName: string;
  lastName: string;
  email: string | null;
  skillLevel?: ImportSkillLevel;
};

type ImportedUserSummary = {
  rowsRead: number;
  accountsDetected: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  issues: string[];
  tournamentImport?: ImportedTournamentSummary;
};

type ImportHeaderKey =
  | 'nomi'
  | 'prenomi'
  | 'maili'
  | 'niveaui'
  | 'equipe'
  | 'nomd1'
  | 'prenomd1'
  | 'maild1'
  | 'nomd2'
  | 'prenomd2'
  | 'maild2'
  | 'niveaud';

type ImportColumnIndexes = Partial<Record<ImportHeaderKey, number>>;

type ParsedImportFile = {
  rowsRead: number;
  accounts: ImportedUserCandidate[];
  issues: string[];
};

type ParsedImportStructure = {
  lines: string[];
  delimiter: (typeof IMPORT_DELIMITERS)[number];
  headerLineIndex: number;
  headerIndexes: ImportColumnIndexes;
  dataLines: string[];
  score: number;
};

type ImportedDoubletteCandidate = {
  name: string;
  skillLevel?: ImportSkillLevel;
  memberOne: ImportedUserCandidate;
  memberTwo: ImportedUserCandidate;
};

type ParsedTournamentImportFile = {
  singleDate?: Date;
  doubleDate?: Date;
  seriesName?: string;
  singlePlayers: ImportedUserCandidate[];
  doublettes: ImportedDoubletteCandidate[];
  issues: string[];
};

type ImportedTournamentSummary = {
  tournamentsCreated: number;
  tournamentsUpdated: number;
  singleRegistrationsCreated: number;
  doublettesCreated: number;
  doublePlayersCreated: number;
  issues: string[];
  singleTournamentId?: string;
  doubleTournamentId?: string;
};

const IMPORT_DELIMITERS = ['\t', ';', ','] as const;
const IMPORT_HEADER_KEYS: ImportHeaderKey[] = [
  'nomi',
  'prenomi',
  'maili',
  'niveaui',
  'equipe',
  'nomd1',
  'prenomd1',
  'maild1',
  'nomd2',
  'prenomd2',
  'maild2',
  'niveaud',
];

const normalizeImportedNamePart = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replaceAll(/\s+/g, ' ').trim().slice(0, 50);
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeImportLookupName = (value: string): string => value
  .normalize('NFD')
  .replaceAll(/[\u0300-\u036f]/g, '')
  .replaceAll(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const normalizeImportEmail = (value: unknown): string | null | undefined => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (!normalized.includes('@') || normalized.length > 255) {
    return undefined;
  }

  return normalized;
};

const normalizeImportHeaderValue = (value: string): string => value
  .normalize('NFD')
  .replaceAll(/[\u0300-\u036f]/g, '')
  .replaceAll(/[^a-zA-Z0-9]+/g, '')
  .trim()
  .toLowerCase();

const parseDelimitedLine = (line: string, delimiter: (typeof IMPORT_DELIMITERS)[number]): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
};

const parseImportDateCell = (value: string): Date | undefined => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/u);
  if (!match) {
    return undefined;
  }

  const dayValue = match[1];
  const monthValue = match[2];
  const yearValue = match[3];
  if (!dayValue || !monthValue || !yearValue) {
    return undefined;
  }

  const day = Number.parseInt(dayValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const year = Number.parseInt(yearValue, 10);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return undefined;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
};

const parseTournamentDateFromLine = (
  line: string,
  delimiter: (typeof IMPORT_DELIMITERS)[number],
  label: 'individuel' | 'doublette'
): Date | undefined => {
  const cells = parseDelimitedLine(line, delimiter).map((cell) => cell.trim());
  const labelIndex = cells.findIndex((cell) => cell.toLowerCase() === label);
  if (labelIndex < 0) {
    return undefined;
  }

  for (let index = labelIndex + 1; index < cells.length; index += 1) {
    const candidate = cells[index];
    if (!candidate) {
      continue;
    }

    const parsedDate = parseImportDateCell(candidate);
    if (parsedDate) {
      return parsedDate;
    }
  }

  return undefined;
};

const parseSeriesNameFromLine = (
  line: string,
  delimiter: (typeof IMPORT_DELIMITERS)[number],
  label: 'individuel' | 'doublette'
): string | undefined => {
  const cells = parseDelimitedLine(line, delimiter).map((cell) => cell.trim());
  const labelIndex = cells.findIndex((cell) => cell.toLowerCase() === label);
  if (labelIndex < 0) {
    return undefined;
  }

  for (let index = labelIndex + 1; index < cells.length; index += 1) {
    const candidate = cells[index];
    if (!candidate || parseImportDateCell(candidate)) {
      continue;
    }
    return candidate.slice(0, 100);
  }

  return undefined;
};

const buildImportColumnIndexes = (cells: string[]): ImportColumnIndexes => {
  const indexes: ImportColumnIndexes = {};

  cells.forEach((cell, index) => {
    const normalizedHeader = normalizeImportHeaderValue(cell);
    if (IMPORT_HEADER_KEYS.includes(normalizedHeader as ImportHeaderKey)) {
      indexes[normalizedHeader as ImportHeaderKey] = index;
    }
  });

  return indexes;
};

const countImportHeaderMatches = (indexes: ImportColumnIndexes): number => Object.keys(indexes).length;

const parseImportStructure = (content: string): ParsedImportStructure | undefined => {
  const lines = content
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return undefined;
  }

  let bestMatch:
    | {
      lineIndex: number;
      delimiter: (typeof IMPORT_DELIMITERS)[number];
      indexes: ImportColumnIndexes;
      score: number;
    }
    | undefined;

  lines.forEach((line, lineIndex) => {
    for (const delimiter of IMPORT_DELIMITERS) {
      const indexes = buildImportColumnIndexes(parseDelimitedLine(line, delimiter));
      const score = countImportHeaderMatches(indexes);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { lineIndex, delimiter, indexes, score };
      }
    }
  });

  if (!bestMatch) {
    return undefined;
  }

  return {
    lines,
    delimiter: bestMatch.delimiter,
    headerLineIndex: bestMatch.lineIndex,
    headerIndexes: bestMatch.indexes,
    dataLines: lines.slice(bestMatch.lineIndex + 1),
    score: bestMatch.score,
  };
};

const parseImportSkillLevel = (value: unknown): ImportSkillLevel | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === '1' || normalized === 'BEGINNER' || normalized === 'DEBUTANT') {
    return 'BEGINNER';
  }
  if (normalized === '2' || normalized === 'INTERMEDIATE' || normalized === 'INTERMEDIAIRE') {
    return 'INTERMEDIATE';
  }
  if (normalized === '3' || normalized === 'EXPERT' || normalized === 'ADVANCED' || normalized === 'AVANCE') {
    return 'EXPERT';
  }

  return undefined;
};

const skillRankByImportLevel: Record<ImportSkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  EXPERT: 3,
};

const mergeIntoImportedAccount = (
  existing: ImportedUserCandidate,
  incoming: ImportedUserCandidate,
  byEmail: Map<string, ImportedUserCandidate>
): void => {
  if (!existing.email && incoming.email) {
    existing.email = incoming.email;
    byEmail.set(incoming.email, existing);
  }

  if (!incoming.skillLevel) {
    return;
  }

  const existingRank = existing.skillLevel ? skillRankByImportLevel[existing.skillLevel] : 0;
  if (skillRankByImportLevel[incoming.skillLevel] > existingRank) {
    existing.skillLevel = incoming.skillLevel;
  }
};

const mergeImportedUsers = (accounts: ImportedUserCandidate[]): ImportedUserCandidate[] => {
  const mergedAccounts: ImportedUserCandidate[] = [];
  const byEmail = new Map<string, ImportedUserCandidate>();
  const byName = new Map<string, ImportedUserCandidate>();

  for (const account of accounts) {
    const nameKey = `${account.firstName.toLowerCase()}|${account.lastName.toLowerCase()}`;
    const existing = (account.email ? byEmail.get(account.email) : undefined) ?? byName.get(nameKey);

    if (!existing) {
      mergedAccounts.push(account);
      if (account.email) {
        byEmail.set(account.email, account);
      }
      byName.set(nameKey, account);
      continue;
    }

    mergeIntoImportedAccount(existing, account, byEmail);
  }

  return mergedAccounts;
};

const buildImportCandidate = (
  cells: string[],
  rowNumber: number,
  sourceLabel: string,
  nameIndexes: { lastName: number | undefined; firstName: number | undefined; email: number | undefined; skillLevel: number | undefined },
  issues: string[]
): ImportedUserCandidate | undefined => {
  const lastName = normalizeImportedNamePart(
    nameIndexes.lastName === undefined ? undefined : cells[nameIndexes.lastName]
  );
  const firstName = normalizeImportedNamePart(
    nameIndexes.firstName === undefined ? undefined : cells[nameIndexes.firstName]
  );

  if (!lastName && !firstName) {
    return undefined;
  }

  const resolvedLastName = lastName ?? 'NC';
  const resolvedFirstName = firstName ?? 'NC';
  if (!lastName || !firstName) {
    issues.push(`Ligne ${rowNumber}: compte ${sourceLabel} incomplet, valeur NC appliquee.`);
  }

  const email = normalizeImportEmail(
    nameIndexes.email === undefined ? undefined : cells[nameIndexes.email]
  );
  if (email === undefined) {
    issues.push(`Ligne ${rowNumber}: email invalide pour ${firstName} ${lastName}.`);
    return undefined;
  }

  const skillLevel = parseImportSkillLevel(
    nameIndexes.skillLevel === undefined ? undefined : cells[nameIndexes.skillLevel]
  );

  return {
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    email,
    ...(skillLevel ? { skillLevel } : {}),
  };
};

const parseImportedUsersFile = (content: string): ParsedImportFile => {
  const structure = parseImportStructure(content);
  if (!structure) {
    return { rowsRead: 0, accounts: [], issues: ['Le fichier est vide.'] };
  }

  if (structure.score < 4) {
    return {
      rowsRead: 0,
      accounts: [],
      issues: ['Impossible de reconnaitre un en-tete CSV/TSV compatible avec inscriptions.tsv.'],
    };
  }

  const issues: string[] = [];
  const accounts: ImportedUserCandidate[] = [];
  const { headerIndexes, dataLines, delimiter } = structure;

  dataLines.forEach((line, rowOffset) => {
    const rowNumber = rowOffset + 1;
    const cells = parseDelimitedLine(line, delimiter);
    const individual = buildImportCandidate(cells, rowNumber, 'individuel', {
      lastName: headerIndexes.nomi,
      firstName: headerIndexes.prenomi,
      email: headerIndexes.maili,
      skillLevel: headerIndexes.niveaui,
    }, issues);

    if (individual) {
      accounts.push(individual);
    }
  });

  return {
    rowsRead: dataLines.length,
    accounts: mergeImportedUsers(accounts),
    issues,
  };
};

const parseImportedTournamentsFile = (content: string): ParsedTournamentImportFile => {
  const structure = parseImportStructure(content);
  if (!structure) {
    return {
      singlePlayers: [],
      doublettes: [],
      issues: ['Le fichier est vide.'],
    };
  }

  if (structure.score < 4) {
    return {
      singlePlayers: [],
      doublettes: [],
      issues: ['Impossible de reconnaitre un en-tete CSV/TSV compatible avec inscriptions.tsv.'],
    };
  }

  const issues: string[] = [];
  const singlePlayers: ImportedUserCandidate[] = [];
  const doublettes: ImportedDoubletteCandidate[] = [];
  const { delimiter, dataLines, headerIndexes } = structure;

  let singleDate: Date | undefined;
  let doubleDate: Date | undefined;
  let seriesName: string | undefined;

  for (const line of structure.lines.slice(0, Math.max(structure.headerLineIndex, 1))) {
    if (!singleDate) {
      singleDate = parseTournamentDateFromLine(line, delimiter, 'individuel');
    }
    if (!doubleDate) {
      doubleDate = parseTournamentDateFromLine(line, delimiter, 'doublette');
    }
    if (!seriesName) {
      seriesName = parseSeriesNameFromLine(line, delimiter, 'individuel')
        ?? parseSeriesNameFromLine(line, delimiter, 'doublette');
    }
  }

  dataLines.forEach((line, rowOffset) => {
    const rowNumber = rowOffset + 1;
    const cells = parseDelimitedLine(line, delimiter);

    const individual = buildImportCandidate(cells, rowNumber, 'individuel', {
      lastName: headerIndexes.nomi,
      firstName: headerIndexes.prenomi,
      email: headerIndexes.maili,
      skillLevel: headerIndexes.niveaui,
    }, issues);
    if (individual) {
      singlePlayers.push(individual);
    }

    const memberOne = buildImportCandidate(cells, rowNumber, 'doublette-1', {
      lastName: headerIndexes.nomd1,
      firstName: headerIndexes.prenomd1,
      email: headerIndexes.maild1,
      skillLevel: headerIndexes.niveaud,
    }, issues);
    const memberTwo = buildImportCandidate(cells, rowNumber, 'doublette-2', {
      lastName: headerIndexes.nomd2,
      firstName: headerIndexes.prenomd2,
      email: headerIndexes.maild2,
      skillLevel: headerIndexes.niveaud,
    }, issues);

    if (memberOne && memberTwo) {
      const teamNameCell = normalizeImportedNamePart(
        headerIndexes.equipe === undefined ? undefined : cells[headerIndexes.equipe]
      );
      const teamName = teamNameCell ?? `${memberOne.firstName} - ${memberTwo.firstName}`;
      const skillLevel = memberOne.skillLevel ?? memberTwo.skillLevel;
      doublettes.push({
        name: teamName.slice(0, 100),
        ...(skillLevel ? { skillLevel } : {}),
        memberOne,
        memberTwo,
      });
    }
  });

  const uniqueDoublettes = new Map<string, ImportedDoubletteCandidate>();
  for (const doublette of doublettes) {
    const key = doublette.name.toLowerCase();
    if (!uniqueDoublettes.has(key)) {
      uniqueDoublettes.set(key, doublette);
    }
  }

  return {
    ...(singleDate ? { singleDate } : {}),
    ...(doubleDate ? { doubleDate } : {}),
    ...(seriesName ? { seriesName } : {}),
    singlePlayers: mergeImportedUsers(singlePlayers),
    doublettes: [...uniqueDoublettes.values()],
    issues,
  };
};

const findExistingImportedUser = async (account: ImportedUserCandidate) => {
  const select = {
    id: true,
    firstName: true,
    lastName: true,
    surname: true,
    email: true,
    skillLevel: true,
  } as const;

  if (account.email) {
    const existingByEmail = await prisma.person.findFirst({
      where: { email: account.email },
      select,
    });

    if (existingByEmail) {
      return existingByEmail;
    }
  }

  const existingByNameInsensitive = await prisma.person.findFirst({
    where: {
      firstName: { equals: account.firstName, mode: 'insensitive' },
      lastName: { equals: account.lastName, mode: 'insensitive' },
    },
    select,
  });
  if (existingByNameInsensitive) {
    return existingByNameInsensitive;
  }

  const candidates = await prisma.person.findMany({
    where: {
      OR: [
        { firstName: { contains: account.firstName.slice(0, 2), mode: 'insensitive' } },
        { lastName: { contains: account.lastName.slice(0, 2), mode: 'insensitive' } },
      ],
    },
    take: 200,
    select,
  });

  const normalizedFirstName = normalizeImportLookupName(account.firstName);
  const normalizedLastName = normalizeImportLookupName(account.lastName);
  return candidates.find(
    (candidate) =>
      normalizeImportLookupName(candidate.firstName) === normalizedFirstName
      && normalizeImportLookupName(candidate.lastName) === normalizedLastName
  );
};

const buildImportedUserUpdates = (
  existing: {
    firstName: string;
    lastName: string;
    email: string | null;
    skillLevel: string | null;
  },
  account: ImportedUserCandidate
): AdminAccountUpdatePayload => {
  const updates: AdminAccountUpdatePayload = {};

  if (existing.firstName !== account.firstName) {
    updates.firstName = account.firstName;
  }
  if (existing.lastName !== account.lastName) {
    updates.lastName = account.lastName;
  }
  if (account.email && existing.email !== account.email) {
    updates.email = account.email;
  }
  if (account.skillLevel && existing.skillLevel !== account.skillLevel) {
    updates.skillLevel = account.skillLevel;
  }

  return updates;
};

const createImportedUser = async (account: ImportedUserCandidate): Promise<void> => {
  await prisma.person.create({
    data: {
      firstName: account.firstName,
      lastName: account.lastName,
      ...(account.email ? { email: account.email } : {}),
      ...(account.skillLevel ? { skillLevel: account.skillLevel } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      surname: true,
      email: true,
      skillLevel: true,
    },
  });
};

const updateImportedUser = async (userId: string, updates: AdminAccountUpdatePayload): Promise<void> => {
  await prisma.person.update({
    where: { id: userId },
    data: updates,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      surname: true,
      email: true,
      skillLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (updates.skillLevel === undefined) {
    return;
  }

  await prisma.player.updateMany({
    where: {
      personId: userId,
      isActive: true,
    },
    data: {
      skillLevel: updates.skillLevel,
    },
  });
};

const importSingleUserAccount = async (account: ImportedUserCandidate): Promise<'created' | 'updated' | 'skipped'> => {
  const existing = await findExistingImportedUser(account);
  if (!existing) {
    await createImportedUser(account);
    return 'created';
  }

  const updates = buildImportedUserUpdates(existing, account);
  if (Object.keys(updates).length === 0) {
    return 'skipped';
  }

  await updateImportedUser(existing.id, updates);
  return 'updated';
};

const upsertImportedTournament = async (
  name: string,
  format: 'SINGLE' | 'DOUBLE',
  startTime: Date,
  participantTotal: number
): Promise<{ id: string; created: boolean }> => {
  const endTime = new Date(startTime);
  endTime.setUTCHours(23, 0, 0, 0);

  const existing = await prisma.tournament.findFirst({
    where: {
      name,
      startTime,
    },
    select: {
      id: true,
      totalParticipants: true,
      targetCount: true,
      status: true,
    },
  });

  if (existing) {
    await prisma.tournament.update({
      where: { id: existing.id },
      data: {
        format,
        durationType: 'FULL_DAY',
        endTime,
        totalParticipants: Math.max(participantTotal, existing.totalParticipants, 2),
        targetCount: Math.max(existing.targetCount, 8),
        status: existing.status === 'DRAFT' ? 'OPEN' : existing.status,
      },
      select: { id: true },
    });
    return { id: existing.id, created: false };
  }

  const created = await prisma.tournament.create({
    data: {
      name,
      format,
      durationType: 'FULL_DAY',
      startTime,
      endTime,
      totalParticipants: Math.max(participantTotal, 2),
      targetCount: 8,
      status: 'OPEN',
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
};

const ensurePersonForImportCandidate = async (account: ImportedUserCandidate): Promise<string> => {
  const existing = await findExistingImportedUser(account);
  if (existing) {
    const updates = buildImportedUserUpdates(existing, account);
    if (Object.keys(updates).length > 0) {
      await updateImportedUser(existing.id, updates);
    }
    return existing.id;
  }

  const created = await prisma.person.create({
    data: {
      firstName: account.firstName,
      lastName: account.lastName,
      ...(account.email ? { email: account.email } : {}),
      ...(account.skillLevel ? { skillLevel: account.skillLevel } : {}),
    },
    select: { id: true },
  });

  return created.id;
};

type ImportPlayerPersonLinkMode = 'always' | 'never' | 'existing-only';

type ExistingTournamentPlayerLink = {
  id: string;
  personId: string | null;
  email: string | null;
  skillLevel: string | null;
  isActive: boolean;
};

const resolveImportPlayerPersonId = async (
  account: ImportedUserCandidate,
  mode: ImportPlayerPersonLinkMode
): Promise<string | undefined> => {
  if (mode === 'never') {
    return undefined;
  }

  if (mode === 'existing-only') {
    const existing = await findExistingImportedUser(account);
    return existing?.id;
  }

  return ensurePersonForImportCandidate(account);
};

const shouldUpdateTournamentPlayer = (
  existing: ExistingTournamentPlayerLink,
  account: ImportedUserCandidate,
  personLinkMode: ImportPlayerPersonLinkMode,
  personId: string | undefined
): boolean => (
  (personLinkMode !== 'never' && personId !== undefined && existing.personId !== personId)
  || !existing.isActive
  || (account.email !== null && existing.email !== account.email)
  || (account.skillLevel !== undefined && existing.skillLevel !== account.skillLevel)
);

const buildTournamentPlayerUpdateData = (
  account: ImportedUserCandidate,
  personLinkMode: ImportPlayerPersonLinkMode,
  personId: string | undefined
): Prisma.PlayerUncheckedUpdateInput => ({
  ...(personLinkMode !== 'never' && personId !== undefined ? { personId } : {}),
  isActive: true,
  ...(account.email ? { email: account.email } : {}),
  ...(account.skillLevel ? { skillLevel: account.skillLevel } : {}),
});

const buildTournamentPlayerCreateData = (
  tournamentId: string,
  account: ImportedUserCandidate,
  personLinkMode: ImportPlayerPersonLinkMode,
  personId: string | undefined
): Prisma.PlayerUncheckedCreateInput => ({
  tournamentId,
  ...(personLinkMode !== 'never' && personId !== undefined ? { personId } : {}),
  firstName: account.firstName,
  lastName: account.lastName,
  ...(account.email ? { email: account.email } : {}),
  ...(account.skillLevel ? { skillLevel: account.skillLevel } : {}),
  isActive: true,
  checkedIn: false,
  registeredAt: new Date(),
});

const ensureTournamentPlayer = async (
  tournamentId: string,
  account: ImportedUserCandidate,
  options?: { personLinkMode?: ImportPlayerPersonLinkMode }
): Promise<{ id: string; created: boolean }> => {
  const personLinkMode = options?.personLinkMode ?? 'always';

  const existing = await prisma.player.findFirst({
    where: {
      tournamentId,
      OR: [
        {
          firstName: account.firstName,
          lastName: account.lastName,
        },
        ...(account.email ? [{ email: account.email }] : []),
      ],
    },
    select: {
      id: true,
      personId: true,
      email: true,
      skillLevel: true,
      isActive: true,
    },
  });

  const personId = await resolveImportPlayerPersonId(account, personLinkMode);

  if (existing) {
    const needsUpdate = shouldUpdateTournamentPlayer(existing, account, personLinkMode, personId);

    if (needsUpdate) {
      await prisma.player.update({
        where: { id: existing.id },
        data: buildTournamentPlayerUpdateData(account, personLinkMode, personId),
        select: { id: true },
      });
    }

    return { id: existing.id, created: false };
  }

  const created = await prisma.player.create({
    data: buildTournamentPlayerCreateData(tournamentId, account, personLinkMode, personId),
    select: { id: true },
  });

  return { id: created.id, created: true };
};

const buildImportedDoublettePasswordHash = (tournamentId: string, teamName: string): string => {
  const hash = createHash('sha256').update(`${tournamentId}:${teamName}`).digest('hex');
  return hash.slice(0, 64);
};

const buildImportedTournamentNames = (
  parsed: ParsedTournamentImportFile
): { singleName: string; doubleName: string } => {
  const label = parsed.seriesName && parsed.seriesName.trim().length > 0
    ? parsed.seriesName.trim()
    : 'Import';

  return {
    singleName: `${label} Individuel ${parsed.singleDate!.getUTCFullYear()}`,
    doubleName: `${label} Doublette ${parsed.doubleDate!.getUTCFullYear()}`,
  };
};

const importSingleRegistrationsToTournament = async (
  tournamentId: string,
  players: ImportedUserCandidate[]
): Promise<number> => {
  let createdCount = 0;
  for (const player of players) {
    const result = await ensureTournamentPlayer(tournamentId, player);
    if (result.created) {
      createdCount += 1;
    }
  }
  return createdCount;
};

const importDoublettesToTournament = async (
  tournamentId: string,
  doublettes: ImportedDoubletteCandidate[]
): Promise<{ doublettesCreated: number; doublePlayersCreated: number }> => {
  let doublettesCreated = 0;
  let doublePlayersCreated = 0;

  for (const doublette of doublettes) {
    const memberOne = await ensureTournamentPlayer(tournamentId, {
      ...doublette.memberOne,
      ...(doublette.skillLevel ? { skillLevel: doublette.skillLevel } : {}),
    }, { personLinkMode: 'always' });
    const memberTwo = await ensureTournamentPlayer(tournamentId, {
      ...doublette.memberTwo,
      ...(doublette.skillLevel ? { skillLevel: doublette.skillLevel } : {}),
    }, { personLinkMode: 'always' });

    if (memberOne.created) {
      doublePlayersCreated += 1;
    }
    if (memberTwo.created) {
      doublePlayersCreated += 1;
    }

    const existingDoublette = await prisma.doublette.findFirst({
      where: {
        tournamentId,
        name: doublette.name,
      },
      select: { id: true },
    });
    if (existingDoublette) {
      continue;
    }

    const createdDoublette = await prisma.doublette.create({
      data: {
        tournamentId,
        name: doublette.name,
        captainPlayerId: memberOne.id,
        passwordHash: buildImportedDoublettePasswordHash(tournamentId, doublette.name),
        ...(doublette.skillLevel ? { skillLevel: doublette.skillLevel } : {}),
        isRegistered: true,
        registeredAt: new Date(),
      },
      select: { id: true },
    });

    await prisma.doubletteMember.createMany({
      data: [
        { doubletteId: createdDoublette.id, playerId: memberOne.id },
        { doubletteId: createdDoublette.id, playerId: memberTwo.id },
      ],
      skipDuplicates: true,
    });

    doublettesCreated += 1;
  }

  return { doublettesCreated, doublePlayersCreated };
};

const importTournamentRegistrations = async (content: string): Promise<ImportedTournamentSummary> => {
  const parsed = parseImportedTournamentsFile(content);
  const issues = [...parsed.issues];

  if (!parsed.singleDate || !parsed.doubleDate) {
    issues.push('Dates de tournois introuvables dans le fichier.');
    return {
      tournamentsCreated: 0,
      tournamentsUpdated: 0,
      singleRegistrationsCreated: 0,
      doublettesCreated: 0,
      doublePlayersCreated: 0,
      issues: issues.slice(0, 20),
    };
  }

  const { singleName, doubleName } = buildImportedTournamentNames(parsed);

  const singleTournament = await upsertImportedTournament(
    singleName,
    'SINGLE',
    parsed.singleDate,
    parsed.singlePlayers.length
  );
  const doubleTournament = await upsertImportedTournament(
    doubleName,
    'DOUBLE',
    parsed.doubleDate,
    parsed.doublettes.length
  );

  const singleRegistrationsCreated = await importSingleRegistrationsToTournament(
    singleTournament.id,
    parsed.singlePlayers
  );
  const { doublettesCreated, doublePlayersCreated } = await importDoublettesToTournament(
    doubleTournament.id,
    parsed.doublettes
  );

  return {
    tournamentsCreated: Number(singleTournament.created) + Number(doubleTournament.created),
    tournamentsUpdated: Number(!singleTournament.created) + Number(!doubleTournament.created),
    singleRegistrationsCreated,
    doublettesCreated,
    doublePlayersCreated,
    issues: issues.slice(0, 20),
    singleTournamentId: singleTournament.id,
    doubleTournamentId: doubleTournament.id,
  };
};

const importUserAccounts = async (
  content: string,
  options?: { includeTournamentImport?: boolean }
): Promise<ImportedUserSummary> => {
  const parsed = parseImportedUsersFile(content);
  if (parsed.accounts.length === 0) {
    const summary: ImportedUserSummary = {
      rowsRead: parsed.rowsRead,
      accountsDetected: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: parsed.issues.length,
      issues: parsed.issues.slice(0, 20),
    };

    if (options?.includeTournamentImport) {
      summary.tournamentImport = await importTournamentRegistrations(content);
    }

    return summary;
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = parsed.issues.length;
  const issues = [...parsed.issues];

  for (const account of parsed.accounts) {
    const result = await importSingleUserAccount(account);
    if (result === 'created') {
      createdCount += 1;
      continue;
    }

    if (result === 'updated') {
      updatedCount += 1;
      continue;
    }

    skippedCount += 1;
  }

  const summary: ImportedUserSummary = {
    rowsRead: parsed.rowsRead,
    accountsDetected: parsed.accounts.length,
    createdCount,
    updatedCount,
    skippedCount,
    issues: issues.slice(0, 20),
  };

  if (options?.includeTournamentImport) {
    summary.tournamentImport = await importTournamentRegistrations(content);
  }

  return summary;
};

const buildUsersWhereClause = (query?: string, tournamentId?: string): Prisma.PersonWhereInput | undefined => {
  const where: Prisma.PersonWhereInput = {};

  if (query) {
    where.OR = [
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
      { surname: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (tournamentId) {
    where.players = {
      some: {
        tournamentId,
        isActive: true,
      },
    };
  }

  return Object.keys(where).length > 0 ? where : undefined;
};

const fetchAdminUsers = async (
  query: string | undefined,
  tournamentId: string | undefined,
  limit: number
): Promise<AdminUserRow[]> => {
  const where = buildUsersWhereClause(query, tournamentId);
  return prisma.person.findMany({
    ...(where ? { where } : {}),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      surname: true,
      email: true,
      skillLevel: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
};

const fetchTournamentLinksForPersons = async (personIds: string[]): Promise<TournamentLinkRow[]> => {
  if (personIds.length === 0) {
    return [];
  }

  return prisma.player.findMany({
    where: {
      personId: { in: personIds },
      isActive: true,
      // eslint-disable-next-line unicorn/no-null
      tournamentId: { not: null },
    },
    select: {
      personId: true,
      tournamentId: true,
    },
    distinct: ['personId', 'tournamentId'],
  });
};

const fetchActivePlayerLinksForPersons = async (personIds: string[]): Promise<ActivePlayerLinkRow[]> => {
  if (personIds.length === 0) {
    return [];
  }

  return prisma.player.findMany({
    where: {
      personId: { in: personIds },
      isActive: true,
    },
    select: {
      personId: true,
      skillLevel: true,
    },
    orderBy: [
      { registeredAt: 'desc' },
    ],
  });
};

const buildSkillLevelByPersonId = (activePlayerLinks: ActivePlayerLinkRow[]): Map<string, string> => {
  const skillLevelByPersonId = new Map<string, string>();
  for (const link of activePlayerLinks) {
    if (!link.personId || !link.skillLevel || skillLevelByPersonId.has(link.personId)) {
      continue;
    }
    skillLevelByPersonId.set(link.personId, link.skillLevel);
  }
  return skillLevelByPersonId;
};

const buildTournamentCountByPersonId = (tournamentLinks: TournamentLinkRow[]): Map<string, number> => {
  const tournamentCountByPersonId = new Map<string, number>();
  for (const link of tournamentLinks) {
    if (!link.personId || !link.tournamentId) {
      continue;
    }
    const current = tournamentCountByPersonId.get(link.personId) ?? 0;
    tournamentCountByPersonId.set(link.personId, current + 1);
  }
  return tournamentCountByPersonId;
};

const buildActivePlayersByPersonId = (activePlayerLinks: ActivePlayerLinkRow[]): Set<string> => (
  new Set(
    activePlayerLinks
      .map((link) => link.personId)
      .filter((personId): personId is string => typeof personId === 'string' && personId.length > 0)
  )
);

const isLocalDevelopmentRequest = (request: Request): boolean => {
  const host = request.hostname?.toLowerCase();
  return config.isDevelopment && (host === 'localhost' || host === '127.0.0.1' || host === '::1');
};

router.get('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  response.json({
    mode: getActiveDevelopmentAutologinMode(request) ?? 'anonymous',
    availableModes: DEVELOPMENT_AUTOLOGIN_MODES,
  });
});

router.post('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  const mode = parseDevelopmentAutologinMode(request.body?.mode);
  if (!mode) {
    response.status(400).json({
      error: 'Bad Request',
      message: `Mode must be one of: ${DEVELOPMENT_AUTOLOGIN_MODES.join(', ')}`,
    });
    return;
  }

  response.cookie(DEVELOPMENT_AUTOLOGIN_COOKIE_NAME, mode, {
    sameSite: 'lax',
    secure: false,
    httpOnly: false,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  response.json({ mode });
});

// Get current user info and admin status
router.get('/me', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userPayload = request.auth?.payload;

  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = resolveUserEmailFromPayload(userPayload);

  let person:
    | {
      id: string;
      firstName: string;
      lastName: string;
      surname: string | null;
      email: string | null;
    }
    | undefined;

  if (email) {
    try {
      person = await ensurePersonForAuthenticatedUser(userPayload, email, request.correlationId);
    } catch (error) {
      logger.error('Failed to ensure Person for authenticated user', {
        correlationId: request.correlationId,
        metadata: {
          email,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      response.status(500).json({ error: 'Internal Server Error' });
      return;
    }
  }

  let effectiveName: string | undefined;
  if (person?.firstName && person.lastName) {
    effectiveName = buildDisplayName(person);
  } else if (typeof userPayload.name === 'string') {
    effectiveName = userPayload.name;
  }

  response.json({
    user: {
      id: userPayload.sub,
      email,
      name: effectiveName,
      picture: userPayload.picture,
      ...(person ? {
        firstName: person.firstName,
        lastName: person.lastName,
        ...(person.surname ? { surname: person.surname } : {}),
      } : {}),
    },
    isAdmin: isAdmin(request),
  });
});

router.patch('/me/profile', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userPayload = request.auth?.payload;
  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = resolveUserEmailFromPayload(userPayload);
  if (!email) {
    response.status(400).json({ error: 'Bad Request', message: 'Authenticated user email is required' });
    return;
  }

  const firstName = normalizeNamePart(request.body?.firstName);
  const lastName = normalizeNamePart(request.body?.lastName);
  const surnameInput = request.body?.surname;
  const surname = typeof surnameInput === 'string'
    ? surnameInput.trim().slice(0, 50)
    : undefined;

  if (!firstName || !lastName) {
    response.status(400).json({
      error: 'Bad Request',
      message: 'firstName and lastName must be between 2 and 50 characters',
    });
    return;
  }

  try {
    const person = await ensurePersonForAuthenticatedUser(userPayload, email, request.correlationId);
    const updated = await prisma.person.update({
      where: { id: person.id },
      data: {
        firstName,
        lastName,
        ...(surname === undefined ? {} : { surname }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        email: true,
      },
    });

    response.json({
      user: {
        id: userPayload.sub,
        email,
        name: buildDisplayName(updated),
        picture: userPayload.picture,
        firstName: updated.firstName,
        lastName: updated.lastName,
        ...(updated.surname ? { surname: updated.surname } : {}),
      },
      isAdmin: isAdmin(request),
    });
  } catch (error) {
    logger.error('Failed to update authenticated Person profile', {
      correlationId: request.correlationId,
      metadata: {
        email,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/users', requireAuth, async (request: Request, response: Response): Promise<void> => {
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const query = resolveSearchQuery(request.query?.q);
  const parsedTournamentFilter = resolveTournamentFilterId(request.query?.tournamentId);
  if (parsedTournamentFilter.errorMessage) {
    response.status(400).json({ error: 'Bad Request', message: parsedTournamentFilter.errorMessage });
    return;
  }
  const tournamentId = parsedTournamentFilter.tournamentId;
  const limitCandidate = Number(request.query?.limit);
  const limit = Number.isFinite(limitCandidate)
    ? Math.min(Math.max(Math.trunc(limitCandidate), 1), 200)
    : 100;

  try {
    const users = await fetchAdminUsers(query, tournamentId, limit);
    const personIds = users.map((user) => user.id);
    const [tournamentLinks, activePlayerLinks] = await Promise.all([
      fetchTournamentLinksForPersons(personIds),
      fetchActivePlayerLinksForPersons(personIds),
    ]);

    const activePlayersByPersonId = buildActivePlayersByPersonId(activePlayerLinks);
    const skillLevelByPersonId = buildSkillLevelByPersonId(activePlayerLinks);
    const tournamentCountByPersonId = buildTournamentCountByPersonId(tournamentLinks);

    response.json({
      users: users.map((user) => {
        const adminAccount = isAdminEmail(user.email);
        const hasActivePlayers = activePlayersByPersonId.has(user.id);
        const resolvedSkillLevel = skillLevelByPersonId.get(user.id) ?? user.skillLevel ?? undefined;

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          surname: user.surname,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          ...(resolvedSkillLevel ? { skillLevel: resolvedSkillLevel } : {}),
          tournamentCount: tournamentCountByPersonId.get(user.id) ?? 0,
          isAdminAccount: adminAccount,
          activePlayerCount: hasActivePlayers ? 1 : 0,
          canDelete: adminAccount ? false : !hasActivePlayers,
        };
      }),
    });
  } catch (error) {
    logger.error('Failed to list user accounts', {
      correlationId: request.correlationId,
      metadata: {
        query,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/users/:id', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userId = request.params.id ?? '';
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const parsedUpdate = parseAdminAccountUpdatePayload(
    typeof request.body === 'object' && request.body !== null
      ? request.body as Record<string, unknown>
      : {}
  );

  if (parsedUpdate.errorMessage) {
    response.status(400).json({ error: 'Bad Request', message: parsedUpdate.errorMessage });
    return;
  }

  const { updates } = parsedUpdate;
  if (updates === undefined) {
    response.status(400).json({ error: 'Bad Request', message: 'No updatable fields provided' });
    return;
  }

  try {
    const { skillLevel, ...personUpdates } = updates;
    const updated = await prisma.person.update({
      where: { id: userId },
      data: {
        ...personUpdates,
        ...(skillLevel === undefined ? {} : { skillLevel }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        email: true,
        skillLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let resolvedSkillLevel: string | undefined;
    if (skillLevel === undefined) {
      resolvedSkillLevel = updated.skillLevel ?? undefined;
      if (!resolvedSkillLevel) {
        const latestActivePlayer = await prisma.player.findFirst({
          where: {
            personId: userId,
            isActive: true,
          },
          orderBy: [
            { registeredAt: 'desc' },
          ],
          select: {
            skillLevel: true,
          },
        });
        resolvedSkillLevel = latestActivePlayer?.skillLevel ?? undefined;
      }
    } else {
      await prisma.player.updateMany({
        where: {
          personId: userId,
          isActive: true,
        },
        data: {
          skillLevel,
        },
      });
      resolvedSkillLevel = skillLevel ?? undefined;
    }

    response.json({ user: { ...updated, ...(resolvedSkillLevel ? { skillLevel: resolvedSkillLevel } : {}) } });
  } catch (error) {
    handleAdminAccountUpdateError(request, response, userId, error);
  }
});

router.post('/users/import', requireAuth, async (request: Request, response: Response): Promise<void> => {
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const body = typeof request.body === 'object' && request.body !== null
    ? request.body as Record<string, unknown>
    : {};
  const content = typeof body.content === 'string' ? body.content : undefined;
  const includeTournamentImport = body.includeTournamentImport === true;

  if (!content || content.trim().length === 0) {
    response.status(400).json({ error: 'Bad Request', message: 'Import content is required' });
    return;
  }

  try {
    const summary = await importUserAccounts(content, { includeTournamentImport });
    response.json(summary);
  } catch (error) {
    const code = typeof error === 'object' && error !== null
      ? (error as { code?: string }).code
      : undefined;

    if (code === 'P2002') {
      response.status(409).json({ error: 'Conflict', message: 'Import conflict on a duplicated email' });
      return;
    }

    logger.error('Failed to import user accounts', {
      correlationId: request.correlationId,
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/users', requireAuth, async (request: Request, response: Response): Promise<void> => {
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const scope = typeof request.query?.scope === 'string' ? request.query.scope.trim() : '';
  if (scope !== 'without-tournament') {
    response.status(400).json({
      error: 'Bad Request',
      message: 'Invalid scope. Use scope=without-tournament',
    });
    return;
  }

  try {
    const candidates = await prisma.person.findMany({
      where: {
        players: {
          none: {
            // eslint-disable-next-line unicorn/no-null
            tournamentId: { not: null },
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const deletableIds = candidates
      .filter((candidate) => !isAdminEmail(candidate.email))
      .map((candidate) => candidate.id);

    if (deletableIds.length === 0) {
      response.json({ deletedCount: 0 });
      return;
    }

    const deletionResult = await prisma.person.deleteMany({
      where: {
        id: {
          in: deletableIds,
        },
      },
    });

    response.json({ deletedCount: deletionResult.count });
  } catch (error) {
    logger.error('Failed to bulk delete user accounts without tournaments', {
      correlationId: request.correlationId,
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/users/:id', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userId = request.params.id ?? '';
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  try {
    const person = await prisma.person.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!person) {
      response.status(404).json({ error: 'Not Found', message: 'User account not found' });
      return;
    }

    if (isAdminEmail(person.email)) {
      response.status(403).json({ error: 'Forbidden', message: 'Cannot delete admin account' });
      return;
    }

    const activePlayersCount = await prisma.player.count({
      where: {
        personId: userId,
        isActive: true,
      },
    });

    if (activePlayersCount > 0) {
      response.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete account linked to active player registrations',
      });
      return;
    }

    await prisma.person.delete({ where: { id: userId } });
    response.status(204).send();
  } catch (error) {
    logger.error('Failed to delete user account', {
      correlationId: request.correlationId,
      metadata: {
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
