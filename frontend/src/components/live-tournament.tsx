import LiveTournamentGate from './live-tournament/live-tournament-gate';
import MatchQueueSection from './live-tournament/match-queue-section';
import LiveTournamentView from './live-tournament/live-tournament-view';
import { resolveEmptyLiveCopy } from '../utils/live-view-helpers';
import useLiveTournamentState from './live-tournament/use-live-tournament-state';
import type { LiveViewData, LiveViewMode, Translator } from './live-tournament/types';

type LiveTournamentFiltersProperties = {
  t: Translator;
  viewMode: LiveViewMode;
  viewStatus: string | undefined;
  tournamentId: string | undefined;
  visibleLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  setSelectedLiveTournamentId: (value: string) => void;
  selectedPoolStagesTournamentId: string;
  setSelectedPoolStagesTournamentId: (value: string) => void;
  onStatusChange: (status?: string) => void;
};

const LiveTournamentFilters = ({
  t,
  viewMode,
  viewStatus,
  tournamentId,
  visibleLiveViews,
  selectedLiveTournamentId,
  setSelectedLiveTournamentId,
  selectedPoolStagesTournamentId,
  setSelectedPoolStagesTournamentId,
  onStatusChange,
}: LiveTournamentFiltersProperties) => {
  const normalizedStatus = (viewStatus ?? '').toUpperCase();
  const selectedStatus = normalizedStatus === 'OPEN' || normalizedStatus === 'LIVE'
    ? normalizedStatus
    : 'ALL';

  return (
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
    {viewMode === 'pool-stages' && !tournamentId && (
      <div className="flex flex-wrap items-center gap-4">
        {visibleLiveViews.length > 1 && (
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</span>
          <div className="flex rounded-full border border-slate-700 bg-slate-950/60 p-1">
            {([
              { value: 'ALL', label: t('common.all') },
              { value: 'LIVE', label: t('nav.live') },
              { value: 'OPEN', label: t('nav.open') },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusChange(option.value === 'ALL' ? undefined : option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedStatus === option.value
                    ? 'bg-cyan-500/20 text-cyan-100'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

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
    liveViews,
    loading,
    error,
    reloadLiveViews,
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
    playerIdByTournament,
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
    handleRecomputeDoubleStage,
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
  const handleStatusChange = (status?: string) => {
    const windowReference = globalThis.window;
    if (windowReference === undefined) {
      return;
    }
    const url = new URL(windowReference.location.href);
    const statusValue = status?.trim();
    if (statusValue === undefined || statusValue === '') {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', statusValue);
    }
    windowReference.location.assign(`${url.pathname}${url.search}`);
  };

  const debugEnabled = (() => {
    const windowReference = globalThis.window;
    if (windowReference === undefined) {
      return false;
    }
    const parameters = new URLSearchParams(windowReference.location.search);
    return parameters.get('debug') === '1';
  })();

  const debugPanel = debugEnabled ? (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
      <div className="font-semibold">Live view debug</div>
      <div>viewMode: {viewMode ?? 'none'} | viewStatus: {viewStatus ?? 'none'} | tournamentId: {tournamentId ?? 'none'}</div>
      <div>isAggregateView: {String(isAggregateView)} | loading: {String(loading)} | error: {error ?? 'none'}</div>
      <div>liveViews: {liveViews.length} | visible: {visibleLiveViews.length} | displayed: {displayedLiveViews.length}</div>
      <div>selectedLive: {selectedLiveTournamentId} | selectedPoolStages: {selectedPoolStagesTournamentId || 'none'}</div>
      <div>authEnabled: {String(authEnabled)} | isAuthenticated: {String(isAuthenticated)} | isAdmin: {String(isAdmin)}</div>
    </div>
  ) : undefined;

  const requireTournamentId = !isAggregateView;
  const gateContent = LiveTournamentGate({
    authLoading,
    authEnabled,
    isAuthenticated,
    authError,
    tournamentId,
    requireTournamentId,
    loading,
    error,
    onRetry: handleRefresh,
    t,
  });

  if (gateContent) {
    return gateContent;
  }

  const hasDisplayedViews = displayedLiveViews.length > 0;
  const isAggregateEmptyState = isAggregateView && loading === false && error === undefined;

  if (hasDisplayedViews) {
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
      onRecomputeDoubleStage: handleRecomputeDoubleStage,
      onStagePoolCountChange: handleStagePoolCountChange,
      onStagePlayersPerPoolChange: handleStagePlayersPerPoolChange,
      onStageStatusChange: handleStageStatusChange,
      editingStageId,
      updatingStageId,
      stageStatusDrafts,
      stagePoolCountDrafts,
      stagePlayersPerPoolDrafts,
      playerIdByTournament,
      onCompleteBracketRound: handleCompleteBracketRound,
      onSelectBracket: handleSelectBracket,
      onRefresh: handleRefresh,
    };

    return (
    <div className="space-y-12">
      {debugPanel}
      <LiveTournamentFilters
        t={t}
        viewMode={viewMode}
        viewStatus={viewStatus}
        tournamentId={tournamentId}
        visibleLiveViews={visibleLiveViews}
        selectedLiveTournamentId={selectedLiveTournamentId}
        setSelectedLiveTournamentId={setSelectedLiveTournamentId}
        selectedPoolStagesTournamentId={selectedPoolStagesTournamentId}
        setSelectedPoolStagesTournamentId={setSelectedPoolStagesTournamentId}
        onStatusChange={handleStatusChange}
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

  if (isAggregateEmptyState) {
    const emptyCopy = resolveEmptyLiveCopy(viewMode, t);
    return (
      <div className="space-y-6">
        {debugPanel}
        <LiveTournamentFilters
          t={t}
          viewMode={viewMode}
          viewStatus={viewStatus}
          tournamentId={tournamentId}
          visibleLiveViews={visibleLiveViews}
          selectedLiveTournamentId={selectedLiveTournamentId}
          setSelectedLiveTournamentId={setSelectedLiveTournamentId}
          selectedPoolStagesTournamentId={selectedPoolStagesTournamentId}
          setSelectedPoolStagesTournamentId={setSelectedPoolStagesTournamentId}
          onStatusChange={handleStatusChange}
        />
        <LiveTournamentEmptyState copy={emptyCopy} />
      </div>
    );
  }

  return debugPanel;
}

export default LiveTournament;
