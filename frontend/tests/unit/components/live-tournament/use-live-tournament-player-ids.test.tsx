import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useLiveTournamentPlayerIds from '../../../../src/components/live-tournament/use-live-tournament-player-ids';

const fetchTournamentPlayers = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
}));

const buildLiveViews = () => [{ id: 't1', name: 'T1', status: 'OPEN' }];

describe('useLiveTournamentPlayerIds', () => {
  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
  });

  it('returns empty map when user is not authenticated', async () => {
    const liveViews = buildLiveViews();
    const getSafeAccessToken = vi.fn(async () => undefined);

    const { result } = renderHook(() => useLiveTournamentPlayerIds({
      liveViews,
      isAuthenticated: false,
      user: { email: 'player@example.com' },
      getSafeAccessToken,
    }));

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({});
    });
  });

  it('loads and maps player ids by tournament', async () => {
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1', name: 'Player One', email: 'player@example.com' },
    ]);

  const liveViews = buildLiveViews();
    const getSafeAccessToken = vi.fn(async () => 'token');

    const { result } = renderHook(() => useLiveTournamentPlayerIds({
      liveViews,
      isAuthenticated: true,
      user: { email: 'player@example.com' },
      getSafeAccessToken,
    }));

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({ t1: 'p1' });
    });
  });

  it('uses fallbackUserEmail when auth user email is unavailable', async () => {
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p1', name: 'Player One', email: 'player@example.com' },
    ]);

  const liveViews = buildLiveViews();
    const getSafeAccessToken = vi.fn(async () => 'token');

    const { result } = renderHook(() => useLiveTournamentPlayerIds({
      liveViews,
      isAuthenticated: false,
      fallbackUserEmail: 'player@example.com',
      getSafeAccessToken,
    }));

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({ t1: 'p1' });
    });
  });

  it('keeps map empty when fetch fails', async () => {
    fetchTournamentPlayers.mockRejectedValue(new Error('boom'));

    const liveViews = buildLiveViews();
    const getSafeAccessToken = vi.fn(async () => 'token');

    const { result } = renderHook(() => useLiveTournamentPlayerIds({
      liveViews,
      isAuthenticated: true,
      user: { email: 'player@example.com' },
      getSafeAccessToken,
    }));

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({});
    });
  });

  it('does not fetch when no email or no live views are available', async () => {
    const getSafeAccessToken = vi.fn(async () => 'token');

    const { result, rerender } = renderHook((properties: { liveViews: Array<{ id: string; name: string; status: string }>; user?: { email?: string } }) => useLiveTournamentPlayerIds({
      liveViews: properties.liveViews,
      isAuthenticated: true,
      user: properties.user,
      getSafeAccessToken,
    }), {
      initialProps: {
        liveViews: [],
        user: { email: 'player@example.com' },
      },
    });

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({});
    });

    rerender({
      liveViews: buildLiveViews(),
      user: {},
    });

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({});
    });

    expect(getSafeAccessToken).not.toHaveBeenCalled();
    expect(fetchTournamentPlayers).not.toHaveBeenCalled();
  });

  it('matches players case-insensitively', async () => {
    fetchTournamentPlayers.mockResolvedValue([
      { playerId: 'p9', name: 'Player Nine', email: 'PLAYER@EXAMPLE.COM' },
    ]);

    const { result } = renderHook(() => useLiveTournamentPlayerIds({
      liveViews: buildLiveViews(),
      isAuthenticated: true,
      user: { email: 'player@example.com' },
      getSafeAccessToken: vi.fn(async () => 'token'),
    }));

    await waitFor(() => {
      expect(result.current.playerIdByTournament).toEqual({ t1: 'p9' });
    });
  });
});
