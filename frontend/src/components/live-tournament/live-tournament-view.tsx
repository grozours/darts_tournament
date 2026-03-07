import { useEffect, useState } from 'react';
import { TournamentFormat } from '@shared/types';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import { hasActiveBrackets, isBracketsView, isPoolStagesView } from '../../utils/live-view-helpers';
import { fetchDoublettes, fetchEquipes } from '../../services/tournament-service';
import BracketsSection from './brackets-section';
import {
  applyPoolConcurrencySlots,
  buildMissingRoundRobinMatches,
  estimateConflictAwareMinutes,
  getRoundRobinPairKey,
} from './conflict-aware-estimator';
import MatchQueueSection from './match-queue-section';
import PoolStagesSection from './pool-stages-section';
import { buildMatchQueue } from './queue-utilities';
import type {
  LiveViewBracket,
  LiveViewData,
  LiveViewMatch,
  LiveViewMode,
  LiveViewPool,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import {
  filterBracketsForView,
  filterPoolStagesForView,
  getPoolStageStats,
} from './view-utilities';
import { getHasLoserBracket } from './target-utilities';
import { getMatchFormatPresets } from '../../utils/match-format-presets';
import { buildPoolStageParallelGroups } from '../queue/pool-stage-parallel-groups';

type PoolStats = {
  poolStageCount: number;
  totalPools: number;
  poolsPerStage: number[];
};

type LiveTournamentViewProperties = {
  t: Translator;
  view: LiveViewData;
  isAdmin: boolean;
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  stageId?: string | undefined;
  isAggregateView: boolean;
  screenMode: boolean;
  visibleLiveViewsCount: number;
  showGlobalQueue: boolean;
  isPoolStagesReadonly: boolean;
  isBracketsReadonly: boolean;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  schedulableTargetCountByTournament: Map<string, number>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  resettingPoolId: string | undefined;
  editingMatchId?: string | undefined;
  updatingRoundKey?: string | undefined;
  resettingBracketId?: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (matchTournamentId: string, targetNumberValue: string) => string | undefined;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  formatTargetLabel: (value: string) => string;
  getTargetLabel: (target: LiveViewTarget) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId?: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => void;
  onEditStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, status: string) => void;
  onLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  canDeleteStage: boolean;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  playerIdByTournament: Record<string, string>;
  onCompleteBracketRound: (matchTournamentId: string, bracket: LiveViewBracket) => void;
  onResetBracketMatches: (matchTournamentId: string, bracketId: string) => void;
  onSelectBracket: (matchTournamentId: string, bracketId: string) => void;
  activeBracketId: string;
  onRefresh: () => void;
};

type LiveTournamentViewHeaderProperties = {
  t: Translator;
  view: LiveViewData;
  schedulableTargetCount: number;
  isAdmin: boolean;
  screenMode: boolean;
  onRefresh: () => void;
  showSummary: boolean;
  onToggleSummary: () => void;
  showBracketsLink: boolean;
  showPoolsLink: boolean;
  poolStages: LiveViewPoolStage[];
  brackets: LiveViewBracket[];
  viewMode?: LiveViewMode;
};

type LiveTournamentPoolSummaryProperties = {
  t: Translator;
  stats: PoolStats;
  hasLoserBracket: boolean;
};

const toValidDate = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatDateTime = (value: Date) => new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(value);

type LiveParticipant = {
  id?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
  teamName?: string;
};

const formatDurationClock = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const NON_REMAINING_MATCH_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const ACTIVE_TARGET_STATUSES = new Set(['AVAILABLE', 'IN_USE']);
const NON_REMAINING_STAGE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const isRemainingMatch = (match: LiveViewMatch) =>
  !NON_REMAINING_MATCH_STATUSES.has((match.status ?? '').toUpperCase());

const isRemainingStage = (status: string | undefined) =>
  !NON_REMAINING_STAGE_STATUSES.has((status ?? '').toUpperCase());

const buildBracketSourceStagesMap = (poolStages: LiveViewPoolStage[] | undefined) => {
  const sourceStageIdsByBracketId = new Map<string, Set<string>>();

  for (const stage of poolStages ?? []) {
    for (const destination of stage.rankingDestinations ?? []) {
      if (destination.destinationType !== 'BRACKET' || !destination.bracketId) {
        continue;
      }

      const current = sourceStageIdsByBracketId.get(destination.bracketId) ?? new Set<string>();
      current.add(stage.id);
      sourceStageIdsByBracketId.set(destination.bracketId, current);
    }
  }

  return sourceStageIdsByBracketId;
};

const getMatchPlayerIds = (match: Pick<LiveViewMatch, 'playerMatches'>) => (
  (match.playerMatches ?? [])
    .map((playerMatch) => playerMatch.player?.id)
    .filter((playerId): playerId is string => Boolean(playerId))
);

const getMissingPoolMatches = (
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  durationByFormatKey: Map<string, number>
) => {
  const assignmentPlayerIds = (pool.assignments ?? [])
    .map((assignment) => assignment.player?.id)
    .filter((playerId): playerId is string => Boolean(playerId));

  const existingPairKeys = new Set(
    (pool.matches ?? [])
      .map((match) => getRoundRobinPairKey(getMatchPlayerIds(match)))
      .filter((pairKey): pairKey is string => Boolean(pairKey))
  );

  return buildMissingRoundRobinMatches({
    idPrefix: `${stage.id}-${pool.id}`,
    playerIds: assignmentPlayerIds,
    existingPairKeys,
    durationMinutes: resolveMatchDuration(stage.matchFormatKey, durationByFormatKey),
  });
};

const collectRemainingPoolMatches = (
  stage: LiveViewPoolStage,
  pool: LiveViewPool,
  durationByFormatKey: Map<string, number>,
  seenMatchIds: Set<string>
) => {
  const matches: Array<{ id: string; durationMinutes: number; playerIds: string[] }> = [];

  for (const match of pool.matches ?? []) {
    if (!isRemainingMatch(match)) {
      continue;
    }
    if (seenMatchIds.has(match.id)) {
      continue;
    }

    seenMatchIds.add(match.id);
    matches.push({
      id: match.id,
      durationMinutes: resolveMatchDuration(match.matchFormatKey ?? stage.matchFormatKey, durationByFormatKey),
      playerIds: getMatchPlayerIds(match),
    });
  }

  return matches;
};

const getPoolPlayerIds = (pool: LiveViewPool) => {
  const assignmentPlayerIds = (pool.assignments ?? [])
    .map((assignment) => assignment.player?.id)
    .filter((playerId): playerId is string => Boolean(playerId));

  if (assignmentPlayerIds.length > 0) {
    return assignmentPlayerIds;
  }

  return (pool.matches ?? [])
    .flatMap((match) => getMatchPlayerIds(match));
};

const getExpectedBracketMatchesByRound = (bracket: LiveViewBracket) => {
  const totalRounds = bracket.totalRounds ?? 0;
  if (totalRounds <= 0) {
    return new Map<number, number>();
  }

  const expectedByRound = new Map<number, number>();
  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
    expectedByRound.set(roundNumber, Math.pow(2, totalRounds - roundNumber));
  }

  return expectedByRound;
};

type BracketRoundWorkload = {
  totalMinutes: number;
  maxSingleMatchMinutes: number;
  knownMatchesCount: number;
  schedulableMatches: Array<{ id: string; durationMinutes: number; playerIds: string[] }>;
};

const getBracketRoundWorkloads = (
  bracket: LiveViewBracket,
  durationByFormatKey: Map<string, number>,
  seenMatchIds: Set<string>
) => {
  const expectedByRound = getExpectedBracketMatchesByRound(bracket);
  const roundWorkloadByRound = new Map<number, BracketRoundWorkload>();

  for (const match of bracket.matches ?? []) {
    if (!isRemainingMatch(match)) {
      continue;
    }
    if (seenMatchIds.has(match.id)) {
      continue;
    }
    seenMatchIds.add(match.id);

    const roundNumber = Number(match.roundNumber) || 1;
    const duration = resolveMatchDuration(
      match.matchFormatKey ?? bracket.roundMatchFormats?.[String(roundNumber)],
      durationByFormatKey
    );
    const current = roundWorkloadByRound.get(roundNumber) ?? {
      totalMinutes: 0,
      maxSingleMatchMinutes: 0,
      knownMatchesCount: 0,
      schedulableMatches: [],
    };

    current.totalMinutes += duration;
    current.maxSingleMatchMinutes = Math.max(current.maxSingleMatchMinutes, duration);
    current.knownMatchesCount += 1;
    current.schedulableMatches.push({
      id: match.id,
      durationMinutes: duration,
      playerIds: (match.playerMatches ?? [])
        .map((playerMatch) => playerMatch.player?.id)
        .filter((playerId): playerId is string => Boolean(playerId)),
    });
    roundWorkloadByRound.set(roundNumber, current);
  }

  for (const [roundNumber, expectedCount] of expectedByRound.entries()) {
    const current = roundWorkloadByRound.get(roundNumber) ?? {
      totalMinutes: 0,
      maxSingleMatchMinutes: 0,
      knownMatchesCount: 0,
      schedulableMatches: [],
    };
    const knownCount = current.knownMatchesCount;
    const missingCount = Math.max(expectedCount - knownCount, 0);
    if (missingCount <= 0) {
      continue;
    }

    const roundDuration = resolveMatchDuration(
      bracket.roundMatchFormats?.[String(roundNumber)],
      durationByFormatKey
    );
    current.totalMinutes += missingCount * roundDuration;
    current.maxSingleMatchMinutes = Math.max(current.maxSingleMatchMinutes, roundDuration);
    for (let index = 0; index < missingCount; index += 1) {
      current.schedulableMatches.push({
        id: `missing-${bracket.id}-${roundNumber}-${index}`,
        durationMinutes: roundDuration,
        playerIds: [],
      });
    }
    roundWorkloadByRound.set(roundNumber, current);
  }

  return roundWorkloadByRound;
};

const buildDurationMap = () => new Map(
  getMatchFormatPresets().map((preset) => [preset.key, preset.durationMinutes])
);

const resolveMatchDuration = (
  matchFormatKey: string | undefined,
  durationByFormatKey: Map<string, number>
) => {
  if (!matchFormatKey) {
    return 0;
  }
  const resolved = durationByFormatKey.get(matchFormatKey);
  return resolved && resolved > 0 ? resolved : 0;
};

const getPoolStagesEstimatedMinutes = (
  poolStages: LiveViewPoolStage[] | undefined,
  durationByFormatKey: Map<string, number>,
  seenMatchIds: Set<string>,
  targetCapacity: number
) => {
  const schedulableMatches: Array<{ id: string; durationMinutes: number; playerIds: string[] }> = [];

  for (const stage of poolStages ?? []) {
    if (!isRemainingStage(stage.status)) {
      continue;
    }

    for (const pool of stage.pools ?? []) {
      const rawPoolSchedulableMatches = [
        ...collectRemainingPoolMatches(stage, pool, durationByFormatKey, seenMatchIds),
        ...getMissingPoolMatches(stage, pool, durationByFormatKey),
      ];
      const poolSchedulableMatches = applyPoolConcurrencySlots(
        rawPoolSchedulableMatches,
        pool.id,
        getPoolPlayerIds(pool),
        stage.playersPerPool
      );
      schedulableMatches.push(...poolSchedulableMatches);
    }
  }

  return estimateConflictAwareMinutes(schedulableMatches, targetCapacity);
};

const getRemainingPoolStagesOrdered = (poolStages: LiveViewPoolStage[] | undefined) =>
  (poolStages ?? [])
    .filter((stage) => isRemainingStage(stage.status))
    .sort((leftStage, rightStage) => {
      const leftOrder = leftStage.stageNumber ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = rightStage.stageNumber ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });

const hasPoolStageParallelConfiguration = (stages: LiveViewPoolStage[]) => (
  stages.some((stage) => (stage.inParallelWith?.length ?? 0) > 0)
);

const getBracketDedicatedTargetCount = (bracket: LiveViewBracket) => {
  const bracketTargetsCount = bracket.bracketTargets?.length ?? 0;
  if (bracketTargetsCount > 0) {
    return bracketTargetsCount;
  }
  return bracket.targetIds?.length ?? 0;
};

const getExpectedMatchesForRound = (bracket: LiveViewBracket, roundNumber: number) => {
  const expectedByRound = getExpectedBracketMatchesByRound(bracket);
  return expectedByRound.get(roundNumber) ?? 0;
};

type BracketWorkloadItem = {
  bracket: LiveViewBracket;
  bracketCapacity: number;
  roundWorkloadByRound: Map<number, BracketRoundWorkload>;
};

const buildBracketWorkloadItems = (
  brackets: LiveViewBracket[],
  durationByFormatKey: Map<string, number>,
  seenMatchIds: Set<string>
): BracketWorkloadItem[] => brackets
  .map((bracket) => {
    const dedicatedTargets = getBracketDedicatedTargetCount(bracket);
    const bracketCapacity = dedicatedTargets > 0
      ? dedicatedTargets
      : Math.max(getExpectedMatchesForRound(bracket, 1), 1);

    return {
      bracket,
      bracketCapacity,
      roundWorkloadByRound: getBracketRoundWorkloads(bracket, durationByFormatKey, seenMatchIds),
    };
  })
  .toSorted((first, second) => first.bracket.name.localeCompare(second.bracket.name, undefined, { sensitivity: 'base' }));

const getRemainingRoundNumbers = (items: BracketWorkloadItem[]) => {
  const roundNumbers = new Set<number>();
  for (const item of items) {
    for (const roundNumber of item.roundWorkloadByRound.keys()) {
      if (roundNumber > 1) {
        roundNumbers.add(roundNumber);
      }
    }
  }
  return roundNumbers;
};

const getLegacyParallelBracketsEstimatedMinutes = (
  bracketItems: BracketWorkloadItem[],
  activeTargetCount: number
) => {
  const sequentialFirstRoundMinutes = bracketItems.reduce((sum, item) => {
    const firstRoundWorkload = item.roundWorkloadByRound.get(1) ?? {
      totalMinutes: 0,
      maxSingleMatchMinutes: 0,
      knownMatchesCount: 0,
      schedulableMatches: [],
    };
    return sum + getRoundEstimatedMinutes(firstRoundWorkload, item.bracketCapacity);
  }, 0);

  const remainingRoundNumbers = [...getRemainingRoundNumbers(bracketItems)]
    .toSorted((first, second) => first - second);
  const parallelRemainingRoundsMinutes = remainingRoundNumbers.reduce((sum, roundNumber) => {
    let totalMinutes = 0;
    let maxSingleMatchMinutes = 0;
    const schedulableMatches: BracketRoundWorkload['schedulableMatches'] = [];

    for (const item of bracketItems) {
      const workload = item.roundWorkloadByRound.get(roundNumber);
      if (!workload) {
        continue;
      }
      totalMinutes += workload.totalMinutes;
      maxSingleMatchMinutes = Math.max(maxSingleMatchMinutes, workload.maxSingleMatchMinutes);
      schedulableMatches.push(...workload.schedulableMatches);
    }

    return sum + getRoundEstimatedMinutes(
      {
        totalMinutes,
        maxSingleMatchMinutes,
        knownMatchesCount: 0,
        schedulableMatches,
      },
      activeTargetCount
    );
  }, 0);

  return sequentialFirstRoundMinutes + parallelRemainingRoundsMinutes;
};

const getBracketParallelReferences = (bracket: LiveViewBracket) => (
  new Set(
    (bracket.inParallelWith ?? [])
      .map((reference) => reference.trim())
      .filter((reference) => /^bracket:.+$/i.test(reference))
      .map((reference) => reference.slice(reference.indexOf(':') + 1).trim().toLocaleLowerCase())
      .filter((name) => name.length > 0)
  )
);

const areBracketsParallelLinked = (firstBracket: LiveViewBracket, secondBracket: LiveViewBracket) => {
  const firstRefs = getBracketParallelReferences(firstBracket);
  const secondRefs = getBracketParallelReferences(secondBracket);
  return firstRefs.has(secondBracket.name.toLocaleLowerCase())
    || secondRefs.has(firstBracket.name.toLocaleLowerCase());
};

const sortBracketWorkloadGroup = (group: BracketWorkloadItem[]) => group.toSorted((first, second) => (
  first.bracket.name.localeCompare(second.bracket.name, undefined, { sensitivity: 'base' })
));

const sortBracketWorkloadGroups = (groups: BracketWorkloadItem[][]) => groups.toSorted((firstGroup, secondGroup) => {
  const firstName = firstGroup[0]?.bracket.name ?? '';
  const secondName = secondGroup[0]?.bracket.name ?? '';
  return firstName.localeCompare(secondName, undefined, { sensitivity: 'base' });
});

const collectBracketParallelGroup = (
  startItem: BracketWorkloadItem,
  bracketItems: BracketWorkloadItem[],
  visitedBracketIds: Set<string>
) => {
  const group: BracketWorkloadItem[] = [];
  const stack = [startItem];
  visitedBracketIds.add(startItem.bracket.id);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    group.push(current);

    for (const candidate of bracketItems) {
      if (visitedBracketIds.has(candidate.bracket.id)) {
        continue;
      }
      if (areBracketsParallelLinked(current.bracket, candidate.bracket)) {
        visitedBracketIds.add(candidate.bracket.id);
        stack.push(candidate);
      }
    }
  }

  return sortBracketWorkloadGroup(group);
};

const buildBracketParallelGroups = (bracketItems: BracketWorkloadItem[]) => {
  const visitedBracketIds = new Set<string>();
  const groups: BracketWorkloadItem[][] = [];

  for (const item of bracketItems) {
    if (visitedBracketIds.has(item.bracket.id)) {
      continue;
    }

    groups.push(collectBracketParallelGroup(item, bracketItems, visitedBracketIds));
  }

  return sortBracketWorkloadGroups(groups);
};

const getGroupRoundEstimatedMinutes = (
  group: BracketWorkloadItem[],
  roundNumber: number,
  activeTargetCount: number
) => {
  let groupTotalMinutes = 0;
  let groupMaxSingleMatchMinutes = 0;
  let groupCapacity = 0;
  const groupSchedulableMatches: BracketRoundWorkload['schedulableMatches'] = [];

  for (const item of group) {
    const workload = item.roundWorkloadByRound.get(roundNumber);
    if (!workload || workload.totalMinutes <= 0) {
      continue;
    }
    groupTotalMinutes += workload.totalMinutes;
    groupMaxSingleMatchMinutes = Math.max(groupMaxSingleMatchMinutes, workload.maxSingleMatchMinutes);
    groupCapacity += item.bracketCapacity;
    groupSchedulableMatches.push(...workload.schedulableMatches);
  }

  if (groupTotalMinutes <= 0) {
    return 0;
  }

  const boundedCapacity = Math.max(1, Math.min(activeTargetCount, groupCapacity));
  return getRoundEstimatedMinutes(
    {
      totalMinutes: groupTotalMinutes,
      maxSingleMatchMinutes: groupMaxSingleMatchMinutes,
      knownMatchesCount: 0,
      schedulableMatches: groupSchedulableMatches,
    },
    boundedCapacity
  );
};

const getConfiguredParallelBracketsEstimatedMinutes = (
  bracketItems: BracketWorkloadItem[],
  activeTargetCount: number
) => {
  const orderedGroups = buildBracketParallelGroups(bracketItems);
  const roundNumbers = new Set<number>();
  for (const item of bracketItems) {
    for (const roundNumber of item.roundWorkloadByRound.keys()) {
      roundNumbers.add(roundNumber);
    }
  }

  return [...roundNumbers]
    .toSorted((first, second) => first - second)
    .reduce((totalMinutes, roundNumber) => {
      const roundMinutes = orderedGroups.reduce(
        (sum, group) => sum + getGroupRoundEstimatedMinutes(group, roundNumber, activeTargetCount),
        0
      );
      return totalMinutes + roundMinutes;
    }, 0);
};

const getParallelBracketsEstimatedMinutes = (
  brackets: LiveViewBracket[],
  durationByFormatKey: Map<string, number>,
  seenMatchIds: Set<string>,
  activeTargetCount: number
) => {
  if (brackets.length === 0) {
    return 0;
  }

  const bracketItems = buildBracketWorkloadItems(brackets, durationByFormatKey, seenMatchIds);
  const hasParallelConfiguration = brackets.some((bracket) => (bracket.inParallelWith?.length ?? 0) > 0);

  if (!hasParallelConfiguration) {
    return getLegacyParallelBracketsEstimatedMinutes(bracketItems, activeTargetCount);
  }

  return getConfiguredParallelBracketsEstimatedMinutes(bracketItems, activeTargetCount);
};

const getRoundEstimatedMinutes = (
  roundWorkload: BracketRoundWorkload,
  activeTargetCount: number
) => {
  if (roundWorkload.schedulableMatches.length <= 0) {
    return 0;
  }

  return estimateConflictAwareMinutes(roundWorkload.schedulableMatches, activeTargetCount);
};

type RemainingEstimateBreakdown = {
  firstPoolStageEstimatedMinutes: number;
  subsequentPoolStagesEstimatedMinutes: number;
  firstStageBracketsEstimatedMinutes: number;
  lateBracketsEstimatedMinutes: number;
  readyNowBracketsEstimatedMinutes: number;
  parallelBranchesEstimatedMinutes: number;
  workflowEstimatedMinutes: number;
  remainingPoolStagesCount: number;
  remainingBracketsCount: number;
  readyNowBracketsCount: number;
  deferredBracketsCount: number;
  hasPoolParallelConfiguration: boolean;
};

type RemainingEstimateResult = {
  totalMinutes: number;
  breakdown: RemainingEstimateBreakdown;
};

const getRemainingEstimatedMinutes = (
  view: LiveViewData,
  activeTargetCount: number
): RemainingEstimateResult => {
  const durationByFormatKey = buildDurationMap();
  const seenMatchIds = new Set<string>();
  const parallelCapacity = Math.max(activeTargetCount, 1);
  const remainingPoolStages = getRemainingPoolStagesOrdered(view.poolStages);
  const hasPoolParallelConfiguration = hasPoolStageParallelConfiguration(remainingPoolStages);
  const bracketsById = new Map((view.brackets ?? []).map((bracket) => [bracket.id, bracket]));
  const remainingBrackets = (view.brackets ?? []).filter((bracket) => isRemainingStage(bracket.status));
  const sourceStageIdsByBracketId = buildBracketSourceStagesMap(view.poolStages);
  const stageStatusById = new Map((view.poolStages ?? []).map((stage) => [stage.id, stage.status]));

  const isBracketReadyNow = (bracketId: string) => {
    const sourceStageIds = sourceStageIdsByBracketId.get(bracketId);
    if (!sourceStageIds || sourceStageIds.size === 0) {
      return true;
    }

    return [...sourceStageIds].every((stageId) => {
      const status = stageStatusById.get(stageId);
      return !isRemainingStage(status);
    });
  };

  const readyNowBrackets = remainingBrackets.filter((bracket) => isBracketReadyNow(bracket.id));
  const deferredBrackets = remainingBrackets.filter((bracket) => !isBracketReadyNow(bracket.id));
  const poolStageGroups = hasPoolParallelConfiguration
    ? buildPoolStageParallelGroups(remainingPoolStages)
    : remainingPoolStages.map((stage) => [stage]);

  const firstPoolGroup = poolStageGroups[0] ?? [];
  const subsequentPoolGroups = poolStageGroups.slice(1);

  const firstPoolStageEstimatedMinutes = getPoolStagesEstimatedMinutes(
    firstPoolGroup,
    durationByFormatKey,
    seenMatchIds,
    parallelCapacity
  );

  const firstStageBracketIds = new Set(
    firstPoolGroup
      .flatMap((stage) => stage.rankingDestinations ?? [])
      .filter((destination) => destination.destinationType === 'BRACKET' && destination.bracketId)
      .map((destination) => destination.bracketId as string)
  );
  const firstStageBrackets = [...firstStageBracketIds]
    .map((bracketId) => bracketsById.get(bracketId))
    .filter((bracket): bracket is LiveViewBracket => (
      !!bracket
      && deferredBrackets.some((deferredBracket) => deferredBracket.id === bracket.id)
    ));
  const firstStageDedicatedTargets = firstStageBrackets.reduce(
    (sum, bracket) => sum + getBracketDedicatedTargetCount(bracket),
    0
  );
  const poolTargetsAfterFirst = Math.max(activeTargetCount - firstStageDedicatedTargets, 1);

  const subsequentPoolStagesEstimatedMinutes = subsequentPoolGroups.reduce((sum, stageGroup) => {
    const groupEstimatedMinutes = getPoolStagesEstimatedMinutes(
      stageGroup,
      durationByFormatKey,
      seenMatchIds,
      poolTargetsAfterFirst
    );
    return sum + groupEstimatedMinutes;
  }, 0);

  const firstStageBracketsEstimatedMinutes = getParallelBracketsEstimatedMinutes(
    firstStageBrackets,
    durationByFormatKey,
    seenMatchIds,
    activeTargetCount
  );

  const lateBrackets = deferredBrackets.filter((bracket) => !firstStageBracketIds.has(bracket.id));
  const lateBracketsEstimatedMinutes = getParallelBracketsEstimatedMinutes(
    lateBrackets,
    durationByFormatKey,
    seenMatchIds,
    activeTargetCount
  );

  const readyNowBracketsEstimatedMinutes = getParallelBracketsEstimatedMinutes(
    readyNowBrackets,
    durationByFormatKey,
    seenMatchIds,
    activeTargetCount
  );

  const poolBranchEstimatedMinutes = subsequentPoolStagesEstimatedMinutes + lateBracketsEstimatedMinutes;
  const parallelBranchesEstimatedMinutes = Math.max(
    firstStageBracketsEstimatedMinutes,
    poolBranchEstimatedMinutes
  );

  const workflowEstimatedMinutes = firstPoolStageEstimatedMinutes + parallelBranchesEstimatedMinutes;
  return {
    totalMinutes: Math.max(workflowEstimatedMinutes, readyNowBracketsEstimatedMinutes),
    breakdown: {
      firstPoolStageEstimatedMinutes,
      subsequentPoolStagesEstimatedMinutes,
      firstStageBracketsEstimatedMinutes,
      lateBracketsEstimatedMinutes,
      readyNowBracketsEstimatedMinutes,
      parallelBranchesEstimatedMinutes,
      workflowEstimatedMinutes,
      remainingPoolStagesCount: remainingPoolStages.length,
      remainingBracketsCount: remainingBrackets.length,
      readyNowBracketsCount: readyNowBrackets.length,
      deferredBracketsCount: deferredBrackets.length,
      hasPoolParallelConfiguration,
    },
  };
};

const getActiveTargetCount = (view: LiveViewData, schedulableTargetCount: number) => {
  const activeTargetsFromView = (view.targets ?? []).filter((target) =>
    ACTIVE_TARGET_STATUSES.has((target.status ?? '').toUpperCase())
  ).length;

  return Math.max(activeTargetsFromView, schedulableTargetCount, 1);
};

const getEstimatedEndAt = (
  startAt: Date | undefined,
  nowTimestamp: number,
  remainingEstimatedMinutes: number,
  activeTargetCount: number
) => {
  if (remainingEstimatedMinutes <= 0) {
    return new Date(nowTimestamp);
  }
  if (activeTargetCount <= 0) {
    return undefined;
  }

  const baseTimestamp = startAt
    ? Math.max(startAt.getTime(), nowTimestamp)
    : nowTimestamp;

  return new Date(baseTimestamp + (remainingEstimatedMinutes * 60_000));
};

const getRemainingDurationMinutes = (
  estimatedEndAt: Date | undefined,
  startAt: Date | undefined,
  nowTimestamp: number
) => {
  if (!estimatedEndAt) {
    return undefined;
  }

  const baseTimestamp = startAt
    ? Math.max(startAt.getTime(), nowTimestamp)
    : nowTimestamp;
  const millisecondsLeft = estimatedEndAt.getTime() - baseTimestamp;
  if (millisecondsLeft <= 0) {
    return 0;
  }

  return Math.ceil(millisecondsLeft / 60_000);
};

const LiveTournamentViewHeader = ({
  t,
  view,
  schedulableTargetCount,
  isAdmin,
  screenMode,
  onRefresh,
  showSummary,
  onToggleSummary,
  showBracketsLink,
  showPoolsLink,
  poolStages,
  brackets,
  viewMode,
}: LiveTournamentViewHeaderProperties) => {
  const headerGap = screenMode ? 'gap-2' : 'gap-3';
  const titleClass = screenMode
    ? 'text-[10px] uppercase tracking-[0.2em] text-cyan-300'
    : 'text-[11px] uppercase tracking-[0.25em] text-cyan-400';
  const nameClass = screenMode
    ? 'text-lg font-semibold text-white mt-0.5'
    : 'text-xl font-semibold text-white mt-1';
  const idClass = screenMode ? 'mt-0 text-[11px] text-slate-500' : 'mt-0.5 text-xs text-slate-500';
  const infoBadgeClass = screenMode
    ? 'rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300'
    : 'rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300';
  const actionsGap = screenMode ? 'gap-1.5' : 'gap-2';
  const actionButtonClass = screenMode
    ? 'rounded-full border border-slate-700/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white'
    : 'rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white';
  const linkButtonClass = screenMode
    ? 'rounded-full border border-cyan-500/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300'
    : 'rounded-full border border-cyan-500/70 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300';
  const refreshButtonClass = screenMode
    ? 'inline-flex items-center gap-2 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:border-slate-500'
    : 'inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500';
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const startAt = toValidDate(view.startTime);
  const activeTargetCount = getActiveTargetCount(view, schedulableTargetCount);
  const remainingEstimate = getRemainingEstimatedMinutes(view, activeTargetCount);
  const remainingEstimatedMinutes = remainingEstimate.totalMinutes;
  const estimatedEndAt = getEstimatedEndAt(
    startAt,
    nowTimestamp,
    remainingEstimatedMinutes,
    activeTargetCount
  );

  useEffect(() => {
    if (!estimatedEndAt || remainingEstimatedMinutes <= 0) {
      return undefined;
    }

    const updateNowTimestamp = () => {
      setNowTimestamp(Date.now());
    };

    updateNowTimestamp();

    let intervalId: number | undefined;
    let lastMinuteIntervalId: number | undefined;
    let lastMinuteTimeoutId: number | undefined;
    const millisecondsUntilNextMinute = 60_000 - (Date.now() % 60_000);
    const timeoutId = globalThis.setTimeout(() => {
      updateNowTimestamp();
      intervalId = globalThis.setInterval(updateNowTimestamp, 60_000);
    }, millisecondsUntilNextMinute);

    const millisecondsUntilLastMinute = estimatedEndAt.getTime() - Date.now() - 60_000;
    const startLastMinuteTick = () => {
      updateNowTimestamp();
      lastMinuteIntervalId = globalThis.setInterval(updateNowTimestamp, 1_000);
    };

    if (millisecondsUntilLastMinute <= 0) {
      startLastMinuteTick();
    } else {
      lastMinuteTimeoutId = globalThis.setTimeout(startLastMinuteTick, millisecondsUntilLastMinute);
    }

    return () => {
      globalThis.clearTimeout(timeoutId);
      if (lastMinuteTimeoutId !== undefined) {
        globalThis.clearTimeout(lastMinuteTimeoutId);
      }
      if (intervalId !== undefined) {
        globalThis.clearInterval(intervalId);
      }
      if (lastMinuteIntervalId !== undefined) {
        globalThis.clearInterval(lastMinuteIntervalId);
      }
    };
  }, [estimatedEndAt?.getTime(), remainingEstimatedMinutes]);

  const estimatedDurationMinutes = Math.max(remainingEstimatedMinutes, 0);
  const remainingDurationMinutes = getRemainingDurationMinutes(estimatedEndAt, startAt, nowTimestamp);

  return (
  <div className={`flex flex-wrap items-center justify-between ${headerGap}`}>
    <div>
      <p className={titleClass}>{t('live.title')}</p>
      <h2 className={nameClass}>{view.name}</h2>
      {isAdmin && (
        <p className={idClass}>ID: {view.id}</p>
      )}
    </div>
    <div className={`w-full sm:w-auto flex flex-col items-start sm:items-end ${actionsGap}`}>
      <div className={`flex w-full flex-wrap items-center justify-start sm:justify-end ${actionsGap}`}>
        <span className={infoBadgeClass} title={`${t('common.status')}: ${view.status}`}>
          <span className="hidden sm:inline">{t('common.status')}: </span>
          {view.status}
        </span>
        <span className={infoBadgeClass} title={`${t('live.estimatedDuration')}: ${formatDurationClock(estimatedDurationMinutes)}`}>
          <span className="hidden sm:inline">{t('live.estimatedDuration')}: </span>
          {formatDurationClock(estimatedDurationMinutes)}
        </span>
        {startAt && (
          <span className={infoBadgeClass} title={`${t('live.startTime')}: ${formatDateTime(startAt)}`}>
            <span className="hidden sm:inline">{t('live.startTime')}: </span>
            {formatDateTime(startAt)}
          </span>
        )}
        {estimatedEndAt && (
          <span className={infoBadgeClass} title={`${t('live.estimatedEndTime')}: ${formatDateTime(estimatedEndAt)}`}>
            <span className="hidden sm:inline">{t('live.estimatedEndTime')}: </span>
            {formatDateTime(estimatedEndAt)}
          </span>
        )}
        {remainingDurationMinutes !== undefined && (
          <span className={infoBadgeClass} title={`${t('live.remainingDuration')}: ${formatDurationClock(remainingDurationMinutes)}`}>
            <span className="hidden sm:inline">{t('live.remainingDuration')}: </span>
            {formatDurationClock(remainingDurationMinutes)}
          </span>
        )}
      </div>
      <div className={`flex w-full flex-wrap items-center justify-start sm:justify-end ${actionsGap}`}>
        {isAdmin && !screenMode && (
          <a
            href={`/?view=edit-tournament&tournamentId=${view.id}`}
            className={actionButtonClass}
          >
            {t('common.edit')}
          </a>
        )}
        <button
          type="button"
          onClick={onToggleSummary}
          className={actionButtonClass}
        >
          {showSummary ? t('live.hideSummary') : t('live.showSummary')}
        </button>
        {showPoolsLink && (
          <a
            href={`/?view=pool-stages&tournamentId=${view.id}`}
            className={linkButtonClass}
          >
            {t('nav.poolStagesRunning')}
          </a>
        )}
        {showBracketsLink && (
          <a
            href={`/?view=brackets&tournamentId=${view.id}`}
            className={linkButtonClass}
          >
            {t('nav.bracketsRunning')}
          </a>
        )}
        <button
          onClick={onRefresh}
          className={refreshButtonClass}
        >
          {t('common.refresh')}
        </button>
      </div>
      {viewMode === 'live' && (poolStages.length > 0 || brackets.length > 0) && (
        <div className="flex flex-wrap items-start justify-end gap-3 text-xs text-slate-300">
          {poolStages.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">{t('live.poolStages')}</span>
              {poolStages.map((stage) => (
                <a
                  key={stage.id}
                  href={`#pool-stage-${view.id}-${stage.id}`}
                  className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400/70 hover:text-cyan-100"
                >
                  {stage.name}
                </a>
              ))}
            </div>
          )}
          {brackets.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">{t('live.bracketStages')}</span>
              {brackets.map((bracket) => (
                <a
                  key={bracket.id}
                  href={`/?view=brackets&tournamentId=${view.id}&bracketId=${bracket.id}`}
                  className="rounded-full border border-slate-700 px-3 py-1 hover:border-amber-400/70 hover:text-amber-100"
                >
                  {bracket.name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  );
};

const LiveTournamentPoolSummaryCards = ({ t, stats, hasLoserBracket }: LiveTournamentPoolSummaryProperties) => (
  <div className="grid gap-4 md:grid-cols-3">
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.poolStages')}</p>
      <p className="mt-2 text-lg font-semibold text-white">{stats.poolStageCount}</p>
      {stats.poolsPerStage.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          {t('live.poolsPerStage')}: {stats.poolsPerStage.join(' · ')}
        </p>
      )}
    </div>
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.totalPools')}</p>
      <p className="mt-2 text-lg font-semibold text-white">{stats.totalPools}</p>
      <p className="mt-1 text-xs text-slate-400">{t('live.playersPerPoolNote')}</p>
    </div>
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.afterPools')}</p>
      <p className="mt-2 text-lg font-semibold text-white">{hasLoserBracket ? t('common.yes') : t('common.no')}</p>
    </div>
  </div>
);

const LiveTournamentView = ({
  t,
  view,
  isAdmin,
  viewMode,
  viewStatus,
  stageId,
  isAggregateView,
  screenMode,
  visibleLiveViewsCount,
  showGlobalQueue,
  isPoolStagesReadonly,
  isBracketsReadonly,
  availableTargetsByTournament,
  schedulableTargetCountByTournament,
  matchTargetSelections,
  updatingMatchId,
  resettingPoolId,
  editingMatchId,
  updatingRoundKey,
  resettingBracketId,
  matchScores,
  getMatchKey,
  getTargetIdForSelection,
  getStatusLabel,
  formatTargetLabel,
  getTargetLabel,
  getMatchTargetLabel,
  onTargetSelectionChange,
  onStartMatch,
  onCompleteMatch,
  onCancelMatch,
  onEditMatch,
  onSaveMatchScores,
  onCancelMatchEdit,
  onScoreChange,
  onResetPoolMatches,
  onEditStage,
  onCancelEditStage,
  onUpdateStage,
  onCompleteStageWithScores,
  onDeleteStage,
  onRecomputeDoubleStage,
  onStagePoolCountChange,
  onStagePlayersPerPoolChange,
  onStageStatusChange,
  onLaunchStage,
  onResetStage,
  canDeleteStage,
  editingStageId,
  updatingStageId,
  stageStatusDrafts,
  stagePoolCountDrafts,
  stagePlayersPerPoolDrafts,
  playerIdByTournament = {},
  onCompleteBracketRound,
  onResetBracketMatches,
  onSelectBracket,
  activeBracketId,
  onRefresh,
}: LiveTournamentViewProperties) => {
  const [groupNameByPlayerId, setGroupNameByPlayerId] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let isCancelled = false;

    const loadGroupLabels = async () => {
      if (view.format !== TournamentFormat.DOUBLE && view.format !== TournamentFormat.TEAM_4_PLAYER) {
        if (!isCancelled) {
          setGroupNameByPlayerId(new Map());
        }
        return;
      }

      try {
        const groups = view.format === TournamentFormat.DOUBLE
          ? await fetchDoublettes(view.id)
          : await fetchEquipes(view.id);
        const nextMap = new Map<string, string>();
        for (const group of groups) {
          for (const member of group.members) {
            nextMap.set(member.playerId, group.name);
          }
        }
        if (!isCancelled) {
          setGroupNameByPlayerId(nextMap);
        }
      } catch {
        if (!isCancelled) {
          setGroupNameByPlayerId(new Map());
        }
      }
    };

    void loadGroupLabels();

    return () => {
      isCancelled = true;
    };
  }, [view.format, view.id]);

  const getParticipantLabel = (player: LiveParticipant | undefined) => {
    if (!player) {
      return 'TBD';
    }
    const groupLabel = player.id ? groupNameByPlayerId.get(player.id) : undefined;
    if (groupLabel) {
      return groupLabel;
    }

    const teamName = (player.teamName ?? '').trim();
    if (teamName) {
      return teamName;
    }

    if (view.format === TournamentFormat.SINGLE) {
      const surname = (player.surname ?? '').trim();
      if (surname) {
        return surname;
      }
    }

    const fallback = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
    return fallback || 'TBD';
  };
  const [showSummary, setShowSummary] = useState(false);
  const handleToggleSummary = () => setShowSummary((value) => !value);
  const filteredPoolStages = filterPoolStagesForView(
    viewMode,
    viewStatus,
    view.poolStages,
    isAdmin,
    screenMode
  );
  const displayedPoolStages = (screenMode && stageId)
    ? filteredPoolStages.filter((stage) => stage.id === stageId)
    : filteredPoolStages;
  const filteredBrackets = filterBracketsForView(
    viewMode,
    viewStatus,
    view.brackets,
    screenMode,
    isAdmin
  );
  const headerPoolStages = isAdmin
    ? displayedPoolStages
    : displayedPoolStages.filter((stage) =>
      (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0)
    );
  const headerBrackets = isAdmin
    ? filteredBrackets
    : filteredBrackets.filter((bracket) => (bracket.entries?.length ?? 0) > 0);
  const hasLiveBrackets = hasActiveBrackets(view, viewStatus, false, screenMode);
  const hasCompletedPoolStage = displayedPoolStages.some((stage) => stage.status === 'COMPLETED');
  const showBracketsLink = hasCompletedPoolStage && hasLiveBrackets && isPoolStagesView(viewMode);
  const showPoolsLink = isBracketsView(viewMode) && displayedPoolStages.length > 0;
  const hasLoserBracket = getHasLoserBracket(view.brackets);
  const poolStats = getPoolStageStats(displayedPoolStages);
  const queue = buildMatchQueue(view, displayedPoolStages);
  const showTournamentName = isAggregateView && visibleLiveViewsCount > 1;
  const hasActivePoolStagesForScreen = displayedPoolStages.length > 0;
  const showPools = !isBracketsView(viewMode)
    && (!screenMode || hasActivePoolStagesForScreen || !hasLiveBrackets);
  const hasRunningPoolStages = (view.poolStages || []).some(
    (stage) => stage.status !== 'COMPLETED' && (stage.pools?.length || 0) > 0
  );
  const showBrackets = !isPoolStagesView(viewMode)
    && (isAdmin || viewMode === 'brackets' || !hasRunningPoolStages);
  const showViewHeader = !(screenMode && isBracketsView(viewMode));
  const schedulableTargetCount = schedulableTargetCountByTournament.get(view.id) ?? 1;

  const queueProperties = {
    t,
    queue,
    showTournamentName,
    availableTargetsByTournament,
    matchTargetSelections,
    updatingMatchId,
    isPoolStagesReadonly,
    getMatchKey,
    getTargetIdForSelection,
    onTargetSelectionChange,
    onStartMatch,
    getStatusLabel,
    formatTargetLabel,
    getTargetLabel,
  };

  const poolStagesProperties = {
    t,
    tournamentId: view.id,
    tournamentStartTime: view.startTime,
    tournamentStatus: view.status,
    doubleStageEnabled: Boolean(view.doubleStageEnabled),
    stages: displayedPoolStages,
    isPoolStagesReadonly,
    getStatusLabel,
    getMatchTargetLabel,
    getTargetLabel,
    matchScores,
    matchTargetSelections,
    updatingMatchId,
    resettingPoolId,
    editingMatchId,
    availableTargetsByTournament,
    schedulableTargetCount,
    getMatchKey,
    getTargetIdForSelection,
    onTargetSelectionChange,
    onScoreChange,
    onStartMatch,
    onCompleteMatch,
    onCancelMatch,
    onEditMatch,
    onSaveMatchScores,
    onCancelMatchEdit,
    onResetPoolMatches,
    onEditStage,
    onCancelEditStage,
    onUpdateStage,
    onCompleteStageWithScores,
    onDeleteStage,
    onRecomputeDoubleStage,
    onStagePoolCountChange,
    onStagePlayersPerPoolChange,
    onStageStatusChange,
    onLaunchStage,
    onResetStage,
    canDeleteStage,
    editingStageId,
    updatingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    playerIdByTournament,
    isAdmin,
    getParticipantLabel,
  };

  const bracketsProperties = {
    t,
    tournamentId: view.id,
    tournamentStartTime: view.startTime,
    poolStages: view.poolStages ?? [],
    brackets: filteredBrackets,
    playerIdByTournament,
    screenMode,
    isAdmin,
    isBracketsReadonly,
    updatingMatchId,
    editingMatchId,
    updatingRoundKey,
    resettingBracketId,
    matchScores,
    matchTargetSelections,
    availableTargetsByTournament,
    schedulableTargetCount,
    getStatusLabel,
    getMatchKey,
    getTargetIdForSelection,
    getTargetLabel,
    onTargetSelectionChange,
    onStartMatch,
    onCompleteMatch,
    onCancelMatch,
    onEditMatch,
    onSaveMatchScores,
    onCancelMatchEdit,
    onScoreChange,
    onCompleteBracketRound,
    onResetBracketMatches,
    onSelectBracket,
    activeBracketId,
    getParticipantLabel,
  };

  return (
    <div className="space-y-10">
      {showViewHeader && (
        <LiveTournamentViewHeader
          t={t}
          view={view}
          schedulableTargetCount={schedulableTargetCount}
          isAdmin={isAdmin}
          screenMode={screenMode}
          onRefresh={onRefresh}
          showSummary={showSummary}
          onToggleSummary={handleToggleSummary}
          showBracketsLink={showBracketsLink}
          showPoolsLink={showPoolsLink}
          poolStages={headerPoolStages}
          brackets={headerBrackets}
          viewMode={viewMode}
        />
      )}
      {showPools && showSummary && (
        <LiveTournamentPoolSummaryCards t={t} stats={poolStats} hasLoserBracket={hasLoserBracket} />
      )}
      {showPools && !isPoolStagesView(viewMode) && !showGlobalQueue && (
        <MatchQueueSection {...queueProperties} />
      )}
      {showPools && <PoolStagesSection {...poolStagesProperties} />}
      {showBrackets && <BracketsSection {...bracketsProperties} />}
    </div>
  );
};

export default LiveTournamentView;
