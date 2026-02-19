import { isBracketsView, isPoolStagesView } from '../../utils/live-view-helpers';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewBracket, LiveViewMode, LiveViewPoolStage } from './types';

type PoolStageStats = {
  poolStageCount: number;
  totalPools: number;
  poolsPerStage: number[];
};

export const filterPoolStagesForView = (
  viewMode: LiveViewMode,
  viewStatus: LiveViewStatus,
  poolStages?: LiveViewPoolStage[],
  canViewEdition = false
) => {
  const stages = poolStages || [];
  if (!isPoolStagesView(viewMode)) {
    return stages;
  }
  const allowedStatuses = viewStatus === 'FINISHED'
    ? new Set(['COMPLETED'])
    : new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
  if (viewStatus !== 'FINISHED' && canViewEdition) {
    allowedStatuses.add('EDITION');
  }
  return stages.filter((stage) => {
    if (!allowedStatuses.has(stage.status)) return false;
    const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
    return poolCount > 0;
  });
};

export const filterBracketsForView = (
  viewMode: LiveViewMode,
  viewStatus: LiveViewStatus,
  brackets?: LiveViewBracket[]
) => {
  const bracketList = brackets || [];
  if (!isBracketsView(viewMode)) {
    return bracketList;
  }
  if (viewStatus !== 'FINISHED') {
    return bracketList;
  }
  return bracketList.filter(
    (bracket) => bracket.status === 'COMPLETED' && (bracket.matches?.length || 0) > 0
  );
};

export const getPoolStageStats = (stages: LiveViewPoolStage[]): PoolStageStats => {
  const poolStageCount = stages.length;
  let totalPools = 0;
  const poolsPerStage: number[] = [];
  for (const stage of stages) {
    const poolCount = stage.pools?.length || 0;
    totalPools += poolCount;
    poolsPerStage.push(poolCount);
  }
  return {
    poolStageCount,
    totalPools,
    poolsPerStage,
  };
};
