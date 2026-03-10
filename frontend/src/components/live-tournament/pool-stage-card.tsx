import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LiveViewMatch,
  LiveViewPool,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import { buildPoolLeaderboard } from './pool-leaderboard';
import MatchScoreInputs from './match-score-inputs';
import MatchTargetSelector from './match-target-selector';
import { getMatchFormatPresets, getMatchFormatTooltip } from '../../utils/match-format-presets';

type LiveParticipant = {
  id?: string;
  firstName?: string;
  lastName?: string;
};

export const formatScheduledMatchTime = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const FALLBACK_MATCH_DURATION_MINUTES = 12;
const NON_REMAINING_STAGE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export const getEstimatedMatchDurationMinutes = (matchFormatKey: string | undefined): number => {
  if (!matchFormatKey) {
    return FALLBACK_MATCH_DURATION_MINUTES;
  }
  const preset = getMatchFormatPresets().find((item) => item.key === matchFormatKey);
  return preset?.durationMinutes ?? FALLBACK_MATCH_DURATION_MINUTES;
};

export const isRemainingStage = (status: string | undefined) => (
  !NON_REMAINING_STAGE_STATUSES.has((status ?? '').toUpperCase())
);

const getMatchPlayerIds = (match: Pick<LiveViewMatch, 'playerMatches'>) => (
  (match.playerMatches ?? [])
    .map((playerMatch) => playerMatch.player?.id)
    .filter((playerId): playerId is string => Boolean(playerId))
);

const getPoolAssignmentPlayerIds = (pool: LiveViewPool) => (
  (pool.assignments ?? [])
    .map((assignment) => assignment.player?.id)
    .filter((playerId): playerId is string => Boolean(playerId))
);

const getMatchReadyTimestampForOptimisticSchedule = (
  match: Pick<LiveViewMatch, 'playerMatches'>,
  playerAvailabilityById: Map<string, number>,
  nowTimestamp: number
) => getMatchPlayerIds(match).reduce(
  (maxTimestamp, playerId) => Math.max(maxTimestamp, playerAvailabilityById.get(playerId) ?? nowTimestamp),
  nowTimestamp
);

const setPlayersAvailabilityForMatch = (
  match: Pick<LiveViewMatch, 'playerMatches'>,
  playerAvailabilityById: Map<string, number>,
  finishTimestamp: number
) => {
  for (const playerId of getMatchPlayerIds(match)) {
    playerAvailabilityById.set(playerId, finishTimestamp);
  }
};

const getPoolPlayerIdsForConcurrency = (pool: LiveViewPool) => {
  const assignmentPlayerIds = new Set(getPoolAssignmentPlayerIds(pool));
  if (assignmentPlayerIds.size > 0) {
    return assignmentPlayerIds;
  }

  return new Set(
    (pool.matches ?? [])
      .flatMap((match) => getMatchPlayerIds(match))
      .filter((playerId): playerId is string => Boolean(playerId))
  );
};

export const getPoolMaxConcurrentMatches = (pool: LiveViewPool, fallbackPlayerCount?: number) => {
  const detectedPlayerCount = getPoolPlayerIdsForConcurrency(pool).size;
  const playerCount = detectedPlayerCount > 0
    ? detectedPlayerCount
    : Math.max(0, Math.floor(fallbackPlayerCount ?? 0));
  if (playerCount <= 1) {
    return 1;
  }
  return Math.max(1, Math.floor(playerCount / 2));
};

export const findEarliestAvailabilityIndex = (availability: number[]) => {
  let earliestIndex = 0;
  let earliestValue = availability[0] ?? Number.POSITIVE_INFINITY;

  for (let index = 1; index < availability.length; index += 1) {
    const value = availability[index] ?? Number.POSITIVE_INFINITY;
    if (value < earliestValue) {
      earliestValue = value;
      earliestIndex = index;
    }
  }

  return earliestIndex;
};

export const getBestTargetAndPoolSlot = (
  targetAvailability: number[],
  poolAvailability: number[],
  matchReadyTimestamp: number
) => {
  let bestTargetIndex = 0;
  let bestPoolSlotIndex = 0;
  let bestStartTimestamp = Number.POSITIVE_INFINITY;

  for (let targetIndex = 0; targetIndex < targetAvailability.length; targetIndex += 1) {
    const targetReadyTimestamp = targetAvailability[targetIndex] ?? 0;
    for (let poolSlotIndex = 0; poolSlotIndex < poolAvailability.length; poolSlotIndex += 1) {
      const poolReadyTimestamp = poolAvailability[poolSlotIndex] ?? 0;
      const startTimestamp = Math.max(targetReadyTimestamp, poolReadyTimestamp, matchReadyTimestamp);
      if (startTimestamp < bestStartTimestamp) {
        bestStartTimestamp = startTimestamp;
        bestTargetIndex = targetIndex;
        bestPoolSlotIndex = poolSlotIndex;
      }
    }
  }

  return {
    bestTargetIndex,
    bestPoolSlotIndex,
    bestStartTimestamp,
  };
};

type OptimisticPoolQueue = {
  poolId: string;
  poolNumber: number;
  progress: number;
  maxConcurrentMatches: number;
  usesFallbackConcurrency: boolean;
  queuedMatches: LiveViewMatch[];
};

type OptimisticCandidate = {
  queue: OptimisticPoolQueue;
  matchIndex: number;
  match: LiveViewMatch;
  bestTargetIndex: number;
  bestPoolSlotIndex: number;
  startTimestamp: number;
  finishTimestamp: number;
};

export const buildOptimisticPoolQueues = (
  pools: LiveViewPool[],
  stagePlayersPerPool?: number
): OptimisticPoolQueue[] => pools.map((pool) => {
  const matches = pool.matches ?? [];
  const queuedMatches = matches
    .filter((match) => match.status === 'SCHEDULED')
    .toSorted((first, second) => {
      if (first.roundNumber !== second.roundNumber) {
        return first.roundNumber - second.roundNumber;
      }
      return first.matchNumber - second.matchNumber;
    });
  const progress = matches.filter(
    (match) => match.status === 'COMPLETED' || match.status === 'IN_PROGRESS'
  ).length;
  const detectedPlayerCount = getPoolPlayerIdsForConcurrency(pool).size;
  const usesFallbackConcurrency = detectedPlayerCount === 0 && stagePlayersPerPool !== undefined;
  return {
    poolId: pool.id,
    poolNumber: pool.poolNumber,
    progress,
    maxConcurrentMatches: getPoolMaxConcurrentMatches(pool, stagePlayersPerPool),
    usesFallbackConcurrency,
    queuedMatches,
  };
});

const buildPoolIdByMatchId = (pools: LiveViewPool[]) => {
  const poolIdByMatchId = new Map<string, string>();
  for (const pool of pools) {
    for (const match of pool.matches ?? []) {
      poolIdByMatchId.set(match.id, pool.id);
    }
  }
  return poolIdByMatchId;
};

export const buildPoolAvailabilityByPoolId = (poolQueues: OptimisticPoolQueue[], nowTimestamp: number) => {
  const poolAvailabilityByPoolId = new Map<string, number[]>();
  for (const queue of poolQueues) {
    poolAvailabilityByPoolId.set(
      queue.poolId,
      Array.from({ length: queue.maxConcurrentMatches }, () => nowTimestamp)
    );
  }
  return poolAvailabilityByPoolId;
};

export const findBestOptimisticCandidate = (
  poolQueues: OptimisticPoolQueue[],
  targetAvailability: number[],
  poolAvailabilityByPoolId: Map<string, number[]>,
  playerAvailabilityById: Map<string, number>,
  nowTimestamp: number,
  prioritizeLeastProgressedPools: boolean,
  resolveDurationMinutes: (match: LiveViewMatch) => number
) => {
  const queuesWithMatches = poolQueues.filter((queue) => queue.queuedMatches.length > 0);
  const findBestFromQueues = (candidateQueues: OptimisticPoolQueue[]) => {
    let bestCandidate: OptimisticCandidate | undefined;

    for (const queue of candidateQueues) {
      const poolAvailability = poolAvailabilityByPoolId.get(queue.poolId) ?? [nowTimestamp];
      for (const [matchIndex, match] of queue.queuedMatches.entries()) {
        const matchReadyTimestamp = getMatchReadyTimestampForOptimisticSchedule(
          match,
          playerAvailabilityById,
          nowTimestamp
        );
        const slot = getBestTargetAndPoolSlot(targetAvailability, poolAvailability, matchReadyTimestamp);
        const finishTimestamp = slot.bestStartTimestamp + resolveDurationMinutes(match) * 60_000;

        if (!bestCandidate) {
          bestCandidate = {
            queue,
            matchIndex,
            match,
            bestTargetIndex: slot.bestTargetIndex,
            bestPoolSlotIndex: slot.bestPoolSlotIndex,
            startTimestamp: slot.bestStartTimestamp,
            finishTimestamp,
          };
          continue;
        }

        const hasEarlierFinish = finishTimestamp < bestCandidate.finishTimestamp;
        const hasEarlierStartAtSameFinish = (
          finishTimestamp === bestCandidate.finishTimestamp
          && slot.bestStartTimestamp < bestCandidate.startTimestamp
        );
        const hasLowerPoolNumberAtSameStartAndFinish = (
          finishTimestamp === bestCandidate.finishTimestamp
          && slot.bestStartTimestamp === bestCandidate.startTimestamp
          && queue.poolNumber < bestCandidate.queue.poolNumber
        );
        if (hasEarlierFinish || hasEarlierStartAtSameFinish || hasLowerPoolNumberAtSameStartAndFinish) {
          bestCandidate = {
            queue,
            matchIndex,
            match,
            bestTargetIndex: slot.bestTargetIndex,
            bestPoolSlotIndex: slot.bestPoolSlotIndex,
            startTimestamp: slot.bestStartTimestamp,
            finishTimestamp,
          };
        }
      }
    }

    return bestCandidate;
  };

  const fairnessQueues = prioritizeLeastProgressedPools
    ? (() => {
      const minProgress = Math.min(...queuesWithMatches.map((queue) => queue.progress));
      return queuesWithMatches.filter((queue) => queue.progress <= (minProgress + 1));
    })()
    : queuesWithMatches;

  const bestFromFairnessQueues = findBestFromQueues(fairnessQueues);
  if (!bestFromFairnessQueues) {
    return undefined;
  }

  const hasIdleTargetNow = targetAvailability.some((availableAt) => availableAt <= nowTimestamp);
  const fairnessDelaysStart = bestFromFairnessQueues.startTimestamp > nowTimestamp;
  if (!prioritizeLeastProgressedPools || !hasIdleTargetNow || !fairnessDelaysStart) {
    return bestFromFairnessQueues;
  }

  return findBestFromQueues(queuesWithMatches) ?? bestFromFairnessQueues;
};

export const computeOptimisticStartTimes = ({
  pools,
  stagePlayersPerPool,
  schedulableTargetCount,
  nowTimestamp,
  prioritizeLeastProgressedPools,
  resolveDurationMinutes,
}: {
  pools: LiveViewPool[];
  stagePlayersPerPool?: number;
  schedulableTargetCount: number;
  nowTimestamp: number;
  prioritizeLeastProgressedPools?: boolean;
  resolveDurationMinutes: (match: LiveViewMatch) => number;
}) => {
  const poolQueues = pools.map((pool) => {
    return buildOptimisticPoolQueues([pool], stagePlayersPerPool)[0] as OptimisticPoolQueue;
  });
  const shouldPrioritizeLeastProgressedPools = prioritizeLeastProgressedPools
    || poolQueues.every((queue) => queue.usesFallbackConcurrency);
  const inProgressMatches = pools
    .flatMap((pool) => pool.matches ?? [])
    .filter((match) => match.status === 'IN_PROGRESS');
  const poolIdByMatchId = buildPoolIdByMatchId(pools);

  const totalTargetCount = Math.max(1, schedulableTargetCount);
  const targetAvailability: number[] = [];
  const playerAvailabilityById = new Map<string, number>();
  const poolAvailabilityByPoolId = buildPoolAvailabilityByPoolId(poolQueues, nowTimestamp);

  const inProgressToReserve = Math.min(totalTargetCount, inProgressMatches.length);
  for (const inProgressMatch of inProgressMatches.slice(0, inProgressToReserve)) {
    const finishTimestamp = nowTimestamp + resolveDurationMinutes(inProgressMatch) * 60_000;
    targetAvailability.push(finishTimestamp);
    setPlayersAvailabilityForMatch(inProgressMatch, playerAvailabilityById, finishTimestamp);

    const poolId = poolIdByMatchId.get(inProgressMatch.id);
    if (poolId) {
      const poolAvailability = poolAvailabilityByPoolId.get(poolId) ?? [nowTimestamp];
      const earliestPoolSlotIndex = findEarliestAvailabilityIndex(poolAvailability);
      poolAvailability[earliestPoolSlotIndex] = finishTimestamp;
      poolAvailabilityByPoolId.set(poolId, poolAvailability);
    }
  }

  const freeTargetCount = Math.max(0, totalTargetCount - inProgressToReserve);
  for (let index = 0; index < freeTargetCount; index += 1) {
    targetAvailability.push(nowTimestamp);
  }

  const optimisticById = new Map<string, string>();
  const finishTimestampByMatchId = new Map<string, number>();

  for (const inProgressMatch of inProgressMatches.slice(0, inProgressToReserve)) {
    const finishTimestamp = nowTimestamp + resolveDurationMinutes(inProgressMatch) * 60_000;
    finishTimestampByMatchId.set(inProgressMatch.id, finishTimestamp);
  }

  while (poolQueues.some((queue) => queue.queuedMatches.length > 0)) {
    const bestCandidate = findBestOptimisticCandidate(
      poolQueues,
      targetAvailability,
      poolAvailabilityByPoolId,
      playerAvailabilityById,
      nowTimestamp,
      shouldPrioritizeLeastProgressedPools,
      resolveDurationMinutes
    );
    if (!bestCandidate) {
      break;
    }

    const safeCandidate = bestCandidate;
    const [nextMatch] = safeCandidate.queue.queuedMatches.splice(safeCandidate.matchIndex, 1);
    if (!nextMatch) {
      continue;
    }

    optimisticById.set(nextMatch.id, formatHourMinute(new Date(safeCandidate.startTimestamp)));
    finishTimestampByMatchId.set(nextMatch.id, safeCandidate.finishTimestamp);

    targetAvailability[safeCandidate.bestTargetIndex] = safeCandidate.finishTimestamp;
    const poolAvailability = poolAvailabilityByPoolId.get(safeCandidate.queue.poolId) ?? [nowTimestamp];
    poolAvailability[safeCandidate.bestPoolSlotIndex] = safeCandidate.finishTimestamp;
    poolAvailabilityByPoolId.set(safeCandidate.queue.poolId, poolAvailability);
    setPlayersAvailabilityForMatch(nextMatch, playerAvailabilityById, safeCandidate.finishTimestamp);
    safeCandidate.queue.progress += 1;
  }

  const latestFinishTimestamp = targetAvailability.reduce(
    (latest, timestamp) => Math.max(latest, timestamp),
    nowTimestamp
  );

  return {
    optimisticById,
    finishTimestampByMatchId,
    estimatedDurationMinutes: Math.max(0, Math.ceil((latestFinishTimestamp - nowTimestamp) / 60_000)),
  };
};

const formatHourMinute = (date: Date) => (
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
);

const formatDurationClock = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const toValidDate = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
};

const isSameCalendarDate = (leftDate: Date, rightDate: Date) => (
  leftDate.getFullYear() === rightDate.getFullYear()
  && leftDate.getMonth() === rightDate.getMonth()
  && leftDate.getDate() === rightDate.getDate()
);

export const getOptimisticScheduleBaseDateTime = (
  tournamentStartTime: string | undefined,
  estimatedStartOffsetMinutes: number
) => {
  const currentDateTime = new Date();
  const tournamentStartDateTime = toValidDate(tournamentStartTime);
  const scheduleBaseDateTime = tournamentStartDateTime
    && !isSameCalendarDate(tournamentStartDateTime, currentDateTime)
    ? tournamentStartDateTime
    : currentDateTime;

  return new Date(scheduleBaseDateTime.getTime() + estimatedStartOffsetMinutes * 60_000);
};

type PoolStageCardProperties = {
  t: Translator;
  tournamentId: string;
  tournamentStartTime: string | undefined;
  tournamentStatus: string;
  doubleStageEnabled: boolean;
  stage: LiveViewPoolStage;
  estimatedStartOffsetMinutes: number;
  isAdmin: boolean;
  isPoolStagesReadonly: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  resettingPoolId: string | undefined;
  editingMatchId?: string | undefined;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  schedulableTargetCount: number;
  optimisticStartTimeByMatchIdOverride?: Map<string, string>;
  estimatedDurationMinutesOverride?: number;
  estimatedStartTimeOverride?: Date;
  estimatedEndTimeOverride?: Date;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => void;
  onEditStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, value: string) => void;
  onLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  canDeleteStage: boolean;
  preferredPlayerId?: string;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  canManageStageActions?: boolean;
  getParticipantLabel?: (player: LiveParticipant | undefined) => string;
};

const PoolStageCard = ({
  t,
  tournamentId,
  tournamentStartTime,
  tournamentStatus,
  doubleStageEnabled,
  stage,
  estimatedStartOffsetMinutes,
  isAdmin,
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
  optimisticStartTimeByMatchIdOverride,
  estimatedDurationMinutesOverride,
  estimatedStartTimeOverride,
  estimatedEndTimeOverride,
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
  preferredPlayerId,
  editingStageId,
  updatingStageId,
  stageStatusDrafts,
  stagePoolCountDrafts,
  stagePlayersPerPoolDrafts,
  canManageStageActions = true,
  getParticipantLabel,
}: PoolStageCardProperties) => {
  const [showMatches, setShowMatches] = useState(!isPoolStagesReadonly);
  const [showCompletedMatchesByPool, setShowCompletedMatchesByPool] = useState<Record<string, boolean>>({});
  const [activePoolId, setActivePoolId] = useState(stage.pools?.[0]?.id ?? '');
  const pools = useMemo(() => stage.pools ?? [], [stage.pools]);
  const manualSelectionReference = useRef(false);
  const playerPoolId = useMemo(() => {
    if (!preferredPlayerId) return '';
    const match = pools.find((pool) =>
      pool.assignments?.some((assignment) => assignment.player?.id === preferredPlayerId)
    );
    return match?.id ?? '';
  }, [pools, preferredPlayerId]);

  useEffect(() => {
    setShowMatches(!isPoolStagesReadonly);
  }, [isPoolStagesReadonly]);

  useEffect(() => {
    manualSelectionReference.current = false;
  }, [preferredPlayerId, stage.id]);

  useEffect(() => {
    setShowCompletedMatchesByPool({});
  }, [stage.id]);

  useEffect(() => {
    if (!playerPoolId || manualSelectionReference.current) return;
    if (playerPoolId !== activePoolId) {
      setActivePoolId(playerPoolId);
    }
  }, [activePoolId, playerPoolId]);

  useEffect(() => {
    if (pools.length === 0) {
      if (activePoolId) {
        setActivePoolId('');
      }
      return;
    }

    const hasActivePool = pools.some((pool) => pool.id === activePoolId);
    if (!hasActivePool) {
      setActivePoolId(pools[0]?.id ?? '');
    }
  }, [activePoolId, pools]);
  const activePool = pools.find((pool) => pool.id === activePoolId) ?? pools[0];
  const stageMatchFormatTooltip = getMatchFormatTooltip(stage.matchFormatKey);
  const hasPoolAssignments = useMemo(
    () => pools.some((pool) => (pool.assignments?.length ?? 0) > 0),
    [pools]
  );

  const optimisticSchedule = useMemo(() => {
    const now = getOptimisticScheduleBaseDateTime(tournamentStartTime, estimatedStartOffsetMinutes);
    return computeOptimisticStartTimes({
      pools,
      ...(stage.playersPerPool === undefined ? {} : { stagePlayersPerPool: stage.playersPerPool }),
      schedulableTargetCount,
      nowTimestamp: now.getTime(),
      resolveDurationMinutes: (match) => getEstimatedMatchDurationMinutes(
        match.matchFormatKey ?? stage.matchFormatKey
      ),
    });
  }, [
    estimatedStartOffsetMinutes,
    pools,
    schedulableTargetCount,
    stage.matchFormatKey,
    stage.playersPerPool,
    tournamentStartTime,
  ]);

  const stageParallelizedEstimatedDurationMinutes = useMemo(() => {
    if (!isRemainingStage(stage.status)) {
      return 0;
    }

    if (estimatedDurationMinutesOverride !== undefined) {
      return estimatedDurationMinutesOverride;
    }

    return optimisticSchedule.estimatedDurationMinutes;
  }, [
    estimatedDurationMinutesOverride,
    stage.status,
    optimisticSchedule.estimatedDurationMinutes,
  ]);

  const stageEstimatedEndTime = useMemo(() => {
    if (estimatedEndTimeOverride) {
      return estimatedEndTimeOverride;
    }

    const stageStartDateTime = getOptimisticScheduleBaseDateTime(
      tournamentStartTime,
      estimatedStartOffsetMinutes
    );
    return new Date(stageStartDateTime.getTime() + stageParallelizedEstimatedDurationMinutes * 60_000);
  }, [
    estimatedEndTimeOverride,
    estimatedStartOffsetMinutes,
    stageParallelizedEstimatedDurationMinutes,
    tournamentStartTime,
  ]);

  const stageEstimatedStartTime = useMemo(() => (
    estimatedStartTimeOverride
      ?? getOptimisticScheduleBaseDateTime(tournamentStartTime, estimatedStartOffsetMinutes)
  ), [estimatedStartOffsetMinutes, estimatedStartTimeOverride, tournamentStartTime]);

  const optimisticStartTimeByMatchId = optimisticStartTimeByMatchIdOverride
    ?? optimisticSchedule.optimisticById;

  const handleSelectPool = (poolId: string) => {
    manualSelectionReference.current = true;
    setActivePoolId(poolId);
  };

  const toggleCompletedMatches = (poolId: string) => {
    setShowCompletedMatchesByPool((current) => ({
      ...current,
      [poolId]: !(current[poolId] ?? false),
    }));
  };

  const renderStageControls = (stageTournamentId: string) => {
    if (isPoolStagesReadonly) {
      return;
    }
    const isEditing = editingStageId === stage.id;
    const canResetStage = stage.status !== 'NOT_STARTED';
    const canLaunchStage = stage.status !== 'IN_PROGRESS' && stage.status !== 'COMPLETED';
    const shouldShowFillLabel = canLaunchStage && !hasPoolAssignments;
    const launchStageLabel = shouldShowFillLabel ? t('live.fillStage') : t('live.launchStage');
    const launchingStageLabel = shouldShowFillLabel ? t('live.fillingStage') : t('live.launchingStage');
    if (!isEditing) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {stage.status === 'IN_PROGRESS' && (
            <button
              onClick={() => onCompleteStageWithScores(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id}
              className="rounded-full border border-amber-500/70 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-300 disabled:opacity-60"
            >
              {updatingStageId === stage.id ? t('live.completingStage') : t('live.completeStage')}
            </button>
          )}
          {doubleStageEnabled && stage.status === 'COMPLETED' && stage.stageNumber <= 3 && (
            <button
              onClick={() => onRecomputeDoubleStage(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id}
              className="rounded-full border border-cyan-500/70 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
            >
              {t('live.recomputeDoubleStage')}
            </button>
          )}
          {canResetStage && (
            <button
              onClick={() => onResetStage(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id || tournamentStatus !== 'LIVE'}
              className="rounded-full border border-sky-500/70 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:border-sky-300 disabled:opacity-60"
            >
              {updatingStageId === stage.id ? t('live.resettingStage') : t('live.resetStage')}
            </button>
          )}
          {canManageStageActions && canLaunchStage && (
            <button
              onClick={() => onLaunchStage(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id || tournamentStatus !== 'LIVE'}
              className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
            >
              {updatingStageId === stage.id ? launchingStageLabel : launchStageLabel}
            </button>
          )}
          {canManageStageActions && (
            <button
              onClick={() => onEditStage(stageTournamentId, stage)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              {t('live.editStage')}
            </button>
          )}
          {canDeleteStage && (
            <button
              onClick={() => onDeleteStage(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id}
              className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <label className="text-xs text-slate-400">
          {t('live.poolCount')}
          <input
            type="number"
            min={1}
            value={stagePoolCountDrafts[stage.id] ?? ''}
            onChange={(event_) => onStagePoolCountChange(stage.id, event_.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('live.playersPerPool')}
          <input
            type="number"
            min={1}
            value={stagePlayersPerPoolDrafts[stage.id] ?? ''}
            onChange={(event_) => onStagePlayersPerPoolChange(stage.id, event_.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <select
          value={stageStatusDrafts[stage.id] || stage.status}
          onChange={(event_) => onStageStatusChange(stage.id, event_.target.value)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
        >
          {['NOT_STARTED', 'EDITION', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
            <option
              key={status}
              value={status}
              disabled={tournamentStatus !== 'LIVE' && status === 'IN_PROGRESS'}
            >
              {getStatusLabel('stage', status)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onUpdateStage(stageTournamentId, stage)}
          disabled={updatingStageId === stage.id}
          className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
        >
          {updatingStageId === stage.id ? t('live.updatingStage') : t('live.updateStage')}
        </button>
        <button
          onClick={onCancelEditStage}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
      </>
    );
  };

  const renderPoolAssignments = (pool: LiveViewPool) => {
    if (pool.assignments && pool.assignments.length > 0) {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {pool.assignments.map((assignment) => (
            <span
              key={assignment.id}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
            >
              {getParticipantLabel
                ? getParticipantLabel(assignment.player)
                : `${assignment.player.firstName} ${assignment.player.lastName}`.trim()}
            </span>
          ))}
        </div>
      );
    }

    return <span className="text-xs text-slate-400">{t('live.noAssignments')}</span>;
  };

  const renderPoolLeaderboard = (pool: LiveViewPool) => {
    const leaderboard = buildPoolLeaderboard(pool, getParticipantLabel);
    const hasCompletedMatches = (pool.matches || []).some((match) => match.status === 'COMPLETED');
    const showCompletedMatches = showCompletedMatchesByPool[pool.id] ?? false;

    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-800/60">
            {leaderboard.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400">{t('live.noStandings')}</p>
        ) : (
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-2 py-2 text-center font-semibold">{t('live.position')}</th>
                <th className="px-3 py-2 text-left font-semibold">{t('common.player')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('live.legsWon')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('live.legsLost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leaderboard.map((row) => (
                <tr key={row.playerId} className="text-slate-200">
                  <td className="px-2 py-2 text-center font-semibold text-slate-300">#{row.position}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right">
                        {row.legsWon}
                        {row.headToHeadBonus !== undefined && (
                      <span
                        className="ml-1 text-amber-300"
                        title={t('live.headToHeadBonusTooltip')}
                        aria-label={t('live.headToHeadBonusTooltip')}
                      >
                        (+{row.headToHeadBonus})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{row.legsLost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasCompletedMatches && (
          <div className="flex justify-end border-t border-slate-800/60 bg-slate-950/40 px-2 py-2">
            <button
              type="button"
              onClick={() => toggleCompletedMatches(pool.id)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:border-slate-500"
            >
              {showCompletedMatches ? t('live.hideCompletedMatches') : t('live.showCompletedMatches')}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderScheduledMatchStatus = (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const availableTargets = availableTargetsByTournament.get(matchTournamentId) || [];
    const selectedTargetNumber = matchTargetSelections[matchKey] || '';
    const selectedTargetId = getTargetIdForSelection(matchTournamentId, selectedTargetNumber);
    return (
      <MatchTargetSelector
        t={t}
        matchTournamentId={matchTournamentId}
        matchId={match.id}
        matchKey={matchKey}
        availableTargets={availableTargets}
        selectedTargetNumber={selectedTargetNumber}
        selectedTargetId={selectedTargetId}
        updatingMatchId={updatingMatchId}
        getTargetLabel={getTargetLabel}
        onTargetSelectionChange={onTargetSelectionChange}
        onStartMatch={onStartMatch}
        containerClassName="mt-2 flex flex-wrap items-center gap-2"
      />
    );
  };

  const renderInProgressMatchStatus = (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const isUpdating = updatingMatchId === matchKey;
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.finalScore')}</p>
        <MatchScoreInputs
          matchTournamentId={matchTournamentId}
          match={match}
          matchScores={matchScores}
          getMatchKey={getMatchKey}
          onScoreChange={onScoreChange}
          {...(getParticipantLabel ? { getParticipantLabel } : {})}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSaveMatchScores(matchTournamentId, match)}
            disabled={isUpdating}
            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
          >
            {isUpdating ? t('live.savingMatch') : t('live.saveScores')}
          </button>
          <button
            onClick={() => onCompleteMatch(matchTournamentId, match)}
            disabled={isUpdating}
            className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
          >
            {isUpdating ? t('live.savingMatch') : t('live.completeMatch')}
          </button>
          <button
            onClick={() => {
              if (!globalThis.window?.confirm(t('targets.cancelMatchConfirm'))) {
                return;
              }
              onCancelMatch(matchTournamentId, match);
            }}
            disabled={isUpdating}
            className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
          >
            {isUpdating ? t('common.loading') : t('targets.cancelMatch')}
          </button>
        </div>
      </div>
    );
  };

  const renderCompletedMatchStatus = (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const targetNumberValue = match.target?.targetNumber === undefined
      ? undefined
      : String(match.target.targetNumber);
    const reopenTargetId = targetNumberValue
      ? getTargetIdForSelection(matchTournamentId, targetNumberValue)
      : undefined;
    const isEditing = editingMatchId === matchKey;
    if (!isEditing) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onEditMatch(matchTournamentId, match)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('live.editScore')}
          </button>
          <button
            onClick={() => {
              if (!reopenTargetId) {
                return;
              }
              if (!globalThis.window?.confirm(t('live.reopenMatchConfirm'))) {
                return;
              }
              onStartMatch(matchTournamentId, match.id, reopenTargetId);
            }}
            disabled={!reopenTargetId || updatingMatchId === matchKey}
            className="rounded-full border border-amber-500/70 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-300 disabled:opacity-60"
          >
            {updatingMatchId === matchKey ? t('common.loading') : t('live.reopenMatch')}
          </button>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.editScore')}</p>
        <MatchScoreInputs
          matchTournamentId={matchTournamentId}
          match={match}
          matchScores={matchScores}
          getMatchKey={getMatchKey}
          onScoreChange={onScoreChange}
          {...(getParticipantLabel ? { getParticipantLabel } : {})}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSaveMatchScores(matchTournamentId, match)}
            disabled={updatingMatchId === matchKey}
            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
          >
            {updatingMatchId === matchKey ? t('live.savingMatch') : t('live.saveScores')}
          </button>
          <button
            onClick={onCancelMatchEdit}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  };

  const renderMatchStatusSection = (
    matchTournamentId: string,
    match: LiveViewMatch
  ): JSX.Element | undefined => {
    if (isPoolStagesReadonly) {
      return undefined;
    }
    if (match.status === 'SCHEDULED') {
      return renderScheduledMatchStatus(matchTournamentId, match);
    }
    if (match.status === 'IN_PROGRESS') {
      return renderInProgressMatchStatus(matchTournamentId, match);
    }
    if (match.status === 'COMPLETED') {
      return renderCompletedMatchStatus(matchTournamentId, match);
    }
    return undefined;
  };

  const renderMatchPlayers = (match: LiveViewMatch) => {
    if (match.playerMatches && match.playerMatches.length > 0) {
      return match.playerMatches.map((playerMatch) => (
        <span key={`${match.id}-${playerMatch.playerPosition}`}>
          {getParticipantLabel
            ? getParticipantLabel(playerMatch.player)
            : `${playerMatch.player?.firstName ?? ''} ${playerMatch.player?.lastName ?? ''}`.trim()}
        </span>
      ));
    }

    return <span>No players assigned yet.</span>;
  };

  const renderPoolMatches = (matchTournamentId: string, pool: LiveViewPool) => {
    const matches = pool.matches || [];
    if (matches.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }
    const showCompletedMatches = showCompletedMatchesByPool[pool.id] ?? false;
    const visibleMatches = showCompletedMatches
      ? matches
      : matches.filter((match) => match.status !== 'COMPLETED');
    if (visibleMatches.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }

    return (
      <div className="mt-2 space-y-2">
        {visibleMatches.map((match) => {
          const scheduledMatchTime = formatScheduledMatchTime(match.scheduledAt);
          const optimisticMatchTime = optimisticStartTimeByMatchId.get(match.id);
          const resolvedMatchFormat = match.matchFormatKey ?? stage.matchFormatKey;
          const matchFormatTooltip = getMatchFormatTooltip(resolvedMatchFormat);

          return (
          <div key={match.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-200">Match {match.matchNumber} · Round {match.roundNumber}</span>
              <span className="text-xs text-slate-400">{getStatusLabel('match', match.status)}</span>
            </div>
            {resolvedMatchFormat && (
              <p className="mt-1 text-[11px] text-cyan-200" title={matchFormatTooltip}>
                {resolvedMatchFormat}
              </p>
            )}
            {match.status === 'SCHEDULED' && (
              <p className="mt-1 text-xs text-slate-400">
                {t('live.matchStartTime')}: {optimisticMatchTime ?? scheduledMatchTime ?? t('live.matchStartTimeUnknown')}
              </p>
            )}
            {match.status === 'IN_PROGRESS' && getMatchTargetLabel(match.target) && (
              <p className="mt-1 text-xs text-slate-400">
                {t('live.queue.targetLabel')}: {getMatchTargetLabel(match.target)}
              </p>
            )}
            {renderMatchStatusSection(matchTournamentId, match)}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {renderMatchPlayers(match)}
            </div>
            {match.status === 'COMPLETED' && (match.playerMatches?.length ?? 0) > 0 && (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  {t('live.finalScore')}
                </p>
                <div className="mt-2 grid gap-1 text-xs">
                  {(match.playerMatches ?? [])
                    .toSorted((first, second) => first.playerPosition - second.playerPosition)
                    .map((playerMatch) => (
                      <div
                        key={`${match.id}-${playerMatch.playerPosition}-score`}
                        className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 px-2 py-1"
                      >
                        <span
                          className={
                            playerMatch.player?.id === match.winner?.id
                              ? 'font-semibold text-emerald-200'
                              : 'text-slate-300'
                          }
                        >
                          {getParticipantLabel
                            ? getParticipantLabel(playerMatch.player)
                            : `${playerMatch.player?.firstName ?? ''} ${playerMatch.player?.lastName ?? ''}`.trim()}
                        </span>
                        <span className="text-slate-200">
                          {playerMatch.scoreTotal ?? playerMatch.legsWon ?? '-'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {match.winner && (
              <p className="mt-2 text-xs text-emerald-300">
                {t('live.winner')}: {getParticipantLabel
                  ? getParticipantLabel(match.winner)
                  : `${match.winner.firstName} ${match.winner.lastName}`.trim()}
              </p>
            )}
          </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-950 via-slate-900/80 to-amber-950/30 p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">{t('live.stage')}</p>
          <h4 className="text-2xl font-semibold text-white mt-2">
            {stage.stageNumber.toString().padStart(2, '0')} · {stage.name}
          </h4>
        </div>
        <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2">
          <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2 text-xs">
            {stage.matchFormatKey && (
              <span
                className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-200"
                title={stageMatchFormatTooltip}
              >
                {stage.matchFormatKey}
              </span>
            )}
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              <span className="hidden sm:inline">{t('common.status')}: </span>
              {getStatusLabel('stage', stage.status)}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              <span className="hidden sm:inline">{t('live.estimatedDuration')}: </span>
              {formatDurationClock(stageParallelizedEstimatedDurationMinutes)}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              <span className="hidden sm:inline">{t('live.estimatedStartTime')}: </span>
              {formatHourMinute(stageEstimatedStartTime)}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              <span className="hidden sm:inline">{t('live.estimatedEndTime')}: </span>
              {formatHourMinute(stageEstimatedEndTime)}
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              {pools.length} {t('live.poolsLabel')} · {stage.playersPerPool ?? 'n/a'} {t('live.perPoolLabel')}
            </span>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2">
            {renderStageControls(tournamentId)}
          </div>
        </div>
      </div>

      {pools.length === 0 ? (
        <p className="mt-5 text-xs text-slate-400">{t('live.noPools')}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" style={{ fontFamily: '"Oswald", sans-serif' }}>
            {pools.map((pool) => {
              const leaderboard = buildPoolLeaderboard(pool, getParticipantLabel).slice(0, 5);
              const isActive = pool.id === activePool?.id;
              const playerCount = pool.assignments?.length ?? 0;
              return (
                <div key={pool.id} className="relative">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!globalThis.window?.confirm(t('live.resetPoolConfirm'))) {
                          return;
                        }
                        onResetPoolMatches(tournamentId, stage.id, pool.id);
                      }}
                      disabled={resettingPoolId === pool.id}
                      aria-label={t('live.resetPool')}
                      title={t('live.resetPool')}
                      className="absolute right-3 top-3 z-10 rounded-full border border-rose-500/70 bg-rose-500/10 p-1 text-rose-200 transition hover:border-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="currentColor"
                      >
                        <path d="M16.24 3.56a2 2 0 0 1 2.83 0l1.37 1.37a2 2 0 0 1 0 2.83l-9.9 9.9a2 2 0 0 1-1.14.56l-3.64.6a.75.75 0 0 1-.86-.86l.6-3.64a2 2 0 0 1 .56-1.14l9.9-9.9zM5 19.5c0-.41.34-.75.75-.75h12.5a.75.75 0 0 1 0 1.5H5.75A.75.75 0 0 1 5 19.5z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectPool(pool.id)}
                    className={`group w-full rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                      isActive
                        ? 'border-amber-400/70 bg-amber-500/10 shadow-[0_20px_45px_-30px_rgba(245,158,11,0.8)]'
                        : 'border-slate-800/70 bg-slate-950/60 hover:border-amber-500/40'
                    }`}
                    aria-pressed={isActive}
                  >
                    <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Pool</p>
                      <p className="mt-2 text-lg font-semibold text-slate-100">
                        {pool.poolNumber.toString().padStart(2, '0')} · {pool.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {t('live.participants')}: {playerCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-700/70 px-3 py-1 text-[11px] uppercase tracking-widest text-slate-300">
                        {getStatusLabel('pool', pool.status)}
                      </span>
                    </div>
                  </div>
                    <div className="mt-4 text-[11px] uppercase tracking-widest text-slate-500">
                      {t('live.leaderboard')}
                    </div>
                    <div className="mt-2 space-y-2 text-xs text-slate-200">
                      {leaderboard.length === 0 ? (
                        <p className="text-slate-500">{t('live.noStandings')}</p>
                      ) : (
                        leaderboard.map((row) => (
                          <div
                            key={row.playerId}
                            className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/50 px-2 py-1"
                          >
                            <span className="font-semibold text-amber-200">#{row.position}</span>
                            <span className="flex-1 px-2 text-left text-slate-100">{row.name}</span>
                            <span className="w-16 text-right text-slate-300">
                              {row.legsWon}
                              {row.headToHeadBonus !== undefined && (
                                <span
                                  className="ml-1 text-amber-300"
                                  title={t('live.headToHeadBonusTooltip')}
                                  aria-label={t('live.headToHeadBonusTooltip')}
                                >
                                  (+{row.headToHeadBonus})
                                </span>
                              )}
                              -{row.legsLost}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {activePool && (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-base font-semibold text-slate-100">
                  Pool {activePool.poolNumber} of {pools.length}: {activePool.name}
                </h5>
                <span className="text-xs text-slate-400">{getStatusLabel('pool', activePool.status)}</span>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.participants')}</p>
                {renderPoolAssignments(activePool)}
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.leaderboard')}</p>
                {renderPoolLeaderboard(activePool)}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
                  {isPoolStagesReadonly && (
                    <button
                      onClick={() => setShowMatches((previous) => !previous)}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      {showMatches ? t('live.hideMatches') : t('live.showMatches')}
                    </button>
                  )}
                </div>
                {(!isPoolStagesReadonly || showMatches) && renderPoolMatches(tournamentId, activePool)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PoolStageCard;
