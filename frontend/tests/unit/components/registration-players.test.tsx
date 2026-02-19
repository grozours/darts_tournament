import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RegistrationPlayers from '../../../src/components/registration-players';

const mockFetchTournamentPlayers = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

let authEnabled = false;
let isAuthenticated = true;
let authLoading = false;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...arguments_: unknown[]) => mockFetchTournamentPlayers(...arguments_),
}));

vi.mock('../../../src/auth/sign-in-panel', () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

describe('RegistrationPlayers', () => {
  const originalFetch = globalThis.fetch;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    authEnabled = false;
    isAuthenticated = true;
    authLoading = false;
    mockFetchTournamentPlayers.mockReset();
    mockGetAccessTokenSilently.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tournaments: [] }),
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  it('shows sign-in panel when auth is required', () => {
    authEnabled = true;
    isAuthenticated = false;

    render(<RegistrationPlayers />);

    expect(screen.getByText('auth.signInToViewRegistrationPlayers')).toBeInTheDocument();
    expect(screen.getByText('auth.protectedContinue')).toBeInTheDocument();
    expect(mockFetchTournamentPlayers).not.toHaveBeenCalled();
  });

  it('loads and displays registration tournaments with players', async () => {
    authEnabled = false;
    isAuthenticated = false;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          {
            id: 't1',
            name: 'Double Cup',
            format: 'DOUBLE',
            status: 'OPEN',
            totalParticipants: 4,
          },
          {
            id: 't2',
            name: 'Singles Cup',
            format: 'SINGLE',
            status: 'OPEN',
            totalParticipants: 8,
          },
        ],
      }),
    }) as typeof fetch;

    mockFetchTournamentPlayers.mockResolvedValue([
      {
        playerId: 'p1',
        name: 'Alice',
        email: 'alice@example.com',
        skillLevel: 'A',
      },
    ]);

    render(<RegistrationPlayers />);

    await waitFor(() => {
      expect(screen.getByText('Double Cup')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.queryByText('Singles Cup')).not.toBeInTheDocument();
    expect(mockFetchTournamentPlayers.mock.calls[0]?.[0]).toBe('t1');
  });

  it('shows an error and retries when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
    }) as typeof fetch;

    render(<RegistrationPlayers />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to fetch registration tournaments')).toBeInTheDocument();
    });
  });
});
