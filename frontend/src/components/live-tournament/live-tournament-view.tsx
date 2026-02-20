import type { LiveViewStatus } from '../../utils/live-view-helpers';
import { hasActiveBrackets, isBracketsView, isPoolStagesView } from '../../utils/live-view-helpers';
import BracketsSection from './brackets-section';
import MatchQueueSection from './match-queue-section';
import PoolStagesSection from './pool-stages-section';
import { buildMatchQueue } from './queue-utilities';
import type {
  LiveViewBracket,
  LiveViewData,
  LiveViewMatch,
  LiveViewMode,
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
  isAggregateView: boolean;
  visibleLiveViewsCount: number;
  showGlobalQueue: boolean;
  isPoolStagesReadonly: boolean;
  isBracketsReadonly: boolean;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
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
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => void;
  onEditStage: (stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, status: string) => void;
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
  onRefresh: () => void;
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

const LiveTournamentViewHeader = ({
  t,
  view,
  onRefresh,
  showBracketsLink,
  showPoolsLink,
  poolStages,
  brackets,
  viewMode,
}: LiveTournamentViewHeaderProperties) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('live.title')}</p>
      <h2 className="text-2xl font-semibold text-white mt-2">{view.name}</h2>
      <p className="mt-1 text-xs text-slate-500">ID: {view.id}</p>
      <p className="mt-1 text-sm text-slate-400">{t('common.status')}: {view.status}</p>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {showPoolsLink && (
          <a
            href={`/?view=pool-stages&tournamentId=${view.id}`}
            className="rounded-full border border-cyan-500/70 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300"
          >
            {t('nav.poolStagesRunning')}
          </a>
        )}
        {showBracketsLink && (
          <a
            href={`/?view=brackets&tournamentId=${view.id}`}
            className="rounded-full border border-cyan-500/70 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300"
          >
            {t('nav.bracketsRunning')}
          </a>
        )}
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          {t('common.refresh')}
        </button>
      </div>
      {viewMode === 'live' && (poolStages.length > 0 || brackets.length > 0) && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-300">
          {poolStages.map((stage) => (
            <a
              key={stage.id}
              href={`#pool-stage-${view.id}-${stage.id}`}
              className="rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-400/70 hover:text-cyan-100"
            >
              {stage.name}
            </a>
          ))}
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
  </div>
);

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
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.loserBracket')}</p>
      <p className="mt-2 text-lg font-semibold text-white">{hasLoserBracket ? t('common.yes') : t('common.no')}</p>
      <p className="mt-1 text-xs text-slate-400">{t('live.afterPools')}</p>
    </div>
  </div>
);

const LiveTournamentView = ({
  t,
  view,
  isAdmin,
  viewMode,
  viewStatus,
  isAggregateView,
  visibleLiveViewsCount,
  showGlobalQueue,
  isPoolStagesReadonly,
  isBracketsReadonly,
  availableTargetsByTournament,
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
  onEditMatch,
  onUpdateCompletedMatch,
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
  const canViewEdition = isAdmin || Boolean(playerIdByTournament[view.id]);
  const filteredPoolStages = filterPoolStagesForView(
    viewMode,
    viewStatus,
    view.poolStages,
    canViewEdition,
    isAdmin
  );
  const filteredBrackets = filterBracketsForView(viewMode, viewStatus, view.brackets);
  const headerPoolStages = isAdmin
    ? filteredPoolStages
    : filteredPoolStages.filter((stage) =>
      (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0)
    );
  const headerBrackets = isAdmin
    ? filteredBrackets
    : filteredBrackets.filter((bracket) => (bracket.entries?.length ?? 0) > 0);
  const hasLiveBrackets = hasActiveBrackets(view, viewStatus);
  const hasCompletedPoolStage = filteredPoolStages.some((stage) => stage.status === 'COMPLETED');
  const showBracketsLink = hasCompletedPoolStage && hasLiveBrackets && isPoolStagesView(viewMode);
  const showPoolsLink = isBracketsView(viewMode) && filteredPoolStages.length > 0;
  const hasLoserBracket = getHasLoserBracket(view.brackets);
  const poolStats = getPoolStageStats(filteredPoolStages);
  const queue = buildMatchQueue(view, filteredPoolStages);
  const showTournamentName = isAggregateView && visibleLiveViewsCount > 1;
  const showPools = !isBracketsView(viewMode);
  const hasRunningPoolStages = (view.poolStages || []).some(
    (stage) => stage.status !== 'COMPLETED' && (stage.pools?.length || 0) > 0
  );
  const showBrackets = !isPoolStagesView(viewMode)
    && (isAdmin || viewMode === 'brackets' || !hasRunningPoolStages);

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
    tournamentStatus: view.status,
    doubleStageEnabled: Boolean(view.doubleStageEnabled),
    stages: filteredPoolStages,
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
    getMatchKey,
    getTargetIdForSelection,
    onTargetSelectionChange,
    onScoreChange,
    onStartMatch,
    onCompleteMatch,
    onEditMatch,
    onUpdateCompletedMatch,
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
    editingStageId,
    updatingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    playerIdByTournament,
    isAdmin,
  };

  const bracketsProperties = {
    t,
    tournamentId: view.id,
    brackets: filteredBrackets,
    hasLoserBracket,
    isAdmin,
    isBracketsReadonly,
    updatingMatchId,
    editingMatchId,
    updatingRoundKey,
    resettingBracketId,
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
    onUpdateCompletedMatch,
    onCancelMatchEdit,
    onScoreChange,
    onCompleteBracketRound,
    onResetBracketMatches,
    onSelectBracket,
    activeBracketId,
  };

  return (
    <div className="space-y-10">
      <LiveTournamentViewHeader
        t={t}
        view={view}
        onRefresh={onRefresh}
        showBracketsLink={showBracketsLink}
        showPoolsLink={showPoolsLink}
        poolStages={headerPoolStages}
        brackets={headerBrackets}
        viewMode={viewMode}
      />
      {showPools && <LiveTournamentPoolSummaryCards t={t} stats={poolStats} hasLoserBracket={hasLoserBracket} />}
      {showPools && !isPoolStagesView(viewMode) && !showGlobalQueue && (
        <MatchQueueSection {...queueProperties} />
      )}
      {showPools && <PoolStagesSection {...poolStagesProperties} />}
      {showBrackets && <BracketsSection {...bracketsProperties} />}
    </div>
  );
};

export default LiveTournamentView;
