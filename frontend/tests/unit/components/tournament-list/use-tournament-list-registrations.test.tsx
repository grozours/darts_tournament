import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import useTournamentListRegistrations from '../../../../src/components/tournament-list/use-tournament-list-registrations';

const serviceMocks = vi.hoisted(() => ({
  fetchDoublettes: vi.fn(),
  fetchEquipes: vi.fn(),
  registerTournamentPlayer: vi.fn(),
  registerDoublette: vi.fn(),
  registerEquipe: vi.fn(),
  unregisterTournamentPlayer: vi.fn(),
  unregisterDoublette: vi.fn(),
  unregisterEquipe: vi.fn(),
  fetchTournamentPlayers: vi.fn(),
}));

vi.mock('../../../../src/services/tournament-service', () => serviceMocks);

const t = (key: string) => key;

const getSafeAccessToken = vi.fn();
const baseProperties = {
  t,
  tournaments: [{ id: 't1', name: 'Open', status: 'OPEN', format: 'X01', totalParticipants: 8 }],
  isAuthenticated: true,
  isAdmin: false,
  user: { email: 'player@example.com', name: 'Ava Archer' },
  getSafeAccessToken,
  refreshTournaments: vi.fn(),
};

const resetRegistrationsMocks = () => {
  getSafeAccessToken.mockReset();
  serviceMocks.fetchDoublettes.mockReset();
  serviceMocks.fetchEquipes.mockReset();
  serviceMocks.registerTournamentPlayer.mockReset();
  serviceMocks.registerDoublette.mockReset();
  serviceMocks.registerEquipe.mockReset();
  serviceMocks.unregisterTournamentPlayer.mockReset();
  serviceMocks.unregisterDoublette.mockReset();
  serviceMocks.unregisterEquipe.mockReset();
  serviceMocks.fetchTournamentPlayers.mockReset();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  });
  globalThis.alert = vi.fn();
  globalThis.confirm = vi.fn();
};

describe('useTournamentListRegistrations - self registration', () => {
  beforeEach(resetRegistrationsMocks);

  it('loads existing registrations for a signed-in user', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    serviceMocks.fetchTournamentPlayers.mockResolvedValue([{ email: 'player@example.com', playerId: 'p1' }]);

    const { result } = renderHook(() => useTournamentListRegistrations(baseProperties));

    await waitFor(() => {
      expect(result.current.userRegistrations.has('t1')).toBe(true);
    });
  });

  it('alerts when registering without authentication', async () => {
    const { result } = renderHook(() => useTournamentListRegistrations({
      ...baseProperties,
      isAuthenticated: false,
    }));

    await act(async () => {
      await result.current.handleRegisterSelf('t1');
    });

    expect(globalThis.alert).toHaveBeenCalledWith('auth.signInRequired');
  });

  it('registers the user when authenticated', async () => {
    getSafeAccessToken.mockResolvedValue('token');

    const { result } = renderHook(() => useTournamentListRegistrations(baseProperties));

    await act(async () => {
      await result.current.handleRegisterSelf('t1');
    });

    expect(serviceMocks.registerTournamentPlayer).toHaveBeenCalledWith(
      't1',
      { firstName: 'Ava', lastName: 'Archer', surname: 'Ava A', email: 'player@example.com' },
      'token'
    );
    expect(result.current.userRegistrations.has('t1')).toBe(true);
  });

  it('shows error when registering self without email', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    const { result } = renderHook(() => useTournamentListRegistrations({
      ...baseProperties,
      user: { name: 'No Email' },
    }));

    await act(async () => {
      await result.current.handleRegisterSelf('t1');
    });

    expect(serviceMocks.registerTournamentPlayer).not.toHaveBeenCalled();
    expect(globalThis.alert).toHaveBeenCalledWith('Email not found in user profile. Please ensure your account has an email address.');
  });

  it('skips unregister when confirmation is rejected', async () => {
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useTournamentListRegistrations(baseProperties));

    await act(async () => {
      await result.current.handleUnregisterSelf('t1');
    });

    expect(serviceMocks.unregisterTournamentPlayer).not.toHaveBeenCalled();
  });

  it('unregisters the user when confirmed', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    serviceMocks.fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1', email: 'player@example.com' },
    ]);

    const { result } = renderHook(() => useTournamentListRegistrations(baseProperties));

    await act(async () => {
      await result.current.handleUnregisterSelf('t1');
    });

    expect(serviceMocks.unregisterTournamentPlayer).toHaveBeenCalledWith('t1', 'p1', 'token');
    expect(result.current.userRegistrations.has('t1')).toBe(false);
  });

  it('handles unregister self when user is not registered', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    serviceMocks.fetchTournamentPlayers.mockResolvedValue([]);

    const { result } = renderHook(() => useTournamentListRegistrations(baseProperties));

    await act(async () => {
      await result.current.handleUnregisterSelf('t1');
    });

    expect(serviceMocks.unregisterTournamentPlayer).not.toHaveBeenCalled();
    expect(globalThis.alert).toHaveBeenCalledWith('You are not registered for this tournament');
  });

});

describe('useTournamentListRegistrations - group registration', () => {
  beforeEach(resetRegistrationsMocks);

  it('registers and unregisters doublette group as captain', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    serviceMocks.fetchTournamentPlayers.mockResolvedValue([{ email: 'player@example.com', playerId: 'p1' }]);
    serviceMocks.fetchDoublettes.mockResolvedValue([
      {
        id: 'g1',
        captainPlayerId: 'p1',
        memberCount: 2,
        isRegistered: false,
        members: [{ playerId: 'p1' }, { playerId: 'p2' }],
      },
    ]);

    const properties = {
      ...baseProperties,
      tournaments: [{ id: 't2', name: 'Double Cup', status: 'OPEN', format: 'DOUBLE', totalParticipants: 16 }],
    };
    const { result } = renderHook(() => useTournamentListRegistrations(properties));

    await waitFor(() => {
      expect(result.current.userGroupStatuses.t2?.groupId).toBe('g1');
    });

    await act(async () => {
      await result.current.handleRegisterGroup('t2');
    });

    expect(serviceMocks.registerDoublette).toHaveBeenCalledWith('t2', 'g1', 'token');
    expect(result.current.userRegistrations.has('t2')).toBe(true);

    await act(async () => {
      await result.current.handleUnregisterGroup('t2');
    });

    expect(serviceMocks.unregisterDoublette).not.toHaveBeenCalled();

    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    await act(async () => {
      await result.current.handleUnregisterGroup('t2');
    });

    expect(serviceMocks.unregisterDoublette).toHaveBeenCalledWith('t2', 'g1', 'token');
    expect(result.current.userRegistrations.has('t2')).toBe(false);
  });

  it('allows admin to unregister a registered team even if not captain', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    serviceMocks.fetchTournamentPlayers.mockResolvedValue([{ email: 'player@example.com', playerId: 'p1' }]);
    serviceMocks.fetchEquipes.mockResolvedValue([
      {
        id: 'team1',
        captainPlayerId: 'p9',
        memberCount: 4,
        isRegistered: true,
        members: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }, { playerId: 'p4' }],
      },
    ]);

    const properties = {
      ...baseProperties,
      isAdmin: true,
      tournaments: [{ id: 't3', name: 'Team Cup', status: 'OPEN', format: 'TEAM_4_PLAYER', totalParticipants: 16 }],
    };
    const { result } = renderHook(() => useTournamentListRegistrations(properties));

    await waitFor(() => {
      expect(result.current.userGroupStatuses.t3?.isGroupRegistered).toBe(true);
    });

    await act(async () => {
      await result.current.handleUnregisterGroup('t3');
    });

    expect(serviceMocks.unregisterEquipe).toHaveBeenCalledWith('t3', 'team1', 'token');
  });

  it('requires authentication to register group', async () => {
    const properties = {
      ...baseProperties,
      isAuthenticated: false,
      tournaments: [{ id: 't2', name: 'Double Cup', status: 'OPEN', format: 'DOUBLE', totalParticipants: 16 }],
    };
    const { result } = renderHook(() => useTournamentListRegistrations(properties));

    await act(async () => {
      await result.current.handleRegisterGroup('t2');
    });

    expect(globalThis.alert).toHaveBeenCalledWith('auth.signInRequired');
  });
});
