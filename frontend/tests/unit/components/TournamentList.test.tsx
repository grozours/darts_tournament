import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import TournamentList from '../../../src/components/tournament-list';

const mockFetchPlayers = vi.fn();
const mockRegisterPlayer = vi.fn();
const mockFetchPoolStages = vi.fn();
const mockFetchBrackets = vi.fn();
const mockLoginWithRedirect = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

vi.mock('../../../src/services/tournament-service', () => ({
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
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

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
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
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
    const tournamentDetailsPromise = Promise.resolve({
      ...tournamentsPayload.tournaments[0],
      logoUrl: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z').toISOString(),
    });
    const fetchResponse = {
      ok: true,
      json: vi.fn(async () => tournamentsPayload),
    };
    const fetchDetailsResponse = {
      ok: true,
      json: vi.fn(async () => tournamentDetailsPromise),
    };
    const fetchResponsePromise = Promise.resolve(fetchResponse);
    const fetchDetailsPromise = Promise.resolve(fetchDetailsResponse);
    (globalThis.fetch as any)
      .mockReturnValueOnce(fetchResponsePromise)
      .mockReturnValueOnce(fetchDetailsPromise);

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

    const registerPromise = Promise.resolve(undefined);
    const refreshPlayersPromise = Promise.resolve([]);
    mockRegisterPlayer.mockReturnValueOnce(registerPromise);
    mockFetchPlayers.mockReturnValueOnce(refreshPlayersPromise);

    fireEvent.click(registrationScope.getByRole('button', { name: /add player|ajouter un joueur/i }));

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
      expect(screen.queryByText(/loading players|chargement des joueurs/i)).not.toBeInTheDocument();
    });
  });
});
