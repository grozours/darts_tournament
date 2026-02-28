import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsView from '../../../src/components/notifications-view';

const authState = {
  enabled: true,
  isAuthenticated: true,
  isLoading: false,
  getAccessTokenSilently: vi.fn(async () => 'token'),
};
const translate = (key: string) => key;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: translate }),
}));

vi.mock('../../../src/auth/sign-in-panel', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('NotificationsView branches', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    authState.isLoading = false;
    authState.getAccessTokenSilently = vi.fn(async () => 'token');

    globalThis.window.localStorage.clear();

    const notificationMock = vi.fn() as unknown as typeof Notification;
    notificationMock.permission = 'default';
    notificationMock.requestPermission = vi.fn(async () => 'granted');
    globalThis.Notification = notificationMock as unknown as typeof Notification;
  });

  it('renders loading and error branches while loading player ids', async () => {
    authState.getAccessTokenSilently = vi.fn(async () => undefined as unknown as string);

    render(<NotificationsView />);

    expect(await screen.findByText('notifications.authRequired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.refresh' })).toBeInTheDocument();
  });

  it('requests browser permission and renders started/completed/format_changed/cancelled notification variants', async () => {
    const items = [
      {
        id: 'n-started',
        receivedAt: '2026-01-01T10:00:00.000Z',
        payload: {
          event: 'started',
          tournamentId: 't1',
          tournamentName: 'Cup',
          target: { targetNumber: 3, targetCode: 'Target 3' },
          match: { source: 'pool', matchNumber: 2, stageNumber: 1, poolNumber: 1 },
          players: [{ id: 'p1', firstName: 'Ava', lastName: 'Archer' }],
        },
      },
      {
        id: 'n-completed',
        receivedAt: '2026-01-01T10:10:00.000Z',
        payload: {
          event: 'completed',
          tournamentId: 't1',
          tournamentName: 'Cup',
          match: { source: 'pool', matchNumber: 3, stageNumber: 1, poolNumber: 1 },
          players: [
            { id: 'p1', firstName: 'Ava', lastName: 'Archer', scoreTotal: 13, isWinner: true },
            { id: 'p2', firstName: 'Bea', lastName: 'Bell', scoreTotal: 9, isWinner: false },
          ],
        },
      },
      {
        id: 'n-format',
        receivedAt: '2026-01-01T10:20:00.000Z',
        payload: {
          event: 'format_changed',
          tournamentId: 't1',
          tournamentName: 'Cup',
          matchFormatTooltip: 'BO3',
          match: { source: 'bracket', bracketName: 'Final', matchNumber: 4 },
          players: [{ id: 'p3', firstName: 'Cid', lastName: 'Cole' }],
        },
      },
      {
        id: 'n-cancelled',
        receivedAt: '2026-01-01T10:30:00.000Z',
        payload: {
          event: 'cancelled',
          tournamentId: 't1',
          tournamentName: 'Cup',
          match: { source: 'bracket', bracketName: 'Semi', matchNumber: 1 },
          players: [{ id: 'p4', teamName: 'Team One' }],
        },
      },
    ];

    globalThis.window.localStorage.setItem('notifications:match-started', JSON.stringify(items));

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ user: { email: 'user@example.com' } }) });
      }
      if (url.startsWith('/api/tournaments?status=')) {
        return Promise.resolve({ ok: true, json: async () => ({ tournaments: [{ id: 't1', name: 'Cup' }] }) });
      }
      if (url.startsWith('/api/tournaments/t1/players')) {
        return Promise.resolve({ ok: true, json: async () => ({ players: [{ playerId: 'p1', email: 'user@example.com' }] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }));

    render(<NotificationsView />);

    expect(await screen.findByText('notifications.permissionTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'notifications.permissionAction' }));

    await waitFor(() => {
      expect(screen.getByText('notifications.calledToTarget targets.target 3')).toBeInTheDocument();
    });
    expect(screen.getByText('notifications.matchCompleted')).toBeInTheDocument();
    expect(screen.getByText('notifications.matchFormatChanged')).toBeInTheDocument();
    expect(screen.getByText('notifications.matchCancelled')).toBeInTheDocument();
    expect(screen.getByText('live.finalScore: 13 - 9')).toBeInTheDocument();

    const acknowledgeButtons = screen.getAllByRole('button', { name: 'notifications.acknowledge' });
    expect(acknowledgeButtons.length).toBeGreaterThan(0);
    fireEvent.click(acknowledgeButtons[0]!);
    expect(await screen.findByText('notifications.acknowledged')).toBeInTheDocument();
  });

  it('handles unsupported browser notifications capability', async () => {
    authState.isAuthenticated = false;
    authState.isLoading = false;

    // @ts-expect-error test stub
    delete globalThis.Notification;

    render(<NotificationsView />);

    expect(screen.getByText('notifications.signInPrompt')).toBeInTheDocument();
  });

  it('handles invalid stored notifications JSON and permission request failures', async () => {
    globalThis.window.localStorage.setItem('notifications:match-started', '{broken-json');

    const notificationMock = vi.fn() as unknown as typeof Notification;
    notificationMock.permission = 'default';
    notificationMock.requestPermission = vi.fn(async () => {
      throw new Error('permission failed');
    });
    globalThis.Notification = notificationMock as unknown as typeof Notification;

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ user: { email: 'user@example.com' } }) });
      }
      if (url.startsWith('/api/tournaments?status=')) {
        return Promise.resolve({ ok: true, json: async () => ({ tournaments: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ players: [] }) });
    }));

    render(<NotificationsView />);

    await screen.findByText('notifications.permissionTitle');
    fireEvent.click(screen.getByRole('button', { name: 'notifications.permissionAction' }));

    await waitFor(() => {
      expect(notificationMock.requestPermission).toHaveBeenCalled();
    });
  });
});
