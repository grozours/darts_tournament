import type { Dispatch, SetStateAction } from 'react';
import type { LiveViewMatch, LiveViewData, Translator } from './types';
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
  matchScores: Record<string, Record<string, string>>;
  handleQueueSelectionChange: (targetKey: string, matchId: string) => void;
  handleStartMatch: (matchId: string, targetNumber: number) => Promise<void>;
  handleScoreChange: (matchId: string, playerId: string, value: string) => void;
  handleCompleteMatch: (match: LiveViewMatch) => Promise<void>;
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

  return {
    matchSelectionByTarget,
    startingMatchId,
    updatingMatchId,
    matchScores,
    handleQueueSelectionChange,
    handleStartMatch,
    handleScoreChange,
    handleCompleteMatch,
  };
};

export default useTargetsViewActions;
