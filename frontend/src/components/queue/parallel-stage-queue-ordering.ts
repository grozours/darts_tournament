import { interleavePools, type PoolQueueBase } from './pool-queue-utilities';

type StageLike = {
  status?: string;
  pools?: Array<{ id: string }>;
};

export const orderPoolQueuesByParallelStageGroups = <TStage extends StageLike, TItem>(
  poolStages: TStage[],
  poolQueues: PoolQueueBase<TItem>[],
  buildGroups: (stages: TStage[]) => TStage[][]
) => {
  const inProgressStages = poolStages.filter((stage) => stage.status === 'IN_PROGRESS');
  if (inProgressStages.length === 0) {
    return interleavePools(poolQueues);
  }

  const groups = buildGroups(inProgressStages);
  const queueByPoolId = new Map(poolQueues.map((queue) => [queue.poolId, queue]));
  const ordered: TItem[] = [];

  for (const group of groups) {
    const groupQueues = group.flatMap((stage) => (
      (stage.pools ?? [])
        .map((pool) => queueByPoolId.get(pool.id))
        .filter((queue): queue is PoolQueueBase<TItem> => Boolean(queue))
    ));
    ordered.push(...interleavePools(groupQueues));
  }

  return ordered;
};