import { getBracketMatchAnchorId } from './bracket-match-anchors';
import { useEffect } from 'react';
import type { LiveViewBracket, LiveViewMatch, LiveViewTarget, Translator } from './types';
import BracketMatches from './bracket-matches';
import { computeOptimisticStartTimes } from './pool-stage-card';
import {
  estimateConflictAwareMinutes,
} from './conflict-aware-estimator';
import SectionEmptyState from './section-empty-state';
import { buildBracketRounds } from './bracket-utilities';
import { getMatchFormatPresets } from '../../utils/match-format-presets';
import { buildPoolStageParallelGroups } from '../queue/pool-stage-parallel-groups';

type BracketsSectionProperties = {
  t: Translator;
  tournamentId: string;
  tournamentStartTime: string | undefined;
  poolStages: import('./types').LiveViewPoolStage[];
  brackets: LiveViewBracket[];
  playerIdByTournament: Record<string, string>;
  screenMode: boolean;
  isAdmin: boolean;
  isBracketsReadonly: boolean;
  updatingMatchId: string | undefined;
  editingMatchId: string | undefined;
  updatingRoundKey: string | undefined;
  resettingBracketId: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  schedulableTargetCount: number;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onCompleteBracketRound: (tournamentId: string, bracket: LiveViewBracket) => void;
  onResetBracketMatches: (tournamentId: string, bracketId: string) => void;
  onSelectBracket: (tournamentId: string, bracketId: string) => void;
  activeBracketId: string;
  getParticipantLabel?: (player: { id?: string; firstName?: string; lastName?: string } | undefined) => string;
};

const FALLBACK_MATCH_DURATION_MINUTES = 12;
const NON_REMAINING_MATCH_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const NON_REMAINING_STAGE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const buildDurationMap = () => new Map(
  getMatchFormatPresets().map((preset) => [preset.key, Math.max(1, preset.durationMinutes)])
);

const resolveMatchDuration = (
  matchFormatKey: string | undefined,
  durationByFormatKey: Map<string, number>
) => durationByFormatKey.get(matchFormatKey ?? '') ?? FALLBACK_MATCH_DURATION_MINUTES;

const isRemainingMatch = (status: string | undefined) => (
  !NON_REMAINING_MATCH_STATUSES.has((status ?? '').toUpperCase())
);

const isRemainingStage = (status: string | undefined) => (
  !NON_REMAINING_STAGE_STATUSES.has((status ?? '').toUpperCase())
);

const formatDurationClock = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildBracketTimingTooltip = ({
  t,
  estimatedDurationMinutes,
  estimatedStartTimeLabel,
  estimatedEndTimeLabel,
}: {
  t: Translator;
  estimatedDurationMinutes: number;
  estimatedStartTimeLabel: string;
  estimatedEndTimeLabel: string;
}) => {
  const lines = [
    `${t('live.estimatedDuration')}: ${formatDurationClock(estimatedDurationMinutes)}`,
    `${t('live.estimatedStartTime')}: ${estimatedStartTimeLabel}`,
    `${t('live.estimatedEndTime')}: ${estimatedEndTimeLabel}`,
  ];

  return {
    title: lines.join('\n'),
    ariaLabel: lines.join('. '),
  };
};

const formatHourMinute = (date: Date) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
}).format(date);

const getHashTargetBracketId = (tournamentId: string) => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const hash = window.location.hash.replace(/^#/, '');
  const matchPrefix = `match-${tournamentId}-`;
  if (!hash.startsWith(matchPrefix)) {
    return undefined;
  }

  const remainder = hash.slice(matchPrefix.length);
  const lastDashIndex = remainder.lastIndexOf('-');
  if (lastDashIndex <= 0) {
    return undefined;
  }

  return remainder.slice(0, lastDashIndex);
};

const BRACKET_MATCH_STATUS_PRIORITY: Record<string, number> = {
  IN_PROGRESS: 0,
  SCHEDULED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const getBracketMatchPriority = (match: NonNullable<LiveViewBracket['matches']>[number]) => (
  BRACKET_MATCH_STATUS_PRIORITY[(match.status ?? '').toUpperCase()] ?? 99
);

const compareBracketMatchCandidates = (
  left: { match: NonNullable<LiveViewBracket['matches']>[number] },
  right: { match: NonNullable<LiveViewBracket['matches']>[number] }
) => {
  const leftPriority = getBracketMatchPriority(left.match);
  const rightPriority = getBracketMatchPriority(right.match);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  const leftRound = left.match.roundNumber ?? 0;
  const rightRound = right.match.roundNumber ?? 0;
  if (leftRound !== rightRound) {
    return leftRound - rightRound;
  }
  return (left.match.matchNumber ?? 0) - (right.match.matchNumber ?? 0);
};

const getPreferredPlayerMatchCandidate = (
  brackets: LiveViewBracket[],
  preferredPlayerId: string | undefined
) => {
  if (!preferredPlayerId) {
    return undefined;
  }

  const candidates: Array<{ bracket: LiveViewBracket; match: NonNullable<LiveViewBracket['matches']>[number] }> = [];
  for (const bracket of brackets) {
    for (const match of bracket.matches ?? []) {
      const hasPreferredPlayer = (match.playerMatches ?? [])
        .some((playerMatch) => playerMatch.player?.id === preferredPlayerId);
      if (hasPreferredPlayer) {
        candidates.push({ bracket, match });
      }
    }
  }

  candidates.sort(compareBracketMatchCandidates);
  return candidates[0];
};

const applyHashBracketSelection = ({
  tournamentId,
  brackets,
  activeBracketId,
  onSelectBracket,
}: {
  tournamentId: string;
  brackets: LiveViewBracket[];
  activeBracketId?: string;
  onSelectBracket: BracketsSectionProperties['onSelectBracket'];
}) => {
  const hashBracketId = getHashTargetBracketId(tournamentId);
  if (!hashBracketId) {
    return;
  }

  const targetBracket = brackets.find((bracket) => bracket.id === hashBracketId);
  if (!targetBracket || activeBracketId === targetBracket.id) {
    return;
  }

  onSelectBracket(tournamentId, targetBracket.id);
};

const syncPreferredPlayerBracketSelection = ({
  tournamentId,
  brackets,
  preferredPlayerId,
  activeBracketId,
  onSelectBracket,
}: {
  tournamentId: string;
  brackets: LiveViewBracket[];
  preferredPlayerId: string | undefined;
  activeBracketId: string | undefined;
  onSelectBracket: BracketsSectionProperties['onSelectBracket'];
}) => {
  if (typeof window === 'undefined' || brackets.length === 0 || !preferredPlayerId) {
    return;
  }

  if (window.location.hash.replace(/^#/, '').startsWith(`match-${tournamentId}-`)) {
    return;
  }

  const candidate = getPreferredPlayerMatchCandidate(brackets, preferredPlayerId);
  if (!candidate) {
    return;
  }

  if (activeBracketId !== candidate.bracket.id) {
    onSelectBracket(tournamentId, candidate.bracket.id);
  }

  const nextHash = getBracketMatchAnchorId(tournamentId, candidate.bracket.id, candidate.match.id);
  if (window.location.hash.replace(/^#/, '') !== nextHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${nextHash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
};

type ActiveBracketContext = {
  activeBracket: LiveViewBracket;
  isUpdatingRound: boolean;
  isResettingBracket: boolean;
  canManageBrackets: boolean;
  canManageActiveBracketActions: boolean;
  activeBracketTargetIds: string[];
  bracketForecast: ReturnType<typeof getBracketRoundForecast>;
  reservedTargetIds: string[];
};

const resolveActiveBracketContext = ({
  brackets,
  activeBracketId,
  tournamentId,
  updatingRoundKey,
  resettingBracketId,
  isAdmin,
  poolStages,
  schedulableTargetCount,
  tournamentStartTime,
}: {
  brackets: LiveViewBracket[];
  activeBracketId: string;
  tournamentId: string;
  updatingRoundKey: string | undefined;
  resettingBracketId: string | undefined;
  isAdmin: boolean;
  poolStages: import('./types').LiveViewPoolStage[];
  schedulableTargetCount: number;
  tournamentStartTime: string | undefined;
}): ActiveBracketContext | undefined => {
  const preferredBracket = brackets.find((bracket) => /winner/i.test(bracket.name)) ?? brackets[0];
  if (!preferredBracket) {
    return undefined;
  }

  const activeBracket = brackets.find((bracket) => bracket.id === activeBracketId) ?? preferredBracket;
  const activeTargetCount = Math.max(schedulableTargetCount, 1);
  const bracketStartDateTime = getBracketStartDateTime(
    activeBracket,
    tournamentStartTime,
    poolStages,
    activeTargetCount
  );

  return {
    activeBracket,
    isUpdatingRound: updatingRoundKey?.startsWith(`${tournamentId}:${activeBracket.id}:`) ?? false,
    isResettingBracket: resettingBracketId === activeBracket.id,
    canManageBrackets: isAdmin,
    canManageActiveBracketActions: canManageBracketActions(poolStages, activeBracket.id),
    activeBracketTargetIds: activeBracket.targetIds
      ?? activeBracket.bracketTargets?.map((target) => target.targetId)
      ?? [],
    bracketForecast: getBracketRoundForecast(activeBracket, bracketStartDateTime),
    reservedTargetIds: Array.from(
      new Set(
        brackets
          .filter((bracket) => bracket.id !== activeBracket.id)
          .flatMap((bracket) => bracket.targetIds ?? bracket.bracketTargets?.map((target) => target.targetId) ?? [])
      )
    ),
  };
};

const renderScreenModeBrackets = ({
  t,
  tournamentId,
  preferredPlayerId,
  context,
  properties,
}: {
  t: Translator;
  tournamentId: string;
  preferredPlayerId: string | undefined;
  context: ActiveBracketContext;
  properties: Pick<BracketsSectionProperties,
    | 'isBracketsReadonly'
    | 'updatingMatchId'
    | 'editingMatchId'
    | 'matchScores'
    | 'matchTargetSelections'
    | 'availableTargetsByTournament'
    | 'getStatusLabel'
    | 'getMatchKey'
    | 'getTargetIdForSelection'
    | 'getTargetLabel'
    | 'onTargetSelectionChange'
    | 'onStartMatch'
    | 'onCompleteMatch'
    | 'onEditMatch'
    | 'onSaveMatchScores'
    | 'onCancelMatch'
    | 'onCancelMatchEdit'
    | 'onScoreChange'
    | 'getParticipantLabel'
  >;
}) => (
  <div className="space-y-3">
    <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">{context.activeBracket.name}</p>
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">
        {context.activeBracket.bracketType}
      </span>
      <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">
        <span className="hidden sm:inline">{t('common.status')}: </span>
        {properties.getStatusLabel('bracket', context.activeBracket.status)}
      </span>
      {(() => {
        const timingTooltip = buildBracketTimingTooltip({
          t,
          estimatedDurationMinutes: context.bracketForecast.estimatedDurationMinutes,
          estimatedStartTimeLabel: context.bracketForecast.estimatedStartTimeLabel,
          estimatedEndTimeLabel: context.bracketForecast.estimatedEndTimeLabel,
        });
        return (
          <span
            className="inline-flex cursor-help select-none items-center rounded-full border border-slate-700 px-2.5 py-1 text-sm text-slate-300"
            title={timingTooltip.title}
            aria-label={timingTooltip.ariaLabel}
          >
            ⏱️
          </span>
        );
      })()}
    </div>
    <BracketMatches
      t={t}
      tournamentId={tournamentId}
      bracket={context.activeBracket}
      {...(preferredPlayerId ? { preferredPlayerId } : {})}
      roundStartTimeByRound={context.bracketForecast.roundStartTimeByRound}
      screenMode
      isBracketsReadonly={properties.isBracketsReadonly}
      updatingMatchId={properties.updatingMatchId}
      editingMatchId={properties.editingMatchId}
      matchScores={properties.matchScores}
      matchTargetSelections={properties.matchTargetSelections}
      availableTargetsByTournament={properties.availableTargetsByTournament}
      reservedTargetIds={context.activeBracketTargetIds.length > 0 ? [] : context.reservedTargetIds}
      getStatusLabel={properties.getStatusLabel}
      getMatchKey={properties.getMatchKey}
      getTargetIdForSelection={properties.getTargetIdForSelection}
      getTargetLabel={properties.getTargetLabel}
      onTargetSelectionChange={properties.onTargetSelectionChange}
      onStartMatch={properties.onStartMatch}
      onCompleteMatch={properties.onCompleteMatch}
      onEditMatch={properties.onEditMatch}
      onSaveMatchScores={properties.onSaveMatchScores}
      onCancelMatch={properties.onCancelMatch}
      onCancelMatchEdit={properties.onCancelMatchEdit}
      onScoreChange={properties.onScoreChange}
      {...(properties.getParticipantLabel ? { getParticipantLabel: properties.getParticipantLabel } : {})}
    />
  </div>
);

const toValidDate = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const isSameCalendarDate = (leftDate: Date, rightDate: Date) => (
  leftDate.getFullYear() === rightDate.getFullYear()
  && leftDate.getMonth() === rightDate.getMonth()
  && leftDate.getDate() === rightDate.getDate()
);

const getBracketScheduleBaseDateTime = (tournamentStartTime?: string) => {
  const now = new Date();
  const tournamentStart = toValidDate(tournamentStartTime);
  if (tournamentStart && !isSameCalendarDate(tournamentStart, now)) {
    return tournamentStart;
  }
  return now;
};

const isRemainingPoolMatchStatus = (status: string | undefined) => (
  !NON_REMAINING_MATCH_STATUSES.has((status ?? '').toUpperCase())
);

const collectStageMatchMaps = (group: import('./types').LiveViewPoolStage[]) => {
  const stageByMatchId = new Map<string, import('./types').LiveViewPoolStage>();
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

const getStageEstimatedMinutesFromGroupSchedule = ({
  stage,
  remainingMatchIdsByStageId,
  finishTimestampByMatchId,
  groupNowTimestamp,
}: {
  stage: import('./types').LiveViewPoolStage;
  remainingMatchIdsByStageId: Map<string, Set<string>>;
  finishTimestampByMatchId: Map<string, number>;
  groupNowTimestamp: number;
}) => {
  const stageRemainingMatchIds = remainingMatchIdsByStageId.get(stage.id) ?? new Set<string>();
  let latestFinishTimestamp = groupNowTimestamp;

  for (const matchId of stageRemainingMatchIds) {
    const finishTimestamp = finishTimestampByMatchId.get(matchId);
    if (finishTimestamp !== undefined) {
      latestFinishTimestamp = Math.max(latestFinishTimestamp, finishTimestamp);
    }
  }

  return Math.max(0, Math.ceil((latestFinishTimestamp - groupNowTimestamp) / 60_000));
};

const getPoolStageTimingById = (
  poolStages: import('./types').LiveViewPoolStage[],
  tournamentStartTime: string | undefined,
  activeTargetCount: number
) => {
  const timingById = new Map<string, { startOffsetMinutes: number; endOffsetMinutes: number }>();
  const durationByFormatKey = buildDurationMap();
  const groups = buildPoolStageParallelGroups(poolStages);
  const baseTimestamp = getBracketScheduleBaseDateTime(tournamentStartTime).getTime();
  let cumulativeMinutes = 0;

  for (const group of groups) {
    const { stageByMatchId, remainingMatchIdsByStageId } = collectStageMatchMaps(group);
    const fallbackPlayersPerPool = group.reduce((maxPlayersPerPool, stage) => (
      Math.max(maxPlayersPerPool, stage.playersPerPool ?? 0)
    ), 0);
    const groupNowTimestamp = baseTimestamp + cumulativeMinutes * 60_000;
    const stageDurationById = new Map<string, number>();

    const groupSchedule = computeOptimisticStartTimes({
      pools: group.flatMap((stage) => stage.pools ?? []),
      ...(fallbackPlayersPerPool > 0 ? { stagePlayersPerPool: fallbackPlayersPerPool } : {}),
      schedulableTargetCount: activeTargetCount,
      nowTimestamp: groupNowTimestamp,
      prioritizeLeastProgressedPools: group.length > 1,
      resolveDurationMinutes: (match) => resolveMatchDuration(
        match.matchFormatKey ?? stageByMatchId.get(match.id)?.matchFormatKey,
        durationByFormatKey
      ),
    });

    for (const stage of group) {
      const stageEstimatedMinutes = isRemainingStage(stage.status)
        ? getStageEstimatedMinutesFromGroupSchedule({
          stage,
          remainingMatchIdsByStageId,
          finishTimestampByMatchId: groupSchedule.finishTimestampByMatchId,
          groupNowTimestamp,
        })
        : 0;

      stageDurationById.set(stage.id, stageEstimatedMinutes);
      timingById.set(stage.id, {
        startOffsetMinutes: cumulativeMinutes,
        endOffsetMinutes: cumulativeMinutes + stageEstimatedMinutes,
      });
    }

    const groupEstimatedMinutes = Math.max(
      0,
      ...group.map((stage) => stageDurationById.get(stage.id) ?? 0)
    );

    cumulativeMinutes += groupEstimatedMinutes;
  }

  return timingById;
};

const getBracketStartDateTime = (
  bracket: LiveViewBracket,
  tournamentStartTime: string | undefined,
  poolStages: import('./types').LiveViewPoolStage[],
  activeTargetCount: number
) => {
  const fallbackBaseDateTime = getBracketScheduleBaseDateTime(tournamentStartTime);
  const sourceStages = getSourceStagesForBracket(poolStages, bracket.id);

  if (sourceStages.length === 0) {
    return fallbackBaseDateTime;
  }

  const timingById = getPoolStageTimingById(poolStages, tournamentStartTime, activeTargetCount);
  const sourceEndOffsetMinutes = Math.max(
    0,
    ...sourceStages.map((stage) => timingById.get(stage.id)?.endOffsetMinutes ?? 0)
  );

  return new Date(fallbackBaseDateTime.getTime() + sourceEndOffsetMinutes * 60_000);
};

const getSourceStagesForBracket = (
  poolStages: import('./types').LiveViewPoolStage[],
  bracketId: string
) => poolStages.filter((stage) => (
  (stage.rankingDestinations ?? []).some((destination) => (
    destination.destinationType === 'BRACKET' && destination.bracketId === bracketId
  ))
));

const isStageCompleted = (status: string | undefined) => (status ?? '').trim().toUpperCase() === 'COMPLETED';

const canManageBracketActions = (
  poolStages: import('./types').LiveViewPoolStage[],
  bracketId: string
) => {
  const sourceStages = getSourceStagesForBracket(poolStages, bracketId);
  if (sourceStages.length === 0) {
    return true;
  }
  return sourceStages.every((stage) => isStageCompleted(stage.status));
};

const getBracketTargetCapacity = (bracket: LiveViewBracket, roundOneMatchesCount: number) => {
  const dedicatedTargets = bracket.targetIds?.length ?? bracket.bracketTargets?.length ?? 0;
  if (dedicatedTargets > 0) {
    return dedicatedTargets;
  }
  return Math.max(roundOneMatchesCount, 1);
};

const getRoundEstimatedMinutes = (
  roundMatches: Array<{
    id: string;
    durationMinutes: number;
    playerIds: string[];
  }>,
  targetCapacity: number
) => {
  if (roundMatches.length === 0) {
    return 0;
  }
  return estimateConflictAwareMinutes(roundMatches, targetCapacity);
};

const getBracketRoundForecast = (
  bracket: LiveViewBracket,
  bracketStartDateTime: Date
) => {
  if (!isRemainingStage(bracket.status)) {
    return {
      estimatedStartTimeLabel: formatHourMinute(bracketStartDateTime),
      estimatedDurationMinutes: 0,
      estimatedEndTimeLabel: formatHourMinute(bracketStartDateTime),
      roundStartTimeByRound: new Map<number, string>(),
    };
  }

  const durationByFormatKey = buildDurationMap();
  const rounds = buildBracketRounds(bracket);
  const roundOneMatchesCount = rounds[0]?.matches.length ?? 1;
  const targetCapacity = getBracketTargetCapacity(bracket, roundOneMatchesCount);
  const baseDateTime = bracketStartDateTime;
  const roundStartTimeByRound = new Map<number, string>();
  let cumulativeMinutes = 0;

  for (const round of rounds) {
    const roundStart = new Date(baseDateTime.getTime() + cumulativeMinutes * 60_000);
    roundStartTimeByRound.set(round.roundNumber, formatHourMinute(roundStart));

    const schedulableRoundMatches = round.matches
      .filter((match) => match.isPlaceholder || isRemainingMatch(match.status))
      .map((match) => ({
        id: match.id,
        durationMinutes: resolveMatchDuration(
          match.matchFormatKey ?? bracket.roundMatchFormats?.[String(round.roundNumber)],
          durationByFormatKey
        ),
        playerIds: (match.playerMatches ?? [])
          .map((playerMatch) => playerMatch.player?.id)
          .filter((playerId): playerId is string => Boolean(playerId)),
      }));

    cumulativeMinutes += getRoundEstimatedMinutes(schedulableRoundMatches, targetCapacity);
  }

  const estimatedEndDateTime = new Date(baseDateTime.getTime() + cumulativeMinutes * 60_000);

  return {
    estimatedStartTimeLabel: formatHourMinute(baseDateTime),
    estimatedDurationMinutes: cumulativeMinutes,
    estimatedEndTimeLabel: formatHourMinute(estimatedEndDateTime),
    roundStartTimeByRound,
  };
};

type BracketsHeaderProperties = {
  t: Translator;
  tournamentId: string;
  brackets: LiveViewBracket[];
  activeBracketId: string;
  onSelectBracket: (tournamentId: string, bracketId: string) => void;
};

const BracketsHeader = ({
  t,
  tournamentId,
  brackets,
  activeBracketId,
  onSelectBracket,
}: BracketsHeaderProperties) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-lg font-semibold text-white">{t('live.bracketStages')}</h3>
    </div>
    <div className="flex flex-wrap gap-2">
      {[...brackets].reverse().map((bracket) => (
        <button
          key={bracket.id}
          type="button"
          onClick={() => onSelectBracket(tournamentId, bracket.id)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            bracket.id === activeBracketId
              ? 'border-amber-400/80 text-amber-200'
              : 'border-slate-700 text-slate-200 hover:border-slate-500'
          }`}
        >
          {bracket.name}
        </button>
      ))}
    </div>
  </div>
);

type BracketSummaryProperties = {
  t: Translator;
  tournamentId: string;
  bracket: LiveViewBracket;
  estimatedStartTimeLabel: string;
  estimatedDurationMinutes: number;
  estimatedEndTimeLabel: string;
  isBracketsReadonly: boolean;
  canManageBrackets: boolean;
  isUpdatingRound: boolean;
  isResettingBracket: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  onCompleteBracketRound: (tournamentId: string, bracket: LiveViewBracket) => void;
  onResetBracketMatches: (tournamentId: string, bracketId: string) => void;
};

const BracketSummaryHeader = ({
  t,
  tournamentId,
  bracket,
  estimatedStartTimeLabel,
  estimatedDurationMinutes,
  estimatedEndTimeLabel,
  isBracketsReadonly,
  canManageBrackets,
  isUpdatingRound,
  isResettingBracket,
  getStatusLabel,
  onCompleteBracketRound,
  onResetBracketMatches,
}: BracketSummaryProperties) => {
  const timingTooltip = buildBracketTimingTooltip({
    t,
    estimatedDurationMinutes,
    estimatedStartTimeLabel,
    estimatedEndTimeLabel,
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="text-lg font-semibold text-white">{bracket.name}</h4>
      </div>
      <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2">
        <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2 text-xs">
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-200">
          {bracket.bracketType}
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
          <span className="hidden sm:inline">{t('common.status')}: </span>
          {getStatusLabel('bracket', bracket.status)}
        </span>
        <span
          className="inline-flex cursor-help select-none items-center rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
          title={timingTooltip.title}
          aria-label={timingTooltip.ariaLabel}
        >
          ⏱️
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
          {bracket.entries?.length || 0} entries
        </span>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2">
        {canManageBrackets && !isBracketsReadonly && (
          <button
            type="button"
            onClick={() => onCompleteBracketRound(tournamentId, bracket)}
            disabled={isUpdatingRound}
            className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
          >
            {isUpdatingRound ? t('live.completingRound') : t('live.completeRound')}
          </button>
        )}
        {canManageBrackets && !isBracketsReadonly && (
          <button
            type="button"
            onClick={() => {
              if (!globalThis.window?.confirm(t('live.resetBracketConfirm'))) {
                return;
              }
              onResetBracketMatches(tournamentId, bracket.id);
            }}
            disabled={isResettingBracket}
            className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
          >
            {isResettingBracket ? t('common.loading') : t('live.resetBracket')}
          </button>
        )}
      </div>
    </div>
  </div>
  );
};

const BracketsSection = ({
  t,
  tournamentId,
  tournamentStartTime,
  poolStages,
  brackets,
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
  onEditMatch,
  onSaveMatchScores,
  onCancelMatch,
  onCancelMatchEdit,
  onScoreChange,
  onCompleteBracketRound,
  onResetBracketMatches,
  onSelectBracket,
  activeBracketId,
  getParticipantLabel,
}: BracketsSectionProperties) => {
  const preferredPlayerId = playerIdByTournament[tournamentId];

  useEffect(() => {
    if (brackets.length === 0) {
      return;
    }

    const runHashSelection = () => applyHashBracketSelection({
      tournamentId,
      brackets,
      activeBracketId,
      onSelectBracket,
    });

    runHashSelection();
    window.addEventListener('hashchange', runHashSelection);

    return () => {
      window.removeEventListener('hashchange', runHashSelection);
    };
  }, [activeBracketId, brackets, onSelectBracket, tournamentId]);

  useEffect(() => {
    syncPreferredPlayerBracketSelection({
      tournamentId,
      brackets,
      preferredPlayerId,
      activeBracketId,
      onSelectBracket,
    });
  }, [activeBracketId, brackets, onSelectBracket, preferredPlayerId, tournamentId]);

  if (brackets.length === 0) {
    return <SectionEmptyState title={t('live.bracketStages')} message={t('live.noBrackets')} />;
  }

  const context = resolveActiveBracketContext({
    brackets,
    activeBracketId,
    tournamentId,
    updatingRoundKey,
    resettingBracketId,
    isAdmin,
    poolStages,
    schedulableTargetCount,
    tournamentStartTime,
  });
  if (!context) {
    return;
  }

  if (screenMode) {
    return renderScreenModeBrackets({
      t,
      tournamentId,
      preferredPlayerId,
      context,
      properties: {
        isBracketsReadonly,
        updatingMatchId,
        editingMatchId,
        matchScores,
        matchTargetSelections,
        availableTargetsByTournament,
        getStatusLabel,
        getMatchKey,
        getTargetIdForSelection,
        getTargetLabel,
        onTargetSelectionChange,
        onStartMatch,
        onCompleteMatch,
        onEditMatch,
        onSaveMatchScores,
        onCancelMatch,
        onCancelMatchEdit,
        onScoreChange,
        ...(getParticipantLabel ? { getParticipantLabel } : {}),
      },
    });
  }

  return (
    <div className="space-y-6">
      <BracketsHeader
        t={t}
        tournamentId={tournamentId}
        brackets={brackets}
        activeBracketId={context.activeBracket.id}
        onSelectBracket={onSelectBracket}
      />

      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
        <BracketSummaryHeader
          t={t}
          tournamentId={tournamentId}
          bracket={context.activeBracket}
          estimatedStartTimeLabel={context.bracketForecast.estimatedStartTimeLabel}
          estimatedDurationMinutes={context.bracketForecast.estimatedDurationMinutes}
          estimatedEndTimeLabel={context.bracketForecast.estimatedEndTimeLabel}
          isBracketsReadonly={isBracketsReadonly}
          canManageBrackets={context.canManageBrackets && context.canManageActiveBracketActions}
          isUpdatingRound={context.isUpdatingRound}
          isResettingBracket={context.isResettingBracket}
          getStatusLabel={getStatusLabel}
          onCompleteBracketRound={onCompleteBracketRound}
          onResetBracketMatches={onResetBracketMatches}
        />

        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
          <BracketMatches
            t={t}
            tournamentId={tournamentId}
            bracket={context.activeBracket}
            {...(preferredPlayerId
              ? { preferredPlayerId }
              : {})}
            roundStartTimeByRound={context.bracketForecast.roundStartTimeByRound}
            screenMode={screenMode}
            isBracketsReadonly={isBracketsReadonly}
            updatingMatchId={updatingMatchId}
            editingMatchId={editingMatchId}
            matchScores={matchScores}
            matchTargetSelections={matchTargetSelections}
            availableTargetsByTournament={availableTargetsByTournament}
            reservedTargetIds={context.activeBracketTargetIds.length > 0 ? [] : context.reservedTargetIds}
            getStatusLabel={getStatusLabel}
            getMatchKey={getMatchKey}
            getTargetIdForSelection={getTargetIdForSelection}
            getTargetLabel={getTargetLabel}
            onTargetSelectionChange={onTargetSelectionChange}
            onStartMatch={onStartMatch}
            onCompleteMatch={onCompleteMatch}
            onEditMatch={onEditMatch}
            onSaveMatchScores={onSaveMatchScores}
            onCancelMatch={onCancelMatch}
            onCancelMatchEdit={onCancelMatchEdit}
            onScoreChange={onScoreChange}
            {...(getParticipantLabel ? { getParticipantLabel } : {})}
          />
        </div>
      </div>
    </div>
  );
};

export default BracketsSection;
