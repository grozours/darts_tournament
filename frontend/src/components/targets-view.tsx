import { useMemo } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import TargetsViewContent from './targets-view/targets-view-content';
import TargetsViewState from './targets-view/targets-view-state';
import useTargetsViewActions from './targets-view/use-targets-view-actions';
import useTargetsViewData from './targets-view/use-targets-view-data';
import useTargetsViewDerived from './targets-view/use-targets-view-derived';

function TargetsView() {
  const { t } = useI18n();
  const { enabled: authEnabled, getAccessTokenSilently } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const tournamentId = useMemo(() => {
    if (globalThis.window === undefined) return;
    const parameter = new URLSearchParams(globalThis.window.location.search).get('tournamentId');
    if (!parameter) return;
    return parameter;
  }, []);

  const {
    liveViews,
    loading,
    error,
    setError,
    setLiveViews,
    loadTargets,
    fetchLiveViews,
    getSafeAccessToken,
  } = useTargetsViewData({
    t,
    authEnabled,
    getAccessTokenSilently,
    tournamentId,
  });

  const {
    scopedViews,
    matchDetailsById,
    matchTournamentById,
    sharedTargets,
    queueItems,
    queuePreview,
  } = useTargetsViewDerived({
    liveViews,
    tournamentId,
    t,
  });
  const {
    matchSelectionByTarget,
    startingMatchId,
    updatingMatchId,
    cancellingMatchId,
    matchScores,
    handleQueueSelectionChange,
    handleStartMatch,
    handleScoreChange,
    handleCompleteMatch,
    handleCancelMatch,
  } = useTargetsViewActions({
    t,
    getSafeAccessToken,
    fetchLiveViews,
    loadTargets,
    setLiveViews,
    setError,
    matchTournamentById,
  });

  if (loading || error || scopedViews.length === 0) {
    return (
      <TargetsViewState
        t={t}
        loading={loading}
        error={error}
        scopedViewsCount={scopedViews.length}
        onRetry={loadTargets}
      />
    );
  }

  return (
    <TargetsViewContent
      t={t}
      isAdmin={isAdmin}
      tournamentId={tournamentId}
      scopedViews={scopedViews}
      sharedTargets={sharedTargets}
      queueItems={queueItems}
      queuePreview={queuePreview}
      matchDetailsById={matchDetailsById}
      matchSelectionByTarget={matchSelectionByTarget}
      matchScores={matchScores}
      updatingMatchId={updatingMatchId}
      startingMatchId={startingMatchId}
      cancellingMatchId={cancellingMatchId}
      onQueueSelectionChange={handleQueueSelectionChange}
      onStartMatch={handleStartMatch}
      onScoreChange={handleScoreChange}
      onCompleteMatch={handleCompleteMatch}
      onCancelMatch={handleCancelMatch}
    />
  );
}

export default TargetsView;
