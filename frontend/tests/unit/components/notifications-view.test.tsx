import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationsView from '../../../src/components/notifications-view';

const authState = {
  enabled: true,
  isAuthenticated: false,
  isLoading: false,
  getAccessTokenSilently: vi.fn(),
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

const t = (key: string) => key;

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t }),
}));

const socketMock = {
  on: vi.fn(),
  emit: vi.fn(),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock),
}));

const setNotificationMock = (permission: NotificationPermission) => {
  const NotificationMock = vi.fn();
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = vi.fn().mockResolvedValue('granted');
  globalThis.Notification = NotificationMock as unknown as typeof Notification;
};

describe('NotificationsView', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.getAccessTokenSilently = vi.fn();
    globalThis.fetch = vi.fn();
    globalThis.window?.localStorage.clear();
    setNotificationMock('default');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows auth disabled message when auth is off', () => {
    authState.enabled = false;

    render(<NotificationsView />);

    expect(screen.getByText('notifications.authDisabled')).toBeInTheDocument();
  });

  it('shows sign-in prompt when unauthenticated', () => {
    render(<NotificationsView />);

    expect(screen.getByText('notifications.signInPrompt')).toBeInTheDocument();
  });

  it('loads with no tournaments and empty notifications', async () => {
    authState.isAuthenticated = true;
    authState.getAccessTokenSilently = vi.fn().mockResolvedValue('token');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ user: { email: 'test@example.com' } }) });
      }
      if (url.startsWith('/api/tournaments?status=')) {
        return Promise.resolve({ ok: true, json: async () => ({ tournaments: [] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<NotificationsView />);

    expect(await screen.findByText('notifications.permissionTitle')).toBeInTheDocument();
    expect(screen.getByText('notifications.noTournaments')).toBeInTheDocument();
    expect(screen.getByText('notifications.empty')).toBeInTheDocument();
  });

  it('renders stored notifications and acknowledges them', async () => {
    authState.isAuthenticated = true;
    authState.getAccessTokenSilently = vi.fn().mockResolvedValue('token');
    setNotificationMock('denied');

    globalThis.window?.localStorage.setItem('notifications:match-started', JSON.stringify([
      {
        id: 'note-1',
        receivedAt: '2024-01-01T10:00:00.000Z',
        payload: {
          matchId: 'm1',
          tournamentId: 't1',
          tournamentName: 'Alpha Cup',
          match: { source: 'pool', matchNumber: 2, stageNumber: 1, poolNumber: 1 },
          players: [{ id: 'p1', firstName: 'Ava', lastName: 'Archer' }],
        },
      },
    ]));

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ user: { email: 'test@example.com' } }) });
      }
      if (url.startsWith('/api/tournaments?status=')) {
        return Promise.resolve({ ok: true, json: async () => ({ tournaments: [] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<NotificationsView />);

    expect(await screen.findByText('notifications.permissionDenied')).toBeInTheDocument();
    expect(screen.getByText('Alpha Cup')).toBeInTheDocument();

    fireEvent.click(screen.getByText('notifications.acknowledge'));
    expect(await screen.findByText('notifications.acknowledged')).toBeInTheDocument();
  });
});
