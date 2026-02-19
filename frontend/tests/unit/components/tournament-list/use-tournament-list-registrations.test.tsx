import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useTournamentListRegistrations from '../../../../src/components/tournament-list/use-tournament-list-registrations';

const serviceMocks = vi.hoisted(() => ({
  registerTournamentPlayer: vi.fn(),
  unregisterTournamentPlayer: vi.fn(),
  fetchTournamentPlayers: vi.fn(),
}));

vi.mock('../../../../src/services/tournament-service', () => serviceMocks);

const t = (key: string) => key;

describe('useTournamentListRegistrations', () => {
  const getSafeAccessToken = vi.fn();
  const baseProperties = {
    t,
    tournaments: [{ id: 't1', name: 'Open', status: 'OPEN', format: 'X01', totalParticipants: 8 }],
    isAuthenticated: true,
    isAdmin: false,
    user: { email: 'player@example.com', name: 'Ava Archer' },
    getSafeAccessToken,
  };

  beforeEach(() => {
    getSafeAccessToken.mockReset();
    serviceMocks.registerTournamentPlayer.mockReset();
    serviceMocks.unregisterTournamentPlayer.mockReset();
    serviceMocks.fetchTournamentPlayers.mockReset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    globalThis.alert = vi.fn();
    globalThis.confirm = vi.fn();
  });

  it('loads existing registrations for a signed-in user', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ players: [{ email: 'player@example.com' }] }),
    });

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
      { firstName: 'Ava', lastName: 'Archer', email: 'player@example.com' },
      'token'
    );
    expect(result.current.userRegistrations.has('t1')).toBe(true);
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
});
