import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePlayerAutoFillMutation,
  usePlayerCheckInMutations,
  usePlayerRegistrationMutations,
} from '../../../../src/components/tournament-list/tournament-players-actions';

const registerTournamentPlayer = vi.fn();
const removeTournamentPlayer = vi.fn();
const updateTournamentPlayer = vi.fn();
const updateTournamentPlayerCheckIn = vi.fn();
const buildAutoFillRegistrations = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  registerTournamentPlayer: (...args: unknown[]) => registerTournamentPlayer(...args),
  removeTournamentPlayer: (...args: unknown[]) => removeTournamentPlayer(...args),
  updateTournamentPlayer: (...args: unknown[]) => updateTournamentPlayer(...args),
  updateTournamentPlayerCheckIn: (...args: unknown[]) => updateTournamentPlayerCheckIn(...args),
}));

vi.mock('../../../../src/components/tournament-list/auto-fill-utilities', () => ({
  buildAutoFillRegistrations: (...args: unknown[]) => buildAutoFillRegistrations(...args),
}));

describe('tournament-players-actions hooks', () => {
  beforeEach(() => {
    registerTournamentPlayer.mockReset();
    removeTournamentPlayer.mockReset();
    updateTournamentPlayer.mockReset();
    updateTournamentPlayerCheckIn.mockReset();
    buildAutoFillRegistrations.mockReset();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('registers player and validates required names', async () => {
    const setPlayersError = vi.fn();
    const fetchPlayers = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: ' ', lastName: '' },
      editingPlayerId: undefined,
      fetchPlayers,
      cancelEditPlayer: vi.fn(),
      setPlayersError,
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.registerPlayer();
    });
    expect(setPlayersError).toHaveBeenCalledWith('First and last name are required');

    const { result: ok } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: ' John ', lastName: ' Doe ', email: 'x@y.com' },
      editingPlayerId: undefined,
      fetchPlayers,
      cancelEditPlayer: vi.fn(),
      setPlayersError: vi.fn(),
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await ok.current.registerPlayer();
    });

    expect(registerTournamentPlayer).toHaveBeenCalledWith('t1', expect.objectContaining({
      firstName: 'John',
      lastName: 'Doe',
      email: 'x@y.com',
    }), 'token');
  });

  it('updates and removes players', async () => {
    const fetchPlayers = vi.fn(async () => undefined);
    const cancelEditPlayer = vi.fn();

    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: 'Jane', lastName: 'Doe' },
      editingPlayerId: 'p1',
      fetchPlayers,
      cancelEditPlayer,
      setPlayersError: vi.fn(),
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.savePlayerEdit();
      await result.current.removePlayer('p1');
    });

    expect(updateTournamentPlayer).toHaveBeenCalledWith('t1', 'p1', expect.any(Object), 'token');
    expect(removeTournamentPlayer).toHaveBeenCalledWith('t1', 'p1', 'token');
    expect(cancelEditPlayer).toHaveBeenCalledTimes(1);
  });

  it('toggles check-in and confirms all players', async () => {
    const fetchPlayers = vi.fn(async () => undefined);
    const refreshTournamentDetails = vi.fn(async () => undefined);

    const { result } = renderHook(() => usePlayerCheckInMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [
        { playerId: 'p1', checkedIn: false },
        { playerId: 'p2', checkedIn: true },
      ] as never,
      fetchPlayers,
      refreshTournamentDetails,
      setPlayersError: vi.fn(),
      setCheckingInPlayerId: vi.fn(),
      setIsConfirmingAll: vi.fn(),
    }));

    await act(async () => {
      await result.current.togglePlayerCheckIn({ playerId: 'p1', checkedIn: false } as never);
      await result.current.confirmAllPlayers();
    });

    expect(updateTournamentPlayerCheckIn).toHaveBeenCalledWith('t1', 'p1', true, 'token');
    expect(refreshTournamentDetails).toHaveBeenCalledWith('t1');
  });

  it('autofills players and handles utility error', async () => {
    buildAutoFillRegistrations
      .mockReturnValueOnce({ registrations: [], error: 'no slots' })
      .mockReturnValueOnce({ registrations: [{ firstName: 'A', lastName: 'B' }], error: undefined });

    const setPlayersError = vi.fn();
    const fetchPlayers = vi.fn(async () => undefined);

    const { result } = renderHook(() => usePlayerAutoFillMutation({
      t: (key: string) => key,
      editingTournament: { id: 't1', totalParticipants: 2, format: 'SINGLE' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [],
      fetchPlayers,
      setPlayersError,
      setIsAutoFillingPlayers: vi.fn(),
    }));

    await act(async () => {
      await result.current.autoFillPlayers();
    });
    expect(setPlayersError).toHaveBeenCalledWith('no slots');

    await act(async () => {
      await result.current.autoFillPlayers();
    });
    expect(registerTournamentPlayer).toHaveBeenCalledWith('t1', { firstName: 'A', lastName: 'B' }, 'token');
  });
});
