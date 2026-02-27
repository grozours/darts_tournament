import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoFillTournamentPlayers,
  usePlayerAutoFillMutation,
  usePlayerCheckInMutations,
  usePlayerRegistrationMutations,
} from '../../../../src/components/tournament-list/tournament-players-actions';

const registerTournamentPlayer = vi.fn();
const fetchTournamentPlayers = vi.fn();
const fetchDoublettes = vi.fn();
const fetchEquipes = vi.fn();
const createDoublette = vi.fn();
const createEquipe = vi.fn();
const registerDoublette = vi.fn();
const registerEquipe = vi.fn();
const removeTournamentPlayer = vi.fn();
const updateTournamentPlayer = vi.fn();
const updateTournamentPlayerCheckIn = vi.fn();
const buildAutoFillRegistrations = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  registerTournamentPlayer: (...args: unknown[]) => registerTournamentPlayer(...args),
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
  fetchDoublettes: (...args: unknown[]) => fetchDoublettes(...args),
  fetchEquipes: (...args: unknown[]) => fetchEquipes(...args),
  createDoublette: (...args: unknown[]) => createDoublette(...args),
  createEquipe: (...args: unknown[]) => createEquipe(...args),
  registerDoublette: (...args: unknown[]) => registerDoublette(...args),
  registerEquipe: (...args: unknown[]) => registerEquipe(...args),
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
    fetchTournamentPlayers.mockReset();
    fetchDoublettes.mockReset();
    fetchEquipes.mockReset();
    createDoublette.mockReset();
    createEquipe.mockReset();
    registerDoublette.mockReset();
    registerEquipe.mockReset();
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

  it('autofills DOUBLE tournaments by creating and registering doublettes', async () => {
    fetchDoublettes.mockResolvedValue([]);
    buildAutoFillRegistrations.mockReturnValue({
      registrations: [
        { firstName: 'P1', lastName: 'L1' },
        { firstName: 'P2', lastName: 'L2' },
        { firstName: 'P3', lastName: 'L3' },
        { firstName: 'P4', lastName: 'L4' },
      ],
      error: undefined,
    });
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1' },
      { playerId: 'p2' },
      { playerId: 'p3' },
      { playerId: 'p4' },
    ]);
    createDoublette
      .mockResolvedValueOnce({ id: 'd1' })
      .mockResolvedValueOnce({ id: 'd2' });

    await autoFillTournamentPlayers({
      tournament: {
        id: 't1',
        format: 'DOUBLE',
        totalParticipants: 2,
      } as never,
      players: [],
      token: 'token',
    });

    expect(registerTournamentPlayer).toHaveBeenCalledTimes(4);
    expect(createDoublette).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        captainPlayerId: 'p1',
        memberPlayerIds: ['p1', 'p2'],
      }),
      'token'
    );
    expect(createDoublette).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        captainPlayerId: 'p3',
        memberPlayerIds: ['p3', 'p4'],
      }),
      'token'
    );
    expect(registerDoublette).toHaveBeenCalledWith('t1', 'd1', 'token');
    expect(registerDoublette).toHaveBeenCalledWith('t1', 'd2', 'token');
  });

  it('autofills TEAM tournaments by creating and registering equipes', async () => {
    fetchEquipes.mockResolvedValue([]);
    buildAutoFillRegistrations.mockReturnValue({
      registrations: [
        { firstName: 'P1', lastName: 'L1' },
        { firstName: 'P2', lastName: 'L2' },
        { firstName: 'P3', lastName: 'L3' },
        { firstName: 'P4', lastName: 'L4' },
      ],
      error: undefined,
    });
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1' },
      { playerId: 'p2' },
      { playerId: 'p3' },
      { playerId: 'p4' },
    ]);
    createEquipe.mockResolvedValue({ id: 'e1' });

    await autoFillTournamentPlayers({
      tournament: {
        id: 't2',
        format: 'TEAM_4_PLAYER',
        totalParticipants: 1,
      } as never,
      players: [],
      token: 'token',
    });

    expect(registerTournamentPlayer).toHaveBeenCalledTimes(4);
    expect(createEquipe).toHaveBeenCalledWith(
      't2',
      expect.objectContaining({
        captainPlayerId: 'p1',
        memberPlayerIds: ['p1', 'p2', 'p3', 'p4'],
      }),
      'token'
    );
    expect(registerEquipe).toHaveBeenCalledWith('t2', 'e1', 'token');
  });
});
