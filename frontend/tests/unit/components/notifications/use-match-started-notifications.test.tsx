import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMatchStartedNotifications from '../../../../src/components/notifications/use-match-started-notifications';
import { NOTIFICATIONS_STORAGE_KEY } from '../../../../src/components/notifications/notifications-types';

const authState = {
  enabled: true,
  isAuthenticated: true,
  getAccessTokenSilently: vi.fn(async () => 'token'),
};

const socketHandlers = new Map<string, (payload?: unknown) => void>();
const socket = {
  on: vi.fn((event: string, callback: (payload?: unknown) => void) => {
    socketHandlers.set(event, callback);
  }),
  emit: vi.fn(),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
};
const io = vi.fn(() => socket);

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => io(...args),
}));

vi.mock('../../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

describe('useMatchStartedNotifications', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    authState.getAccessTokenSilently.mockReset();
    authState.getAccessTokenSilently.mockResolvedValue('token');
    socketHandlers.clear();
    socket.on.mockClear();
    socket.emit.mockClear();
    socket.removeAllListeners.mockClear();
    socket.disconnect.mockClear();
    io.mockClear();
    globalThis.localStorage.clear();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { email: 'p@example.com' } }) } as Response;
      }
      if (url.includes('/api/tournaments?status=LIVE')) {
        return { ok: true, json: async () => ({ tournaments: [{ id: 't1', name: 'Cup', status: 'LIVE' }] }) } as Response;
      }
      if (url.includes('/api/tournaments?status=SIGNATURE')) {
        return { ok: true, json: async () => ({ tournaments: [] }) } as Response;
      }
      if (url.includes('/api/tournaments/t1/players')) {
        return { ok: true, json: async () => ({ players: [{ playerId: 'p1', email: 'p@example.com' }] }) } as Response;
      }
      if (url.includes('/api/tournaments/t1/pool-stages/s1/pools')) {
        return { ok: true, json: async () => ({ pools: [{ id: 'pool-1', assignments: [{ playerId: 'p1' }] }] }) } as Response;
      }
      if (url.includes('/api/tournaments/t1/pool-stages')) {
        return { ok: true, json: async () => ({ poolStages: [{ id: 's1' }] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
  });

  it('does not open socket when auth is disabled', () => {
    authState.enabled = false;
    renderHook(() => useMatchStartedNotifications());
    expect(io).not.toHaveBeenCalled();
  });

  it('does not open socket when access token cannot be retrieved', async () => {
    authState.getAccessTokenSilently.mockRejectedValueOnce(new Error('no token'));

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalled();
    });
    expect(io).not.toHaveBeenCalled();
  });

  it('joins tournaments and stores notifications only for matching player', async () => {
    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    socketHandlers.get('connect')?.();
    expect(socket.emit).toHaveBeenCalledWith('join-tournament', 't1');

    const startedHandler = socketHandlers.get('match:started');
    expect(startedHandler).toBeDefined();

    startedHandler?.({
      matchId: 'm1',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-1', targetNumber: 5 },
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 1 },
      players: [{ id: 'p1' }],
    });

    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);

    startedHandler?.({
      matchId: 'm2',
      tournamentId: 't1',
      tournamentName: 'Cup',
      match: { source: 'bracket', matchNumber: 2 },
      players: [{ id: 'other' }],
    });

    const storedAfter = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(storedAfter).toHaveLength(1);
  });

  it('shows browser notifications for completed and format-changed events', async () => {
    const notificationSpy = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: Object.assign(notificationSpy, { permission: 'granted' }),
    });

    const { unmount } = renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const finishedHandler = socketHandlers.get('match:finished');
    const formatChangedHandler = socketHandlers.get('match:format-changed');

    finishedHandler?.({
      event: 'completed',
      matchId: 'm3',
      tournamentId: 't1',
      tournamentName: 'Cup',
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 3 },
      players: [{ id: 'p1', scoreTotal: 3, isWinner: true }, { id: 'p2', scoreTotal: 1 }],
    });

    formatChangedHandler?.({
      event: 'format_changed',
      matchId: 'm4',
      tournamentId: 't1',
      tournamentName: 'Cup',
      matchFormatKey: 'BO5',
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 4 },
      players: [{ id: 'p1' }],
    });

    expect(notificationSpy).toHaveBeenCalledTimes(2);

    unmount();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
