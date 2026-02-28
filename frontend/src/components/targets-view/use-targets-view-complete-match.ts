import { useCallback, useState } from 'react';
import { completeMatch } from '../../services/tournament-service';
import type { LiveViewMatch, Translator } from './types';

type MatchTournamentInfo = { tournamentId: string; tournamentName: string };

type UseTargetsViewCompleteMatchProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  applyOptimisticMatchStatus: (tournamentId: string, matchId: string, status: 'SCHEDULED' | 'COMPLETED') => void;
  setError: (value: string | undefined) => void;
  matchTournamentById: Map<string, MatchTournamentInfo>;
  matchScores: Record<string, Record<string, string>>;
};

type TargetsViewCompleteMatchResult = {
  updatingMatchId: string | undefined;
  handleCompleteMatch: (match: LiveViewMatch) => Promise<void>;
};

const useTargetsViewCompleteMatch = ({
  t,
  getSafeAccessToken,
  loadTargets,
  applyOptimisticMatchStatus,
  setError,
  matchTournamentById,
  matchScores,
}: UseTargetsViewCompleteMatchProperties): TargetsViewCompleteMatchResult => {
  const [updatingMatchId, setUpdatingMatchId] = useState<string | undefined>();

  const handleCompleteMatch = useCallback(async (match: LiveViewMatch) => {
    const matchTournament = matchTournamentById.get(match.id);
    if (!matchTournament) {
      setError('Match tournament not found.');
      return;
    }
    if (!match.playerMatches || match.playerMatches.length < 2) {
      setError('Match does not have enough players to complete.');
      return;
    }

    const scoresForMatch = matchScores[match.id] || {};
    const scores = match.playerMatches.map((playerMatch) => ({
      playerId: playerMatch.player?.id || '',
      scoreTotal: Number(scoresForMatch[playerMatch.player?.id || ''] ?? ''),
    }));

    if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
      setError('Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(match.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      applyOptimisticMatchStatus(matchTournament.tournamentId, match.id, 'COMPLETED');
      await completeMatch(matchTournament.tournamentId, match.id, scores, token);
      await loadTargets({ silent: true });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [applyOptimisticMatchStatus, getSafeAccessToken, loadTargets, matchScores, matchTournamentById, setError, t]);

  return { updatingMatchId, handleCompleteMatch };
};

export default useTargetsViewCompleteMatch;
