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

const shouldQueueMatch = (
  match: LiveViewMatch,
  isMatchBlocked: (match: LiveViewMatch) => boolean
): boolean => {
  const isFinalStatus = match.status === 'COMPLETED' || match.status === 'CANCELLED';
  if (isFinalStatus) {
    return false;
  }
  return !isMatchBlocked(match);
};

const createQueueItem = (
  view: LiveViewData,
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  match: LiveViewMatch,
  isSingleTournament: boolean
): MatchQueueItem => {
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

const buildPoolItems = (
  view: LiveViewData,
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  poolQueue: PoolQueue | undefined,
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  isSingleTournament: boolean
): MatchQueueItem[] => {
  const poolItems: MatchQueueItem[] = [];
  for (const match of pool.matches ?? []) {
    if (!shouldQueueMatch(match, isMatchBlocked)) {
      continue;
    }
    const nextItem = createQueueItem(view, stage, pool, match, isSingleTournament);
    poolItems.push(nextItem);
    if (poolQueue) {
      poolQueue.matches.push(nextItem);
    }
  }
  return poolItems;
};

const buildQueueItems = ( // NOSONAR
  view: LiveViewData,
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  isSingleTournament: boolean
) => {
  const items: MatchQueueItem[] = [];
  const inProgressStages = poolStages.filter((stage) => stage.status === 'IN_PROGRESS');
  for (const stage of inProgressStages) {
    for (const pool of stage.pools ?? []) {
      const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
      items.push(...buildPoolItems(view, stage, pool, poolQueue, isMatchBlocked, isSingleTournament));
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

  const collectBracketActivePlayers = () => {
    for (const bracket of view.brackets ?? []) {
      collectActiveFromMatches(bracket.matches ?? [], isInProgress, collectActivePlayers);
    }
  };

  const sortPoolQueues = () => {
    for (const queue of poolQueues) {
      sortPoolMatches(queue);
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

  collectBracketActivePlayers();

  const isMatchBlocked = buildBlockedMatcher(activePlayerIds, activePlayerLabels);

  const items = buildQueueItems(view, poolStages, poolQueues, isMatchBlocked, isSingleTournament);
  sortPoolQueues();
  const ordered = orderPoolQueuesByParallelStageGroups(poolStages, poolQueues);
  return ordered.length > 0 ? ordered : items;
};
