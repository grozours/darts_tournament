import { useCallback, useState } from 'react';
import { completeMatch, saveMatchScores, updateMatchStatus } from '../../services/tournament-service';
import validateMatchScores from './use-live-tournament-score-validation';
import type { LiveViewMatch } from './types';

type UseLiveTournamentMatchUpdateProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  matchScores: Record<string, Record<string, string>>;
  clearMatchTargetSelection: (matchKey: string) => void;
  onSavedMatchScores: () => void;
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
  handleSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => Promise<void>;
};

const useLiveTournamentMatchUpdate = ({
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  getMatchKey,
  matchScores,
  clearMatchTargetSelection,
  onSavedMatchScores,
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
      if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELLED' || status === 'SCHEDULED') {
        clearMatchTargetSelection(matchKey);
      }
    } catch (error) {
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
      setError(error_ instanceof Error ? error_.message : 'Failed to complete match');
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [getMatchKey, getSafeAccessToken, matchScores, reloadLiveViews, setError]);

  const handleSaveMatchScores = useCallback(async (matchTournamentId: string, match: LiveViewMatch) => {
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
      await saveMatchScores(matchTournamentId, match.id, scores, token);
      setUpdatingMatchId(undefined);
      await reloadLiveViews({ showLoader: false });
      onSavedMatchScores();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to update match scores');
    } finally {
      setUpdatingMatchId(undefined);
    }
  }, [getMatchKey, getSafeAccessToken, matchScores, onSavedMatchScores, reloadLiveViews, setError]);

  return {
    updatingMatchId,
    handleMatchStatusUpdate,
    handleCompleteMatch,
    handleSaveMatchScores,
  };
};

export default useLiveTournamentMatchUpdate;
