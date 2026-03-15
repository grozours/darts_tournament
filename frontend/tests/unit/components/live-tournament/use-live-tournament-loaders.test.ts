import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentLoaders from '../../../../src/components/live-tournament/use-live-tournament-loaders';

const fetchTournamentLiveViewMock = vi.fn();
const fetchLiveTournamentSummaryMock = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: (...arguments_: unknown[]) => fetchTournamentLiveViewMock(...arguments_),
  fetchLiveTournamentSummary: (...arguments_: unknown[]) => fetchLiveTournamentSummaryMock(...arguments_),
}));

describe('useLiveTournamentLoaders', () => {
  const getSafeAccessToken = vi.fn(async () => 'token');
  beforeEach(() => {
    fetchTournamentLiveViewMock.mockReset();
    fetchLiveTournamentSummaryMock.mockReset();
    getSafeAccessToken.mockClear();
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

  it('loads aggregate views across status list', async () => {
    fetchLiveTournamentSummaryMock.mockResolvedValue([
      { id: 't1', status: 'LIVE' },
      { id: 't2', status: 'OPEN' },
      { id: 't3', status: 'SIGNATURE' },
    ]);

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      viewMode: 'pool-stages',
      isAggregateView: true,
    }));

    await act(async () => {
      await result.current.reloadLiveViews();
    });

    expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledTimes(1);
    expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE', 'OPEN', 'SIGNATURE'], 'token');
    expect(result.current.liveViews.map((view) => view.id).sort((left, right) => left.localeCompare(right))).toEqual(['t1', 't2', 't3']);
  });

  it('falls back to an available live tournament when requested tournament is not live', async () => {
    vi.useFakeTimers();

    fetchTournamentLiveViewMock.mockImplementation(async (id: string) => {
      if (id === 't1') {
        throw Object.assign(new Error('Tournament is not live yet'), { code: 'TOURNAMENT_NOT_LIVE' });
      }
      return { id };
    });
    fetchLiveTournamentSummaryMock.mockResolvedValue([{ id: 'live-42' }]);

    globalThis.window.history.replaceState({}, '', '/?view=live&tournamentId=t1');
    const replaceStateSpy = vi.spyOn(globalThis.window.history, 'replaceState');

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      tournamentId: 't1',
      isAggregateView: false,
    }));

    await act(async () => {
      const pending = result.current.reloadLiveViews();
      await vi.advanceTimersByTimeAsync(1200 * 4);
      await pending;
    });

    expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE'], 'token');
    expect(fetchTournamentLiveViewMock).toHaveBeenCalledWith('live-42', 'token');
    expect(result.current.error).toBeUndefined();
    expect(result.current.liveViews).toEqual([{ id: 'live-42' }]);
    expect(replaceStateSpy).toHaveBeenCalled();
    expect(globalThis.window.location.search).toContain('tournamentId=live-42');

    replaceStateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps not-live error when no live fallback tournament exists', async () => {
    vi.useFakeTimers();

    fetchTournamentLiveViewMock.mockRejectedValue({ code: 'TOURNAMENT_NOT_LIVE' });
    fetchLiveTournamentSummaryMock.mockResolvedValue([]);

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      tournamentId: 't1',
      isAggregateView: false,
    }));

    await act(async () => {
      const pending = result.current.reloadLiveViews();
      await vi.advanceTimersByTimeAsync(1200 * 4);
      await pending;
    });

    expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE'], 'token');
    expect(result.current.error).toBe('Tournament is not open for live view yet');
    vi.useRealTimers();
  });

  it('sets generic error when aggregate live loading fails with unknown error shape', async () => {
    fetchLiveTournamentSummaryMock.mockRejectedValueOnce({ foo: 'bar' });

    const { result } = renderHook(() => useLiveTournamentLoaders({
      getSafeAccessToken,
      viewMode: 'live',
      isAggregateView: true,
    }));

    await act(async () => {
      await result.current.reloadLiveViews();
    });

    expect(result.current.error).toBe('Failed to load live view');
  });
});
