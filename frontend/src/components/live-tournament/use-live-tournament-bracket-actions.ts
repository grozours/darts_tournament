import { useCallback, useState } from 'react';
import {
  completeBracketRoundWithScores,
  populateBracketFromPools,
  resetBracketMatches,
} from '../../services/tournament-service';
import type { LiveViewBracket, LiveViewPoolStage, Translator } from './types';

type UseLiveTournamentBracketActionsProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
};

type LiveTournamentBracketActionsResult = {
  updatingRoundKey?: string;
  resettingBracketId?: string;
  populatingBracketId?: string;
  handleCompleteBracketRound: (matchTournamentId: string, bracket: LiveViewBracket) => Promise<void>;
  handleResetBracketMatches: (matchTournamentId: string, bracketId: string) => Promise<void>;
  handlePopulateBracketFromPools: (
    matchTournamentId: string,
    bracketId: string,
    stage: LiveViewPoolStage
  ) => Promise<void>;
  handleSelectBracket: (matchTournamentId: string, bracketId: string) => void;
  activeBracketByTournament: Record<string, string>;
};

const useLiveTournamentBracketActions = ({
  t,
  getSafeAccessToken,
  reloadLiveViews,
  setError,
}: UseLiveTournamentBracketActionsProperties): LiveTournamentBracketActionsResult => {
  const [updatingRoundKey, setUpdatingRoundKey] = useState<string | undefined>();
  const [resettingBracketId, setResettingBracketId] = useState<string | undefined>();
  const [populatingBracketId, setPopulatingBracketId] = useState<string | undefined>();
  const [activeBracketByTournament, setActiveBracketByTournament] = useState<Record<string, string>>({});

  const handleCompleteBracketRound = useCallback(async (matchTournamentId: string, bracket: LiveViewBracket) => {
    const activeMatches = (bracket.matches || [])
      .filter((match) => match.status !== 'COMPLETED' && match.status !== 'CANCELLED');
    if (activeMatches.length === 0) {
      setError('No matches available to complete in this bracket round.');
      return;
    }

    const roundNumber = Math.min(...activeMatches.map((match) => match.roundNumber || 1));
    const roundKey = `${matchTournamentId}:${bracket.id}:${roundNumber}`;
    setUpdatingRoundKey(roundKey);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await completeBracketRoundWithScores(matchTournamentId, bracket.id, roundNumber, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to complete bracket round');
    } finally {
      setUpdatingRoundKey(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError]);

  const handleSelectBracket = useCallback((matchTournamentId: string, bracketId: string) => {
    setActiveBracketByTournament((current) => ({
      ...current,
      [matchTournamentId]: bracketId,
    }));
  }, []);

  const handleResetBracketMatches = useCallback(async (matchTournamentId: string, bracketId: string) => {
    setResettingBracketId(bracketId);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await resetBracketMatches(matchTournamentId, bracketId, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset bracket matches');
    } finally {
      setResettingBracketId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError]);

  const handlePopulateBracketFromPools = useCallback(
    async (matchTournamentId: string, bracketId: string, stage: LiveViewPoolStage) => {
      if (!confirm(t('live.populateBracketConfirm'))) {
        return;
      }
      setPopulatingBracketId(bracketId);
      setError(undefined);
      try {
        const token = await getSafeAccessToken();
        await populateBracketFromPools(matchTournamentId, bracketId, stage.id, undefined, token);
        await reloadLiveViews({ showLoader: false });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to populate bracket');
      } finally {
        setPopulatingBracketId(undefined);
      }
    },
    [getSafeAccessToken, reloadLiveViews, setError, t]
  );

  return {
    updatingRoundKey,
    resettingBracketId,
    populatingBracketId,
    handleCompleteBracketRound,
    handleResetBracketMatches,
    handlePopulateBracketFromPools,
    handleSelectBracket,
    activeBracketByTournament,
  };
};

export default useLiveTournamentBracketActions;
