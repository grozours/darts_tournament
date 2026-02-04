import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TournamentList from '../../../src/components/TournamentList';

const mockFetchPlayers = vi.fn();
const mockRegisterPlayer = vi.fn();
const mockFetchPoolStages = vi.fn();
const mockFetchBrackets = vi.fn();

vi.mock('../../../src/services/tournamentService', () => ({
  updateTournament: vi.fn(),
  updateTournamentStatus: vi.fn(),
  fetchTournamentPlayers: (...args: any[]) => mockFetchPlayers(...args),
  registerTournamentPlayer: (...args: any[]) => mockRegisterPlayer(...args),
  updateTournamentPlayer: vi.fn(),
  removeTournamentPlayer: vi.fn(),
  fetchPoolStages: (...args: any[]) => mockFetchPoolStages(...args),
  fetchBrackets: (...args: any[]) => mockFetchBrackets(...args),
  fetchPoolStagePools: vi.fn(),
  updatePoolAssignments: vi.fn(),
}));

vi.mock('../../../src/auth/optionalAuth', () => ({
  useOptionalAuth: () => ({
    enabled: false,
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    getAccessTokenSilently: vi.fn(),
  }),
}));

describe('TournamentList - player registration', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockFetchPlayers.mockResolvedValue([]);
    mockFetchPoolStages.mockResolvedValue([]);
    mockFetchBrackets.mockResolvedValue([]);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      const message = args[0];
      if (typeof message === 'string' && message.includes('not wrapped in act')) {
        return;
      }
      console.warn(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders player registration form and submits new player', async () => {
    const user = userEvent.setup();

    const tournamentsPayload = {
      tournaments: [
        {
          id: 'tournament-1',
          name: 'Registration Open Tournament',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          startTime: new Date('2026-04-10T10:00:00.000Z').toISOString(),
          endTime: new Date('2026-04-10T18:00:00.000Z').toISOString(),
          targetCount: 2,
        },
      ],
    };
    const tournamentsPromise = Promise.resolve(tournamentsPayload);
    const tournamentDetailsPromise = Promise.resolve({
      ...tournamentsPayload.tournaments[0],
      logoUrl: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z').toISOString(),
    });
    const fetchResponse = {
      ok: true,
      json: vi.fn(() => tournamentsPromise),
    };
    const fetchDetailsResponse = {
      ok: true,
      json: vi.fn(() => tournamentDetailsPromise),
    };
    (globalThis.fetch as any)
      .mockResolvedValueOnce(fetchResponse)
      .mockResolvedValueOnce(fetchDetailsResponse);

    await act(async () => {
      render(<TournamentList />);
      await tournamentsPromise;
    });

    await waitFor(() => {
      expect(screen.queryByText(/loading tournaments/i)).not.toBeInTheDocument();
    });

    await screen.findByText(/registration open tournament/i);

    const initialPlayersPromise = Promise.resolve([]);
    mockFetchPlayers.mockReturnValueOnce(initialPlayersPromise);
    mockFetchPoolStages.mockResolvedValueOnce([]);
    mockFetchBrackets.mockResolvedValueOnce([]);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    await act(async () => {
      await initialPlayersPromise;
    });

    await screen.findByText(/player registration/i);
    await waitFor(() => {
      expect(mockFetchPlayers.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/loading players/i)).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/first name/i), 'Grace');
    await user.type(screen.getByLabelText(/last name/i), 'Hopper');

    const registerPromise = Promise.resolve(undefined);
    const refreshPlayersPromise = Promise.resolve([]);
    mockRegisterPlayer.mockReturnValueOnce(registerPromise);
    mockFetchPlayers.mockReturnValueOnce(refreshPlayersPromise);

    await user.click(screen.getByRole('button', { name: /add player/i }));

    await act(async () => {
      await registerPromise;
      await refreshPlayersPromise;
    });

    await waitFor(() => {
      expect(mockRegisterPlayer).toHaveBeenCalledWith(
        'tournament-1',
        expect.objectContaining({
          firstName: 'Grace',
          lastName: 'Hopper',
        }),
        undefined
      );
      expect(mockFetchPlayers.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/loading players/i)).not.toBeInTheDocument();
    });
  });
});
