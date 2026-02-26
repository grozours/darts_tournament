import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useLiveTournamentPlayerIds from '../../../../src/components/live-tournament/use-live-tournament-player-ids';

const fetchTournamentPlayers = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
}));

describe('useLiveTournamentPlayerIds', () => {
  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
  });

  it('returns empty map when user is not authenticated', async () => {
    const liveViews = [{ id: 't1', name: 'T1', status: 'OPEN' }] as const;
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

    const liveViews = [{ id: 't1', name: 'T1', status: 'OPEN' }] as const;
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

  it('keeps map empty when fetch fails', async () => {
    fetchTournamentPlayers.mockRejectedValue(new Error('boom'));

    const liveViews = [{ id: 't1', name: 'T1', status: 'OPEN' }] as const;
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
});
