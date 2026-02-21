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
  allowEmptyPools = false,
  screenMode = false
) => {
  const stages = poolStages || [];
  if (!isPoolStagesView(viewMode) && viewMode !== 'live') {
    return stages;
  }
  let allowedStatuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EDITION']);
  if (viewStatus === 'FINISHED') {
    allowedStatuses = new Set(['COMPLETED']);
  }
  if (screenMode) {
    allowedStatuses = new Set(['IN_PROGRESS']);
  }
  return stages.filter((stage) => {
    if (!allowedStatuses.has(stage.status)) return false;
    const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
    if (poolCount <= 0) return false;
    if (!screenMode && allowEmptyPools) return true;
    return (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0);
  });
};

export const filterBracketsForView = (
  viewMode: LiveViewMode,
  viewStatus: LiveViewStatus,
  brackets?: LiveViewBracket[],
  screenMode = false
) => {
  const bracketList = brackets || [];
  if (!isBracketsView(viewMode)) {
    return bracketList;
  }
  if (screenMode) {
    return bracketList.filter(
      (bracket) => bracket.status === 'IN_PROGRESS' && (bracket.entries?.length ?? 0) > 0
    );
  }
  if (viewStatus !== 'FINISHED') {
    return bracketList.filter((bracket) => (bracket.entries?.length ?? 0) > 0);
  }
  return bracketList.filter(
    (bracket) => bracket.status === 'COMPLETED'
      && (bracket.matches?.length || 0) > 0
      && (bracket.entries?.length ?? 0) > 0
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
