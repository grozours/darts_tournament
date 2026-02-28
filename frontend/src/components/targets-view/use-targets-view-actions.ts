import type { Dispatch, SetStateAction } from 'react';
import type { LiveViewData, LiveViewMatch, SharedTarget, Translator } from './types';
import { useCallback, useState } from 'react';
import { updateMatchStatus } from '../../services/tournament-service';
import useTargetsViewCompleteMatch from './use-targets-view-complete-match';
import useTargetsViewMatchScores from './use-targets-view-match-scores';
import useTargetsViewStartMatch from './use-targets-view-start-match';

type MatchTournamentInfo = { tournamentId: string; tournamentName: string };

type UseTargetsViewActionsProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  setLiveViews: Dispatch<SetStateAction<LiveViewData[]>>;
  setError: (value: string | undefined) => void;
  matchTournamentById: Map<string, MatchTournamentInfo>;
  sharedTargets: SharedTarget[];
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

const stripMatchTarget = (
  match: LiveViewMatch,
  status: 'SCHEDULED' | 'COMPLETED',
  releasedTargetIds: Set<string>
): LiveViewMatch => {
  if (match.targetId) {
    releasedTargetIds.add(match.targetId);
  }
  const matchWithoutTarget = Object.fromEntries(
    Object.entries(match).filter(([key]) => key !== 'targetId' && key !== 'target')
  ) as Omit<LiveViewMatch, 'targetId' | 'target'>;
  return {
    ...matchWithoutTarget,
    status,
  };
};

const updatePoolStagesOptimistically = (
  poolStages: LiveViewData['poolStages'],
  matchId: string,
  status: 'SCHEDULED' | 'COMPLETED',
  releasedTargetIds: Set<string>
): LiveViewData['poolStages'] => {
  if (!poolStages) {
    return undefined;
  }

  const nextStages = [];
  for (const stage of poolStages) {
    if (!stage.pools) {
      nextStages.push(stage);
      continue;
    }

    const nextPools = [];
    for (const pool of stage.pools) {
      if (!pool.matches) {
        nextPools.push(pool);
        continue;
      }

      const nextMatches = pool.matches.map((match) => (
        match.id === matchId ? stripMatchTarget(match, status, releasedTargetIds) : match
      ));

      nextPools.push({
        ...pool,
        matches: nextMatches,
      });
    }

    nextStages.push({
      ...stage,
      pools: nextPools,
    });
  }

  return nextStages;
};

const updateBracketsOptimistically = (
  brackets: LiveViewData['brackets'],
  matchId: string,
  status: 'SCHEDULED' | 'COMPLETED',
  releasedTargetIds: Set<string>
): LiveViewData['brackets'] => {
  if (!brackets) {
    return undefined;
  }

  const nextBrackets = [];
  for (const bracket of brackets) {
    if (!bracket.matches) {
      nextBrackets.push(bracket);
      continue;
    }

    const nextMatches = bracket.matches.map((match) => (
      match.id === matchId ? stripMatchTarget(match, status, releasedTargetIds) : match
    ));

    nextBrackets.push({
      ...bracket,
      matches: nextMatches,
    });
  }

  return nextBrackets;
};

const updateTargetsOptimistically = (
  targets: LiveViewData['targets'],
  matchId: string,
  releasedTargetIds: Set<string>
): LiveViewData['targets'] => {
  if (!targets) {
    return undefined;
  }

  return targets.map((target) => {
    if (releasedTargetIds.has(target.id) || target.currentMatchId === matchId) {
      const targetWithoutCurrentMatch = Object.fromEntries(
        Object.entries(target).filter(([key]) => key !== 'currentMatchId')
      ) as Omit<typeof target, 'currentMatchId'>;
      return {
        ...targetWithoutCurrentMatch,
        status: 'AVAILABLE',
      };
    }
    return target;
  });
};

const applyOptimisticMatchStatusToViews = (
  currentViews: LiveViewData[],
  tournamentId: string,
  matchId: string,
  status: 'SCHEDULED' | 'COMPLETED'
): LiveViewData[] => currentViews.map((view) => {
  if (view.id !== tournamentId) {
    return view;
  }

  const releasedTargetIds = new Set<string>();
  const updatedPoolStages = updatePoolStagesOptimistically(view.poolStages, matchId, status, releasedTargetIds);
  const updatedBrackets = updateBracketsOptimistically(view.brackets, matchId, status, releasedTargetIds);
  const updatedTargets = updateTargetsOptimistically(view.targets, matchId, releasedTargetIds);

  return {
    ...view,
    ...(updatedPoolStages ? { poolStages: updatedPoolStages } : {}),
    ...(updatedBrackets ? { brackets: updatedBrackets } : {}),
    ...(updatedTargets ? { targets: updatedTargets } : {}),
  };
});

const useTargetsViewActions = ({
  t,
  getSafeAccessToken,
  loadTargets,
  setLiveViews,
  setError,
  matchTournamentById,
  sharedTargets,
}: UseTargetsViewActionsProperties): TargetsViewActionsResult => {
  const [cancellingMatchId, setCancellingMatchId] = useState<string | undefined>();
  const { matchScores, handleScoreChange } = useTargetsViewMatchScores();
  const applyOptimisticMatchStatus = useCallback((tournamentId: string, matchId: string, status: 'SCHEDULED' | 'COMPLETED') => {
    setLiveViews((currentViews): LiveViewData[] => applyOptimisticMatchStatusToViews(
      currentViews,
      tournamentId,
      matchId,
      status
    ));
  }, [setLiveViews]);

  const {
    matchSelectionByTarget,
    startingMatchId,
    handleQueueSelectionChange,
    handleStartMatch,
  } = useTargetsViewStartMatch({
    t,
    getSafeAccessToken,
    loadTargets,
    setError,
    matchTournamentById,
    sharedTargets,
  });
  const { updatingMatchId, handleCompleteMatch } = useTargetsViewCompleteMatch({
    t,
    getSafeAccessToken,
    loadTargets,
    applyOptimisticMatchStatus,
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
      applyOptimisticMatchStatus(matchTournament.tournamentId, match.id, 'SCHEDULED');
      await updateMatchStatus(matchTournament.tournamentId, match.id, 'SCHEDULED', undefined, token);
      await loadTargets({ silent: true });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setCancellingMatchId(undefined);
    }
  }, [applyOptimisticMatchStatus, getSafeAccessToken, loadTargets, matchTournamentById, setError, t]);

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
