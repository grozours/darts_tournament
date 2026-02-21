import { describe, it, expect } from 'vitest';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import { getVisibleLiveViews, resolveEmptyLiveCopy } from '../../../src/utils/live-view-helpers';

const translate = (key: string) => key;

describe('LiveTournament helpers', () => {
  it('filters live views for pool stages', () => {
    const views: LiveViewData[] = [
      {
        id: 'one',
        name: 'One',
        status: 'LIVE',
        poolStages: [
          {
            id: 'stage-1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'IN_PROGRESS',
            pools: [
              {
                id: 'pool-1',
                poolNumber: 1,
                name: 'Pool 1',
                status: 'IN_PROGRESS',
                assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
              },
            ],
          },
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

    const visible = getVisibleLiveViews('pool-stages', views);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('one');
  });

  it('returns empty copy for pool-stages view', () => {
    expect(resolveEmptyLiveCopy('pool-stages', translate)).toBe('live.nonePoolStages');
  });
});
