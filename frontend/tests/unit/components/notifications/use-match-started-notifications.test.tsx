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
  const toUrl = (input: RequestInfo | URL) => {
    if (input instanceof URL) return input.toString();
    if (typeof input === 'string') return input;
    return input.url;
  };

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
      const url = toUrl(input);
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

  it('stores started notification when player is in same pool even without direct player match', async () => {
    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const startedHandler = socketHandlers.get('match:started');
    startedHandler?.({
      matchId: 'm-pool-only',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-1', targetCode: 'target7' },
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 9 },
      players: [{ id: 'other-player' }],
    });

    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.payload?.matchId).toBe('m-pool-only');
  });

  it('does not create browser notifications when permission is denied', async () => {
    const notificationSpy = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: Object.assign(notificationSpy, { permission: 'denied' }),
    });

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const finishedHandler = socketHandlers.get('match:finished');
    finishedHandler?.({
      event: 'completed',
      matchId: 'm5',
      tournamentId: 't1',
      tournamentName: 'Cup',
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 5 },
      players: [{ id: 'p1', scoreTotal: 3, isWinner: true }, { id: 'p2', scoreTotal: 2 }],
    });

    expect(notificationSpy).not.toHaveBeenCalled();
    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
  });

  it('does not open socket when auth profile endpoint fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) } as Response));

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalled();
    });
    expect(io).not.toHaveBeenCalled();
  });

  it('does not open socket when tournaments endpoint fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { email: 'p@example.com' } }) } as Response;
      }
      if (url.includes('/api/tournaments?status=LIVE')) {
        return { ok: false, json: async () => ({}) } as Response;
      }
      if (url.includes('/api/tournaments?status=SIGNATURE')) {
        return { ok: true, json: async () => ({ tournaments: [] }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalled();
    });
    expect(io).not.toHaveBeenCalled();
  });

  it('does not open socket when auth email is missing', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: {} }) } as Response;
      }
      return { ok: true, json: async () => ({ tournaments: [] }) } as Response;
    });

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalled();
    });
    expect(io).not.toHaveBeenCalled();
  });

  it('ignores finished and format-changed events for unrelated players', async () => {
    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const finishedHandler = socketHandlers.get('match:finished');
    const formatChangedHandler = socketHandlers.get('match:format-changed');

    finishedHandler?.({
      event: 'completed',
      matchId: 'm6',
      tournamentId: 't1',
      tournamentName: 'Cup',
      match: { source: 'bracket', matchNumber: 7 },
      players: [{ id: 'other' }],
    });

    formatChangedHandler?.({
      event: 'format_changed',
      matchId: 'm7',
      tournamentId: 't1',
      tournamentName: 'Cup',
      matchFormatKey: 'BO5',
      match: { source: 'bracket', matchNumber: 8 },
      players: [{ id: 'other' }],
    });

    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(0);
  });

  it('does not open socket when token is unavailable at socket opening', async () => {
    authState.getAccessTokenSilently
      .mockResolvedValueOnce('token')
      .mockResolvedValueOnce(undefined as unknown as string);

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalledTimes(2);
    });
    expect(io).not.toHaveBeenCalled();
  });

  it('stores notification when local storage content is malformed JSON shape', async () => {
    globalThis.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, '{"unexpected":true}');
    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const startedHandler = socketHandlers.get('match:started');
    startedHandler?.({
      matchId: 'm8',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-1', name: 'Table A' },
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 2, poolNumber: 3, matchNumber: 1 },
      players: [{ id: 'p1' }],
    });

    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.payload?.matchId).toBe('m8');
  });

  it('opens socket before pool loading completes and keeps cleanup safe after unmount', async () => {
    let resolvePools: ((value: Response) => void) | undefined;
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
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
        return await new Promise<Response>((resolve) => {
          resolvePools = resolve;
        });
      }
      if (url.includes('/api/tournaments/t1/pool-stages')) {
        return { ok: true, json: async () => ({ poolStages: [{ id: 's1' }] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const { unmount } = renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(resolvePools).toBeTypeOf('function');
      expect(io).toHaveBeenCalledTimes(1);
    });

    unmount();
    resolvePools?.({ ok: true, json: async () => ({ pools: [{ id: 'pool-1', assignments: [{ playerId: 'p1' }] }] }) } as Response);
    await Promise.resolve();

    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('aborts socket opening when disposed before token resolution', async () => {
    let resolveSecondToken: ((value: string | undefined) => void) | undefined;
    authState.getAccessTokenSilently
      .mockResolvedValueOnce('token')
      .mockImplementationOnce(async () => await new Promise<string | undefined>((resolve) => {
        resolveSecondToken = resolve;
      }));

    const { unmount } = renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(authState.getAccessTokenSilently).toHaveBeenCalledTimes(2);
      expect(resolveSecondToken).toBeTypeOf('function');
    });

    unmount();
    resolveSecondToken?.('token');
    await Promise.resolve();

    expect(io).not.toHaveBeenCalled();
  });

  it('stores notification when local storage contains invalid JSON', async () => {
    globalThis.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, '{invalid-json');
    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const startedHandler = socketHandlers.get('match:started');
    startedHandler?.({
      matchId: 'm9',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-1', targetCode: 'target 12' },
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 12 },
      players: [{ id: 'p1' }],
    });

    const stored = JSON.parse(globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.payload?.matchId).toBe('m9');
  });

  it('builds browser notification text for started bracket and completed with incomplete score', async () => {
    const notificationSpy = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: Object.assign(notificationSpy, { permission: 'granted' }),
    });

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const startedHandler = socketHandlers.get('match:started');
    const finishedHandler = socketHandlers.get('match:finished');

    startedHandler?.({
      matchId: 'm10',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-2', targetCode: 'target 7' },
      match: { source: 'bracket', bracketName: 'Final', matchNumber: 10 },
      players: [{ id: 'p1' }],
    });

    finishedHandler?.({
      event: 'completed',
      matchId: 'm11',
      tournamentId: 't1',
      tournamentName: 'Cup',
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 1, poolNumber: 1, matchNumber: 11 },
      players: [{ id: 'p1', scoreTotal: 2 }, { id: 'p2' }],
    });

    expect(notificationSpy).toHaveBeenCalledTimes(2);
  });

  it('continues loading when one tournament players endpoint fails and uses raw target label fallback', async () => {
    const notificationSpy = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: Object.assign(notificationSpy, { permission: 'granted' }),
    });

    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { email: 'p@example.com' } }) } as Response;
      }
      if (url.includes('/api/tournaments?status=LIVE')) {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ id: 't1', name: 'Cup' }, { id: 't2', name: 'Cup 2' }] }),
        } as Response;
      }
      if (url.includes('/api/tournaments?status=SIGNATURE')) {
        return { ok: true, json: async () => ({ tournaments: [] }) } as Response;
      }
      if (url.includes('/api/tournaments/t1/players')) {
        return { ok: true, json: async () => ({ players: [{ playerId: 'p1', email: 'p@example.com' }] }) } as Response;
      }
      if (url.includes('/api/tournaments/t2/players')) {
        return { ok: false, json: async () => ({}) } as Response;
      }
      if (url.includes('/api/tournaments/t1/pool-stages/s1/pools')) {
        return { ok: true, json: async () => ({ pools: [{ id: 'pool-1', assignments: [{ playerId: 'p1' }] }] }) } as Response;
      }
      if (url.includes('/api/tournaments/t2/pool-stages')) {
        return { ok: true, json: async () => ({ poolStages: [] }) } as Response;
      }
      if (url.includes('/api/tournaments/t1/pool-stages')) {
        return { ok: true, json: async () => ({ poolStages: [{ id: 's1' }] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    renderHook(() => useMatchStartedNotifications());

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const startedHandler = socketHandlers.get('match:started');
    startedHandler?.({
      matchId: 'm12',
      tournamentId: 't1',
      tournamentName: 'Cup',
      target: { id: 'target-3', name: 'Board A' },
      match: { source: 'pool', poolId: 'pool-1', stageNumber: 2, poolNumber: 2, matchNumber: 3 },
      players: [{ id: 'p1' }],
    });

    expect(notificationSpy).toHaveBeenCalledTimes(1);
  });
});
