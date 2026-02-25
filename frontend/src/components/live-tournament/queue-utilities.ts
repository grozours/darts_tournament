import type {
  LiveViewData,
  LiveViewMatch,
  LiveViewPool,
  LiveViewPoolStage,
  MatchQueueItem,
  PoolQueue,
} from './types';
import {
  buildPoolQueues,
  collectActiveFromMatches,
  interleavePools,
} from '../queue/pool-queue-utilities';

const getStageParallelReferences = (stage: LiveViewPoolStage) => (
  new Set(
    (stage.inParallelWith ?? [])
      .map((reference) => reference.trim())
      .filter((reference) => /^stage:\d+$/i.test(reference))
      .map((reference) => Number(reference.split(':')[1]))
      .filter((stageNumber) => Number.isInteger(stageNumber) && stageNumber > 0)
  )
);

const areStagesParallelLinked = (firstStage: LiveViewPoolStage, secondStage: LiveViewPoolStage) => {
  const firstReferences = getStageParallelReferences(firstStage);
  const secondReferences = getStageParallelReferences(secondStage);
  return firstReferences.has(secondStage.stageNumber) || secondReferences.has(firstStage.stageNumber);
};

const collectParallelStageGroup = (
  startStage: LiveViewPoolStage,
  orderedStages: LiveViewPoolStage[],
  visitedStageIds: Set<string>
) => {
  const group: LiveViewPoolStage[] = [];
  const stack = [startStage];
  visitedStageIds.add(startStage.id);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    group.push(current);

    for (const candidate of orderedStages) {
      if (visitedStageIds.has(candidate.id)) {
        continue;
      }
      if (areStagesParallelLinked(current, candidate)) {
        visitedStageIds.add(candidate.id);
        stack.push(candidate);
      }
    }
  }

  return group.toSorted((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
};

const buildPoolStageParallelGroups = (stages: LiveViewPoolStage[]) => {
  const orderedStages = [...stages].sort((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
  const visitedStageIds = new Set<string>();
  const groups: LiveViewPoolStage[][] = [];

  for (const stage of orderedStages) {
    if (visitedStageIds.has(stage.id)) {
      continue;
    }

    groups.push(collectParallelStageGroup(stage, orderedStages, visitedStageIds));
  }

  return groups;
};

const orderPoolQueuesByParallelStageGroups = (
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[]
) => {
  const inProgressStages = poolStages.filter((stage) => stage.status === 'IN_PROGRESS');
  if (inProgressStages.length === 0) {
    return interleavePools(poolQueues);
  }

  const groups = buildPoolStageParallelGroups(inProgressStages);
  const queueByPoolId = new Map(poolQueues.map((queue) => [queue.poolId, queue]));
  const ordered: MatchQueueItem[] = [];

  for (const group of groups) {
    const groupQueues = group.flatMap((stage) => (
      (stage.pools ?? [])
        .map((pool) => queueByPoolId.get(pool.id))
        .filter((queue): queue is PoolQueue => Boolean(queue))
    ));
    ordered.push(...interleavePools(groupQueues));
  }

  return ordered;
};

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

const isInProgress = (match: LiveViewMatch) => match.status === 'IN_PROGRESS';
const isCompletedOrInProgress = (match: LiveViewMatch) => (
  match.status === 'COMPLETED' || match.status === 'IN_PROGRESS'
);

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

  const poolQueues: PoolQueue[] = buildPoolQueues<LiveViewPoolStage, LiveViewPool, LiveViewMatch, MatchQueueItem>({
    stages: poolStages,
    getPools: (stage) => stage.pools,
    getPoolId: (pool) => pool.id,
    getStageNumber: (stage) => stage.stageNumber,
    getPoolNumber: (pool) => pool.poolNumber,
    getMatches: (pool) => pool.matches,
    isMatchCompletedOrInProgress: isCompletedOrInProgress,
    isMatchInProgress: isInProgress,
    onInProgressMatch: collectActivePlayers,
  });

  for (const bracket of view.brackets ?? []) {
    collectActiveFromMatches(bracket.matches ?? [], isInProgress, collectActivePlayers);
  }

  const isMatchBlocked = buildBlockedMatcher(activePlayerIds, activePlayerLabels);

  const items = buildQueueItems(view, poolStages, poolQueues, isMatchBlocked);
  for (const queue of poolQueues) {
    sortPoolMatches(queue);
  }
  const ordered = orderPoolQueuesByParallelStageGroups(poolStages, poolQueues);
  return ordered.length > 0 ? ordered : items;
};
