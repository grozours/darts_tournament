import { useEffect, useMemo, useState } from 'react';
import { TournamentFormat } from '@shared/types';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import { fetchDoublettes, fetchEquipes } from '../services/tournament-service';
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
    getSafeAccessToken,
  } = useTargetsViewData({
    t,
    authEnabled,
    getAccessTokenSilently,
    tournamentId,
  });

  const scopedViews = useMemo(() => {
    const activeViews = liveViews.filter((view) => (view.status ?? '').toUpperCase() === 'LIVE');
    return tournamentId ? activeViews.filter((view) => view.id === tournamentId) : activeViews;
  }, [liveViews, tournamentId]);

  const [groupNameByPlayerIdByTournament, setGroupNameByPlayerIdByTournament] = useState<Map<string, Map<string, string>>>(new Map());

  useEffect(() => {
    let isCancelled = false;

    const loadGroupLabels = async () => {
      const groupedViews = scopedViews.filter(
        (view) => view.format === TournamentFormat.DOUBLE || view.format === TournamentFormat.TEAM_4_PLAYER
      );

      if (groupedViews.length === 0) {
        if (!isCancelled) {
          setGroupNameByPlayerIdByTournament(new Map());
        }
        return;
      }

      const token = await getSafeAccessToken();
      const settledResults = await Promise.allSettled(groupedViews.map(async (view) => {
        const groups = view.format === TournamentFormat.DOUBLE
          ? await fetchDoublettes(view.id, token)
          : await fetchEquipes(view.id, token);

        const byPlayerId = new Map<string, string>();
        for (const group of groups) {
          for (const member of group.members) {
            byPlayerId.set(member.playerId, group.name);
          }
        }

        return {
          viewId: view.id,
          byPlayerId,
        };
      }));

      const nextMap = new Map<string, Map<string, string>>();
      for (const result of settledResults) {
        if (result.status !== 'fulfilled') {
          continue;
        }
        nextMap.set(result.value.viewId, result.value.byPlayerId);
      }

      if (!isCancelled) {
        setGroupNameByPlayerIdByTournament(nextMap);
      }
    };

    void loadGroupLabels();

    return () => {
      isCancelled = true;
    };
  }, [getSafeAccessToken, scopedViews]);

  const derived = useTargetsViewDerived({
    liveViews,
    tournamentId,
    t,
    groupNameByPlayerIdByTournament,
  });
  const {
    scopedViews: derivedScopedViews,
    matchDetailsById,
    matchTournamentById,
    sharedTargets,
    queueItems,
    queuePreview,
  } = derived;
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
    loadTargets,
    setLiveViews,
    setError,
    matchTournamentById,
    sharedTargets,
  });

  if (loading || error || derivedScopedViews.length === 0) {
    return (
      <TargetsViewState
        t={t}
        loading={loading}
        error={error}
        scopedViewsCount={derivedScopedViews.length}
        onRetry={loadTargets}
      />
    );
  }

  return (
    <TargetsViewContent
      t={t}
      isAdmin={isAdmin}
      tournamentId={tournamentId}
      scopedViews={derivedScopedViews}
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
