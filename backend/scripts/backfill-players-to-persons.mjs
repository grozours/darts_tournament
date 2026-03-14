#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const AMBIGUOUS = 'AMBIGUOUS';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeEmail = (value) => {
  const trimmed = normalizeText(value).toLowerCase();
  if (trimmed && trimmed.includes('@')) {
    return trimmed;
  }
};

const toNameKey = (firstName, lastName, surname) => [
  normalizeText(firstName).toLowerCase(),
  normalizeText(lastName).toLowerCase(),
  normalizeText(surname).toLowerCase(),
].join('|');

const putPersonInIndex = (indexes, person) => {
  const normalizedEmail = normalizeEmail(person.email);
  if (normalizedEmail && !indexes.emailMap.has(normalizedEmail)) {
    indexes.emailMap.set(normalizedEmail, person);
  }

  const nameKey = toNameKey(person.firstName, person.lastName, person.surname ?? '');
  const previous = indexes.nameMap.get(nameKey);
  if (!previous) {
    indexes.nameMap.set(nameKey, person);
    return;
  }

  if (previous !== AMBIGUOUS && previous.id !== person.id) {
    indexes.nameMap.set(nameKey, AMBIGUOUS);
  }
};

const loadPersonsIndex = async () => {
  const persons = await prisma.person.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      surname: true,
      email: true,
    },
  });

  const indexes = {
    emailMap: new Map(),
    nameMap: new Map(),
  };

  for (const person of persons) {
    putPersonInIndex(indexes, person);
  }

  return indexes;
};

const buildPersonCreateData = (player) => {
  const firstName = normalizeText(player.firstName) || 'Unknown';
  const lastName = normalizeText(player.lastName) || 'Player';
  const surname = normalizeText(player.surname);
  const email = normalizeEmail(player.email);

  return {
    firstName,
    lastName,
    ...(surname ? { surname } : {}),
    ...(email ? { email } : {}),
  };
};

const loadPlayersWithoutPerson = async () => {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      personId: true,
      firstName: true,
      lastName: true,
      surname: true,
      email: true,
      registeredAt: true,
    },
    orderBy: {
      registeredAt: 'asc',
    },
  });

  return players.filter((player) => typeof player.personId !== 'string' || player.personId.length === 0);
};

const findByUniqueName = (indexes, player) => {
  const key = toNameKey(player.firstName, player.lastName, player.surname ?? '');
  const candidate = indexes.nameMap.get(key);
  if (!candidate || candidate === AMBIGUOUS) {
    return;
  }
  return candidate;
};

const findExistingPerson = (indexes, player) => {
  const email = normalizeEmail(player.email);
  if (email) {
    const candidate = indexes.emailMap.get(email);
    if (candidate) {
      return candidate;
    }
  }
  return findByUniqueName(indexes, player);
};

const findPersonByEmailInsensitive = async (email) => prisma.person.findFirst({
  where: {
    email: { equals: email, mode: 'insensitive' },
  },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    surname: true,
    email: true,
  },
});

const createPersonForPlayer = async (player) => {
  const data = buildPersonCreateData(player);
  try {
    return await prisma.person.create({ data });
  } catch (error) {
    const code = typeof error === 'object' && error ? error.code : '';
    if (code === 'P2002' && data.email) {
      const byEmail = await findPersonByEmailInsensitive(data.email);
      if (byEmail) {
        return byEmail;
      }
    }
    throw error;
  }
};

const resolvePersonForPlayer = async (indexes, player) => {
  const existing = findExistingPerson(indexes, player);
  if (existing) {
    return { person: existing, created: false };
  }

  if (mode === 'apply') {
    const created = await createPersonForPlayer(player);
    return { person: created, created: true };
  }

  const dryRunPerson = {
    id: `DRY_RUN_${player.id}`,
    ...buildPersonCreateData(player),
  };
  return { person: dryRunPerson, created: true };
};

const linkPlayerToPerson = async (playerId, personId) => {
  if (mode === 'apply') {
    await prisma.player.update({
      where: { id: playerId },
      data: { personId },
    });
  }
};

const backfillPlayersToPersons = async () => {
  console.log(`[person-backfill] Mode: ${mode}`);
  const playersWithoutPerson = await loadPlayersWithoutPerson();
  if (playersWithoutPerson.length === 0) {
    console.log('[person-backfill] No players without personId. Nothing to do.');
    return;
  }

  const indexes = await loadPersonsIndex();
  const stats = {
    scanned: playersWithoutPerson.length,
    linkedPlayers: 0,
    linkedToExisting: 0,
    createdPersons: 0,
  };

  for (const player of playersWithoutPerson) {
    const { person, created } = await resolvePersonForPlayer(indexes, player);
    await linkPlayerToPerson(player.id, person.id);
    putPersonInIndex(indexes, person);

    stats.linkedPlayers += 1;
    if (created) {
      stats.createdPersons += 1;
    } else {
      stats.linkedToExisting += 1;
    }
  }

  console.log(`[person-backfill] Players scanned without personId: ${stats.scanned}`);
  console.log(`[person-backfill] Players linked: ${stats.linkedPlayers}`);
  console.log(`[person-backfill] Linked to existing persons: ${stats.linkedToExisting}`);
  console.log(`[person-backfill] New persons created: ${stats.createdPersons}`);

  if (mode === 'apply') {
    console.log('[person-backfill] Backfill completed successfully.');
    return;
  }

  console.log('[person-backfill] Dry-run complete. Re-run with --apply to persist changes.');
};

try {
  await backfillPlayersToPersons();
} catch (error) {
  console.error('[person-backfill] Failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
