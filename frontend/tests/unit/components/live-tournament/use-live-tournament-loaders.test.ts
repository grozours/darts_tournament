import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentLoaders from '../../../../src/components/live-tournament/use-live-tournament-loaders';

const fetchTournamentLiveViewMock = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: (...arguments_: unknown[]) => fetchTournamentLiveViewMock(...arguments_),
}));

describe('useLiveTournamentLoaders', () => {
  const getSafeAccessToken = vi.fn(async () => 'token');
  const toUrl = (input: RequestInfo | URL) => {
    if (input instanceof URL) return input.toString();
    if (typeof input === 'string') return input;
    return input.url;
  };

  beforeEach(() => {
    fetchTournamentLiveViewMock.mockReset();
    getSafeAccessToken.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('retries TOURNAMENT_NOT_LIVE errors for single tournament and then succeeds', async () => {
    vi.useFakeTimers();
    fetchTournamentLiveViewMock
      .mockRejectedValueOnce({ code: 'TOURNAMENT_NOT_LIVE' })
      .mockResolvedValueOnce({ id: 't1' });

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      tournamentId: 't1',
      isAggregateView: false,
    }));

    const promise = act(async () => {
      const pending = result.current.reloadLiveViews();
      await vi.advanceTimersByTimeAsync(1200);
      await pending;
    });

    await promise;

    expect(fetchTournamentLiveViewMock).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeUndefined();
    expect(result.current.liveViews).toEqual([{ id: 't1' }]);

    vi.useRealTimers();
  });

  it('sets user-facing error when single tournament loading fails', async () => {
    fetchTournamentLiveViewMock.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      tournamentId: 't1',
      isAggregateView: false,
    }));

    await act(async () => {
      await result.current.reloadLiveViews({ showLoader: false });
    });

    expect(result.current.error).toBe('boom');
  });

  it('loads aggregate views across status list and de-duplicates tournaments by id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url.includes('status=LIVE')) {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ id: 't1', status: 'LIVE' }] }),
        } as Response;
      }
      if (url.includes('status=OPEN')) {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ id: 't1', status: 'OPEN' }, { id: 't2', status: 'OPEN' }] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ tournaments: [{ id: 't3', status: 'SIGNATURE' }] }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    fetchTournamentLiveViewMock.mockImplementation(async (id: string) => ({ id }));

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      viewMode: 'pool-stages',
      isAggregateView: true,
    }));

    await act(async () => {
      await result.current.reloadLiveViews();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchTournamentLiveViewMock).toHaveBeenCalledTimes(4);
    expect(result.current.liveViews.map((view) => view.id).sort((left, right) => left.localeCompare(right))).toEqual(['t1', 't2', 't3']);
  });
});
