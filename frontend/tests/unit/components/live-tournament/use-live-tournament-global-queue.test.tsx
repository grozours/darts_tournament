import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentGlobalQueue from '../../../../src/components/live-tournament/use-live-tournament-global-queue';

const buildMatchQueue = vi.fn();
const filterPoolStagesForView = vi.fn();

vi.mock('../../../../src/components/live-tournament/queue-utilities', () => ({
  buildMatchQueue: (...args: unknown[]) => buildMatchQueue(...args),
}));

vi.mock('../../../../src/components/live-tournament/view-utilities', () => ({
  filterPoolStagesForView: (...args: unknown[]) => filterPoolStagesForView(...args),
}));

describe('useLiveTournamentGlobalQueue', () => {
  beforeEach(() => {
    buildMatchQueue.mockReset();
    filterPoolStagesForView.mockReset();
  });

  it('returns empty queue when global queue should be hidden', () => {
    const { result } = renderHook(() => useLiveTournamentGlobalQueue({
      viewMode: 'live',
      displayedLiveViews: [{ id: 't1', name: 'A', status: 'OPEN' }],
      selectedLiveTournamentId: 't1',
      visibleLiveViewsCount: 1,
    }));

    expect(result.current.showGlobalQueue).toBe(false);
    expect(result.current.globalQueue).toEqual([]);
  });

  it('builds queue for sorted views when global queue is visible', () => {
    filterPoolStagesForView.mockReturnValue([{ id: 'stage-1' }]);
    buildMatchQueue
      .mockReturnValueOnce([{ matchId: 'm1' }])
      .mockReturnValueOnce([{ matchId: 'm2' }]);

    const { result } = renderHook(() => useLiveTournamentGlobalQueue({
      viewMode: 'live',
      viewStatus: 'OPEN',
      displayedLiveViews: [
        { id: 't2', name: 'B', status: 'OPEN', poolStages: [] },
        { id: 't1', name: 'A', status: 'OPEN', poolStages: [] },
      ],
      selectedLiveTournamentId: 'ALL',
      visibleLiveViewsCount: 2,
      allowEmptyPools: true,
      screenMode: false,
    }));

    expect(result.current.showGlobalQueue).toBe(true);
    expect(buildMatchQueue).toHaveBeenCalledTimes(2);
    expect(result.current.globalQueue).toEqual([{ matchId: 'm1' }, { matchId: 'm2' }]);
  });
});
