import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app';

const authState = { isAuthenticated: true };
const adminState = { isAdmin: true };
const fetchMatchFormatPresetsMock = vi.fn(async () => []);
const setMatchFormatPresetsMock = vi.fn();
const toUrl = (input: RequestInfo | URL) => {
  if (input instanceof URL) return input.toString();
  if (typeof input === 'string') return input;
  return input.url;
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() })) }));
vi.mock('../../src/components/notifications/use-match-started-notifications', () => ({ default: vi.fn() }));
vi.mock('../../src/services/tournament-service', () => ({
  fetchMatchFormatPresets: (...arguments_: unknown[]) => fetchMatchFormatPresetsMock(...arguments_),
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
    setMatchFormatPresetsMock.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tournaments: [] }) })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders admin-only guard for players view when non-admin', () => {
    adminState.isAdmin = false;
    globalThis.history.pushState({}, '', '/?view=players');
    render(<App />);
    expect(screen.getByText('auth.adminOnly')).toBeInTheDocument();
  });

  it('renders requested views from query params', () => {
    adminState.isAdmin = true;

    globalThis.history.pushState({}, '', '/?view=registration-players');
    const { rerender } = render(<App />);
    expect(screen.getByText('REGISTRATION_PLAYERS')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=tournament-preset-editor');
    rerender(<App />);
    expect(screen.getByText('TOURNAMENT_PRESETS')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=match-formats');
    rerender(<App />);
    expect(screen.getByText('MATCH_FORMATS')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=doublettes&tournamentId=t1');
    rerender(<App />);
    expect(screen.getByText('DOUBLETTES_VIEW')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=equipes&tournamentId=t1');
    rerender(<App />);
    expect(screen.getByText('EQUIPES_VIEW')).toBeInTheDocument();
  });

  it('falls back to live view when status=live without explicit view', () => {
    globalThis.history.pushState({}, '', '/?status=live');
    render(<App />);
    expect(screen.getByText('LIVE_TOURNAMENT')).toBeInTheDocument();
  });

  it('falls back to tournament list for unknown status without explicit view', () => {
    globalThis.history.pushState({}, '', '/?status=draft');
    render(<App />);
    expect(screen.getByText('TOURNAMENT_LIST')).toBeInTheDocument();
  });

  it('hides header and loads screen rotation list in screen mode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url === '/api/tournaments?status=LIVE') {
        return {
          ok: true,
          json: async () => ({ tournaments: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ poolStages: [], brackets: [] }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    globalThis.history.pushState({}, '', '/?screen=1');
    render(<App />);

    expect(screen.queryByText('APP_HEADER')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/tournaments?status=LIVE');
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

    globalThis.history.pushState({}, '', '/?screen=1&tournamentId=t1');
    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/tournaments/t1/live');
    });
  });

  it('stores empty match presets when presets fetch fails', async () => {
    fetchMatchFormatPresetsMock.mockRejectedValueOnce(new Error('network'));

    render(<App />);

    await waitFor(() => {
      expect(setMatchFormatPresetsMock).toHaveBeenCalledWith([]);
    });
  });

  it('renders remaining route branches and admin guard for presets', () => {
    adminState.isAdmin = true;

    globalThis.history.pushState({}, '', '/?view=tournament-players');
    const { rerender } = render(<App />);
    expect(screen.getByText('TOURNAMENT_PLAYERS')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=live');
    rerender(<App />);
    expect(screen.getByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=pool-stages');
    rerender(<App />);
    expect(screen.getByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=brackets');
    rerender(<App />);
    expect(screen.getByText('LIVE_TOURNAMENT')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=targets');
    rerender(<App />);
    expect(screen.getByText('TARGETS_VIEW')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=notifications');
    rerender(<App />);
    expect(screen.getByText('NOTIFICATIONS_VIEW')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=create-tournament');
    rerender(<App />);
    expect(screen.getByText('CREATE_TOURNAMENT')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=account');
    rerender(<App />);
    expect(screen.getByText('ACCOUNT_VIEW')).toBeInTheDocument();

    globalThis.history.pushState({}, '', '/?view=tournament-presets');
    rerender(<App />);
    expect(screen.getByText('TOURNAMENT_PRESETS')).toBeInTheDocument();

    adminState.isAdmin = false;
    globalThis.history.pushState({}, '', '/?view=tournament-presets');
    rerender(<App />);
    expect(screen.getByText('auth.adminOnly')).toBeInTheDocument();
  });
});
