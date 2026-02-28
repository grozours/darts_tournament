import { useCallback, useState } from 'react';
import { resetPoolMatches } from '../../services/tournament-service';
import useLiveTournamentMatchEdit from './use-live-tournament-match-edit';
import useLiveTournamentMatchScores from './use-live-tournament-match-scores';
import useLiveTournamentMatchUpdate from './use-live-tournament-match-update';
import type { LiveViewMatch } from './types';

type UseLiveTournamentMatchActionsProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
  clearMatchTargetSelection: (matchKey: string) => void;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
};

type LiveTournamentMatchActionsResult = {
  updatingMatchId: string | undefined;
  resettingPoolId: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  editingMatchId?: string | undefined;
  handleMatchStatusUpdate: (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string
  ) => Promise<void>;
  handleResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => Promise<void>;
  handleScoreChange: (matchKey: string, playerId: string, value: string) => void;
  handleCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  handleEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  cancelMatchEdit: () => void;
  handleSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
};

const useLiveTournamentMatchActions = ({
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  clearMatchTargetSelection,
  getMatchKey,
}: UseLiveTournamentMatchActionsProperties): LiveTournamentMatchActionsResult => {
  const [resettingPoolId, setResettingPoolId] = useState<string | undefined>();
  const { matchScores, handleScoreChange, setMatchScoresForMatch } = useLiveTournamentMatchScores();
  const { editingMatchId, handleEditMatch, cancelMatchEdit } = useLiveTournamentMatchEdit({
    getMatchKey,
    setMatchScoresForMatch,
  });
  const { updatingMatchId, handleMatchStatusUpdate, handleCompleteMatch, handleSaveMatchScores } =
    useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey,
      matchScores,
      clearMatchTargetSelection,
      onSavedMatchScores: cancelMatchEdit,
    });

  const handleResetPoolMatches = useCallback(async (
    tournamentId: string,
    stageId: string,
    poolId: string
  ) => {
    setResettingPoolId(poolId);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await resetPoolMatches(tournamentId, stageId, poolId, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset pool matches');
    } finally {
      setResettingPoolId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError]);

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
  };
};

export default useLiveTournamentMatchActions;
