import { useEffect } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useAdminStatus } from '../../auth/use-admin-status';
import { useI18n } from '../../i18n';
import useLiveTournamentBracketActions from './use-live-tournament-bracket-actions';
import useLiveTournamentData from './use-live-tournament-data';
import useLiveTournamentGlobalQueue from './use-live-tournament-global-queue';
import useLiveTournamentMatchActions from './use-live-tournament-match-actions';
import useLiveTournamentMatchKey from './use-live-tournament-match-key';
import useLiveTournamentParameters from './use-live-tournament-parameters';
import useLiveTournamentReadonly from './use-live-tournament-readonly';
import useLiveTournamentRefresh from './use-live-tournament-refresh';
import useLiveTournamentPlayerIds from './use-live-tournament-player-ids';
import useLiveTournamentStageActions from './use-live-tournament-stage-actions';
import useLiveTournamentStatusLabels from './use-live-tournament-status-labels';
import useLiveTournamentTargetLabels from './use-live-tournament-target-labels';
import useLiveTournamentTargets from './use-live-tournament-targets';
import useLiveTournamentToken from './use-live-tournament-token';
import useLiveTournamentSelection from './use-live-tournament-selection';
import type {
  LiveViewBracket,
  LiveViewData,
  LiveViewMatch,
  LiveViewMode,
  LiveViewPoolStage,
  LiveViewTarget,
  MatchQueueItem,
  Translator,
} from './types';

type LiveTournamentState = {
  t: Translator;
  authEnabled: boolean;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: Error | undefined;
  isAdmin: boolean;
  viewMode: LiveViewMode;
  viewStatus: string | undefined;
  tournamentId: string | undefined;
  stageId: string | undefined;
  bracketId: string | undefined;
  isAggregateView: boolean;
  screenMode: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  reloadLiveViews: () => Promise<void>;
  visibleLiveViews: LiveViewData[];
  displayedLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  setSelectedLiveTournamentId: (value: string) => void;
  selectedPoolStagesTournamentId: string;
  setSelectedPoolStagesTournamentId: (value: string) => void;
  playerIdByTournament: Record<string, string>;
  showGlobalQueue: boolean;
  globalQueue: MatchQueueItem[];
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  matchTargetSelections: Record<string, string>;
  handleTargetSelectionChange: (matchKey: string, targetId: string) => void;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  clearMatchTargetSelection: (matchKey: string) => void;
  formatTargetLabel: (value: string) => string;
  getTargetLabel: (target: LiveViewTarget) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  updatingMatchId: string | undefined;
  resettingPoolId: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  editingMatchId?: string | undefined;
  handleMatchStatusUpdate: (matchTournamentId: string, matchId: string, status: string, targetId?: string) => Promise<void>;
  handleResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => Promise<void>;
  handleScoreChange: (matchKey: string, playerId: string, value: string) => void;
  handleCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  handleEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  cancelMatchEdit: () => void;
  handleUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  editingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  updatingStageId?: string | undefined;
  handleEditStage: (stage: LiveViewPoolStage) => void;
  handleStageStatusChange: (stageId: string, status: string) => void;
  handleStagePoolCountChange: (stageId: string, value: string) => void;
  handleStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  handleUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  cancelEditStage: () => void;
  updatingRoundKey?: string | undefined;
  resettingBracketId?: string | undefined;
  populatingBracketId?: string | undefined;
  handleCompleteBracketRound: (tournamentId: string, bracket: LiveViewBracket) => Promise<void>;
  handleResetBracketMatches: (tournamentId: string, bracketId: string) => Promise<void>;
  handlePopulateBracketFromPools: (
    tournamentId: string,
    bracketId: string,
    stage: LiveViewPoolStage,
    role: 'WINNER' | 'LOSER'
  ) => Promise<void>;
  handleSelectBracket: (tournamentId: string, bracketId: string) => void;
  activeBracketByTournament: Record<string, string>;
  isPoolStagesReadonly: boolean;
  isBracketsReadonly: boolean;
};

const useLiveTournamentState = (): LiveTournamentState => {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    error: authError,
    user,
  } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();
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
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    clearMatchTargetSelection,
  } = useLiveTournamentTargets({ liveViews });
  const { formatTargetLabel, getTargetLabel, getMatchTargetLabel } = useLiveTournamentTargetLabels(t);
  const { getMatchKey } = useLiveTournamentMatchKey();
  const {
    updatingMatchId,
    resettingPoolId,
    matchScores,
    editingMatchId,
    handleMatchStatusUpdate,
    handleResetPoolMatches,
    handleScoreChange,
    handleCompleteMatch,
    handleEditMatch,
    cancelMatchEdit,
    handleUpdateCompletedMatch,
  } = useLiveTournamentMatchActions({
    getSafeAccessToken,
    reloadLiveViews,
    setError,
    clearMatchTargetSelection,
    getMatchKey,
  });
  const {
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
  } = useLiveTournamentStageActions({
    t,
    getSafeAccessToken,
    reloadLiveViews,
    setError,
  });
  const {
    updatingRoundKey,
    resettingBracketId,
    populatingBracketId,
    handleCompleteBracketRound,
    handleResetBracketMatches,
    handlePopulateBracketFromPools,
    handleSelectBracket,
    activeBracketByTournament,
  } = useLiveTournamentBracketActions({
    t,
    getSafeAccessToken,
    reloadLiveViews,
    setError,
  });

  useEffect(() => {
    if (!tournamentId || !bracketId) return;
    handleSelectBracket(tournamentId, bracketId);
  }, [bracketId, handleSelectBracket, tournamentId]);
  const { isPoolStagesReadonly, isBracketsReadonly } = useLiveTournamentReadonly({ isAdmin, viewMode });

  useLiveTournamentRefresh({
    reloadLiveViews,
    canRefresh: !authEnabled || !authLoading,
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
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    clearMatchTargetSelection,
    formatTargetLabel,
    getTargetLabel,
    getMatchTargetLabel,
    getMatchKey,
    updatingMatchId,
    resettingPoolId,
    matchScores,
    editingMatchId,
    handleMatchStatusUpdate,
    handleResetPoolMatches,
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
    resettingBracketId,
    populatingBracketId,
    handleCompleteBracketRound,
    handleResetBracketMatches,
    handlePopulateBracketFromPools,
    handleSelectBracket,
    activeBracketByTournament,
    isPoolStagesReadonly,
    isBracketsReadonly,
  };
};

export default useLiveTournamentState;
