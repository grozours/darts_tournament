import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import LiveTournament from '../../../src/components/LiveTournament';

const mockFetchTournamentLiveView = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

vi.mock('../../../src/services/tournamentService', () => ({
  fetchTournamentLiveView: (...args: any[]) => mockFetchTournamentLiveView(...args),
  updateMatchStatus: vi.fn(),
  completeMatch: vi.fn(),
  updateCompletedMatchScores: vi.fn(),
  updatePoolStage: vi.fn(),
}));

vi.mock('../../../src/auth/optionalAuth', () => ({
  useOptionalAuth: () => ({
    enabled: false,
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    getAccessTokenSilently: vi.fn(),
  }),
}));

describe('LiveTournament aggregate view', () => {
  beforeEach(() => {
    mockFetchTournamentLiveView.mockResolvedValue({
      id: 'tournament-1',
      name: 'Live Tournament',
      status: 'LIVE',
      poolStages: [],
      brackets: [],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });
    originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
    globalThis.window.history.pushState({}, '', '/?view=pool-stages');
  });

  afterEach(() => {
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
      });
    }
    vi.clearAllMocks();
  });

  it('requests live tournaments with an uppercase status filter', async () => {
    render(<LiveTournament />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments?status=LIVE', {
        headers: undefined,
      });
    });
  });
});
