import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentPlayersView from '../../../src/components/tournament-players-view';

const mockFetchTournamentPlayers = vi.fn();
const mockUpdateTournamentPlayerCheckIn = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

let authEnabled = false;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: authEnabled,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...arguments_: unknown[]) => mockFetchTournamentPlayers(...arguments_),
  updateTournamentPlayerCheckIn: (...arguments_: unknown[]) => mockUpdateTournamentPlayerCheckIn(...arguments_),
}));

describe('TournamentPlayersView', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    authEnabled = false;
    mockFetchTournamentPlayers.mockReset();
    mockUpdateTournamentPlayerCheckIn.mockReset();
    mockGetAccessTokenSilently.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows an empty state when no tournament id is provided', () => {
    globalThis.window?.history.pushState({}, '', '/?status=OPEN');

    render(<TournamentPlayersView />);

    expect(screen.getByText('common.noSelection')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toBeInTheDocument();
  });

  it('loads tournament details and players', async () => {
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t1');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't1', name: 'Spring Cup' }),
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    render(<TournamentPlayersView />);

    await waitFor(() => {
      expect(screen.getByText('Spring Cup')).toBeInTheDocument();
      expect(screen.getByText('Ava Archer')).toBeInTheDocument();
    });

    expect(mockFetchTournamentPlayers.mock.calls[0]?.[0]).toBe('t1');
  });

  it('confirms player presence when authenticated', async () => {
    authEnabled = true;
    mockGetAccessTokenSilently.mockResolvedValue('token');
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t1');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't1', name: 'Spring Cup' }),
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    render(<TournamentPlayersView />);

    await waitFor(() => {
      expect(screen.getByText('players.confirmPresence')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'players.confirmPresence' }));

    await waitFor(() => {
      expect(mockUpdateTournamentPlayerCheckIn).toHaveBeenCalledWith('t1', 'p1', true, 'token');
    });

    expect(screen.getByText('players.confirmed')).toBeInTheDocument();
  });
});
