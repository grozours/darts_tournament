import type { LiveViewData, LiveViewMatch, LiveViewPool, LiveViewPoolStage, MatchQueueItem, PoolQueue } from './types';
import { getPlayerIdentity, getMatchPlayers, statusWeight } from './target-labels';
import { buildPoolQueues, collectActiveFromMatches, interleavePools } from '../queue/pool-queue-utilities';

type BuildQueueItemsProperties = {
  view: LiveViewData;
  poolQueues: PoolQueue[];
  isMatchBlocked: (match: LiveViewMatch) => boolean;
  ignoreBlocking?: boolean;
};

const isFinalMatchStatus = (status: string) => (
  status === 'COMPLETED' || status === 'CANCELLED' || status === 'IN_PROGRESS'
);

const shouldQueueMatch = (
  match: LiveViewMatch,
  ignoreBlocking: boolean | undefined,
  isMatchBlocked: (match: LiveViewMatch) => boolean
) => {
  if (isFinalMatchStatus(match.status)) return false;
  if (ignoreBlocking) return true;
  return !isMatchBlocked(match);
};

const createQueueItem = (
  view: LiveViewData,
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  match: LiveViewMatch,
  isMatchBlocked: (match: LiveViewMatch) => boolean
): MatchQueueItem => {
  const blocked = isMatchBlocked(match);
  const players = getMatchPlayers(match);
  const targetCode = match.target?.targetCode;
  const targetNumber = match.target?.targetNumber;

  return {
    tournamentId: view.id,
    tournamentName: view.name,
    source: 'pool',
    matchId: match.id,
    poolId: pool.id,
    stageNumber: stage.stageNumber,
    stageName: stage.name,
    poolNumber: pool.poolNumber,
    poolName: pool.name,
    matchNumber: match.matchNumber,
    roundNumber: match.roundNumber,
    status: match.status,
    ...(targetCode ? { targetCode } : {}),
    ...(typeof targetNumber === 'number' ? { targetNumber } : {}),
    players,
    blocked,
  };
};

const sortPoolMatches = (queue: PoolQueue) => {
  queue.matches = queue.matches.toSorted((a: MatchQueueItem, b: MatchQueueItem) => {
    if (a.blocked !== b.blocked) {
      return a.blocked ? 1 : -1;
    }
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (statusWeight(a.status) !== statusWeight(b.status)) {
      return statusWeight(a.status) - statusWeight(b.status);
    }
    return a.matchNumber - b.matchNumber;
  });
};


const collectPoolItemsForPool = (
  view: LiveViewData,
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  poolQueue: PoolQueue | undefined,
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  ignoreBlocking: boolean | undefined
) => {
  const poolItems: MatchQueueItem[] = [];
  for (const match of pool.matches ?? []) {
    if (!shouldQueueMatch(match, ignoreBlocking, isMatchBlocked)) {
      continue;
    }
    const nextItem = createQueueItem(view, stage, pool, match, isMatchBlocked);
    poolItems.push(nextItem);
    if (poolQueue) {
      poolQueue.matches.push(nextItem);
    }
  }
  return poolItems;
};

const collectPoolItemsForStage = (
  view: LiveViewData,
  stage: LiveViewPoolStage,
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  ignoreBlocking: boolean | undefined
) => {
  const items: MatchQueueItem[] = [];
  for (const pool of stage.pools ?? []) {
    const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
    items.push(...collectPoolItemsForPool(view, stage, pool, poolQueue, isMatchBlocked, ignoreBlocking));
  }
  return items;
};

const buildQueueItems = ({
  view,
  poolQueues,
  isMatchBlocked,
  ignoreBlocking,
}: BuildQueueItemsProperties) => {
  const items: MatchQueueItem[] = [];
  for (const stage of view.poolStages ?? []) {
    if (!stage.pools) continue;
    items.push(...collectPoolItemsForStage(view, stage, poolQueues, isMatchBlocked, ignoreBlocking));
  }
  return items;
};

const isInProgress = (match: LiveViewMatch) => match.status === 'IN_PROGRESS';
const isCompletedOrInProgress = (match: LiveViewMatch) => (
  match.status === 'COMPLETED' || match.status === 'IN_PROGRESS'
);

const buildMatchBlocker = (activePlayerKeys: Set<string>) => (match: LiveViewMatch) => {
  for (const playerMatch of match.playerMatches ?? []) {
    const key = getPlayerIdentity(playerMatch.player);
    if (key && activePlayerKeys.has(key)) {
      return true;
    }
  }
  return false;
};

const getBracketTargetIds = (bracket: LiveViewData['brackets'][number]) => (
  bracket.targetIds
    ?? bracket.bracketTargets?.map((target) => target.targetId)
    ?? []
);

const getBracketMaxRound = (bracket: LiveViewData['brackets'][number]) => (
  Math.max(0, ...((bracket.matches ?? []).map((match) => match.roundNumber)))
);

const getBracketRoundMatchCount = (
  bracket: LiveViewData['brackets'][number],
  roundNumber: number
) => (bracket.matches ?? []).filter((match) => match.roundNumber === roundNumber).length;

const isQueueableBracketMatch = (match: LiveViewMatch) => !(
  match.status === 'COMPLETED'
  || match.status === 'CANCELLED'
  || match.status === 'IN_PROGRESS'
);

const buildBracketQueueItem = (
  view: LiveViewData,
  bracket: LiveViewData['brackets'][number],
  match: LiveViewMatch,
  bracketTargetIds: string[],
  maxRoundNumber: number,
  maxRoundMatchCount: number
): MatchQueueItem => {
  const players = getMatchPlayers(match);
  const targetCode = match.target?.targetCode;
  const targetNumber = match.target?.targetNumber;

  return {
    tournamentId: view.id,
    tournamentName: view.name,
    source: 'bracket',
    matchId: match.id,
    poolId: '',
    stageNumber: 0,
    stageName: '',
    poolNumber: 0,
    poolName: '',
    bracketId: bracket.id,
    bracketName: bracket.name,
    ...(bracketTargetIds.length > 0 ? { bracketTargetIds } : {}),
    matchNumber: match.matchNumber,
    roundNumber: match.roundNumber,
    status: match.status,
    isBracketFinal: maxRoundNumber > 0
      && match.roundNumber === maxRoundNumber
      && maxRoundMatchCount === 1,
    ...(targetCode ? { targetCode } : {}),
    ...(typeof targetNumber === 'number' ? { targetNumber } : {}),
    players,
    blocked: false,
  };
};

const buildBracketQueueItems = (view: LiveViewData): MatchQueueItem[] => {
  const bracketItems: MatchQueueItem[] = [];
  for (const bracket of view.brackets ?? []) {
    const bracketTargetIds = getBracketTargetIds(bracket);
    const maxRoundNumber = getBracketMaxRound(bracket);
    const maxRoundMatchCount = maxRoundNumber > 0
      ? getBracketRoundMatchCount(bracket, maxRoundNumber)
      : 0;
    for (const match of bracket.matches ?? []) {
      if (!isQueueableBracketMatch(match)) {
        continue;
      }
      bracketItems.push(buildBracketQueueItem(
        view,
        bracket,
        match,
        bracketTargetIds,
        maxRoundNumber,
        maxRoundMatchCount
      ));
    }
  }
  return bracketItems;
};

export const buildMatchQueue = (view: LiveViewData): MatchQueueItem[] => {
  const buildQueue = (options?: { ignoreBlocking?: boolean }) => {
    const items: MatchQueueItem[] = [];
    const activePlayerKeys = new Set<string>();
    const poolQueues: PoolQueue[] = [];

    const collectActivePlayers = (match: LiveViewMatch) => {
      for (const playerMatch of match.playerMatches ?? []) {
        const key = getPlayerIdentity(playerMatch.player);
        if (key) {
          activePlayerKeys.add(key);
        }
      }
    };

    poolQueues.push(...buildPoolQueues<LiveViewPoolStage, LiveViewPool, LiveViewMatch, MatchQueueItem>({
      stages: view.poolStages ?? [],
      getPools: (stage) => stage.pools,
      getPoolId: (pool) => pool.id,
      getStageNumber: (stage) => stage.stageNumber,
      getPoolNumber: (pool) => pool.poolNumber,
      getMatches: (pool) => pool.matches,
      isMatchCompletedOrInProgress: isCompletedOrInProgress,
      isMatchInProgress: isInProgress,
      onInProgressMatch: collectActivePlayers,
    }));

    for (const bracket of view.brackets ?? []) {
      collectActiveFromMatches(bracket.matches ?? [], isInProgress, collectActivePlayers);
    }

    const isMatchBlocked = buildMatchBlocker(activePlayerKeys);

    const ignoreBlocking = options?.ignoreBlocking;
    items.push(...buildQueueItems({
      view,
      poolQueues,
      isMatchBlocked,
      ...(ignoreBlocking === undefined ? {} : { ignoreBlocking }),
    }));
    for (const queue of poolQueues) {
      sortPoolMatches(queue);
    }
    const ordered = interleavePools(poolQueues);
    const poolItems = ordered.length > 0 ? ordered : items;
    const bracketItems = buildBracketQueueItems(view);

    return [...poolItems, ...bracketItems];
  };

  return buildQueue({ ignoreBlocking: true });
};

export const buildGlobalMatchQueue = (views: LiveViewData[]) => {
  const perTournament = views.map((view) => buildMatchQueue(view));
  const ordered: MatchQueueItem[] = [];
  const maxLength = Math.max(0, ...perTournament.map((items) => items.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const items of perTournament) {
      const item = items[index];
      if (item) {
        ordered.push(item);
      }
    }
  }

  return ordered;
};
