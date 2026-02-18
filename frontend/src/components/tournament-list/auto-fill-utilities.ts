import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';

type BuildAutoFillParameters = {
  remainingSlots: number;
  players: TournamentPlayer[];
  isTeamFormat: boolean;
  sampleFirstNames: string[];
  sampleLastNames: string[];
  lastNameModifiers: string[];
  sampleSurnames: string[];
  sampleTeams: string[];
  teamModifiers: string[];
};

type AutoFillResult = { registrations: CreatePlayerPayload[]; error?: string };

type NamePair = { firstName: string; lastName: string };

const secureRandomIndex = (maxExclusive: number): number => {
  if (maxExclusive <= 0) {
    return 0;
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator unavailable');
  }
  const maxUint32 = 0xFFFFFFFF;
  const limit = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    cryptoApi.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);
  return value % maxExclusive;
};

const secureRandomInt = (min: number, max: number): number => {
  if (max < min) {
    return min;
  }
  const range = max - min + 1;
  return min + secureRandomIndex(range);
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const index_ = secureRandomIndex(index + 1);
    const current = copy[index];
    const swap = copy[index_];
    if (current === undefined || swap === undefined) {
      continue;
    }
    [copy[index], copy[index_]] = [swap, current];
  }
  return copy;
};

const buildCandidates = (bases: string[], modifiers: string[]) => {
  const candidates = new Set<string>();
  for (const base of bases) {
    candidates.add(base);
    for (const modifier of modifiers) {
      candidates.add(`${base} ${modifier}`);
      candidates.add(`${modifier} ${base}`);
    }
  }
  return [...candidates];
};

const buildExistingPlayerSets = (playersList: TournamentPlayer[]) => {
  const existingNames = new Set(playersList.map((player) => player.name.toLowerCase()));
  const existingSurnames = new Set(
    playersList
      .map((player) => player.surname?.toLowerCase())
      .filter((value): value is string => typeof value === 'string')
  );
  const existingTeamNames = new Set(
    playersList
      .map((player) => player.teamName?.toLowerCase())
      .filter((value): value is string => typeof value === 'string')
  );
  return { existingNames, existingSurnames, existingTeamNames };
};

const buildCandidateLastNames = (names: string[], modifiers: string[]) => {
  const candidateLastNames = new Set(names);
  for (const lastName of names) {
    for (const modifier of modifiers) {
      candidateLastNames.add(`${lastName}-${modifier}`);
    }
  }
  return candidateLastNames;
};

const buildNamePairs = (
  firstNames: string[],
  lastNames: Iterable<string>
): NamePair[] => {
  const pairs: NamePair[] = [];
  for (const firstName of firstNames) {
    for (const lastName of lastNames) {
      pairs.push({ firstName, lastName });
    }
  }
  return pairs;
};

const buildRegistrations = (parameters: {
  remainingSlots: number;
  isTeamFormat: boolean;
  existingNames: Set<string>;
  shuffledPairs: NamePair[];
  shuffledSurnames: string[];
  shuffledTeams: string[];
}): CreatePlayerPayload[] => {
  const registrations: CreatePlayerPayload[] = [];
  let surnameIndex = 0;
  let teamIndex = 0;

  for (const pair of parameters.shuffledPairs) {
    if (registrations.length >= parameters.remainingSlots) {
      break;
    }
    const fullName = `${pair.firstName} ${pair.lastName}`.toLowerCase();
    if (parameters.existingNames.has(fullName)) {
      continue;
    }
    parameters.existingNames.add(fullName);
    const surname = parameters.shuffledSurnames[surnameIndex];
    const teamName = parameters.isTeamFormat ? parameters.shuffledTeams[teamIndex] : undefined;
    const payload: CreatePlayerPayload = {
      firstName: pair.firstName,
      lastName: pair.lastName,
      email: `${pair.firstName.toLowerCase()}.${pair.lastName.toLowerCase()}@example.com`,
      phone: `0${secureRandomInt(100_000_000, 999_999_999)}`,
    };
    if (surname) {
      payload.surname = surname;
    }
    if (teamName) {
      payload.teamName = teamName;
    }
    registrations.push(payload);
    surnameIndex += 1;
    if (parameters.isTeamFormat) {
      teamIndex += 1;
    }
  }

  return registrations;
};

export const buildAutoFillRegistrations = (parameters: BuildAutoFillParameters): AutoFillResult => {
  const { existingNames, existingSurnames, existingTeamNames } = buildExistingPlayerSets(parameters.players);
  const candidateLastNames = buildCandidateLastNames(parameters.sampleLastNames, parameters.lastNameModifiers);
  const surnameCandidates = buildCandidates(parameters.sampleSurnames, parameters.lastNameModifiers)
    .filter((surname) => !existingSurnames.has(surname.toLowerCase()));
  const teamCandidates = buildCandidates(parameters.sampleTeams, parameters.teamModifiers)
    .filter((team) => !existingTeamNames.has(team.toLowerCase()));

  if (surnameCandidates.length < parameters.remainingSlots) {
    return { registrations: [], error: 'Not enough unique surnames to fill remaining slots.' };
  }
  if (parameters.isTeamFormat && teamCandidates.length < parameters.remainingSlots) {
    return { registrations: [], error: 'Not enough unique team names to fill remaining slots.' };
  }

  const shuffledPairs = shuffleArray(buildNamePairs(parameters.sampleFirstNames, candidateLastNames));
  const shuffledSurnames = shuffleArray(surnameCandidates);
  const shuffledTeams = shuffleArray(teamCandidates);

  const registrations = buildRegistrations({
    remainingSlots: parameters.remainingSlots,
    isTeamFormat: parameters.isTeamFormat,
    existingNames,
    shuffledPairs,
    shuffledSurnames,
    shuffledTeams,
  });

  if (registrations.length < parameters.remainingSlots) {
    return { registrations: [], error: 'Not enough unique names to fill remaining slots.' };
  }

  return { registrations };
};
