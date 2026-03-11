import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app';

const authState = { isAuthenticated: true };
const adminState = { isAdmin: true };
const fetchMatchFormatPresetsMock = vi.fn(async () => []);
const fetchLiveTournamentSummaryMock = vi.fn(async () => []);
const setMatchFormatPresetsMock = vi.fn();
const navigateTo = (url: string) => {
  act(() => {
    globalThis.history.pushState({}, '', url);
    globalThis.dispatchEvent(new PopStateEvent('popstate'));
  });
};
const toUrl = (input: RequestInfo | URL) => {
  if (input instanceof URL) return input.toString();
  if (typeof input === 'string') return input;
  return input.url;
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() })) }));
vi.mock('../../src/components/notifications/use-match-started-notifications', () => ({ default: vi.fn() }));
vi.mock('../../src/services/tournament-service', () => ({
  fetchMatchFormatPresets: (...arguments_: unknown[]) => fetchMatchFormatPresetsMock(...arguments_),
  fetchLiveTournamentSummary: (...arguments_: unknown[]) => fetchLiveTournamentSummaryMock(...arguments_),
}));
vi.mock('../../src/utils/match-format-presets', () => ({
  setMatchFormatPresets: (...arguments_: unknown[]) => setMatchFormatPresetsMock(...arguments_),
}));

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({ lang: 'fr', setLanguage: vi.fn(), t: (key: string) => key }),
}));

vi.mock('../../src/auth/optional-auth', () => ({ useOptionalAuth: () => authState }));
vi.mock('../../src/auth/use-admin-status', () => ({ useAdminStatus: () => adminState }));

vi.mock('../../src/components/app-header', () => ({ default: () => <div>APP_HEADER</div> }));
vi.mock('../../src/components/tournament-list', () => ({ default: () => <div>TOURNAMENT_LIST</div> }));
vi.mock('../../src/components/players-view', () => ({ default: () => <div>PLAYERS_VIEW</div> }));
vi.mock('../../src/components/registration-players', () => ({ default: () => <div>REGISTRATION_PLAYERS</div> }));
vi.mock('../../src/components/live-tournament', () => ({ default: () => <div>LIVE_TOURNAMENT</div> }));
vi.mock('../../src/components/targets-view', () => ({ default: () => <div>TARGETS_VIEW</div> }));
vi.mock('../../src/components/notifications-view', () => ({ default: () => <div>NOTIFICATIONS_VIEW</div> }));
vi.mock('../../src/components/tournaments/create-tournament-page', () => ({ default: () => <div>CREATE_TOURNAMENT</div> }));
vi.mock('../../src/components/account-view', () => ({ default: () => <div>ACCOUNT_VIEW</div> }));
vi.mock('../../src/components/tournament-players-view', () => ({ default: () => <div>TOURNAMENT_PLAYERS</div> }));
vi.mock('../../src/components/tournament-presets-view', () => ({ default: () => <div>TOURNAMENT_PRESETS</div> }));
vi.mock('../../src/components/match-formats-view', () => ({ default: () => <div>MATCH_FORMATS</div> }));
vi.mock('../../src/components/doublettes-view', () => ({ default: () => <div>DOUBLETTES_VIEW</div> }));
vi.mock('../../src/components/equipes-view', () => ({ default: () => <div>EQUIPES_VIEW</div> }));

describe('App routing', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    adminState.isAdmin = true;
    fetchMatchFormatPresetsMock.mockReset();
    fetchMatchFormatPresetsMock.mockResolvedValue([]);
    fetchLiveTournamentSummaryMock.mockReset();
    fetchLiveTournamentSummaryMock.mockResolvedValue([]);
    setMatchFormatPresetsMock.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tournaments: [] }) })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders admin-only guard for players view when non-admin', async () => {
    adminState.isAdmin = false;
    navigateTo('/?view=players');
    render(<App />);
    expect(await screen.findByText('auth.adminOnly')).toBeInTheDocument();
  });

  it('renders requested views from query params', async () => {
    adminState.isAdmin = true;

    navigateTo('/?view=registration-players');
    const { rerender } = render(<App />);
    expect(await screen.findByText('REGISTRATION_PLAYERS')).toBeInTheDocument();

    navigateTo('/?view=tournament-preset-editor');
    rerender(<App />);
    expect(await screen.findByText('TOURNAMENT_PRESETS')).toBeInTheDocument();

    navigateTo('/?view=match-formats');
    rerender(<App />);
    expect(await screen.findByText('MATCH_FORMATS')).toBeInTheDocument();

    navigateTo('/?view=doublettes&tournamentId=t1');
    rerender(<App />);
    expect(await screen.findByText('DOUBLETTES_VIEW')).toBeInTheDocument();

    navigateTo('/?view=equipes&tournamentId=t1');
    rerender(<App />);
    expect(await screen.findByText('EQUIPES_VIEW')).toBeInTheDocument();
  });

  it('falls back to live view when status=live without explicit view', async () => {
    navigateTo('/?status=live');
    render(<App />);
    expect(await screen.findByText('LIVE_TOURNAMENT')).toBeInTheDocument();
  });

  it('falls back to tournament list for unknown status without explicit view', async () => {
    navigateTo('/?status=draft');
    render(<App />);
    expect(await screen.findByText('TOURNAMENT_LIST')).toBeInTheDocument();
  });

  it('hides header and loads screen rotation list in screen mode', async () => {
    fetchLiveTournamentSummaryMock.mockResolvedValue([]);

    navigateTo('/?screen=1');
    render(<App />);

    expect(screen.queryByText('APP_HEADER')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE']);
    });
  });

  it('resolves screen rotation from explicit tournament live endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url === '/api/tournaments/t1/live') {
        return {
          ok: true,
          json: async () => ({
            id: 't1',
            poolStages: [{ id: 's1', status: 'IN_PROGRESS', poolCount: 1, pools: [{ assignments: [{ player: { id: 'p1' } }] }] }],
            brackets: [{ id: 'b1', status: 'IN_PROGRESS', entries: [{ player: { id: 'p1' } }] }],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ tournaments: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    navigateTo('/?screen=1&tournamentId=t1');
    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/tournaments/t1/live');
    });
  });

  it('keeps global screen rotation scope after URL includes tournamentId', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tournaments: [] }) } as Response));
    vi.stubGlobal('fetch', fetchMock);
    fetchLiveTournamentSummaryMock.mockResolvedValueOnce([
      {
        id: 't1',
        poolStages: [{ id: 's1', status: 'IN_PROGRESS', poolCount: 1 }],
        brackets: [],
      },
      {
        id: 't2',
        poolStages: [{ id: 's2', status: 'IN_PROGRESS', poolCount: 1 }],
        brackets: [],
      },
    ]);

    navigateTo('/?screen=1&status=LIVE');
    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledWith(['LIVE']);
    });

    navigateTo('/?screen=1&status=LIVE&screenScope=global&view=pool-stages&tournamentId=t1&stageId=s1');
    rerender(<App />);

    await waitFor(() => {
      expect(fetchLiveTournamentSummaryMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).not.toHaveBeenCalledWith('/api/tournaments/t1/live');
  });

  it('stores empty match presets when presets fetch fails', async () => {
    fetchMatchFormatPresetsMock.mockRejectedValueOnce(new Error('network'));

    render(<App />);

    await waitFor(() => {
      expect(setMatchFormatPresetsMock).toHaveBeenCalledWith([]);
    });
  });

  it('renders remaining route branches and admin guard for presets', async () => {
    adminState.isAdmin = true;

    navigateTo('/?view=tournament-players');
    const { rerender } = render(<App />);
    expect(await screen.findByText('TOURNAMENT_PLAYERS')).toBeInTheDocument();

    navigateTo('/?view=live');
    rerender(<App />);
    expect(await screen.findByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    navigateTo('/?view=pool-stages');
    rerender(<App />);
    expect(await screen.findByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    navigateTo('/?view=brackets');
    rerender(<App />);
    expect(await screen.findByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    navigateTo('/?view=targets');
    rerender(<App />);
    expect(await screen.findByText('TARGETS_VIEW')).toBeInTheDocument();

    navigateTo('/?view=notifications');
    rerender(<App />);
    expect(await screen.findByText('NOTIFICATIONS_VIEW')).toBeInTheDocument();

    navigateTo('/?view=create-tournament');
    rerender(<App />);
    expect(await screen.findByText('CREATE_TOURNAMENT')).toBeInTheDocument();

    navigateTo('/?view=account');
    rerender(<App />);
    expect(await screen.findByText('ACCOUNT_VIEW')).toBeInTheDocument();

    navigateTo('/?view=tournament-presets');
    rerender(<App />);
    expect(await screen.findByText('TOURNAMENT_PRESETS')).toBeInTheDocument();

    adminState.isAdmin = false;
    navigateTo('/?view=tournament-presets');
    rerender(<App />);
    expect(await screen.findByText('auth.adminOnly')).toBeInTheDocument();
  });
});
