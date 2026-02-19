import type { LiveViewStatus } from '../../utils/live-view-helpers';
import { isBracketsView, isPoolStagesView } from '../../utils/live-view-helpers';
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
  editingMatchId?: string | undefined;
  updatingRoundKey?: string | undefined;
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
  onEditStage: (stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, status: string) => void;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  onCompleteBracketRound: (matchTournamentId: string, bracket: LiveViewBracket) => void;
  onSelectBracket: (matchTournamentId: string, bracketId: string) => void;
  activeBracketId: string;
  onRefresh: () => void;
};

type LiveTournamentViewHeaderProperties = {
  t: Translator;
  view: LiveViewData;
  onRefresh: () => void;
};

type LiveTournamentPoolSummaryProperties = {
  t: Translator;
  stats: PoolStats;
  hasLoserBracket: boolean;
};

const LiveTournamentViewHeader = ({ t, view, onRefresh }: LiveTournamentViewHeaderProperties) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('live.title')}</p>
      <h2 className="text-2xl font-semibold text-white mt-2">{view.name}</h2>
      <p className="mt-1 text-xs text-slate-500">ID: {view.id}</p>
      <p className="mt-1 text-sm text-slate-400">{t('common.status')}: {view.status}</p>
    </div>
    <button
      onClick={onRefresh}
      className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
    >
      {t('common.refresh')}
    </button>
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
  editingMatchId,
  updatingRoundKey,
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
  onEditStage,
  onCancelEditStage,
  onUpdateStage,
  onCompleteStageWithScores,
  onDeleteStage,
  onStagePoolCountChange,
  onStagePlayersPerPoolChange,
  onStageStatusChange,
  editingStageId,
  updatingStageId,
  stageStatusDrafts,
  stagePoolCountDrafts,
  stagePlayersPerPoolDrafts,
  onCompleteBracketRound,
  onSelectBracket,
  activeBracketId,
  onRefresh,
}: LiveTournamentViewProperties) => {
  const filteredPoolStages = filterPoolStagesForView(viewMode, viewStatus, view.poolStages, isAdmin);
  const filteredBrackets = filterBracketsForView(viewMode, viewStatus, view.brackets);
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
    stages: filteredPoolStages,
    isPoolStagesReadonly,
    getStatusLabel,
    getMatchTargetLabel,
    getTargetLabel,
    matchScores,
    matchTargetSelections,
    updatingMatchId,
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
    onEditStage,
    onCancelEditStage,
    onUpdateStage,
    onCompleteStageWithScores,
    onDeleteStage,
    onStagePoolCountChange,
    onStagePlayersPerPoolChange,
    onStageStatusChange,
    editingStageId,
    updatingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
  };

  const bracketsProperties = {
    t,
    tournamentId: view.id,
    brackets: filteredBrackets,
    hasLoserBracket,
    isBracketsReadonly,
    updatingMatchId,
    editingMatchId,
    updatingRoundKey,
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
    onSelectBracket,
    activeBracketId,
  };

  return (
    <div className="space-y-10">
      <LiveTournamentViewHeader t={t} view={view} onRefresh={onRefresh} />
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
