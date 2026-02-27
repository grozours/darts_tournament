import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import TournamentList from '../../../src/components/tournament-list';

const toRequestUrl = (input: RequestInfo | URL) => {
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof input === 'string') {
    return input;
  }
  return input.url;
};

const mockFetchPlayers = vi.fn();
const mockRegisterPlayer = vi.fn();
const mockFetchPoolStages = vi.fn();
const mockFetchBrackets = vi.fn();
const mockFetchTournamentTargets = vi.fn();
const mockUpdateTournamentStatus = vi.fn();
const mockFetchTournamentPresets = vi.fn();
const mockAutoFillTournamentPlayers = vi.fn();
const mockConfirmAllTournamentPlayers = vi.fn();
const mockLoginWithRedirect = vi.fn();
const mockGetAccessTokenSilently = vi.fn();
const adminState = { isAdmin: true };
const authState = {
  enabled: false,
  isAuthenticated: false,
  isLoading: false,
};
const originalLocation = globalThis.window.location;

vi.mock('../../../src/services/tournament-service', () => ({
  updateTournament: vi.fn(),
  updateTournamentStatus: (...arguments_: unknown[]) => mockUpdateTournamentStatus(...arguments_),
  fetchTournamentPresets: (...arguments_: unknown[]) => mockFetchTournamentPresets(...arguments_),
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
    enabled: authState.enabled,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
}));


vi.mock('../../../src/components/tournament-list/tournament-players-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/components/tournament-list/tournament-players-actions')>();
  return {
    ...actual,
    autoFillTournamentPlayers: (...arguments_: unknown[]) => mockAutoFillTournamentPlayers(...arguments_),
    confirmAllTournamentPlayers: (...arguments_: unknown[]) => mockConfirmAllTournamentPlayers(...arguments_),
  };
});

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
    adminState.isAdmin = true;
    authState.enabled = false;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    mockGetAccessTokenSilently.mockReset();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    globalThis.window?.history.pushState({}, '', '/');
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
    mockFetchTournamentPresets.mockResolvedValue([]);
    mockAutoFillTournamentPlayers.mockResolvedValue(undefined);
    mockConfirmAllTournamentPlayers.mockResolvedValue(undefined);
    vi.stubGlobal('alert', vi.fn());
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
      const url = toRequestUrl(input);
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

    await Promise.resolve();

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

    await registerPromise;
    await refreshPlayersPromise;

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

  it('hides draft tournaments for non-admin users and skips loading presets', async () => {
    adminState.isAdmin = false;

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [
          {
            id: 'draft-1',
            name: 'Hidden Draft',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'DRAFT',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
          {
            id: 'open-1',
            name: 'Visible Open',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'OPEN',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
        ],
      }),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByText('Visible Open')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hidden Draft')).not.toBeInTheDocument();
    expect(mockFetchTournamentPresets).not.toHaveBeenCalled();
  });

  it('shows auto action buttons on root cards for admin open and signature tournaments', async () => {
    adminState.isAdmin = true;

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [
          {
            id: 'open-1',
            name: 'Open Cup',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'OPEN',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
          {
            id: 'sig-1',
            name: 'Signature Cup',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'SIGNATURE',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
        ],
      }),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByText('Open Cup')).toBeInTheDocument();
      expect(screen.getByText('Signature Cup')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /auto-fill players|remplir automatiquement/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto signature|signature auto/i })).toBeInTheDocument();
  });

  it('triggers admin root-card actions for open/signature workflows', async () => {
    adminState.isAdmin = true;

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [
          {
            id: 'draft-1',
            name: 'Draft Cup',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'DRAFT',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
          {
            id: 'open-1',
            name: 'Open Cup',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'OPEN',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
          {
            id: 'sig-1',
            name: 'Signature Cup',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'SIGNATURE',
            durationType: 'FULL_DAY',
            targetCount: 2,
          },
        ],
      }),
    });
    mockFetchPlayers.mockResolvedValue([]);

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByText('Draft Cup')).toBeInTheDocument();
      expect(screen.getByText('Open Cup')).toBeInTheDocument();
      expect(screen.getByText('Signature Cup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /ouvrir aux inscriptions/i }));
    fireEvent.click(screen.getByRole('button', { name: /ouvrir la signature/i }));
    fireEvent.click(screen.getByRole('button', { name: /remplir automatiquement/i }));
    fireEvent.click(screen.getByRole('button', { name: /signature auto/i }));

    await waitFor(() => {
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('draft-1', 'OPEN', undefined);
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('open-1', 'SIGNATURE', undefined);
      expect(mockFetchPlayers).toHaveBeenCalledWith('open-1', undefined);
      expect(mockFetchPlayers).toHaveBeenCalledWith('sig-1', undefined);
      expect(mockAutoFillTournamentPlayers).toHaveBeenCalled();
      expect(mockConfirmAllTournamentPlayers).toHaveBeenCalled();
    });
  });

  it('shows session checking loader while auth is loading', () => {
    authState.enabled = true;
    authState.isAuthenticated = false;
    authState.isLoading = true;

    render(<TournamentList />);

    expect(screen.getByText(/checkingSession|vérification/i)).toBeInTheDocument();
  });

  it('shows retry block on tournaments fetch error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry|réessayer/i })).toBeInTheDocument();
    });
  });

  it('renders empty-state subtitle when no tournament is available', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByText(/tournaments.none.subtitle|aucun tournoi/i)).toBeInTheDocument();
    });
  });

  it('hides automatic card actions when status filter is draft', async () => {
    adminState.isAdmin = true;
    globalThis.window?.history.pushState({}, '', '/?status=DRAFT');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'draft-1',
          name: 'Draft Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'DRAFT',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByText('Draft Cup')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /auto-fill players|remplir automatiquement/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto signature|signature auto/i })).not.toBeInTheDocument();
  });

  it('retries loading tournaments when clicking retry button', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        text: async () => 'backend failed',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tournaments: [{
            id: 'open-1',
            name: 'Recovered Open',
            format: 'SINGLE',
            totalParticipants: 8,
            status: 'OPEN',
            durationType: 'FULL_DAY',
            targetCount: 2,
          }],
        }),
      });

    render(<TournamentList />);

    const retryButton = await screen.findByRole('button', { name: /retry|réessayer/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Recovered Open')).toBeInTheDocument();
    });

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows tournaments loading indicator while fetch is pending', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    render(<TournamentList />);

    expect(await screen.findByText(/tournaments.loading|chargement des tournois/i)).toBeInTheDocument();
  });

  it('alerts with explicit error when opening registration from card fails', async () => {
    adminState.isAdmin = true;
    mockUpdateTournamentStatus.mockRejectedValueOnce(new Error('open failed'));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'draft-1',
          name: 'Draft Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'DRAFT',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Draft Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir aux inscriptions/i }));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith('open failed');
    });
  });

  it('alerts with fallback key when opening signature fails with non-error value', async () => {
    adminState.isAdmin = true;
    mockUpdateTournamentStatus.mockRejectedValueOnce('failed');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir la signature/i }));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.any(String));
    });
  });

  it('alerts with fallback key when auto-fill action fails', async () => {
    adminState.isAdmin = true;
    mockFetchPlayers.mockResolvedValueOnce([]);
    mockAutoFillTournamentPlayers.mockRejectedValueOnce('failed');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /remplir automatiquement/i }));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.any(String));
    });
  });

  it('alerts with fallback key when confirm-all action fails', async () => {
    adminState.isAdmin = true;
    mockFetchPlayers.mockResolvedValueOnce([]);
    mockConfirmAllTournamentPlayers.mockRejectedValueOnce('failed');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'sig-1',
          name: 'Signature Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'SIGNATURE',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Signature Cup');
    fireEvent.click(screen.getByRole('button', { name: /signature auto/i }));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.any(String));
    });
  });

  it('passes fetched players and tournament payload to auto-fill action', async () => {
    adminState.isAdmin = true;
    const players = [{ id: 'p1', firstName: 'A', lastName: 'B' }];
    mockFetchPlayers.mockResolvedValueOnce(players);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /remplir automatiquement/i }));

    await waitFor(() => {
      expect(mockAutoFillTournamentPlayers).toHaveBeenCalledWith(expect.objectContaining({
        players,
        tournament: expect.objectContaining({ id: 'open-1' }),
      }));
    });
  });

  it('passes fetched players and tournament payload to confirm-all action', async () => {
    adminState.isAdmin = true;
    const players = [{ id: 'p2', firstName: 'C', lastName: 'D' }];
    mockFetchPlayers.mockResolvedValueOnce(players);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'sig-1',
          name: 'Signature Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'SIGNATURE',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Signature Cup');
    fireEvent.click(screen.getByRole('button', { name: /signature auto/i }));

    await waitFor(() => {
      expect(mockConfirmAllTournamentPlayers).toHaveBeenCalledWith(expect.objectContaining({
        players,
        tournament: expect.objectContaining({ id: 'sig-1' }),
      }));
    });
  });

  it('uses access token for admin card status actions when authenticated', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-123');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'draft-1',
          name: 'Draft Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'DRAFT',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Draft Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir aux inscriptions/i }));

    await waitFor(() => {
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('draft-1', 'OPEN', 'token-123');
    });
  });

  it('falls back to undefined token when access token retrieval fails', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockRejectedValueOnce(new Error('token failed'));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'draft-1',
          name: 'Draft Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'DRAFT',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Draft Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir aux inscriptions/i }));

    await waitFor(() => {
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('draft-1', 'OPEN', undefined);
    });
  });

  it('hides signature auto action when filtered to open status', async () => {
    adminState.isAdmin = true;
    globalThis.window?.history.pushState({}, '', '/?status=OPEN');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');

    expect(screen.queryByRole('button', { name: /signature auto/i })).not.toBeInTheDocument();
  });

  it('does not request access token on initial render when auth is disabled', async () => {
    authState.enabled = false;
    authState.isAuthenticated = false;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });

    render(<TournamentList />);

    await screen.findByText(/tournaments.none.subtitle|aucun tournoi/i);
    expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
  });

  it('redirects edit page to tournament-presets when admin has no quick presets', async () => {
    adminState.isAdmin = true;
    mockFetchTournamentPresets.mockResolvedValueOnce([]);
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
    const locationAssign = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });
    const { fetchResponse, fetchDetailsResponse } = buildTournamentFetchResponses();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toRequestUrl(input);
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
      expect(locationAssign).toHaveBeenCalled();
    });
  });

  it('does not redirect edit page when quick presets are available', async () => {
    adminState.isAdmin = true;
    mockFetchTournamentPresets.mockResolvedValueOnce([
      {
        id: 'preset-1',
        name: 'Preset One',
        presetType: 'custom',
        totalParticipants: 16,
        targetCount: 4,
        templateConfig: {
          format: 'SINGLE',
          stages: [],
          brackets: [],
          routingRules: [],
        },
      },
    ]);
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
    const locationAssign = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });
    const { fetchResponse, fetchDetailsResponse } = buildTournamentFetchResponses();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toRequestUrl(input);
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
      expect(mockFetchTournamentPresets).toHaveBeenCalled();
    });
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it('keeps edit page available when quick presets fetch fails', async () => {
    adminState.isAdmin = true;
    mockFetchTournamentPresets.mockRejectedValueOnce(new Error('preset failed'));
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
    const { fetchResponse, fetchDetailsResponse } = buildTournamentFetchResponses();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toRequestUrl(input);
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
      expect(screen.getByRole('heading', { name: /edit tournament|modifier le tournoi/i })).toBeInTheDocument();
    });
    expect(mockFetchTournamentPresets).toHaveBeenCalled();
  });

  it('shows signature auto action and hides auto-fill when filtered to signature', async () => {
    adminState.isAdmin = true;
    globalThis.window?.history.pushState({}, '', '/?status=SIGNATURE');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'sig-1',
          name: 'Signature Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'SIGNATURE',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Signature Cup');

    expect(screen.getByRole('button', { name: /signature auto/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remplir automatiquement/i })).not.toBeInTheDocument();
  });

  it('shows auto-fill action and hides signature auto when filtered to open', async () => {
    adminState.isAdmin = true;
    globalThis.window?.history.pushState({}, '', '/?status=OPEN');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');

    expect(screen.getByRole('button', { name: /remplir automatiquement/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /signature auto/i })).not.toBeInTheDocument();
  });

  it('hides open-signature button when filtered to draft', async () => {
    adminState.isAdmin = true;
    globalThis.window?.history.pushState({}, '', '/?status=DRAFT');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'draft-1',
          name: 'Draft Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'DRAFT',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Draft Cup');

    expect(screen.queryByRole('button', { name: /ouvrir la signature/i })).not.toBeInTheDocument();
  });

  it('uses access token for auto-fill action when authenticated', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-xyz');
    mockFetchPlayers.mockResolvedValueOnce([]);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /remplir automatiquement/i }));

    await waitFor(() => {
      expect(mockFetchPlayers).toHaveBeenCalledWith('open-1', 'token-xyz');
    });
  });

  it('uses access token for confirm-all action when authenticated', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-xyz');
    mockFetchPlayers.mockResolvedValueOnce([]);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'sig-1',
          name: 'Signature Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'SIGNATURE',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Signature Cup');
    fireEvent.click(screen.getByRole('button', { name: /signature auto/i }));

    await waitFor(() => {
      expect(mockFetchPlayers).toHaveBeenCalledWith('sig-1', 'token-xyz');
    });
  });

  it('uses access token for open-signature status update when authenticated', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-xyz');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir la signature/i }));

    await waitFor(() => {
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('open-1', 'SIGNATURE', 'token-xyz');
    });
  });

  it('falls back to undefined token for open-signature when token retrieval fails', async () => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockRejectedValueOnce(new Error('token failed'));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tournaments: [{
          id: 'open-1',
          name: 'Open Cup',
          format: 'SINGLE',
          totalParticipants: 8,
          status: 'OPEN',
          durationType: 'FULL_DAY',
          targetCount: 2,
        }],
      }),
    });

    render(<TournamentList />);
    await screen.findByText('Open Cup');
    fireEvent.click(screen.getByRole('button', { name: /ouvrir la signature/i }));

    await waitFor(() => {
      expect(mockUpdateTournamentStatus).toHaveBeenCalledWith('open-1', 'SIGNATURE', undefined);
    });
  });

  it('redirects to presets from edit page without tournamentId when presets are empty', async () => {
    adminState.isAdmin = true;
    mockFetchTournamentPresets.mockResolvedValueOnce([]);
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament');
    const locationAssign = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });

    render(<TournamentList />);

    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalled();
    });
    expect(String(locationAssign.mock.calls[0]?.[0] ?? '')).toContain('view=tournament-presets');
    expect(String(locationAssign.mock.calls[0]?.[0] ?? '')).not.toContain('tournamentId=');
  });

});
