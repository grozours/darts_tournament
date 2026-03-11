import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useTargetsViewData from '../../../../src/components/targets-view/use-targets-view-data';

const fetchTournamentLiveViewMock = vi.fn();
const fetchLiveTournamentSummaryMock = vi.fn();
const translate = (key: string) => key;

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: (...args: unknown[]) => fetchTournamentLiveViewMock(...args),
  fetchLiveTournamentSummary: (...args: unknown[]) => fetchLiveTournamentSummaryMock(...args),
}));

describe('useTargetsViewData', () => {
  beforeEach(() => {
    fetchTournamentLiveViewMock.mockReset();
    fetchLiveTournamentSummaryMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a single tournament live view when tournamentId is provided', async () => {
    fetchTournamentLiveViewMock.mockResolvedValue({ id: 't1', name: 'Cup' });
    const getAccessTokenSilently = vi.fn(async () => 'token');

    const { result } = renderHook(() => useTargetsViewData({
      t: translate,
      authEnabled: false,
      getAccessTokenSilently,
      tournamentId: 't1',
    }));

    await waitFor(() => {
      expect(result.current.liveViews).toHaveLength(1);
    });

    expect(fetchTournamentLiveViewMock).toHaveBeenCalledWith('t1', undefined);
    await expect(result.current.getSafeAccessToken()).resolves.toBeUndefined();
  });

  it('filters LIVE tournaments and fetches aggregate views with auth fallback', async () => {
    const getAccessTokenSilently = vi.fn(async () => {
      throw new Error('no token');
    });
    fetchLiveTournamentSummaryMock.mockResolvedValue([
      { id: 't1', name: 'One' },
      { id: 't3', name: 'Three' },
    ]);

    const { result } = renderHook(() => useTargetsViewData({
      t: translate,
      authEnabled: true,
      getAccessTokenSilently,
      tournamentId: undefined,
    }));

    await waitFor(() => {
      expect(result.current.liveViews).toHaveLength(2);
    });

    expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE'], undefined);
  });

  it('throws on aggregate fetch failures and exposes setters', async () => {
    const getAccessTokenSilently = vi.fn(async () => 'token');
    fetchLiveTournamentSummaryMock.mockRejectedValue(new Error('Failed to fetch live tournaments'));

    const { result } = renderHook(() => useTargetsViewData({
      t: translate,
      authEnabled: false,
      getAccessTokenSilently,
      tournamentId: undefined,
    }));

    await act(async () => {
      await expect(result.current.fetchLiveViews()).rejects.toThrow('Failed to fetch live tournaments');
    });

    await act(async () => {
      result.current.setError('manual-error');
      result.current.setLiveViews([{ id: 'manual' } as never]);
    });

    expect(result.current.error).toBe('manual-error');
    expect(result.current.liveViews).toEqual([{ id: 'manual' }]);
  });
});
