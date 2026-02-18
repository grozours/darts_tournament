import { useCallback, useState } from 'react';
import { completeMatch, updateCompletedMatchScores, updateMatchStatus } from '../../services/tournament-service';
import validateMatchScores from './use-live-tournament-score-validation';
import type { LiveViewMatch } from './types';

type UseLiveTournamentMatchUpdateProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  matchScores: Record<string, Record<string, string>>;
  clearMatchTargetSelection: (matchKey: string) => void;
  onUpdatedCompletedMatch: () => void;
};

type LiveTournamentMatchUpdateResult = {
  updatingMatchId: string | undefined;
  handleMatchStatusUpdate: (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string
  ) => Promise<void>;
  handleCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
  handleUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
};

const useLiveTournamentMatchUpdate = ({
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  getMatchKey,
  matchScores,
  clearMatchTargetSelection,
  onUpdatedCompletedMatch,
}: UseLiveTournamentMatchUpdateProperties): LiveTournamentMatchUpdateResult => {
  const [updatingMatchId, setUpdatingMatchId] = useState<string | undefined>();

  const handleMatchStatusUpdate = useCallback(async (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string
  ) => {
    const matchKey = getMatchKey(matchTournamentId, matchId);
    setUpdatingMatchId(matchKey);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updateMatchStatus(matchTournamentId, matchId, status, targetId, token);
      await reloadLiveViews({ showLoader: false });
      if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELLED') {
        clearMatchTargetSelection(matchKey);
      }
    } catch (error) {
      console.error('Error updating match status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update match status');
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [clearMatchTargetSelection, getMatchKey, getSafeAccessToken, reloadLiveViews, setError]);

  const handleCompleteMatch = useCallback(async (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const scoresForMatch = matchScores[matchKey] || {};
    const { scores, error } = validateMatchScores(
      match,
      scoresForMatch,
      'Match does not have enough players to complete.'
    );
    if (!scores) {
      setError(error ?? 'Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(matchKey);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await completeMatch(matchTournamentId, match.id, scores, token);
      setUpdatingMatchId(undefined);
      await reloadLiveViews({ showLoader: false });
    } catch (error_) {
      console.error('Error completing match:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to complete match');
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [getMatchKey, getSafeAccessToken, matchScores, reloadLiveViews, setError]);

  const handleUpdateCompletedMatch = useCallback(async (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const scoresForMatch = matchScores[matchKey] || {};
    const { scores, error } = validateMatchScores(
      match,
      scoresForMatch,
      'Match does not have enough players to update.'
    );
    if (!scores) {
      setError(error ?? 'Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(matchKey);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updateCompletedMatchScores(matchTournamentId, match.id, scores, token);
      setUpdatingMatchId(undefined);
      await reloadLiveViews({ showLoader: false });
      onUpdatedCompletedMatch();
    } catch (error_) {
      console.error('Error updating match scores:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to update match scores');
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [getMatchKey, getSafeAccessToken, matchScores, onUpdatedCompletedMatch, reloadLiveViews, setError]);

  return {
    updatingMatchId,
    handleMatchStatusUpdate,
    handleCompleteMatch,
    handleUpdateCompletedMatch,
  };
};

export default useLiveTournamentMatchUpdate;
