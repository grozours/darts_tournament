import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentData from '../../../../src/components/live-tournament/use-live-tournament-data';

const liveTournamentLoadersMock = vi.fn();

vi.mock('../../../../src/components/live-tournament/use-live-tournament-loaders', () => ({
  default: (...args: unknown[]) => liveTournamentLoadersMock(...args),
}));

describe('useLiveTournamentData', () => {
  beforeEach(() => {
    liveTournamentLoadersMock.mockReset();
  });

  it('forwards parameters and returns loader state', () => {
    const setError = vi.fn();
    const reloadLiveViews = vi.fn(async () => undefined);
    liveTournamentLoadersMock.mockReturnValue({
      liveViews: [{ id: 't1' }],
      loading: true,
      error: 'boom',
      setError,
      reloadLiveViews,
    });

    const getSafeAccessToken = vi.fn(async () => 'token');
    const { result } = renderHook(() => useLiveTournamentData({
      getSafeAccessToken,
      viewMode: 'live',
      viewStatus: 'LIVE',
      tournamentId: 't1',
      isAggregateView: false,
    }));

    expect(liveTournamentLoadersMock).toHaveBeenCalledWith({
      getSafeAccessToken,
      viewMode: 'live',
      viewStatus: 'LIVE',
      tournamentId: 't1',
      isAggregateView: false,
    });
    expect(result.current.liveViews).toEqual([{ id: 't1' }]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe('boom');
    expect(result.current.setError).toBe(setError);
    expect(result.current.reloadLiveViews).toBe(reloadLiveViews);
  });
});
