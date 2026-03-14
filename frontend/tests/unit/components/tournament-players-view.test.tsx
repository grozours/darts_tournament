import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockFetchTournamentPlayers = vi.fn();
const mockFetchDoublettes = vi.fn();
const mockFetchEquipes = vi.fn();
const mockUpdateTournamentPlayerCheckIn = vi.fn();
const mockUpdateTournamentPlayer = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

let authEnabled = false;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: authEnabled,
    getAccessTokenSilently: mockGetAccessTokenSilently,
    user: { email: 'player@example.com' },
  }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...arguments_: unknown[]) => mockFetchTournamentPlayers(...arguments_),
  fetchDoublettes: (...arguments_: unknown[]) => mockFetchDoublettes(...arguments_),
  fetchEquipes: (...arguments_: unknown[]) => mockFetchEquipes(...arguments_),
  updateTournamentPlayerCheckIn: (...arguments_: unknown[]) => mockUpdateTournamentPlayerCheckIn(...arguments_),
  updateTournamentPlayer: (...arguments_: unknown[]) => mockUpdateTournamentPlayer(...arguments_),
  removeTournamentPlayer: vi.fn(),
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: true }),
}));

describe('TournamentPlayersView', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    authEnabled = false;
    mockFetchTournamentPlayers.mockReset();
    mockFetchDoublettes.mockReset();
    mockFetchEquipes.mockReset();
    mockUpdateTournamentPlayerCheckIn.mockReset();
    mockUpdateTournamentPlayer.mockReset();
    mockGetAccessTokenSilently.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows an empty state when no tournament id is provided', async () => {
    globalThis.window?.history.pushState({}, '', '/?status=OPEN');

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    expect(screen.getByText('common.noSelection')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toBeInTheDocument();
  });

  it('loads tournament details and players', async () => {
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t1');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't1', name: 'Spring Cup', status: 'SIGNATURE' }),
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
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
      json: async () => ({ id: 't1', name: 'Spring Cup', status: 'SIGNATURE' }),
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
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

  it('renders registered group cards for DOUBLE tournaments', async () => {
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t2');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't2', name: 'Double Cup', status: 'OPEN', format: 'DOUBLE', totalParticipants: 16 }),
    }) as typeof fetch;

    mockFetchDoublettes.mockResolvedValueOnce([
      {
        id: 'd1',
        name: 'Duo One',
        captainPlayerId: 'p1',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'p1', firstName: 'Ava', lastName: 'Archer', joinedAt: new Date().toISOString() },
          { playerId: 'p2', firstName: 'Bea', lastName: 'Bell', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    await waitFor(() => {
      expect(screen.getByText('Double Cup')).toBeInTheDocument();
      expect(screen.getByText('Duo One')).toBeInTheDocument();
      expect(screen.getAllByText((content, element) => {
        const text = element?.textContent ?? content;
        return text.includes('1') && text.includes('/') && text.includes('16') && text.includes('registration.slotsCount');
      }).length).toBeGreaterThan(0);
    });

    expect(mockFetchDoublettes).toHaveBeenCalledWith('t2', undefined);
    expect(mockFetchTournamentPlayers).not.toHaveBeenCalled();
  });

  it('allows admin to edit and save a player from tournament players view', async () => {
    authEnabled = true;
    mockGetAccessTokenSilently.mockResolvedValue('token');
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t-edit');

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/auth/users?')) {
        return {
          ok: true,
          json: async () => ({
            users: [
              { id: 'person-2', firstName: 'Zoe', lastName: 'Zimmer', surname: 'Zoom' },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ id: 't-edit', name: 'Edit Cup', status: 'OPEN', format: 'SINGLE' }),
      } as Response;
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    await screen.findByText('Ava Archer');
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), { target: { value: 'Zoe' } });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), { target: { value: 'Zimmer' } });
    fireEvent.change(screen.getByPlaceholderText('edit.surname'), { target: { value: 'Zoom' } });
    fireEvent.change(screen.getByPlaceholderText('edit.teamName'), { target: { value: 'Comets' } });
    fireEvent.change(screen.getByPlaceholderText('edit.email'), { target: { value: 'zoe@example.com' } });
    fireEvent.change(screen.getByLabelText('Compte associe'), { target: { value: 'Zimmer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zimmer / Zoe / Zoom' }));

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(mockUpdateTournamentPlayer).toHaveBeenCalledWith(
        't-edit',
        'p1',
        expect.objectContaining({
          personId: 'person-2',
          firstName: 'Zoe',
          lastName: 'Zimmer',
          surname: 'Zoom',
          teamName: 'Comets',
          email: 'zoe@example.com',
        }),
        'token'
      );
    });

    expect(screen.getByText('Zoe Zimmer')).toBeInTheDocument();
  });

  it('filters account options and allows clearing account assignment', async () => {
    authEnabled = true;
    mockGetAccessTokenSilently.mockResolvedValue('token');
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t-autocomplete');

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/auth/users?')) {
        return {
          ok: true,
          json: async () => ({
            users: [
              { id: 'person-1', firstName: 'Ava', lastName: 'Archer', surname: 'Ace' },
              { id: 'person-2', firstName: 'Bea', lastName: 'Durand', surname: 'Lynx' },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ id: 't-autocomplete', name: 'Autocomplete Cup', status: 'OPEN', format: 'SINGLE' }),
      } as Response;
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        personId: 'person-1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    await screen.findByText('Ava Archer');
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    expect(screen.getByLabelText('Compte associe')).toHaveValue('Archer / Ava / Ace');

    fireEvent.change(screen.getByLabelText('Compte associe'), { target: { value: 'Durand' } });
    fireEvent.click(screen.getByRole('button', { name: 'Durand / Bea / Lynx' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(mockUpdateTournamentPlayer).toHaveBeenCalledWith(
        't-autocomplete',
        'p1',
        expect.objectContaining({ personId: 'person-2' }),
        'token'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.none' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      const latestCall = mockUpdateTournamentPlayer.mock.calls.at(-1);
      expect(latestCall?.[0]).toBe('t-autocomplete');
      expect(latestCall?.[1]).toBe('p1');
      expect((latestCall?.[2] as { personId?: string } | undefined)?.personId).toBeUndefined();
    });
  });

  it('searches accounts on server when result is missing from initial preload', async () => {
    authEnabled = true;
    mockGetAccessTokenSilently.mockResolvedValue('token');
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t-remote-search');

    const userFetches: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/auth/users?')) {
        userFetches.push(url);

        if (url.includes('q=Durand')) {
          return {
            ok: true,
            json: async () => ({
              users: [
                { id: 'person-2', firstName: 'Bea', lastName: 'Durand', surname: 'Lynx' },
              ],
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            users: [
              { id: 'person-1', firstName: 'Ava', lastName: 'Archer', surname: 'Ace' },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ id: 't-remote-search', name: 'Remote Search Cup', status: 'OPEN', format: 'SINGLE' }),
      } as Response;
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValueOnce([
      {
        playerId: 'p1',
        personId: 'person-1',
        firstName: 'Ava',
        lastName: 'Archer',
        checkedIn: false,
      },
    ]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    await screen.findByText('Ava Archer');
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    expect(screen.queryByRole('button', { name: 'Durand / Bea / Lynx' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Compte associe'), { target: { value: 'Durand' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Durand / Bea / Lynx' })).toBeInTheDocument();
    });

    expect(userFetches.some((url) => url.includes('q=Durand'))).toBe(true);
  });

  it('shows retry button when player loading fails and retries loading', async () => {
    authEnabled = true;
    mockGetAccessTokenSilently.mockResolvedValue('token');
    globalThis.window?.history.pushState({}, '', '/?tournamentId=t-retry');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't-retry', name: 'Retry Cup', status: 'OPEN', format: 'SINGLE' }),
    }) as typeof fetch;

    mockFetchTournamentPlayers
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce([]);

    const { default: TournamentPlayersView } = await import('../../../src/components/tournament-players-view');
    render(<TournamentPlayersView />);

    await screen.findByText('load failed');
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(mockFetchTournamentPlayers).toHaveBeenCalledTimes(2);
    });
  });
});
