import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useTargetsViewDerived from '../../../../src/components/targets-view/use-targets-view-derived';

const buildMatchMaps = vi.fn();
const buildSharedTargets = vi.fn();
const buildGlobalMatchQueue = vi.fn();

vi.mock('../../../../src/components/targets-view/match-maps', () => ({
  buildMatchMaps: (...args: unknown[]) => buildMatchMaps(...args),
  buildSharedTargets: (...args: unknown[]) => buildSharedTargets(...args),
}));

vi.mock('../../../../src/components/targets-view/queue-helpers', () => ({
  buildGlobalMatchQueue: (...args: unknown[]) => buildGlobalMatchQueue(...args),
}));

describe('useTargetsViewDerived', () => {
  it('filters active live views and applies tournament scope', () => {
    buildMatchMaps.mockReturnValue({
      matchByTargetId: new Map([['target-1', { id: 'm1' }]]),
      matchById: new Map([['m1', { id: 'm1' }]]),
      matchDetailsById: new Map([['m1', { id: 'm1' }]]),
      matchTournamentById: new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]),
    });
    buildSharedTargets.mockReturnValue([{ id: 'target-1' }]);
    buildGlobalMatchQueue.mockReturnValue([{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }]);

    const liveViews = [
      { id: 't1', name: 'Cup', status: 'LIVE' },
      { id: 't2', name: 'League', status: 'completed' },
      { id: 't3', name: 'Open', status: 'live' },
    ] as never;

    const { result } = renderHook(() => useTargetsViewDerived({
      liveViews,
      tournamentId: 't1',
      t: (key: string) => key,
      groupNameByPlayerIdByTournament: new Map(),
    }));

    expect(result.current.scopedViews).toHaveLength(1);
    expect(result.current.scopedViews[0]?.id).toBe('t1');
    expect(result.current.sharedTargets).toEqual([{ id: 'target-1' }]);
    expect(result.current.queueItems).toHaveLength(6);
    expect(result.current.queuePreview).toHaveLength(5);

    expect(buildMatchMaps).toHaveBeenCalledWith(
      [{ id: 't1', name: 'Cup', status: 'LIVE' }],
      expect.any(Function),
      expect.any(Map)
    );
  });

  it('uses all active views when tournament scope is undefined', () => {
    buildMatchMaps.mockReturnValue({
      matchByTargetId: new Map(),
      matchById: new Map(),
      matchDetailsById: new Map(),
      matchTournamentById: new Map(),
    });
    buildSharedTargets.mockReturnValue([]);
    buildGlobalMatchQueue.mockReturnValue([]);

    const liveViews = [
      { id: 't1', status: 'LIVE' },
      { id: 't2', status: 'IN_PROGRESS' },
      { id: 't3', status: undefined },
    ] as never;

    const { result } = renderHook(() => useTargetsViewDerived({
      liveViews,
      tournamentId: undefined,
      t: (key: string) => key,
    }));

    expect(result.current.scopedViews).toEqual([{ id: 't1', status: 'LIVE' }]);
    expect(result.current.queuePreview).toEqual([]);
  });
});
