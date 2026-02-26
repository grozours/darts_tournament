import type {
  LiveViewMatch,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import PoolStageCard, { computeOptimisticStartTimes } from './pool-stage-card';
import SectionEmptyState from './section-empty-state';
import { getMatchFormatPresets } from '../../utils/match-format-presets';

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
  const firstRefs = getStageParallelReferences(firstStage);
  const secondRefs = getStageParallelReferences(secondStage);
  return firstRefs.has(secondStage.stageNumber) || secondRefs.has(firstStage.stageNumber);
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
  const orderedStages = [...stages]
    .sort((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
  const visitedStageIds = new Set<string>();
  const groups: LiveViewPoolStage[][] = [];

  for (const stage of orderedStages) {
    if (visitedStageIds.has(stage.id)) {
      continue;
    }

    groups.push(collectParallelStageGroup(stage, orderedStages, visitedStageIds));
  }

  return groups.toSorted((firstGroup, secondGroup) => {
    const firstOrder = firstGroup[0]?.stageNumber ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = secondGroup[0]?.stageNumber ?? Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder;
  });
};

const toValidDate = (value: string | undefined) => {
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

const getScheduleBaseTimestamp = (tournamentStartTime: string | undefined) => {
  const currentDateTime = new Date();
  const tournamentStartDateTime = toValidDate(tournamentStartTime);
  if (tournamentStartDateTime && !isSameCalendarDate(tournamentStartDateTime, currentDateTime)) {
    return tournamentStartDateTime.getTime();
  }

  return currentDateTime.getTime();
};

const isRemainingPoolMatchStatus = (status: string | undefined) => {
  const normalizedStatus = (status ?? '').toUpperCase();
  return normalizedStatus !== 'COMPLETED' && normalizedStatus !== 'CANCELLED';
};

const collectStageMatchMaps = (group: LiveViewPoolStage[]) => {
  const stageByMatchId = new Map<string, LiveViewPoolStage>();
  const remainingMatchIdsByStageId = new Map<string, Set<string>>();

  for (const stage of group) {
    const stageRemainingMatchIds = new Set<string>();
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        stageByMatchId.set(match.id, stage);
        if (isRemainingPoolMatchStatus(match.status)) {
          stageRemainingMatchIds.add(match.id);
        }
      }
    }
    remainingMatchIdsByStageId.set(stage.id, stageRemainingMatchIds);
  }

  return { stageByMatchId, remainingMatchIdsByStageId };
};

const getStageForecastFromGroupSchedule = ({
  stage,
  remainingMatchIdsByStageId,
  finishTimestampByMatchId,
  optimisticStartTimeByMatchId,
  groupNowTimestamp,
}: {
  stage: LiveViewPoolStage;
  remainingMatchIdsByStageId: Map<string, Set<string>>;
  finishTimestampByMatchId: Map<string, number>;
  optimisticStartTimeByMatchId: Map<string, string>;
  groupNowTimestamp: number;
}) => {
  const stageRemainingMatchIds = remainingMatchIdsByStageId.get(stage.id) ?? new Set<string>();
  let latestFinishTimestamp = groupNowTimestamp;
  const stageOptimisticStartTimeByMatchId = new Map<string, string>();

  for (const matchId of stageRemainingMatchIds) {
    const finishTimestamp = finishTimestampByMatchId.get(matchId);
    if (finishTimestamp !== undefined) {
      latestFinishTimestamp = Math.max(latestFinishTimestamp, finishTimestamp);
    }

    const optimisticStartTime = optimisticStartTimeByMatchId.get(matchId);
    if (optimisticStartTime) {
      stageOptimisticStartTimeByMatchId.set(matchId, optimisticStartTime);
    }
  }

  return {
    optimisticStartTimeByMatchId: stageOptimisticStartTimeByMatchId,
    latestFinishTimestamp,
    estimatedDurationMinutes: Math.max(0, Math.ceil((latestFinishTimestamp - groupNowTimestamp) / 60_000)),
  };
};

const buildStageParallelSchedulingMaps = ({
  stageGroups,
  activeTargetCount,
  baseTimestamp,
  resolveDurationMinutes,
}: {
  stageGroups: LiveViewPoolStage[][];
  activeTargetCount: number;
  baseTimestamp: number;
  resolveDurationMinutes: (match: LiveViewMatch, stage: LiveViewPoolStage | undefined) => number;
}) => {
  const estimatedOffsetByStageId = new Map<string, number>();
  const estimatedMinutesByStageId = new Map<string, number>();
  const optimisticStartTimeByMatchIdByStageId = new Map<string, Map<string, string>>();
  const estimatedStartTimestampByStageId = new Map<string, number>();
  const estimatedEndTimestampByStageId = new Map<string, number>();
  let cumulativeMinutes = 0;

  for (const group of stageGroups) {
    const { stageByMatchId, remainingMatchIdsByStageId } = collectStageMatchMaps(group);
    const fallbackPlayersPerPool = group.reduce((maxPlayersPerPool, stage) => (
      Math.max(maxPlayersPerPool, stage.playersPerPool ?? 0)
    ), 0);
    const groupNowTimestamp = baseTimestamp + cumulativeMinutes * 60_000;

    const groupSchedule = computeOptimisticStartTimes({
      pools: group.flatMap((stage) => stage.pools ?? []),
      ...(fallbackPlayersPerPool > 0 ? { stagePlayersPerPool: fallbackPlayersPerPool } : {}),
      schedulableTargetCount: activeTargetCount,
      nowTimestamp: groupNowTimestamp,
      prioritizeLeastProgressedPools: group.length > 1,
      resolveDurationMinutes: (match) => resolveDurationMinutes(match, stageByMatchId.get(match.id)),
    });

    for (const stage of group) {
      const stageForecast = getStageForecastFromGroupSchedule({
        stage,
        remainingMatchIdsByStageId,
        finishTimestampByMatchId: groupSchedule.finishTimestampByMatchId,
        optimisticStartTimeByMatchId: groupSchedule.optimisticById,
        groupNowTimestamp,
      });
      optimisticStartTimeByMatchIdByStageId.set(stage.id, stageForecast.optimisticStartTimeByMatchId);
      estimatedMinutesByStageId.set(stage.id, stageForecast.estimatedDurationMinutes);
      estimatedOffsetByStageId.set(stage.id, cumulativeMinutes);
      estimatedStartTimestampByStageId.set(stage.id, groupNowTimestamp);
      estimatedEndTimestampByStageId.set(stage.id, stageForecast.latestFinishTimestamp);
    }

    const groupEstimatedMinutes = Math.max(
      0,
      ...group.map((stage) => estimatedMinutesByStageId.get(stage.id) ?? 0)
    );
    cumulativeMinutes += groupEstimatedMinutes;
  }

  return {
    estimatedOffsetByStageId,
    estimatedMinutesByStageId,
    optimisticStartTimeByMatchIdByStageId,
    estimatedStartTimestampByStageId,
    estimatedEndTimestampByStageId,
  };
};

type PoolStagesSectionProperties = {
  t: Translator;
  tournamentId: string;
  tournamentStartTime: string | undefined;
  tournamentStatus: string;
  doubleStageEnabled: boolean;
  stages: LiveViewPoolStage[];
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
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  playerIdByTournament: Record<string, string>;
};

const PoolStagesSection = ({
  t,
  tournamentId,
  tournamentStartTime,
  tournamentStatus,
  doubleStageEnabled,
  stages,
  isAdmin,
  playerIdByTournament = {},
  ...stageProperties
}: PoolStagesSectionProperties) => {
  if (stages.length === 0) {
    return <SectionEmptyState title={t('live.poolStages')} message={t('live.noPoolStages')} />;
  }

  const fallbackDurationMinutes = 12;
  const durationByFormatKey = new Map(
    getMatchFormatPresets().map((preset) => [preset.key, Math.max(1, preset.durationMinutes ?? fallbackDurationMinutes)])
  );
  const getEstimatedMatchDurationMinutes = (match: LiveViewMatch, stageFormatKey: string | undefined) => {
    const matchFormatKey = match.matchFormatKey ?? stageFormatKey;
    return durationByFormatKey.get(matchFormatKey ?? '') ?? fallbackDurationMinutes;
  };

  const activeTargetCount = Math.max(stageProperties.schedulableTargetCount, 1);
  const baseTimestamp = getScheduleBaseTimestamp(tournamentStartTime);

  const orderedStages = [...stages].sort((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
  const stageGroups = buildPoolStageParallelGroups(orderedStages);
  const {
    estimatedOffsetByStageId,
    estimatedMinutesByStageId,
    optimisticStartTimeByMatchIdByStageId,
    estimatedStartTimestampByStageId,
    estimatedEndTimestampByStageId,
  } = buildStageParallelSchedulingMaps({
    stageGroups,
    activeTargetCount,
    baseTimestamp,
    resolveDurationMinutes: (match, stage) => getEstimatedMatchDurationMinutes(match, stage?.matchFormatKey),
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">{t('live.poolStages')}</h3>
      <div className="space-y-6">
        {stages.map((stage) => {
          const optimisticOverride = optimisticStartTimeByMatchIdByStageId.get(stage.id);
          const durationOverride = estimatedMinutesByStageId.get(stage.id);
          const startTimestampOverride = estimatedStartTimestampByStageId.get(stage.id);
          const endTimestampOverride = estimatedEndTimestampByStageId.get(stage.id);

          return (
            <div key={stage.id} id={`pool-stage-${tournamentId}-${stage.id}`}>
              <PoolStageCard
                t={t}
                tournamentId={tournamentId}
                tournamentStartTime={tournamentStartTime}
                tournamentStatus={tournamentStatus}
                doubleStageEnabled={doubleStageEnabled}
                stage={stage}
                estimatedStartOffsetMinutes={estimatedOffsetByStageId.get(stage.id) ?? 0}
                isAdmin={isAdmin}
                {...(optimisticOverride ? { optimisticStartTimeByMatchIdOverride: optimisticOverride } : {})}
                {...(durationOverride === undefined ? {} : { estimatedDurationMinutesOverride: durationOverride })}
                {...(startTimestampOverride === undefined
                  ? {}
                  : { estimatedStartTimeOverride: new Date(startTimestampOverride) })}
                {...(endTimestampOverride === undefined
                  ? {}
                  : { estimatedEndTimeOverride: new Date(endTimestampOverride) })}
                {...(playerIdByTournament[tournamentId]
                  ? { preferredPlayerId: playerIdByTournament[tournamentId] }
                  : {})}
                {...stageProperties}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PoolStagesSection;
