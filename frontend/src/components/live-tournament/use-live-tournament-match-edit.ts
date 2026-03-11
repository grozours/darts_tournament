import { useCallback, useState } from 'react';
import type { LiveViewMatch } from './types';

type UseLiveTournamentMatchEditProperties = {
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  setMatchScoresForMatch: (matchKey: string, scores: Record<string, string>) => void;
};

type LiveTournamentMatchEditResult = {
  editingMatchId: string | undefined;
  handleEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  cancelMatchEdit: () => void;
};

const useLiveTournamentMatchEdit = ({
  getMatchKey,
  setMatchScoresForMatch,
}: UseLiveTournamentMatchEditProperties): LiveTournamentMatchEditResult => {
  const [editingMatchId, setEditingMatchId] = useState<string | undefined>();

  const handleEditMatch = useCallback((matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const initialScores: Record<string, string> = {};
    for (const playerMatch of match.playerMatches || []) {
      if (playerMatch.player?.id) {
        initialScores[playerMatch.player.id] = String(playerMatch.scoreTotal ?? playerMatch.legsWon ?? 0);
      }
    }
    setMatchScoresForMatch(matchKey, initialScores);
    setEditingMatchId(matchKey);
  }, [getMatchKey, setMatchScoresForMatch]);

  const cancelMatchEdit = useCallback(() => {
    setEditingMatchId(undefined);
  }, []);

  return {
    editingMatchId,
    handleEditMatch,
    cancelMatchEdit,
  };
};

export default useLiveTournamentMatchEdit;
