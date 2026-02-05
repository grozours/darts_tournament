import { describe, it, expect } from 'vitest';
import { getVisibleLiveViews, resolveEmptyLiveCopy } from '../../../src/utils/liveViewHelpers';

describe('LiveTournament helpers', () => {
  it('filters live views for pool stages', () => {
    const views = [
      {
        id: 'one',
        name: 'One',
        status: 'LIVE',
        poolStages: [
          { id: 'stage-1', stageNumber: 1, name: 'Stage 1', status: 'IN_PROGRESS', pools: [{ id: 'pool-1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS' }] },
        ],
        brackets: [],
      },
      {
        id: 'two',
        name: 'Two',
        status: 'LIVE',
        poolStages: [],
        brackets: [],
      },
    ];

    const visible = getVisibleLiveViews('pool-stages', views as any);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('one');
  });

  it('returns empty copy for pool-stages view', () => {
    const t = (key: string) => key;
    expect(resolveEmptyLiveCopy('pool-stages', t)).toBe('live.nonePoolStages');
  });
});
