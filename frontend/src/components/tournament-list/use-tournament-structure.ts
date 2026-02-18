import { useCallback } from 'react';
import useBracketStructure from './use-bracket-structure';
import usePoolStageStructure from './use-pool-stage-structure';
import type { TournamentStructureBaseProperties } from './tournament-structure-types';
import type { BracketStructureResult } from './use-bracket-structure';
import type { PoolStageStructureResult } from './use-pool-stage-structure';

type UseTournamentStructureResult = PoolStageStructureResult &
  BracketStructureResult & {
    resetStructureState: () => void;
  };

const useTournamentStructure = (properties: TournamentStructureBaseProperties): UseTournamentStructureResult => {
  const poolStageStructure = usePoolStageStructure(properties);
  const bracketStructure = useBracketStructure({
    ...properties,
    poolStages: poolStageStructure.poolStages,
  });

  const { resetPoolStageState } = poolStageStructure;
  const { resetBracketState } = bracketStructure;

  const resetStructureState = useCallback(() => {
    resetPoolStageState();
    resetBracketState();
  }, [resetBracketState, resetPoolStageState]);

  return {
    ...poolStageStructure,
    ...bracketStructure,
    resetStructureState,
  };
};

export default useTournamentStructure;
