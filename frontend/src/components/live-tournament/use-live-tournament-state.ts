import { useEffect } from 'react';
import useLiveTournamentActionsState from './use-live-tournament-actions-state';
import useLiveTournamentCoreState from './use-live-tournament-core-state';
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

export type LiveTournamentState = {
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
  getSafeAccessToken: () => Promise<string | undefined>;
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
  schedulableTargetCountByTournament: Map<string, number>;
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
  editingMatchId: string | undefined;
  handleMatchStatusUpdate: (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string,
    options?: { notifyCancelled?: boolean }
  ) => Promise<void>;
  handleResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => Promise<void>;
  handleScoreChange: (matchKey: string, playerId: string, value: string) => void;
  handleCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  handleEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  cancelMatchEdit: () => void;
  handleSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  editingStageId: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  updatingStageId: string | undefined;
  handleLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleEditStage: (stage: LiveViewPoolStage) => void;
  handleStageStatusChange: (stageId: string, status: string) => void;
  handleStagePoolCountChange: (stageId: string, value: string) => void;
  handleStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  handleUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  cancelEditStage: () => void;
  updatingRoundKey: string | undefined;
  resettingBracketId: string | undefined;
  populatingBracketId: string | undefined;
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

export type LiveTournamentCoreState = Pick<LiveTournamentState,
  | 't'
  | 'authEnabled'
  | 'isAuthenticated'
  | 'authLoading'
  | 'authError'
  | 'isAdmin'
  | 'viewMode'
  | 'viewStatus'
  | 'tournamentId'
  | 'stageId'
  | 'bracketId'
  | 'isAggregateView'
  | 'screenMode'
  | 'getStatusLabel'
  | 'liveViews'
  | 'loading'
  | 'error'
  | 'setError'
  | 'getSafeAccessToken'
  | 'reloadLiveViews'
  | 'visibleLiveViews'
  | 'displayedLiveViews'
  | 'selectedLiveTournamentId'
  | 'setSelectedLiveTournamentId'
  | 'selectedPoolStagesTournamentId'
  | 'setSelectedPoolStagesTournamentId'
  | 'playerIdByTournament'
  | 'showGlobalQueue'
  | 'globalQueue'
  | 'availableTargetsByTournament'
  | 'schedulableTargetCountByTournament'
  | 'matchTargetSelections'
  | 'handleTargetSelectionChange'
  | 'getTargetIdForSelection'
  | 'clearMatchTargetSelection'
  | 'formatTargetLabel'
  | 'getTargetLabel'
  | 'getMatchTargetLabel'
  | 'getMatchKey'
  | 'isPoolStagesReadonly'
  | 'isBracketsReadonly'
>;

export type LiveTournamentBaseContext = Pick<LiveTournamentCoreState,
  | 't'
  | 'authEnabled'
  | 'isAuthenticated'
  | 'authLoading'
  | 'authError'
  | 'isAdmin'
  | 'viewMode'
  | 'viewStatus'
  | 'tournamentId'
  | 'stageId'
  | 'bracketId'
  | 'isAggregateView'
  | 'screenMode'
  | 'getStatusLabel'
  | 'getSafeAccessToken'
> & {
  user?: { email?: string };
  adminUser?: { email?: string };
};

export type LiveTournamentLoadedData = Pick<LiveTournamentCoreState,
  | 'liveViews'
  | 'loading'
  | 'error'
  | 'setError'
  | 'reloadLiveViews'
  | 'visibleLiveViews'
  | 'displayedLiveViews'
  | 'selectedLiveTournamentId'
  | 'setSelectedLiveTournamentId'
  | 'selectedPoolStagesTournamentId'
  | 'setSelectedPoolStagesTournamentId'
  | 'playerIdByTournament'
  | 'showGlobalQueue'
  | 'globalQueue'
  | 'availableTargetsByTournament'
  | 'schedulableTargetCountByTournament'
  | 'matchTargetSelections'
  | 'handleTargetSelectionChange'
  | 'getTargetIdForSelection'
  | 'clearMatchTargetSelection'
  | 'formatTargetLabel'
  | 'getTargetLabel'
  | 'getMatchTargetLabel'
  | 'getMatchKey'
  | 'isPoolStagesReadonly'
  | 'isBracketsReadonly'
>;

export type LiveTournamentActionsState = Pick<LiveTournamentState,
  | 'updatingMatchId'
  | 'resettingPoolId'
  | 'matchScores'
  | 'editingMatchId'
  | 'handleMatchStatusUpdate'
  | 'handleResetPoolMatches'
  | 'handleScoreChange'
  | 'handleCompleteMatch'
  | 'handleEditMatch'
  | 'cancelMatchEdit'
  | 'handleSaveMatchScores'
  | 'editingStageId'
  | 'stageStatusDrafts'
  | 'stagePoolCountDrafts'
  | 'stagePlayersPerPoolDrafts'
  | 'updatingStageId'
  | 'handleLaunchStage'
  | 'handleResetStage'
  | 'handleEditStage'
  | 'handleStageStatusChange'
  | 'handleStagePoolCountChange'
  | 'handleStagePlayersPerPoolChange'
  | 'handleUpdateStage'
  | 'handleDeleteStage'
  | 'handleCompleteStageWithScores'
  | 'handleRecomputeDoubleStage'
  | 'cancelEditStage'
  | 'updatingRoundKey'
  | 'resettingBracketId'
  | 'populatingBracketId'
  | 'handleCompleteBracketRound'
  | 'handleResetBracketMatches'
  | 'handlePopulateBracketFromPools'
  | 'handleSelectBracket'
  | 'activeBracketByTournament'
>;

const useLiveTournamentState = (): LiveTournamentState => {
  const coreState = useLiveTournamentCoreState();
  const actionsState = useLiveTournamentActionsState(coreState);
  const { bracketId, tournamentId } = coreState;
  const { handleSelectBracket } = actionsState;

  useEffect(() => {
    if (!tournamentId || !bracketId) return;
    handleSelectBracket(tournamentId, bracketId);
  }, [bracketId, handleSelectBracket, tournamentId]);

  return {
    ...coreState,
    ...actionsState,
  };
};

export default useLiveTournamentState;
