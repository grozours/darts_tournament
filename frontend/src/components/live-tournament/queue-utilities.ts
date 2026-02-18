import type {
  LiveViewData,
  LiveViewMatch,
  LiveViewPool,
  LiveViewPoolStage,
  MatchQueueItem,
  PoolQueue,
} from './types';

const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);

const sortPoolMatches = (queue: PoolQueue) => {
  queue.matches = queue.matches.toSorted((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (statusWeight(a.status) !== statusWeight(b.status)) {
      return statusWeight(a.status) - statusWeight(b.status);
    }
    return a.matchNumber - b.matchNumber;
  });
};

const interleavePools = (queues: PoolQueue[]) => {
  const ordered: MatchQueueItem[] = [];
  const comparePools = (a: PoolQueue, b: PoolQueue) => {
    if (a.progress !== b.progress) return a.progress - b.progress;
    if (a.stageNumber !== b.stageNumber) return a.stageNumber - b.stageNumber;
    return a.poolNumber - b.poolNumber;
  };

  while (queues.some((queue) => queue.matches.length > 0)) {
    const nextPool = [...queues]
      .filter((queue) => queue.matches.length > 0)
      .toSorted(comparePools)[0];
    if (!nextPool) break;
    const nextMatch = nextPool.matches.shift();
    if (!nextMatch) break;
    ordered.push(nextMatch);
    nextPool.progress += 1;
  }

  return ordered;
};

const buildPoolQueues = (
  poolStages: LiveViewPoolStage[],
  collectActivePlayers: (match: LiveViewMatch) => void
): PoolQueue[] => {
  const poolQueues: PoolQueue[] = [];
  for (const stage of poolStages) {
    for (const pool of stage.pools ?? []) {
      const completedOrInProgress = (pool.matches ?? []).filter(
        (match) => match.status === 'COMPLETED' || match.status === 'IN_PROGRESS'
      ).length;
      poolQueues.push({
        poolId: pool.id,
        stageNumber: stage.stageNumber,
        poolNumber: pool.poolNumber,
        progress: completedOrInProgress,
        matches: [],
      });
      for (const match of pool.matches ?? []) {
        if (match.status === 'IN_PROGRESS') {
          collectActivePlayers(match);
        }
      }
    }
  }
  return poolQueues;
};

const buildQueueItems = (
  view: LiveViewData,
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean
) => {
  const shouldQueueMatch = (match: LiveViewMatch) => {
    const isFinalStatus = match.status === 'COMPLETED' || match.status === 'CANCELLED';
    if (isFinalStatus) return false;
    return !isMatchBlocked(match);
  };

  const createQueueItem = (stage: LiveViewPoolStage, pool: LiveViewPool, match: LiveViewMatch) => {
    const players = (match.playerMatches ?? [])
      .map((pm) => (pm.player ? `${pm.player.firstName} ${pm.player.lastName}` : ''))
      .filter(Boolean);
    const targetCode = match.target?.targetCode;
    const targetNumber = match.target?.targetNumber;

    return {
      tournamentId: view.id,
      tournamentName: view.name,
      stageId: stage.id,
      stageName: stage.name,
      stageNumber: stage.stageNumber,
      poolId: pool.id,
      poolName: pool.name,
      poolNumber: pool.poolNumber,
      matchId: match.id,
      matchNumber: match.matchNumber,
      roundNumber: match.roundNumber,
      status: match.status,
      ...(targetCode ? { targetCode } : {}),
      ...(typeof targetNumber === 'number' ? { targetNumber } : {}),
      players,
      match,
    };
  };

  const buildPoolItems = (stage: LiveViewPoolStage, pool: LiveViewPool, poolQueue?: PoolQueue) => {
    const poolItems: MatchQueueItem[] = [];
    for (const match of pool.matches ?? []) {
      if (!shouldQueueMatch(match)) {
        continue;
      }
      const nextItem = createQueueItem(stage, pool, match);
      poolItems.push(nextItem);
      if (poolQueue) {
        poolQueue.matches.push(nextItem);
      }
    }
    return poolItems;
  };

  const items: MatchQueueItem[] = [];
  for (const stage of poolStages) {
    if (stage.status !== 'IN_PROGRESS') {
      continue;
    }
    for (const pool of stage.pools ?? []) {
      const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
      items.push(...buildPoolItems(stage, pool, poolQueue));
    }
  }
  return items;
};

const collectActivePlayersFromMatches = (
  matches: LiveViewMatch[],
  collectActivePlayers: (match: LiveViewMatch) => void
) => {
  for (const match of matches) {
    if (match.status === 'IN_PROGRESS') {
      collectActivePlayers(match);
    }
  }
};

const buildBlockedMatcher = (
  activePlayerIds: Set<string>,
  activePlayerLabels: Set<string>
) => (match: LiveViewMatch) => {
  for (const pm of match.playerMatches ?? []) {
    const player = pm.player;
    if (!player) continue;
    if (player.id && activePlayerIds.has(player.id)) {
      return true;
    }
    const label = `${player.firstName} ${player.lastName}`.trim();
    if (label && activePlayerLabels.has(label)) {
      return true;
    }
  }
  return false;
};

export const buildMatchQueue = (view: LiveViewData, poolStages: LiveViewPoolStage[]): MatchQueueItem[] => {
  const activePlayerIds = new Set<string>();
  const activePlayerLabels = new Set<string>();

  const collectActivePlayers = (match: LiveViewMatch) => {
    for (const pm of match.playerMatches ?? []) {
      const player = pm.player;
      if (!player) continue;
      if (player.id) {
        activePlayerIds.add(player.id);
      }
      const label = `${player.firstName} ${player.lastName}`.trim();
      if (label) {
        activePlayerLabels.add(label);
      }
    }
  };

  const poolQueues = buildPoolQueues(poolStages, collectActivePlayers);

  for (const bracket of view.brackets ?? []) {
    collectActivePlayersFromMatches(bracket.matches ?? [], collectActivePlayers);
  }

  const isMatchBlocked = buildBlockedMatcher(activePlayerIds, activePlayerLabels);

  const items = buildQueueItems(view, poolStages, poolQueues, isMatchBlocked);
  for (const queue of poolQueues) {
    sortPoolMatches(queue);
  }
  const ordered = interleavePools(poolQueues);
  return ordered.length > 0 ? ordered : items;
};
