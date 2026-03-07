import { useOptionalAuth } from '../../auth/optional-auth';
import { useAdminStatus } from '../../auth/use-admin-status';
import { useI18n } from '../../i18n';
import { getLiveRefreshIntervalMs } from '../../utils/polling-config';
import useLiveTournamentData from './use-live-tournament-data';
import useLiveTournamentGlobalQueue from './use-live-tournament-global-queue';
import useLiveTournamentMatchKey from './use-live-tournament-match-key';
import useLiveTournamentParameters from './use-live-tournament-parameters';
import useLiveTournamentReadonly from './use-live-tournament-readonly';
import useLiveTournamentRefresh from './use-live-tournament-refresh';
import useLiveTournamentPlayerIds from './use-live-tournament-player-ids';
import useLiveTournamentStatusLabels from './use-live-tournament-status-labels';
import useLiveTournamentTargetLabels from './use-live-tournament-target-labels';
import useLiveTournamentTargets from './use-live-tournament-targets';
import useLiveTournamentToken from './use-live-tournament-token';
import useLiveTournamentSelection from './use-live-tournament-selection';
import type {
  LiveTournamentCoreState,
  LiveTournamentBaseContext,
  LiveTournamentLoadedData,
} from './use-live-tournament-state';

const useLiveTournamentBaseContext = (): LiveTournamentBaseContext => {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    error: authError,
    user,
  } = useOptionalAuth();
  const { isAdmin, adminUser } = useAdminStatus();
  const { getStatusLabel } = useLiveTournamentStatusLabels(t);
  const {
    viewMode,
    viewStatus,
    tournamentId,
    stageId,
    bracketId,
    isAggregateView,
    screenMode,
  } = useLiveTournamentParameters();
  const { getSafeAccessToken } = useLiveTournamentToken({
    authEnabled,
    isAuthenticated,
    getAccessTokenSilently,
  });

  return {
    t,
    authEnabled,
    isAuthenticated,
    authLoading,
    authError,
    isAdmin,
    viewMode,
    viewStatus,
    tournamentId,
    stageId,
    bracketId,
    isAggregateView,
    screenMode,
    getStatusLabel,
    getSafeAccessToken,
    ...(user ? { user } : {}),
    ...(adminUser ? { adminUser } : {}),
  };
};

const useLiveTournamentLoadedData = (baseContext: LiveTournamentBaseContext): LiveTournamentLoadedData => {
  const {
    getSafeAccessToken,
    viewMode,
    viewStatus,
    tournamentId,
    isAggregateView,
    isAuthenticated,
    user,
    adminUser,
    isAdmin,
    screenMode,
    t,
  } = baseContext;
  const {
    liveViews,
    loading,
    error,
    setError,
    reloadLiveViews,
  } = useLiveTournamentData({
    getSafeAccessToken,
    viewMode,
    viewStatus,
    tournamentId,
    isAggregateView,
  });
  const { playerIdByTournament } = useLiveTournamentPlayerIds({
    liveViews,
    isAuthenticated,
    ...(user ? { user } : {}),
    ...(adminUser?.email ? { fallbackUserEmail: adminUser.email } : {}),
    getSafeAccessToken,
  });
  const canViewEditionByViewId = (viewId: string) => isAdmin || Boolean(playerIdByTournament[viewId]);
  const allowEmptyPoolsByViewId = () => isAdmin;
  const {
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
  } = useLiveTournamentSelection({
    viewMode,
    viewStatus,
    screenMode,
    tournamentId,
    liveViews,
    canViewEditionByViewId,
    allowEmptyPoolsByViewId,
  });
  const { showGlobalQueue, globalQueue } = useLiveTournamentGlobalQueue({
    viewMode,
    viewStatus,
    displayedLiveViews,
    selectedLiveTournamentId,
    visibleLiveViewsCount: visibleLiveViews.length,
    allowEmptyPools: isAdmin && !screenMode,
    screenMode,
  });
  const {
    availableTargetsByTournament,
    schedulableTargetCountByTournament,
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    clearMatchTargetSelection,
  } = useLiveTournamentTargets({ liveViews });
  const { formatTargetLabel, getTargetLabel, getMatchTargetLabel } = useLiveTournamentTargetLabels(t);
  const { getMatchKey } = useLiveTournamentMatchKey();
  const { isPoolStagesReadonly, isBracketsReadonly } = useLiveTournamentReadonly({ isAdmin, viewMode });

  useLiveTournamentRefresh({
    reloadLiveViews,
    canRefresh: !baseContext.authEnabled || !baseContext.authLoading,
    refreshIntervalMs: getLiveRefreshIntervalMs(isAdmin),
  });

  return {
    liveViews,
    loading,
    error,
    setError,
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
    schedulableTargetCountByTournament,
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    clearMatchTargetSelection,
    formatTargetLabel,
    getTargetLabel,
    getMatchTargetLabel,
    getMatchKey,
    isPoolStagesReadonly,
    isBracketsReadonly,
  };
};

const useLiveTournamentCoreState = (): LiveTournamentCoreState => {
  const baseContext = useLiveTournamentBaseContext();
  const loadedData = useLiveTournamentLoadedData(baseContext);

  return {
    ...baseContext,
    ...loadedData,
  };
};

export default useLiveTournamentCoreState;
