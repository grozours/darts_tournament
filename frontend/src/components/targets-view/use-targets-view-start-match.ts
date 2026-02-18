import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { updateMatchStatus } from '../../services/tournament-service';
import { buildMatchMaps, buildSharedTargets } from './match-maps';
import type { LiveViewData, Translator } from './types';

type MatchTournamentInfo = { tournamentId: string; tournamentName: string };

type UseTargetsViewStartMatchProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  fetchLiveViews: (token?: string) => Promise<LiveViewData[]>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  setLiveViews: Dispatch<SetStateAction<LiveViewData[]>>;
  setError: (value: string | undefined) => void;
  matchTournamentById: Map<string, MatchTournamentInfo>;
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
  fetchLiveViews,
  loadTargets,
  setLiveViews,
  setError,
  matchTournamentById,
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
      const freshViews = await fetchLiveViews(token);
      setLiveViews(freshViews);

      const matchTournament = matchTournamentById.get(matchId);
      if (!matchTournament) {
        throw new Error('Match tournament not found');
      }

      const freshMatchMaps = buildMatchMaps(freshViews, t);
      const freshSharedTargets = buildSharedTargets(
        freshViews,
        freshMatchMaps.matchByTargetId,
        freshMatchMaps.matchById,
        t
      );
      const freshTarget = freshSharedTargets.find((item) => item.targetNumber === targetNumber);
      const targetId = freshTarget?.targetIdsByTournament.get(matchTournament.tournamentId);
      if (!targetId) {
        throw new Error('Target is not available');
      }
      if (freshTarget?.isInUse) {
        throw new Error('Target is not available');
      }

      await updateMatchStatus(matchTournament.tournamentId, matchId, 'IN_PROGRESS', targetId, token);
      await loadTargets();
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
  }, [fetchLiveViews, getSafeAccessToken, loadTargets, matchTournamentById, setError, setLiveViews, t]);

  return {
    matchSelectionByTarget,
    startingMatchId,
    handleQueueSelectionChange,
    handleStartMatch,
  };
};

export default useTargetsViewStartMatch;
