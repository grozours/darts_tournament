import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RegistrationPlayers from '../../../src/components/registration-players';

const mockFetchTournamentPlayers = vi.fn();
const mockFetchDoublettes = vi.fn();
const mockFetchEquipes = vi.fn();
const mockGetAccessTokenSilently = vi.fn();

let authEnabled = false;
let isAuthenticated = true;
let authLoading = false;
const mockTranslate = (key: string) => key;

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
    t: mockTranslate,
  }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...arguments_: unknown[]) => mockFetchTournamentPlayers(...arguments_),
  fetchDoublettes: (...arguments_: unknown[]) => mockFetchDoublettes(...arguments_),
  fetchEquipes: (...arguments_: unknown[]) => mockFetchEquipes(...arguments_),
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
    mockFetchDoublettes.mockReset();
    mockFetchEquipes.mockReset();
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

  it('loads and displays registration tournaments by format', async () => {
    authEnabled = false;
    isAuthenticated = false;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          {
            id: 't0',
            name: 'Singles Cup',
            format: 'SINGLE',
            status: 'OPEN',
            totalParticipants: 8,
          },
          {
            id: 't1',
            name: 'Double Cup',
            format: 'DOUBLE',
            status: 'OPEN',
            totalParticipants: 16,
          },
          {
            id: 't2',
            name: 'Team Cup',
            format: 'TEAM_4_PLAYER',
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

    mockFetchDoublettes.mockResolvedValue([
      {
        id: 'd1',
        name: 'Duo One',
        captainPlayerId: 'p2',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'p2', firstName: 'John', lastName: 'Doe', joinedAt: new Date().toISOString() },
          { playerId: 'p3', firstName: 'Jane', lastName: 'Doe', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    mockFetchEquipes.mockResolvedValue([
      {
        id: 'e1',
        name: 'Team One',
        captainPlayerId: 'p4',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 4,
        members: [
          { playerId: 'p4', firstName: 'A', lastName: 'One', joinedAt: new Date().toISOString() },
          { playerId: 'p5', firstName: 'B', lastName: 'Two', joinedAt: new Date().toISOString() },
          { playerId: 'p6', firstName: 'C', lastName: 'Three', joinedAt: new Date().toISOString() },
          { playerId: 'p7', firstName: 'D', lastName: 'Four', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<RegistrationPlayers />);

    await waitFor(() => {
      expect(screen.getByText('Singles Cup')).toBeInTheDocument();
      expect(screen.getByText('Double Cup')).toBeInTheDocument();
      expect(screen.getByText('Team Cup')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Duo One')).toBeInTheDocument();
      expect(screen.getByText('Team One')).toBeInTheDocument();
    });

    expect(screen.getAllByText((content, element) => {
      const text = element?.textContent ?? content;
      return text.includes('1') && text.includes('/') && text.includes('8') && text.includes('registration.playersCount');
    }).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content, element) => {
      const text = element?.textContent ?? content;
      return text.includes('1') && text.includes('/') && text.includes('16') && text.includes('registration.slotsCount');
    }).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content, element) => {
      const text = element?.textContent ?? content;
      return text.includes('1') && text.includes('/') && text.includes('4') && text.includes('registration.slotsCount');
    }).length).toBeGreaterThan(0);

    expect(mockFetchTournamentPlayers.mock.calls[0]?.[0]).toBe('t0');
    expect(mockFetchDoublettes.mock.calls[0]?.[0]).toBe('t1');
    expect(mockFetchEquipes.mock.calls[0]?.[0]).toBe('t2');
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
