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
  matchScores: Record<string, Record<string, string>>;
  editingMatchId?: string | undefined;
  handleMatchStatusUpdate: (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string
  ) => Promise<void>;
  handleScoreChange: (matchKey: string, playerId: string, value: string) => void;
  handleCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  handleEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  cancelMatchEdit: () => void;
  handleUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
};

const useLiveTournamentMatchActions = ({
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  clearMatchTargetSelection,
  getMatchKey,
}: UseLiveTournamentMatchActionsProperties): LiveTournamentMatchActionsResult => {
  const { matchScores, handleScoreChange, setMatchScoresForMatch } = useLiveTournamentMatchScores();
  const { editingMatchId, handleEditMatch, cancelMatchEdit } = useLiveTournamentMatchEdit({
    getMatchKey,
    setMatchScoresForMatch,
  });
  const { updatingMatchId, handleMatchStatusUpdate, handleCompleteMatch, handleUpdateCompletedMatch } =
    useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey,
      matchScores,
      clearMatchTargetSelection,
      onUpdatedCompletedMatch: cancelMatchEdit,
    });

  return {
    updatingMatchId,
    matchScores,
    editingMatchId,
    handleMatchStatusUpdate,
    handleScoreChange,
    handleCompleteMatch,
    handleEditMatch,
    cancelMatchEdit,
    handleUpdateCompletedMatch,
  };
};

export default useLiveTournamentMatchActions;
