import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoFillTournamentPlayers,
  confirmAllTournamentPlayers,
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
      setConfirmAllProgress: vi.fn(),
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
      setAutoFillProgress: vi.fn(),
    }));

    await act(async () => {
      await result.current.autoFillPlayers();
    });
    expect(setPlayersError).toHaveBeenCalledWith('no slots');

    await act(async () => {
      await result.current.autoFillPlayers();
    });
    expect(registerTournamentPlayer).toHaveBeenCalledTimes(1);
    const [, autoPlayerPayload, playerToken] = registerTournamentPlayer.mock.calls[0] ?? [];
    expect(playerToken).toBe('token');
    expect(autoPlayerPayload).toEqual(expect.objectContaining({
      firstName: 'A',
      lastName: 'B',
      skillLevel: expect.stringMatching(/^(BEGINNER|INTERMEDIATE|EXPERT)$/),
      surname: expect.stringMatching(/^★{1,3}$/),
    }));
    const starsBySkill: Record<string, string> = {
      BEGINNER: '★',
      INTERMEDIATE: '★★',
      EXPERT: '★★★',
    };
    expect(autoPlayerPayload.surname).toBe(starsBySkill[autoPlayerPayload.skillLevel]);
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
      { playerId: 'p1', skillLevel: 'EXPERT' },
      { playerId: 'p2', skillLevel: 'EXPERT' },
      { playerId: 'p3', skillLevel: 'BEGINNER' },
      { playerId: 'p4', skillLevel: 'BEGINNER' },
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
        skillLevel: 'EXPERT',
      }),
      'token'
    );
    expect(createDoublette).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        captainPlayerId: 'p3',
        memberPlayerIds: ['p3', 'p4'],
        skillLevel: 'BEGINNER',
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
      { playerId: 'p1', skillLevel: 'EXPERT' },
      { playerId: 'p2', skillLevel: 'EXPERT' },
      { playerId: 'p3', skillLevel: 'BEGINNER' },
      { playerId: 'p4', skillLevel: 'BEGINNER' },
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
        skillLevel: 'INTERMEDIATE',
      }),
      'token'
    );
    expect(registerEquipe).toHaveBeenCalledWith('t2', 'e1', 'token');
  });

  it('throws when SINGLE tournament has no remaining slot', async () => {
    await expect(autoFillTournamentPlayers({
      tournament: {
        id: 't-single-full',
        format: 'SINGLE',
        totalParticipants: 1,
      } as never,
      players: [{ playerId: 'p1' }] as never,
      token: 'token',
    })).rejects.toThrow('All spots are already filled.');
  });

  it('throws when group tournament has no remaining group slots', async () => {
    fetchDoublettes.mockResolvedValue([
      { id: 'd1', isRegistered: true, members: [{ playerId: 'p1' }, { playerId: 'p2' }] },
    ]);

    await expect(autoFillTournamentPlayers({
      tournament: {
        id: 't-double-full',
        format: 'DOUBLE',
        totalParticipants: 1,
      } as never,
      players: [{ playerId: 'p1' }, { playerId: 'p2' }] as never,
      token: 'token',
    })).rejects.toThrow('All spots are already filled.');
  });

  it('throws when group tournament cannot build a complete auto-group', async () => {
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-existing',
        isRegistered: false,
        members: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }],
      },
    ]);

    await expect(autoFillTournamentPlayers({
      tournament: {
        id: 't-double-incomplete',
        format: 'DOUBLE',
        totalParticipants: 2,
      } as never,
      players: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }] as never,
      token: 'token',
    })).rejects.toThrow('Not enough available slots to create a complete group automatically.');
  });

  it('does nothing when confirming all but everyone is already checked-in', async () => {
    const onProgress = vi.fn();

    await confirmAllTournamentPlayers({
      tournament: { id: 't-confirm' } as never,
      players: [
        { playerId: 'p1', checkedIn: true },
        { playerId: 'p2', checkedIn: true },
      ] as never,
      token: 'token',
      onProgress,
    });

    expect(updateTournamentPlayerCheckIn).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('skips remove when user cancels confirmation', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: 'Jane', lastName: 'Doe' },
      editingPlayerId: undefined,
      fetchPlayers: vi.fn(async () => undefined),
      cancelEditPlayer: vi.fn(),
      setPlayersError: vi.fn(),
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.removePlayer('p1');
    });

    expect(removeTournamentPlayer).not.toHaveBeenCalled();
  });

  it('returns early when no editing tournament is selected', async () => {
    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: 'Jane', lastName: 'Doe' },
      editingPlayerId: 'p1',
      fetchPlayers: vi.fn(async () => undefined),
      cancelEditPlayer: vi.fn(),
      setPlayersError: vi.fn(),
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.registerPlayer();
      await result.current.savePlayerEdit();
      await result.current.removePlayer('p1');
    });

    expect(registerTournamentPlayer).not.toHaveBeenCalled();
    expect(updateTournamentPlayer).not.toHaveBeenCalled();
    expect(removeTournamentPlayer).not.toHaveBeenCalled();
  });

  it('returns early for empty confirm-all list and missing tournament in hooks', async () => {
    const { result } = renderHook(() => usePlayerCheckInMutations({
      t: (key: string) => key,
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [] as never,
      fetchPlayers: vi.fn(async () => undefined),
      refreshTournamentDetails: vi.fn(async () => undefined),
      setPlayersError: vi.fn(),
      setCheckingInPlayerId: vi.fn(),
      setIsConfirmingAll: vi.fn(),
      setConfirmAllProgress: vi.fn(),
    }));

    await act(async () => {
      await result.current.confirmAllPlayers();
      await result.current.togglePlayerCheckIn({ playerId: 'p1', checkedIn: false } as never);
    });

    expect(updateTournamentPlayerCheckIn).not.toHaveBeenCalled();
  });

  it('sets translated errors when check-in and auto-fill fail with non-Error', async () => {
    updateTournamentPlayerCheckIn.mockRejectedValue('boom');
    const checkinError = vi.fn();
    const { result: checkin } = renderHook(() => usePlayerCheckInMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [{ playerId: 'p1', checkedIn: false }] as never,
      fetchPlayers: vi.fn(async () => undefined),
      refreshTournamentDetails: vi.fn(async () => undefined),
      setPlayersError: checkinError,
      setCheckingInPlayerId: vi.fn(),
      setIsConfirmingAll: vi.fn(),
      setConfirmAllProgress: vi.fn(),
    }));

    await act(async () => {
      await checkin.current.togglePlayerCheckIn({ playerId: 'p1', checkedIn: false } as never);
    });

    expect(checkinError).toHaveBeenCalledWith('edit.error.failedUpdateCheckIn');

    buildAutoFillRegistrations.mockReturnValue({ registrations: [{ firstName: 'A', lastName: 'B' }], error: undefined });
    registerTournamentPlayer.mockRejectedValue('nope');
    const autofillError = vi.fn();
    const { result: autofill } = renderHook(() => usePlayerAutoFillMutation({
      t: (key: string) => key,
      editingTournament: { id: 't1', totalParticipants: 2, format: 'SINGLE' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [],
      fetchPlayers: vi.fn(async () => undefined),
      setPlayersError: autofillError,
      setIsAutoFillingPlayers: vi.fn(),
      setAutoFillProgress: vi.fn(),
    }));

    await act(async () => {
      await autofill.current.autoFillPlayers();
    });

    expect(autofillError).toHaveBeenCalledWith('edit.error.failedAutoFillPlayers');
  });

  it('handles save/remove/confirm-all failures with translated fallback for non-Error', async () => {
    updateTournamentPlayer.mockRejectedValue('save-failed');
    removeTournamentPlayer.mockRejectedValue('remove-failed');
    updateTournamentPlayerCheckIn.mockRejectedValue('confirm-failed');

    const setPlayersError = vi.fn();
    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: 'Jane', lastName: 'Doe' },
      editingPlayerId: 'p1',
      fetchPlayers: vi.fn(async () => undefined),
      cancelEditPlayer: vi.fn(),
      setPlayersError,
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.savePlayerEdit();
      await result.current.removePlayer('p1');
    });

    expect(setPlayersError).toHaveBeenCalledWith('edit.error.failedUpdatePlayer');
    expect(setPlayersError).toHaveBeenCalledWith('edit.error.failedRemovePlayer');

    const checkinError = vi.fn();
    const { result: checkin } = renderHook(() => usePlayerCheckInMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [{ playerId: 'p1', checkedIn: false }] as never,
      fetchPlayers: vi.fn(async () => undefined),
      refreshTournamentDetails: vi.fn(async () => undefined),
      setPlayersError: checkinError,
      setCheckingInPlayerId: vi.fn(),
      setIsConfirmingAll: vi.fn(),
      setConfirmAllProgress: vi.fn(),
    }));

    await act(async () => {
      await checkin.current.confirmAllPlayers();
    });

    expect(checkinError).toHaveBeenCalledWith('edit.error.failedConfirmAllPlayers');
  });

  it('returns early for missing edit player id and missing auto-fill tournament', async () => {
    const updateError = vi.fn();
    const { result } = renderHook(() => usePlayerRegistrationMutations({
      t: (key: string) => key,
      editingTournament: { id: 't1' } as never,
      getSafeAccessToken: vi.fn(async () => 'token'),
      playerForm: { firstName: 'Jane', lastName: 'Doe' },
      editingPlayerId: undefined,
      fetchPlayers: vi.fn(async () => undefined),
      cancelEditPlayer: vi.fn(),
      setPlayersError: updateError,
      setPlayerForm: vi.fn(),
      setIsRegisteringPlayer: vi.fn(),
    }));

    await act(async () => {
      await result.current.savePlayerEdit();
    });
    expect(updateTournamentPlayer).not.toHaveBeenCalled();

    const { result: autofill } = renderHook(() => usePlayerAutoFillMutation({
      t: (key: string) => key,
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => 'token'),
      players: [],
      fetchPlayers: vi.fn(async () => undefined),
      setPlayersError: vi.fn(),
      setIsAutoFillingPlayers: vi.fn(),
      setAutoFillProgress: vi.fn(),
    }));

    await act(async () => {
      await autofill.current.autoFillPlayers();
    });
    expect(registerTournamentPlayer).not.toHaveBeenCalled();
  });

  it('handles group autofill edge failures after loading players', async () => {
    fetchDoublettes.mockResolvedValue([]);
    buildAutoFillRegistrations.mockReturnValue({
      registrations: [{ firstName: 'A', lastName: 'B' }],
      error: undefined,
    });

    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1' }]);
    await expect(autoFillTournamentPlayers({
      tournament: { id: 'tg1', format: 'DOUBLE', totalParticipants: 1 } as never,
      players: [],
      token: 'token',
    })).rejects.toThrow('Not enough available players to create groups automatically.');

    fetchDoublettes.mockResolvedValue([]);
    buildAutoFillRegistrations.mockReturnValue({
      registrations: [],
      error: undefined,
    });
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1' },
      { playerId: undefined },
    ]);

    await expect(autoFillTournamentPlayers({
      tournament: { id: 'tg2', format: 'DOUBLE', totalParticipants: 1 } as never,
      players: [{ playerId: 'p1' }, { playerId: 'p2' }] as never,
      token: 'token',
    })).rejects.toThrow('Failed to build complete groups for auto-fill.');
  });

  it('supports single autofill with empty registrations and no progress callback', async () => {
    buildAutoFillRegistrations.mockReturnValue({ registrations: [], error: undefined });
    const onProgress = vi.fn();

    await autoFillTournamentPlayers({
      tournament: { id: 'ts1', format: 'SINGLE', totalParticipants: 3 } as never,
      players: [] as never,
      token: 'token',
      onProgress,
    });

    expect(onProgress).not.toHaveBeenCalled();
  });
});
