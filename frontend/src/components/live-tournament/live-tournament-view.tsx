import { useState } from 'react';
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
  screenMode: boolean;
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
  onPopulateBracketFromPools: (
    matchTournamentId: string,
    bracketId: string,
    stage: LiveViewPoolStage,
    role: 'WINNER' | 'LOSER'
  ) => void;
  onSelectBracket: (matchTournamentId: string, bracketId: string) => void;
  activeBracketId: string;
  populatingBracketId?: string | undefined;
  onRefresh: () => void;
};

type LiveTournamentViewHeaderProperties = {
  t: Translator;
  view: LiveViewData;
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

const LiveTournamentViewHeader = ({
  t,
  view,
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
  const statusClass = screenMode ? 'mt-0 text-[11px] text-slate-400' : 'mt-0.5 text-xs text-slate-400';
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

  return (
  <div className={`flex flex-wrap items-center justify-between ${headerGap}`}>
    <div>
      <p className={titleClass}>{t('live.title')}</p>
      <h2 className={nameClass}>{view.name}</h2>
      {isAdmin && (
        <p className={idClass}>ID: {view.id}</p>
      )}
      <p className={statusClass}>{t('common.status')}: {view.status}</p>
    </div>
    <div className={`flex flex-col items-end ${actionsGap}`}>
      <div className={`flex flex-wrap items-center justify-end ${actionsGap}`}>
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
  screenMode,
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
  onPopulateBracketFromPools,
  onSelectBracket,
  activeBracketId,
  populatingBracketId,
  onRefresh,
}: LiveTournamentViewProperties) => {
  const [showSummary, setShowSummary] = useState(false);
  const handleToggleSummary = () => setShowSummary((value) => !value);
  const filteredPoolStages = filterPoolStagesForView(
    viewMode,
    viewStatus,
    view.poolStages,
    isAdmin,
    screenMode
  );
  const filteredBrackets = filterBracketsForView(
    viewMode,
    viewStatus,
    view.brackets,
    screenMode,
    isAdmin
  );
  const headerPoolStages = isAdmin
    ? filteredPoolStages
    : filteredPoolStages.filter((stage) =>
      (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0)
    );
  const headerBrackets = isAdmin
    ? filteredBrackets
    : filteredBrackets.filter((bracket) => (bracket.entries?.length ?? 0) > 0);
  const hasLiveBrackets = hasActiveBrackets(view, viewStatus, false, screenMode);
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
    poolStages: view.poolStages ?? [],
    hasLoserBracket,
    isAdmin,
    isBracketsReadonly,
    updatingMatchId,
    editingMatchId,
    updatingRoundKey,
    resettingBracketId,
    populatingBracketId,
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
    onPopulateBracketFromPools,
    onSelectBracket,
    activeBracketId,
  };

  return (
    <div className="space-y-10">
      <LiveTournamentViewHeader
        t={t}
        view={view}
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
