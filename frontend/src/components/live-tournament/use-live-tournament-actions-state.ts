import useLiveTournamentBracketActions from './use-live-tournament-bracket-actions';
import useLiveTournamentMatchActions from './use-live-tournament-match-actions';
import useLiveTournamentStageActions from './use-live-tournament-stage-actions';
import type {
  LiveTournamentActionsState,
  LiveTournamentCoreState,
} from './use-live-tournament-state';

const useLiveTournamentActionsState = ({
  t,
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  clearMatchTargetSelection,
  getMatchKey,
}: Pick<LiveTournamentCoreState,
  | 't'
  | 'getSafeAccessToken'
  | 'reloadLiveViews'
  | 'setError'
  | 'clearMatchTargetSelection'
  | 'getMatchKey'
>): LiveTournamentActionsState => {
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
    handleSaveMatchScores,
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
    handleLaunchStage,
    handleResetStage,
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

  return {
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
    handleSaveMatchScores,
    editingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    updatingStageId,
    handleLaunchStage,
    handleResetStage,
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
  };
};

export default useLiveTournamentActionsState;
