import { TournamentFormat } from '@shared/types';
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
} from '../queue/pool-queue-utilities';
import { buildPoolStageParallelGroups } from '../queue/pool-stage-parallel-groups';
import { orderPoolQueuesByParallelStageGroups as orderByParallelGroups } from '../queue/parallel-stage-queue-ordering';

const orderPoolQueuesByParallelStageGroups = (
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[]
) => orderByParallelGroups(poolStages, poolQueues, buildPoolStageParallelGroups);

const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);

const getQueuePlayerLabel = (
  player: { firstName?: string; lastName?: string; surname?: string } | undefined,
  isSingleTournament: boolean
) => {
  if (!player) {
    return '';
  }

  if (isSingleTournament) {
    const surname = (player.surname ?? '').trim();
    if (surname) {
      return surname;
    }
  }

  return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
};

const sortPoolMatches = (queue: PoolQueue) => {
  queue.matches = queue.matches.toSorted((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (statusWeight(a.status) !== statusWeight(b.status)) {
      return statusWeight(a.status) - statusWeight(b.status);
    }
    return a.matchNumber - b.matchNumber;
  });
};

const buildQueueItems = ( // NOSONAR
  view: LiveViewData,
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  isSingleTournament: boolean
) => {
  const shouldQueueMatch = (match: LiveViewMatch) => {
    const isFinalStatus = match.status === 'COMPLETED' || match.status === 'CANCELLED';
    if (isFinalStatus) return false;
    return !isMatchBlocked(match);
  };

  const createQueueItem = (stage: LiveViewPoolStage, pool: LiveViewPool, match: LiveViewMatch) => {
    const players = (match.playerMatches ?? [])
      .map((pm) => getQueuePlayerLabel(pm.player, isSingleTournament))
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

export const buildMatchQueue = (view: LiveViewData, poolStages: LiveViewPoolStage[]): MatchQueueItem[] => { // NOSONAR
  const isSingleTournament = view.format === TournamentFormat.SINGLE;
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

  const items = buildQueueItems(view, poolStages, poolQueues, isMatchBlocked, isSingleTournament);
  for (const queue of poolQueues) {
    sortPoolMatches(queue);
  }
  const ordered = orderPoolQueuesByParallelStageGroups(poolStages, poolQueues);
  return ordered.length > 0 ? ordered : items;
};
