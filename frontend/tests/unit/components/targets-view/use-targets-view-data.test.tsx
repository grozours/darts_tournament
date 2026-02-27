import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useTargetsViewData from '../../../../src/components/targets-view/use-targets-view-data';

const fetchTournamentLiveViewMock = vi.fn();
const translate = (key: string) => key;

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: (...args: unknown[]) => fetchTournamentLiveViewMock(...args),
}));

describe('useTargetsViewData', () => {
  beforeEach(() => {
    fetchTournamentLiveViewMock.mockReset();
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
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getAccessTokenSilently = vi.fn(async () => {
      throw new Error('no token');
    });
    fetchTournamentLiveViewMock
      .mockResolvedValueOnce({ id: 't1', name: 'One' })
      .mockResolvedValueOnce({ id: 't3', name: 'Three' });

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', status: 'LIVE' },
          { id: 't2', status: 'OPEN' },
          { id: 't3', status: 'live' },
        ],
      }),
    })));

    const { result } = renderHook(() => useTargetsViewData({
      t: translate,
      authEnabled: true,
      getAccessTokenSilently,
      tournamentId: undefined,
    }));

    await waitFor(() => {
      expect(result.current.liveViews).toHaveLength(2);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments?status=LIVE', {});
    expect(fetchTournamentLiveViewMock).toHaveBeenNthCalledWith(1, 't1', undefined);
    expect(fetchTournamentLiveViewMock).toHaveBeenNthCalledWith(2, 't3', undefined);
    expect(warningSpy).toHaveBeenCalled();
  });

  it('throws on aggregate fetch failures and exposes setters', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getAccessTokenSilently = vi.fn(async () => 'token');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })));

    const { result } = renderHook(() => useTargetsViewData({
      t: translate,
      authEnabled: false,
      getAccessTokenSilently,
      tournamentId: undefined,
    }));

    await expect(result.current.fetchLiveViews()).rejects.toThrow('Failed to fetch live tournaments');

    await act(async () => {
      result.current.setError('manual-error');
      result.current.setLiveViews([{ id: 'manual' } as never]);
    });

    expect(result.current.error).toBe('manual-error');
    expect(result.current.liveViews).toEqual([{ id: 'manual' }]);
    expect(errorSpy).toHaveBeenCalled();
  });
});
