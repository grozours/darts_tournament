import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentListEditData from '../../../../src/components/tournament-list/use-tournament-list-edit-data';

const fetchMock = vi.fn();

describe('useTournamentListEditData', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads targets only when edit id exists and auth is ready', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const getSafeAccessToken = vi.fn(async () => undefined);
    const setEditingTournament = vi.fn();

    const { rerender } = renderHook((properties: {
      editingTournamentId: string | undefined;
      authEnabled: boolean;
      authLoading: boolean;
      isAuthenticated: boolean;
    }) => useTournamentListEditData({
      ...properties,
      loadTargets,
      getSafeAccessToken,
      setEditingTournament,
    }), {
      initialProps: {
        editingTournamentId: undefined,
        authEnabled: true,
        authLoading: false,
        isAuthenticated: true,
      } as {
        editingTournamentId: string | undefined;
        authEnabled: boolean;
        authLoading: boolean;
        isAuthenticated: boolean;
      },
    });

    expect(loadTargets).not.toHaveBeenCalled();

    rerender({
      editingTournamentId: 't1',
      authEnabled: true,
      authLoading: true,
      isAuthenticated: false,
    });
    expect(loadTargets).not.toHaveBeenCalled();

    rerender({
      editingTournamentId: 't1',
      authEnabled: true,
      authLoading: false,
      isAuthenticated: true,
    });

    await waitFor(() => {
      expect(loadTargets).toHaveBeenCalledWith('t1');
    });
  });

  it('refreshes details with bearer token and merges with current state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'OPEN', location: 'Paris' }),
    });

    const getSafeAccessToken = vi.fn(async () => 'token-1');
    const setEditingTournament = vi.fn();

    const { result } = renderHook(() => useTournamentListEditData({
      editingTournamentId: 't1',
      authEnabled: false,
      authLoading: false,
      isAuthenticated: false,
      loadTargets: vi.fn(async () => undefined),
      getSafeAccessToken,
      setEditingTournament,
    }));

    await act(async () => {
      await result.current.refreshTournamentDetails('t1');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/tournaments/t1', {
      headers: { Authorization: 'Bearer token-1' },
    });

    const updater = setEditingTournament.mock.calls[0]?.[0] as (current: unknown) => unknown;
    expect(updater({ id: 't1', name: 'Cup' })).toEqual({
      id: 't1',
      name: 'Cup',
      status: 'OPEN',
      location: 'Paris',
    });
    expect(updater(undefined)).toEqual({ status: 'OPEN', location: 'Paris' });
  });

  it('uses unauthenticated fetch options and swallows fetch errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 't1' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'bad' }),
    });

    const setEditingTournament = vi.fn();
    const { result } = renderHook(() => useTournamentListEditData({
      editingTournamentId: 't1',
      authEnabled: false,
      authLoading: false,
      isAuthenticated: false,
      loadTargets: vi.fn(async () => undefined),
      getSafeAccessToken: vi.fn(async () => undefined),
      setEditingTournament,
    }));

    await act(async () => {
      await result.current.refreshTournamentDetails('t1');
      await result.current.refreshTournamentDetails('t2');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/tournaments/t1', {});
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tournaments/t2', {});
    expect(setEditingTournament).toHaveBeenCalledTimes(1);
  });
});
