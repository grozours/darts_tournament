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
});
