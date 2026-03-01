import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useTournamentEditDetails from '../../../../src/components/tournament-list/use-tournament-edit-details';

describe('use-tournament-edit-details', () => {
  it('fetches players only for OPEN and SIGNATURE statuses', async () => {
    const fetchPlayers = vi.fn(async () => undefined);
    const setEditingTournament = vi.fn();

    renderHook(() => useTournamentEditDetails({
      editingTournament: { id: 't-open', status: 'OPEN' } as never,
      getSafeAccessToken: vi.fn(async () => undefined),
      fetchPlayers,
      setEditingTournament,
    }));

    await waitFor(() => {
      expect(fetchPlayers).toHaveBeenCalledWith('t-open');
    });

    fetchPlayers.mockClear();
    renderHook(() => useTournamentEditDetails({
      editingTournament: { id: 't-live', status: 'LIVE' } as never,
      getSafeAccessToken: vi.fn(async () => undefined),
      fetchPlayers,
      setEditingTournament,
    }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPlayers).not.toHaveBeenCalled();
  });

  it('fetchTournamentDetails merges response into existing tournament with auth header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Updated', status: 'OPEN' }),
    } as Response);

    const setEditingTournament = vi.fn((updater) => {
      const current = { id: 't1', name: 'Initial', status: 'DRAFT' };
      return typeof updater === 'function' ? updater(current) : updater;
    });

    const { result } = renderHook(() => useTournamentEditDetails({
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => 'token-1'),
      fetchPlayers: vi.fn(async () => undefined),
      setEditingTournament,
    }));

    await result.current.fetchTournamentDetails('t1');

    expect(fetchMock).toHaveBeenCalledWith('/api/tournaments/t1', {
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(setEditingTournament).toHaveBeenCalled();

    fetchMock.mockRestore();
  });

  it('swallows fetch errors and non-ok responses', async () => {
    const setEditingTournament = vi.fn();
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useTournamentEditDetails({
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => undefined),
      fetchPlayers: vi.fn(async () => undefined),
      setEditingTournament,
    }));

    await result.current.fetchTournamentDetails('t2');
    await result.current.fetchTournamentDetails('t3');

    expect(setEditingTournament).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
