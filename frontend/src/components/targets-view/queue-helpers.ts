import type { LiveViewData, LiveViewMatch, LiveViewPool, LiveViewPoolStage, MatchQueueItem, PoolQueue } from './types';
import { getPlayerIdentity, getMatchPlayers, statusWeight } from './target-labels';
import { buildPoolQueues, collectActiveFromMatches, interleavePools } from '../queue/pool-queue-utilities';

type BuildQueueItemsProperties = {
  view: LiveViewData;
  poolQueues: PoolQueue[];
  isMatchBlocked: (match: LiveViewMatch) => boolean;
  ignoreBlocking?: boolean;
  groupNameByPlayerId?: Map<string, string>;
};

type LiveViewBracket = NonNullable<LiveViewData['brackets']>[number];

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
  view: LiveViewData,
  poolQueues: PoolQueue[]
) => {
  const inProgressStages = (view.poolStages ?? []).filter((stage) => stage.status === 'IN_PROGRESS');
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
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  poolConcurrencyLimitReached: boolean,
  groupNameByPlayerId?: Map<string, string>
): MatchQueueItem => {
  const blocked = poolConcurrencyLimitReached || isMatchBlocked(match);
  const players = getMatchPlayers(match, groupNameByPlayerId);
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
  ignoreBlocking: boolean | undefined,
  groupNameByPlayerId?: Map<string, string>
) => {
  const assignmentPlayerIds = new Set(
    (pool.assignments ?? [])
      .map((assignment) => assignment.player?.id)
      .filter((playerId): playerId is string => Boolean(playerId))
  );
  const poolPlayerIds = assignmentPlayerIds.size > 0
    ? assignmentPlayerIds
    : new Set(
        (pool.matches ?? [])
          .flatMap((candidateMatch) => candidateMatch.playerMatches ?? [])
          .map((playerMatch) => playerMatch.player?.id)
          .filter((playerId): playerId is string => Boolean(playerId))
      );
  const maxConcurrentMatches = Math.floor(poolPlayerIds.size / 2);
  const inProgressMatchesInPool = (pool.matches ?? []).filter((match) => match.status === 'IN_PROGRESS').length;
  const poolConcurrencyLimitReached = maxConcurrentMatches > 0 && inProgressMatchesInPool >= maxConcurrentMatches;

  const poolItems: MatchQueueItem[] = [];
  for (const match of pool.matches ?? []) {
    if (!shouldQueueMatch(match, ignoreBlocking, isMatchBlocked)) {
      continue;
    }
    const nextItem = createQueueItem(
      view,
      stage,
      pool,
      match,
      isMatchBlocked,
      poolConcurrencyLimitReached,
      groupNameByPlayerId
    );
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
  ignoreBlocking: boolean | undefined,
  groupNameByPlayerId?: Map<string, string>
) => {
  const items: MatchQueueItem[] = [];
  for (const pool of stage.pools ?? []) {
    const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
    items.push(...collectPoolItemsForPool(
      view,
      stage,
      pool,
      poolQueue,
      isMatchBlocked,
      ignoreBlocking,
      groupNameByPlayerId
    ));
  }
  return items;
};

const buildQueueItems = ({
  view,
  poolQueues,
  isMatchBlocked,
  ignoreBlocking,
  groupNameByPlayerId,
}: BuildQueueItemsProperties) => {
  const items: MatchQueueItem[] = [];
  for (const stage of view.poolStages ?? []) {
    if (!stage.pools) continue;
    items.push(...collectPoolItemsForStage(
      view,
      stage,
      poolQueues,
      isMatchBlocked,
      ignoreBlocking,
      groupNameByPlayerId
    ));
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

const getBracketTargetIds = (bracket: LiveViewBracket) => (
  bracket.targetIds
    ?? bracket.bracketTargets?.map((target: { targetId: string }) => target.targetId)
    ?? []
);

const getBracketMaxRound = (bracket: LiveViewBracket) => (
  Math.max(0, ...((bracket.matches ?? []).map((match: LiveViewMatch) => match.roundNumber)))
);

const getBracketRoundMatchCount = (
  bracket: LiveViewBracket,
  roundNumber: number
) => (bracket.matches ?? []).filter((match: LiveViewMatch) => match.roundNumber === roundNumber).length;

const isQueueableBracketMatch = (match: LiveViewMatch) => !(
  match.status === 'COMPLETED'
  || match.status === 'CANCELLED'
  || match.status === 'IN_PROGRESS'
);

const isBracketReadyFromPools = (view: LiveViewData, bracketId: string) => {
  const sourceStages = (view.poolStages ?? []).filter((stage) => (
    (stage.rankingDestinations ?? []).some((destination) => (
      destination.destinationType === 'BRACKET' && destination.bracketId === bracketId
    ))
  ));

  if (sourceStages.length === 0) {
    return true;
  }

  return sourceStages.every((stage) => stage.status === 'COMPLETED');
};

const buildBracketQueueItem = (
  view: LiveViewData,
  bracket: LiveViewBracket,
  match: LiveViewMatch,
  bracketTargetIds: string[],
  maxRoundNumber: number,
  maxRoundMatchCount: number,
  groupNameByPlayerId?: Map<string, string>
): MatchQueueItem => {
  const players = getMatchPlayers(match, groupNameByPlayerId);
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

const buildBracketQueueItems = (
  view: LiveViewData,
  groupNameByPlayerId?: Map<string, string>
): MatchQueueItem[] => {
  const bracketItems: MatchQueueItem[] = [];
  for (const bracket of view.brackets ?? []) {
    if (!isBracketReadyFromPools(view, bracket.id)) {
      continue;
    }

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
        maxRoundMatchCount,
        groupNameByPlayerId
      ));
    }
  }
  return bracketItems.toSorted((firstItem, secondItem) => {
    if (firstItem.roundNumber !== secondItem.roundNumber) {
      return firstItem.roundNumber - secondItem.roundNumber;
    }

    const firstBracketName = firstItem.bracketName ?? '';
    const secondBracketName = secondItem.bracketName ?? '';
    const bracketOrder = firstBracketName.localeCompare(secondBracketName, undefined, { sensitivity: 'base' });
    if (bracketOrder !== 0) {
      return bracketOrder;
    }

    if ((firstItem.bracketId ?? '') !== (secondItem.bracketId ?? '')) {
      return (firstItem.bracketId ?? '').localeCompare(secondItem.bracketId ?? '');
    }

    return firstItem.matchNumber - secondItem.matchNumber;
  });
};

export const buildMatchQueue = (
  view: LiveViewData,
  groupNameByPlayerId?: Map<string, string>
): MatchQueueItem[] => {
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
      ...(groupNameByPlayerId ? { groupNameByPlayerId } : {}),
      ...(ignoreBlocking === undefined ? {} : { ignoreBlocking }),
    }));
    for (const queue of poolQueues) {
      sortPoolMatches(queue);
    }
    const ordered = orderPoolQueuesByParallelStageGroups(view, poolQueues);
    const poolItems = ordered.length > 0 ? ordered : items;
    const bracketItems = buildBracketQueueItems(view, groupNameByPlayerId);

    return [...poolItems, ...bracketItems];
  };

  return buildQueue({ ignoreBlocking: true });
};

export const buildGlobalMatchQueue = (
  views: LiveViewData[],
  groupNameByPlayerIdByTournament?: Map<string, Map<string, string>>
) => {
  const perTournament = views.map((view) => buildMatchQueue(
    view,
    groupNameByPlayerIdByTournament?.get(view.id)
  ));
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
