import LiveTournamentGate from './live-tournament/live-tournament-gate';
import MatchQueueSection from './live-tournament/match-queue-section';
import LiveTournamentView from './live-tournament/live-tournament-view';
import { resolveEmptyLiveCopy } from '../utils/live-view-helpers';
import useLiveTournamentState from './live-tournament/use-live-tournament-state';
import type { LiveViewData, LiveViewMode, Translator } from './live-tournament/types';

type LiveTournamentFiltersProperties = {
  t: Translator;
  viewMode: LiveViewMode;
  tournamentId: string | undefined;
  visibleLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  setSelectedLiveTournamentId: (value: string) => void;
  selectedPoolStagesTournamentId: string;
  setSelectedPoolStagesTournamentId: (value: string) => void;
};

const LiveTournamentFilters = ({
  t,
  viewMode,
  tournamentId,
  visibleLiveViews,
  selectedLiveTournamentId,
  setSelectedLiveTournamentId,
  selectedPoolStagesTournamentId,
  setSelectedPoolStagesTournamentId,
}: LiveTournamentFiltersProperties) => (
  <>
    {viewMode === 'live' && visibleLiveViews.length > 1 && (
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-widest text-slate-500" htmlFor="live-tournament-filter">
          {t('live.selectTournament')}
        </label>
        <select
          id="live-tournament-filter"
          value={selectedLiveTournamentId}
          onChange={(event) => setSelectedLiveTournamentId(event.target.value)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
        >
          <option value="ALL">{t('live.allTournaments')}</option>
          {visibleLiveViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      </div>
    )}
    {viewMode === 'pool-stages' && !tournamentId && visibleLiveViews.length > 1 && (
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-widest text-slate-500" htmlFor="pool-stages-tournament-filter">
          {t('live.selectTournament')}
        </label>
        <select
          id="pool-stages-tournament-filter"
          value={selectedPoolStagesTournamentId}
          onChange={(event) => setSelectedPoolStagesTournamentId(event.target.value)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
        >
          {visibleLiveViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      </div>
    )}
  </>
);

type LiveTournamentEmptyStateProperties = {
  copy: string;
};

const LiveTournamentEmptyState = ({ copy }: LiveTournamentEmptyStateProperties) => (
  <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
    <p className="text-slate-300">{copy}</p>
  </div>
);

function LiveTournament() {
  const {
    t,
    authEnabled,
    isAuthenticated,
    authLoading,
    authError,
    isAdmin,
    viewMode,
    viewStatus,
    tournamentId,
    isAggregateView,
    getStatusLabel,
    loading,
    error,
    reloadLiveViews,
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
    showGlobalQueue,
    globalQueue,
    availableTargetsByTournament,
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    formatTargetLabel,
    getTargetLabel,
    getMatchTargetLabel,
    getMatchKey,
    updatingMatchId,
    matchScores,
    editingMatchId,
    handleMatchStatusUpdate,
    handleScoreChange,
    handleCompleteMatch,
    handleEditMatch,
    cancelMatchEdit,
    handleUpdateCompletedMatch,
    editingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    updatingStageId,
    handleEditStage,
    handleStageStatusChange,
    handleStagePoolCountChange,
    handleStagePlayersPerPoolChange,
    handleUpdateStage,
    handleDeleteStage,
    handleCompleteStageWithScores,
    cancelEditStage,
    updatingRoundKey,
    handleCompleteBracketRound,
    handleSelectBracket,
    activeBracketByTournament,
    isPoolStagesReadonly,
    isBracketsReadonly,
  } = useLiveTournamentState();

  const handleStartMatch = (matchTournamentId: string, matchId: string, targetId?: string) => {
    handleMatchStatusUpdate(matchTournamentId, matchId, 'IN_PROGRESS', targetId);
  };
  const handleRefresh = () => {
    void reloadLiveViews();
  };

  const gateContent = LiveTournamentGate({
    authLoading,
    authEnabled,
    isAuthenticated,
    authError,
    tournamentId,
    requireTournamentId: !isAggregateView,
    loading,
    error,
    onRetry: handleRefresh,
    t,
  });

  if (gateContent) {
    return gateContent;
  }

  if (displayedLiveViews.length === 0) {
    if (isAggregateView && !loading && !error) {
      const emptyCopy = resolveEmptyLiveCopy(viewMode, t);
      return <LiveTournamentEmptyState copy={emptyCopy} />;
    }
    return;
  }

  const commonViewProperties = {
    t,
    isAdmin,
    viewMode,
    viewStatus,
    isAggregateView,
    visibleLiveViewsCount: visibleLiveViews.length,
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
    onTargetSelectionChange: handleTargetSelectionChange,
    onStartMatch: handleStartMatch,
    onCompleteMatch: handleCompleteMatch,
    onEditMatch: handleEditMatch,
    onUpdateCompletedMatch: handleUpdateCompletedMatch,
    onCancelMatchEdit: cancelMatchEdit,
    onScoreChange: handleScoreChange,
    onEditStage: handleEditStage,
    onCancelEditStage: cancelEditStage,
    onUpdateStage: handleUpdateStage,
    onCompleteStageWithScores: handleCompleteStageWithScores,
    onDeleteStage: handleDeleteStage,
    onStagePoolCountChange: handleStagePoolCountChange,
    onStagePlayersPerPoolChange: handleStagePlayersPerPoolChange,
    onStageStatusChange: handleStageStatusChange,
    editingStageId,
    updatingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    onCompleteBracketRound: handleCompleteBracketRound,
    onSelectBracket: handleSelectBracket,
    onRefresh: handleRefresh,
  };

  return (
    <div className="space-y-12">
      <LiveTournamentFilters
        t={t}
        viewMode={viewMode}
        tournamentId={tournamentId}
        visibleLiveViews={visibleLiveViews}
        selectedLiveTournamentId={selectedLiveTournamentId}
        setSelectedLiveTournamentId={setSelectedLiveTournamentId}
        selectedPoolStagesTournamentId={selectedPoolStagesTournamentId}
        setSelectedPoolStagesTournamentId={setSelectedPoolStagesTournamentId}
      />
      {showGlobalQueue && (
        <MatchQueueSection
          t={t}
          queue={globalQueue}
          showTournamentName
          availableTargetsByTournament={availableTargetsByTournament}
          matchTargetSelections={matchTargetSelections}
          updatingMatchId={updatingMatchId}
          isPoolStagesReadonly={isPoolStagesReadonly}
          getMatchKey={getMatchKey}
          getTargetIdForSelection={getTargetIdForSelection}
          onTargetSelectionChange={handleTargetSelectionChange}
          onStartMatch={handleStartMatch}
          getStatusLabel={getStatusLabel}
          formatTargetLabel={formatTargetLabel}
          getTargetLabel={getTargetLabel}
        />
      )}
      {displayedLiveViews.map((view) => (
        <LiveTournamentView
          key={view.id}
          {...commonViewProperties}
          view={view}
          activeBracketId={activeBracketByTournament[view.id] ?? ''}
        />
      ))}
    </div>
  );
}

export default LiveTournament;
