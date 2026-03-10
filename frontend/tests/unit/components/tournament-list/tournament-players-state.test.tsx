import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPlayerForm,
  usePlayersEditHandlers,
  usePlayersFetch,
  usePlayersState,
} from '../../../../src/components/tournament-list/tournament-players-state';

const fetchTournamentPlayers = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
}));

describe('tournament-players-state hooks', () => {
  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
  });

  it('resets players state to defaults', () => {
    const { result } = renderHook(() => usePlayersState());

    act(() => {
      result.current.setPlayers([{ playerId: 'p1', name: 'Player One' }] as never);
      result.current.setPlayersError('error');
      result.current.setEditingPlayerId('p1');
      result.current.setIsConfirmingAll(true);
      result.current.setPlayerForm({ firstName: 'A', lastName: 'B' });
      result.current.resetPlayersState();
    });

    expect(result.current.players).toEqual([]);
    expect(result.current.playersError).toBeUndefined();
    expect(result.current.editingPlayerId).toBeUndefined();
    expect(result.current.isConfirmingAll).toBe(false);
    expect(result.current.playerForm).toEqual(emptyPlayerForm);
  });

  it('fetches players successfully', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player One' }]);
    const setPlayers = vi.fn();
    const setPlayersError = vi.fn();
    const setPlayersLoading = vi.fn();

    const { result } = renderHook(() => usePlayersFetch({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      setPlayers,
      setPlayersError,
      setPlayersLoading,
    }));

    await act(async () => {
      await result.current('t1');
    });

    expect(fetchTournamentPlayers).toHaveBeenCalledWith('t1', 'token');
    expect(setPlayers).toHaveBeenCalledWith([{ playerId: 'p1', name: 'Player One' }]);
    expect(setPlayersError).toHaveBeenCalledWith(undefined);
  });

  it('sets translated fetch error on failure', async () => {
    fetchTournamentPlayers.mockRejectedValue(new Error('boom'));
    const setPlayersError = vi.fn();

    const { result } = renderHook(() => usePlayersFetch({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      setPlayers: vi.fn(),
      setPlayersError,
      setPlayersLoading: vi.fn(),
    }));

    await act(async () => {
      await result.current('t1');
    });

    expect(setPlayersError).toHaveBeenLastCalledWith('boom');
  });

  it('starts and cancels player edit with derived first/last names', () => {
    const setEditingPlayerId = vi.fn();
    const setPlayerForm = vi.fn();
    const setPlayersError = vi.fn();

    const { result } = renderHook(() => usePlayersEditHandlers({
      setEditingPlayerId,
      setPlayerForm,
      setPlayersError,
    }));

    act(() => {
      result.current.startEditPlayer({
        playerId: 'p1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        skillLevel: 'INTERMEDIATE',
      } as never);
    });

    expect(setEditingPlayerId).toHaveBeenCalledWith('p1');
    expect(setPlayerForm).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      skillLevel: 'INTERMEDIATE',
    }));

    act(() => {
      result.current.cancelEditPlayer();
    });

    expect(setEditingPlayerId).toHaveBeenCalledWith(undefined);
    expect(setPlayerForm).toHaveBeenCalledWith(emptyPlayerForm);
  });
});
