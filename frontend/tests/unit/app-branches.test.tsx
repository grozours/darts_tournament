import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app';

const fetchLiveTournamentSummaryMock = vi.fn();
const fetchMatchFormatPresetsMock = vi.fn(async () => []);
const socketHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {};
const emitMock = vi.fn();
const disconnectMock = vi.fn();
const removeAllListenersMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (event: string, callback: (payload?: unknown) => void) => {
      socketHandlers[event] = callback;
    },
    emit: (...args: unknown[]) => emitMock(...args),
    removeAllListeners: () => removeAllListenersMock(),
    disconnect: () => disconnectMock(),
  })),
}));
vi.mock('../../src/components/notifications/use-match-started-notifications', () => ({ default: vi.fn() }));
vi.mock('../../src/services/tournament-service', () => ({
  fetchLiveTournamentSummary: (statuses: string[], token?: string) => fetchLiveTournamentSummaryMock(statuses, token),
  fetchMatchFormatPresets: () => fetchMatchFormatPresetsMock(),
}));
vi.mock('../../src/utils/match-format-presets', () => ({ setMatchFormatPresets: vi.fn() }));

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({ lang: 'fr', setLanguage: vi.fn(), t: (key: string) => key }),
}));
vi.mock('../../src/auth/optional-auth', () => ({ useOptionalAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../src/auth/use-admin-status', () => ({ useAdminStatus: () => ({ isAdmin: true }) }));

vi.mock('../../src/components/app-header', () => ({ default: () => <div>APP_HEADER</div> }));
vi.mock('../../src/components/tournament-list', () => ({ default: () => <div>TOURNAMENT_LIST</div> }));
vi.mock('../../src/components/live-tournament', () => ({ default: () => <div>LIVE_TOURNAMENT</div> }));
vi.mock('../../src/components/targets-view', () => ({ default: () => <div>TARGETS_VIEW</div> }));
vi.mock('../../src/components/players-view', () => ({ default: () => <div>PLAYERS_VIEW</div> }));
vi.mock('../../src/components/registration-players', () => ({ default: () => <div>REGISTRATION_PLAYERS</div> }));
vi.mock('../../src/components/notifications-view', () => ({ default: () => <div>NOTIFICATIONS_VIEW</div> }));
vi.mock('../../src/components/tournaments/create-tournament-page', () => ({ default: () => <div>CREATE_TOURNAMENT</div> }));
vi.mock('../../src/components/account-view', () => ({ default: () => <div>ACCOUNT_VIEW</div> }));
vi.mock('../../src/components/tournament-players-view', () => ({ default: () => <div>TOURNAMENT_PLAYERS</div> }));
vi.mock('../../src/components/tournament-presets-view', () => ({ default: () => <div>TOURNAMENT_PRESETS</div> }));
vi.mock('../../src/components/match-formats-view', () => ({ default: () => <div>MATCH_FORMATS</div> }));
vi.mock('../../src/components/doublettes-view', () => ({ default: () => <div>DOUBLETTES</div> }));
vi.mock('../../src/components/equipes-view', () => ({ default: () => <div>EQUIPES</div> }));

describe('App branch coverage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    globalThis.history.replaceState({}, '', '/');
    globalThis.localStorage.clear();

    socketHandlers.connect = undefined;
    socketHandlers['match:finished'] = undefined;
    emitMock.mockReset();
    disconnectMock.mockReset();
    removeAllListenersMock.mockReset();
    fetchLiveTournamentSummaryMock.mockReset();
    fetchLiveTournamentSummaryMock.mockResolvedValue([
      {
        id: 't1',
        poolStages: [
          {
            id: 's1',
            status: 'IN_PROGRESS',
            pools: [{ assignments: [{ player: { id: 'p1' } }] }],
          },
        ],
        brackets: [
          {
            id: 'b1',
            status: 'IN_PROGRESS',
            entries: [{ player: { id: 'p1' } }],
          },
        ],
      },
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 't1',
        poolStages: [
          { id: 's1', status: 'IN_PROGRESS', pools: [{ assignments: [{ player: { id: 'p1' } }] }] },
        ],
        brackets: [
          { id: 'b1', status: 'IN_PROGRESS', entries: [{ player: { id: 'p1' } }] },
        ],
      }),
    })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders debug panel and performs screen rotation navigation', async () => {
    globalThis.history.pushState({}, '', '/?screen=1&debug=1&view=pool-stages&tournamentId=t1&stageId=s1');

    render(<App />);

    expect(screen.getByText(/Debug: view=pool-stages/i)).toBeInTheDocument();
    expect(screen.queryByText('APP_HEADER')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments/t1/live');
    });

    await act(async () => {
      socketHandlers.connect?.();
      socketHandlers['match:finished']?.({ match: { source: 'bracket' } });
    });

    expect(emitMock).toHaveBeenCalledWith('join-tournament', 't1');
  });

  it('falls back to targets rotation item when summary is empty', async () => {
    fetchLiveTournamentSummaryMock.mockResolvedValueOnce([]);
    globalThis.history.pushState({}, '', '/?screen=1');

    render(<App />);

    await waitFor(() => {
      expect(fetchLiveTournamentSummaryMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('TOURNAMENT_LIST')).toBeInTheDocument();
  });
});
