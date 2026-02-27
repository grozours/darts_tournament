import { useCallback, useState } from 'react';
import { updateMatchStatus } from '../../services/tournament-service';
import type { SharedTarget, Translator } from './types';

type MatchTournamentInfo = { tournamentId: string; tournamentName: string };

type UseTargetsViewStartMatchProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
  matchTournamentById: Map<string, MatchTournamentInfo>;
  sharedTargets: SharedTarget[];
};

type TargetsViewStartMatchResult = {
  matchSelectionByTarget: Record<string, string>;
  startingMatchId: string | undefined;
  handleQueueSelectionChange: (targetKey: string, matchId: string) => void;
  handleStartMatch: (matchId: string, targetNumber: number) => Promise<void>;
};

const useTargetsViewStartMatch = ({
  t,
  getSafeAccessToken,
  loadTargets,
  setError,
  matchTournamentById,
  sharedTargets,
}: UseTargetsViewStartMatchProperties): TargetsViewStartMatchResult => {
  const [matchSelectionByTarget, setMatchSelectionByTarget] = useState<Record<string, string>>({});
  const [startingMatchId, setStartingMatchId] = useState<string | undefined>();

  const handleQueueSelectionChange = useCallback((targetKey: string, matchId: string) => {
    setMatchSelectionByTarget((current) => ({
      ...current,
      [targetKey]: matchId,
    }));
  }, []);

  const handleStartMatch = useCallback(async (matchId: string, targetNumber: number) => {
    setStartingMatchId(matchId);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();

      const matchTournament = matchTournamentById.get(matchId);
      if (!matchTournament) {
        throw new Error('Match tournament not found');
      }

      const selectedTarget = sharedTargets.find((item) => item.targetNumber === targetNumber);
      const targetId = selectedTarget?.targetIdsByTournament.get(matchTournament.tournamentId);
      if (!targetId) {
        throw new Error('Target is not available');
      }
      if (selectedTarget?.isInUse) {
        throw new Error('Target is not available');
      }

      await updateMatchStatus(matchTournament.tournamentId, matchId, 'IN_PROGRESS', targetId, token);
      await loadTargets({ silent: true });
      setMatchSelectionByTarget((current) => {
        const next = { ...current };
        delete next[String(targetNumber)];
        return next;
      });
    } catch (error_) {
      console.error('Error starting match from queue:', error_);
      setError(error_ instanceof Error ? error_.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setStartingMatchId(undefined);
    }
  }, [getSafeAccessToken, loadTargets, matchTournamentById, setError, sharedTargets, t]);

  return {
    matchSelectionByTarget,
    startingMatchId,
    handleQueueSelectionChange,
    handleStartMatch,
  };
};

export default useTargetsViewStartMatch;
