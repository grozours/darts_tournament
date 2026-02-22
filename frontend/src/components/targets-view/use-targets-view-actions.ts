import type { Dispatch, SetStateAction } from 'react';
import type { LiveViewMatch, LiveViewData, Translator } from '../live-tournament/types';
import { useCallback, useState } from 'react';
import { updateMatchStatus } from '../../services/tournament-service';
import useTargetsViewCompleteMatch from './use-targets-view-complete-match';
import useTargetsViewMatchScores from './use-targets-view-match-scores';
import useTargetsViewStartMatch from './use-targets-view-start-match';

type MatchTournamentInfo = { tournamentId: string; tournamentName: string };

type UseTargetsViewActionsProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  fetchLiveViews: (token?: string) => Promise<LiveViewData[]>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  setLiveViews: Dispatch<SetStateAction<LiveViewData[]>>;
  setError: (value: string | undefined) => void;
  matchTournamentById: Map<string, MatchTournamentInfo>;
};

type TargetsViewActionsResult = {
  matchSelectionByTarget: Record<string, string>;
  startingMatchId: string | undefined;
  updatingMatchId: string | undefined;
  cancellingMatchId: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  handleQueueSelectionChange: (targetKey: string, matchId: string) => void;
  handleStartMatch: (matchId: string, targetNumber: number) => Promise<void>;
  handleScoreChange: (matchId: string, playerId: string, value: string) => void;
  handleCompleteMatch: (match: LiveViewMatch) => Promise<void>;
  handleCancelMatch: (match: LiveViewMatch) => Promise<void>;
};

const useTargetsViewActions = ({
  t,
  getSafeAccessToken,
  fetchLiveViews,
  loadTargets,
  setLiveViews,
  setError,
  matchTournamentById,
}: UseTargetsViewActionsProperties): TargetsViewActionsResult => {
  const [cancellingMatchId, setCancellingMatchId] = useState<string | undefined>();
  const { matchScores, handleScoreChange } = useTargetsViewMatchScores();
  const {
    matchSelectionByTarget,
    startingMatchId,
    handleQueueSelectionChange,
    handleStartMatch,
  } = useTargetsViewStartMatch({
    t,
    getSafeAccessToken,
    fetchLiveViews,
    loadTargets,
    setLiveViews,
    setError,
    matchTournamentById,
  });
  const { updatingMatchId, handleCompleteMatch } = useTargetsViewCompleteMatch({
    t,
    getSafeAccessToken,
    loadTargets,
    setError,
    matchTournamentById,
    matchScores,
  });

  const handleCancelMatch = useCallback(async (match: LiveViewMatch) => {
    const matchTournament = matchTournamentById.get(match.id);
    if (!matchTournament) {
      setError('Match tournament not found.');
      return;
    }
    setCancellingMatchId(match.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updateMatchStatus(matchTournament.tournamentId, match.id, 'SCHEDULED', undefined, token);
      await loadTargets();
    } catch (error_) {
      console.error('Error cancelling match:', error_);
      setError(error_ instanceof Error ? error_.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setCancellingMatchId(undefined);
    }
  }, [getSafeAccessToken, loadTargets, matchTournamentById, setError, t]);

  return {
    matchSelectionByTarget,
    startingMatchId,
    updatingMatchId,
    cancellingMatchId,
    matchScores,
    handleQueueSelectionChange,
    handleStartMatch,
    handleScoreChange,
    handleCompleteMatch,
    handleCancelMatch,
  };
};

export default useTargetsViewActions;
