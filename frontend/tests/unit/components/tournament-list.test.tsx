import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import TournamentList from '../../../src/components/tournament-list';

const mockFetchPlayers = vi.fn();
const mockRegisterPlayer = vi.fn();
const mockFetchPoolStages = vi.fn();
const mockFetchBrackets = vi.fn();
const mockFetchTournamentTargets = vi.fn();
const mockLoginWithRedirect = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

vi.mock('../../../src/services/tournament-service', () => ({
  updateTournament: vi.fn(),
  updateTournamentStatus: vi.fn(),
  fetchTournamentPlayers: (...arguments_: unknown[]) => mockFetchPlayers(...arguments_),
  registerTournamentPlayer: (...arguments_: unknown[]) => mockRegisterPlayer(...arguments_),
  updateTournamentPlayer: vi.fn(),
  removeTournamentPlayer: vi.fn(),
  fetchPoolStages: (...arguments_: unknown[]) => mockFetchPoolStages(...arguments_),
  fetchBrackets: (...arguments_: unknown[]) => mockFetchBrackets(...arguments_),
  fetchTournamentTargets: (...arguments_: unknown[]) => mockFetchTournamentTargets(...arguments_),
  fetchPoolStagePools: vi.fn(),
  updatePoolAssignments: vi.fn(),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: false,
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

const buildTournamentsPayload = () => ({
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
});

const buildTournamentFetchResponses = () => {
  const tournamentsPayload = buildTournamentsPayload();
  const tournamentDetails = {
    ...tournamentsPayload.tournaments[0],
    createdAt: new Date('2026-04-01T10:00:00.000Z').toISOString(),
  };
  const fetchResponse = {
    ok: true,
    json: vi.fn(async () => tournamentsPayload),
  };
  const fetchDetailsResponse = {
    ok: true,
    json: vi.fn(async () => tournamentDetails),
  };
  return {
    fetchResponse,
    fetchDetailsResponse,
  };
};

describe('TournamentList - player registration', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tournaments: [] }),
      })
    );
    mockFetchPlayers.mockResolvedValue([]);
    mockFetchPoolStages.mockResolvedValue([]);
    mockFetchBrackets.mockResolvedValue([]);
    mockFetchTournamentTargets.mockResolvedValue([]);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...arguments_: unknown[]) => {
      const message = arguments_[0];
      if (typeof message === 'string' && message.includes('not wrapped in act')) {
        return;
      }
      console.warn(...arguments_);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders player registration form and submits new player', async () => {
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
    const { fetchResponse, fetchDetailsResponse } = buildTournamentFetchResponses();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/tournaments') {
        return fetchResponse as unknown as Response;
      }
      if (url === '/api/tournaments/tournament-1') {
        return fetchDetailsResponse as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as unknown as Response;
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(fetchResponse.json).toHaveBeenCalled();
    });

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText(/loading tournaments|chargement des tournois/i)).not.toBeInTheDocument();
    });

    const initialPlayersPromise = Promise.resolve([]);
    mockFetchPlayers.mockReturnValueOnce(initialPlayersPromise);
    mockFetchPoolStages.mockResolvedValueOnce([]);
    mockFetchBrackets.mockResolvedValueOnce([]);

    const registrationHeading = await screen.findByRole('heading', {
      name: /player registration|inscriptions des joueurs/i,
      level: 4,
    });
    const registrationSection =
      registrationHeading.closest('div')?.parentElement?.parentElement ?? document.body;
    const registrationScope = within(registrationSection);
    await waitFor(() => {
      expect(mockFetchPlayers.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/loading players|chargement des joueurs/i)).not.toBeInTheDocument();
    });

    fireEvent.change(registrationScope.getByLabelText(/first name|prénom/i), { target: { value: 'Grace' } });
    fireEvent.change(registrationScope.getByLabelText(/^Nom$|last name/i), { target: { value: 'Hopper' } });

    const registerPromise = Promise.resolve();
    const refreshPlayersPromise = Promise.resolve([]);
    mockRegisterPlayer.mockReturnValueOnce(registerPromise);
    mockFetchPlayers.mockReturnValueOnce(refreshPlayersPromise);

    fireEvent.click(registrationScope.getByRole('button', { name: /add player|ajouter un joueur/i }));

    await act(async () => {
      await registerPromise;
      await refreshPlayersPromise;
    });

    await waitFor(() => {
      const registerCall = mockRegisterPlayer.mock.calls[0] ?? [];
      expect(registerCall[0]).toBe('tournament-1');
      expect(registerCall[1]).toEqual(expect.objectContaining({
        firstName: 'Grace',
        lastName: 'Hopper',
      }));
      expect(mockFetchPlayers.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/loading players|chargement des joueurs/i)).not.toBeInTheDocument();
    });
  });
});
