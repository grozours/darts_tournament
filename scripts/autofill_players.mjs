#!/usr/bin/env node

import { randomInt } from 'node:crypto';

const apiBase = process.env.API_BASE || 'http://localhost:3000';
const registrationEmptySlots = Number(process.env.REGISTRATION_EMPTY_SLOTS ?? '0');

const sampleFirstNames = [
  'Alex',
  'Jamie',
  'Taylor',
  'Casey',
  'Jordan',
  'Morgan',
  'Riley',
  'Cameron',
  'Drew',
  'Avery',
  'Parker',
  'Skyler',
  'Quinn',
  'Reese',
  'Rowan',
  'Emerson',
];

const sampleLastNames = [
  'Morgan',
  'Lee',
  'Jordan',
  'Nguyen',
  'Patel',
  'Santos',
  'Chen',
  'Brooks',
  'Fischer',
  'Lopez',
  'Kim',
  'Wright',
  'Martin',
  'Garcia',
  'Singh',
  'Bennett',
];

const lastNameModifiers = [
  'River',
  'Stone',
  'Fox',
  'Bear',
  'Hawk',
  'Vale',
  'Wood',
  'Field',
  'Hill',
  'Cross',
  'Lane',
  'Grove',
];

const sampleSurnames = [
  'Falcon',
  'Viper',
  'Atlas',
  'Nova',
  'Phoenix',
  'Storm',
  'Onyx',
  'Comet',
  'Raptor',
  'Blaze',
  'Echo',
  'Summit',
  'Orion',
  'Lynx',
  'Cobalt',
  'Aurora',
];

const buildCandidates = (bases, modifiers) => {
  const candidates = new Set();
  for (const base of bases) {
    candidates.add(base);
    for (const modifier of modifiers) {
      candidates.add(`${base} ${modifier}`);
      candidates.add(`${modifier} ${base}`);
    }
  }
  return [...candidates];
};

const buildCandidateLastNames = (names, modifiers) => {
  const candidateLastNames = new Set(names);
  for (const lastName of names) {
    for (const modifier of modifiers) {
      candidateLastNames.add(`${lastName}-${modifier}`);
    }
  }
  return [...candidateLastNames];
};

const buildNamePairs = (firstNames, lastNames) => {
  const pairs = [];
  for (const firstName of firstNames) {
    for (const lastName of lastNames) {
      pairs.push({ firstName, lastName });
    }
  }
  return pairs;
};

const shuffleArray = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const index_ = randomInt(0, index + 1);
    [copy[index], copy[index_]] = [copy[index_], copy[index]];
  }
  return copy;
};

const buildRegistrations = (count, existingNames) => {
  const candidateLastNames = buildCandidateLastNames(sampleLastNames, lastNameModifiers);
  const surnameCandidates = buildCandidates(sampleSurnames, lastNameModifiers);
  if (surnameCandidates.length < count) {
    throw new Error('Not enough surnames to generate players.');
  }

  const shuffledPairs = shuffleArray(buildNamePairs(sampleFirstNames, candidateLastNames));
  const shuffledSurnames = shuffleArray(surnameCandidates);

  const registrations = [];
  let surnameIndex = 0;

  for (const pair of shuffledPairs) {
    if (registrations.length >= count) {
      break;
    }
    const fullName = `${pair.firstName} ${pair.lastName}`.toLowerCase();
    if (existingNames.has(fullName)) {
      continue;
    }
    existingNames.add(fullName);
    const surname = shuffledSurnames[surnameIndex];
    const payload = {
      firstName: pair.firstName,
      lastName: pair.lastName,
      surname,
      email: `${pair.firstName.toLowerCase()}.${pair.lastName.toLowerCase()}@example.com`,
      phone: `0${randomInt(100_000_000, 1_000_000_000)}`,
    };
    registrations.push(payload);
    surnameIndex += 1;
  }

  if (registrations.length < count) {
    throw new Error('Not enough unique names to generate players.');
  }

  return registrations;
};

const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
};

const fetchPlayers = async (tournamentId) => {
  const data = await requestJson(`${apiBase}/api/tournaments/${tournamentId}/players`);
  return data.players || [];
};

const registerPlayers = async (tournamentId, desiredCount) => {
  const existingPlayers = await fetchPlayers(tournamentId);
  const remaining = Math.max(0, desiredCount - existingPlayers.length);
  if (remaining === 0) {
    return;
  }
  const existingNames = new Set(
    existingPlayers
      .map((player) => `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase())
      .filter((name) => name.length > 0)
  );
  const registrations = buildRegistrations(remaining, existingNames);
  for (const payload of registrations) {
    await requestJson(`${apiBase}/api/tournaments/${tournamentId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
};

const checkInPlayers = async (tournamentId) => {
  const players = await fetchPlayers(tournamentId);
  for (const player of players) {
    await requestJson(`${apiBase}/api/tournaments/${tournamentId}/players/${player.playerId}/check-in`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkedIn: true }),
    });
  }
};

const setTournamentStatus = async (tournamentId, status) => {
  await requestJson(`${apiBase}/api/tournaments/${tournamentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, force: true }),
  });
};

const getLiveView = async (tournamentId) => requestJson(`${apiBase}/api/tournaments/${tournamentId}/live`);

const getStagePoolsSummary = async (tournamentId, stageNumber = 1) => {
  const liveView = await getLiveView(tournamentId);
  const stage = (liveView.poolStages || []).find((item) => item.stageNumber === stageNumber);
  const pools = stage?.pools || [];
  const assignmentCount = pools.reduce((total, pool) => total + ((pool.assignments || []).length), 0);
  return {
    stage,
    poolsCount: pools.length,
    assignmentCount,
  };
};

const forceActivateStage = async (tournamentId, stageId, poolCount, playersPerPool) => {
  await requestJson(`${apiBase}/api/tournaments/${tournamentId}/pool-stages/${stageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'EDITION',
      ...(poolCount > 0 ? { poolCount } : {}),
      ...(playersPerPool > 0 ? { playersPerPool } : {}),
    }),
  });

  await requestJson(`${apiBase}/api/tournaments/${tournamentId}/pool-stages/${stageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
};

const activateStageOne = async (tournamentId) => {
  const data = await requestJson(`${apiBase}/api/tournaments/${tournamentId}/pool-stages`);
  const stages = data.poolStages || [];
  const stageOne = stages.find((stage) => stage.stageNumber === 1);
  if (!stageOne) {
    throw new Error('Stage 1 not found for tournament.');
  }

  const poolCount = Number(stageOne.poolCount ?? 0);
  const playersPerPool = Number(stageOne.playersPerPool ?? 0);

  await forceActivateStage(tournamentId, stageOne.id, poolCount, playersPerPool);

  const summary = await getStagePoolsSummary(tournamentId, 1);
  if (summary.poolsCount === 0 || summary.assignmentCount === 0) {
    await forceActivateStage(tournamentId, stageOne.id, poolCount, playersPerPool);
    const retrySummary = await getStagePoolsSummary(tournamentId, 1);
    if (retrySummary.poolsCount === 0 || retrySummary.assignmentCount === 0) {
      throw new Error(
        `Stage 1 pools not initialized (pools=${retrySummary.poolsCount}, assignments=${retrySummary.assignmentCount}).`
      );
    }
  }
};

const findTournamentId = async (name) => {
  const data = await requestJson(`${apiBase}/api/tournaments?limit=100`);
  const tournaments = data.tournaments || [];
  const match = tournaments.find((t) => t.name === name);
  if (!match) {
    throw new Error(`Tournament not found: ${name}`);
  }
  return match.id;
};

const main = async () => {
  const t1Id = await findTournamentId('Registration Cup');
  const t2Id = await findTournamentId('Dual Stage Open');

  const t1Info = await requestJson(`${apiBase}/api/tournaments/${t1Id}`);
  const t1Capacity = Number(t1Info.totalParticipants ?? 0);
  const t1Target = Math.max(0, t1Capacity - registrationEmptySlots);
  if (t1Target > 0) {
    await registerPlayers(t1Id, t1Target);
  }
  await registerPlayers(t2Id, 40);

  const t2Info = await requestJson(`${apiBase}/api/tournaments/${t2Id}`);
  if (t2Info.status !== 'LIVE') {
    await setTournamentStatus(t2Id, 'SIGNATURE');
    await checkInPlayers(t2Id);
    await setTournamentStatus(t2Id, 'LIVE');
  }
  await activateStageOne(t2Id);

  console.log('Players added and T2 activated.');
  console.log(`Registration Cup: ${t1Id}`);
  console.log(`Dual Stage Open: ${t2Id}`);
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
