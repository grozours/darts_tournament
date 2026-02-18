export type PoolQueueBase<TItem> = {
  poolId: string;
  stageNumber: number;
  poolNumber: number;
  progress: number;
  matches: TItem[];
};

type BuildPoolQueuesOptions<TStage, TPool, TMatch> = {
  stages: TStage[];
  getPools: (stage: TStage) => TPool[] | undefined;
  getPoolId: (pool: TPool) => string;
  getStageNumber: (stage: TStage) => number;
  getPoolNumber: (pool: TPool) => number;
  getMatches: (pool: TPool) => TMatch[] | undefined;
  isMatchCompletedOrInProgress: (match: TMatch) => boolean;
  isMatchInProgress: (match: TMatch) => boolean;
  onInProgressMatch: (match: TMatch) => void;
};

export const buildPoolQueues = <TStage, TPool, TMatch, TItem>(
  options: BuildPoolQueuesOptions<TStage, TPool, TMatch>
): PoolQueueBase<TItem>[] => {
  const {
    stages,
    getPools,
    getPoolId,
    getStageNumber,
    getPoolNumber,
    getMatches,
    isMatchCompletedOrInProgress,
    isMatchInProgress,
    onInProgressMatch,
  } = options;
  const poolQueues: PoolQueueBase<TItem>[] = [];

  for (const stage of stages) {
    for (const pool of getPools(stage) ?? []) {
      const matches = getMatches(pool) ?? [];
      const completedOrInProgress = matches.filter(isMatchCompletedOrInProgress).length;
      poolQueues.push({
        poolId: getPoolId(pool),
        stageNumber: getStageNumber(stage),
        poolNumber: getPoolNumber(pool),
        progress: completedOrInProgress,
        matches: [],
      });
      for (const match of matches) {
        if (isMatchInProgress(match)) {
          onInProgressMatch(match);
        }
      }
    }
  }

  return poolQueues;
};

export const collectActiveFromMatches = <TMatch>(
  matches: TMatch[] | undefined,
  isMatchInProgress: (match: TMatch) => boolean,
  onActiveMatch: (match: TMatch) => void
) => {
  for (const match of matches ?? []) {
    if (isMatchInProgress(match)) {
      onActiveMatch(match);
    }
  }
};

export const interleavePools = <TItem>(queues: PoolQueueBase<TItem>[]) => {
  const ordered: TItem[] = [];
  const comparePools = (a: PoolQueueBase<TItem>, b: PoolQueueBase<TItem>) => {
    if (a.progress !== b.progress) return a.progress - b.progress;
    if (a.stageNumber !== b.stageNumber) return a.stageNumber - b.stageNumber;
    return a.poolNumber - b.poolNumber;
  };

  while (queues.some((queue) => queue.matches.length > 0)) {
    const nextPool = [...queues]
      .filter((queue) => queue.matches.length > 0)
      .toSorted(comparePools)[0];
    if (!nextPool) break;
    const nextMatch = nextPool.matches.shift();
    if (!nextMatch) break;
    ordered.push(nextMatch);
    nextPool.progress += 1;
  }

  return ordered;
};
