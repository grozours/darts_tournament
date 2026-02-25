export type SchedulableMatch = {
  id: string;
  durationMinutes: number;
  playerIds: string[];
};

const buildPoolSlotResourceId = (poolId: string, slotIndex: number) => `__pool_slot:${poolId}:${slotIndex}`;

const getPoolConcurrencyLimit = (poolPlayerIds: string[], fallbackPlayerCount?: number) => {
  const uniquePlayers = new Set(poolPlayerIds.filter(Boolean)).size;
  const resolvedPlayerCount = uniquePlayers > 0
    ? uniquePlayers
    : Math.max(0, Math.floor(fallbackPlayerCount ?? 0));

  if (resolvedPlayerCount <= 1) {
    return 1;
  }
  return Math.max(1, Math.floor(resolvedPlayerCount / 2));
};

export const applyPoolConcurrencySlots = (
  matches: SchedulableMatch[],
  poolId: string,
  poolPlayerIds: string[],
  fallbackPlayerCount?: number
): SchedulableMatch[] => {
  if (matches.length === 0) {
    return [];
  }

  const concurrencyLimit = getPoolConcurrencyLimit(poolPlayerIds, fallbackPlayerCount);
  return matches.map((match, index) => ({
    ...match,
    playerIds: [
      ...match.playerIds,
      buildPoolSlotResourceId(poolId, index % concurrencyLimit),
    ],
  }));
};

const toUniqueSortedPlayerIds = (playerIds: string[]) => (
  [...new Set(playerIds.filter(Boolean))].sort((leftPlayerId, rightPlayerId) => (
    leftPlayerId.localeCompare(rightPlayerId)
  ))
);

export const getRoundRobinPairKey = (playerIds: string[]) => {
  const uniqueSortedPlayerIds = toUniqueSortedPlayerIds(playerIds);
  if (uniqueSortedPlayerIds.length !== 2) {
    return undefined;
  }
  return `${uniqueSortedPlayerIds[0]}::${uniqueSortedPlayerIds[1]}`;
};

type BuildMissingRoundRobinMatchesOptions = {
  idPrefix: string;
  playerIds: string[];
  existingPairKeys: Set<string>;
  durationMinutes: number;
};

export const buildMissingRoundRobinMatches = ({
  idPrefix,
  playerIds,
  existingPairKeys,
  durationMinutes,
}: BuildMissingRoundRobinMatchesOptions): SchedulableMatch[] => {
  const uniquePlayerIds = toUniqueSortedPlayerIds(playerIds);
  if (uniquePlayerIds.length < 2) {
    return [];
  }

  const matches: SchedulableMatch[] = [];
  let sequenceNumber = 1;

  for (let firstIndex = 0; firstIndex < uniquePlayerIds.length; firstIndex += 1) {
    const firstPlayerId = uniquePlayerIds[firstIndex];
    if (!firstPlayerId) {
      continue;
    }

    for (let secondIndex = firstIndex + 1; secondIndex < uniquePlayerIds.length; secondIndex += 1) {
      const secondPlayerId = uniquePlayerIds[secondIndex];
      if (!secondPlayerId) {
        continue;
      }

      const pairKey = `${firstPlayerId}::${secondPlayerId}`;
      if (existingPairKeys.has(pairKey)) {
        continue;
      }

      matches.push({
        id: `${idPrefix}-missing-${sequenceNumber}`,
        durationMinutes,
        playerIds: [firstPlayerId, secondPlayerId],
      });
      sequenceNumber += 1;
    }
  }

  return matches;
};

const getMatchReadyTimestamp = (
  match: SchedulableMatch,
  playerAvailabilityById: Map<string, number>
) => {
  if (match.playerIds.length === 0) {
    return 0;
  }
  return match.playerIds.reduce(
    (maxTimestamp, playerId) => Math.max(maxTimestamp, playerAvailabilityById.get(playerId) ?? 0),
    0
  );
};

const normalizeMatches = (matches: SchedulableMatch[]) => matches
  .map((match) => ({
    ...match,
    durationMinutes: Math.max(0, Math.ceil(match.durationMinutes)),
    playerIds: [...new Set(match.playerIds.filter(Boolean))],
  }))
  .filter((match) => match.durationMinutes > 0);

type BestSlot = {
  matchIndex: number;
  targetIndex: number;
  startTimestamp: number;
  finishTimestamp: number;
};

const getBestSlot = (
  remainingMatches: SchedulableMatch[],
  targetAvailability: number[],
  playerAvailabilityById: Map<string, number>
): BestSlot | undefined => {
  let bestSlot: BestSlot | undefined;

  for (const [matchIndex, match] of remainingMatches.entries()) {
    const matchReadyTimestamp = getMatchReadyTimestamp(match, playerAvailabilityById);

    for (const [targetIndex, targetReadyTimestamp] of targetAvailability.entries()) {
      const startTimestamp = Math.max(matchReadyTimestamp, targetReadyTimestamp);
      const finishTimestamp = startTimestamp + match.durationMinutes;

      if (!bestSlot) {
        bestSlot = {
          matchIndex,
          targetIndex,
          startTimestamp,
          finishTimestamp,
        };
        continue;
      }

      const hasEarlierFinish = finishTimestamp < bestSlot.finishTimestamp;
      const hasEarlierStartAtSameFinish = (
        finishTimestamp === bestSlot.finishTimestamp
        && startTimestamp < bestSlot.startTimestamp
      );

      if (hasEarlierFinish || hasEarlierStartAtSameFinish) {
        bestSlot = {
          matchIndex,
          targetIndex,
          startTimestamp,
          finishTimestamp,
        };
      }
    }
  }

  return bestSlot;
};

export const estimateConflictAwareMinutes = (
  matches: SchedulableMatch[],
  targetCapacity: number
): number => {
  const boundedTargetCapacity = Math.max(1, targetCapacity);
  const targetAvailability = Array.from({ length: boundedTargetCapacity }, () => 0);
  const playerAvailabilityById = new Map<string, number>();
  const remainingMatches = normalizeMatches(matches);

  if (remainingMatches.length === 0) {
    return 0;
  }

  while (remainingMatches.length > 0) {
    const bestSlot = getBestSlot(remainingMatches, targetAvailability, playerAvailabilityById);
    if (!bestSlot || !Number.isFinite(bestSlot.finishTimestamp)) {
      break;
    }

    const [scheduledMatch] = remainingMatches.splice(bestSlot.matchIndex, 1);
    if (!scheduledMatch) {
      continue;
    }

    targetAvailability[bestSlot.targetIndex] = bestSlot.finishTimestamp;
    for (const playerId of scheduledMatch.playerIds) {
      playerAvailabilityById.set(playerId, bestSlot.finishTimestamp);
    }
  }

  return Math.max(...targetAvailability);
};
