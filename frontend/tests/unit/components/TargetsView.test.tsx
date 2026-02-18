import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TargetsView from '../../../src/components/targets-view';
import { completeMatch, fetchTournamentLiveView, updateMatchStatus } from '../../../src/services/tournament-service';

type MockFetch = ReturnType<typeof vi.fn>;

vi.mock('../../../src/services/tournament-service', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/tournament-service')>(
    '../../../src/services/tournament-service'
  );
  return {
    ...actual,
    fetchTournamentLiveView: vi.fn(),
    updateMatchStatus: vi.fn(),
    completeMatch: vi.fn(),
  };
});

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: true }),
}));

describe('TargetsView', () => {
  const mockFetch = vi.fn() as MockFetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 0 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders live targets and queue', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Live Tournament', status: 'LIVE' }],
      }),
    });

    vi.mocked(fetchTournamentLiveView).mockResolvedValue({
      id: 't1',
      name: 'Live Tournament',
      status: 'LIVE',
      targets: [
        {
          id: 'target-1',
          targetNumber: 1,
          targetCode: 'A1',
          status: 'FREE',
          currentMatchId: null,
        },
      ],
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { firstName: 'Alice', lastName: 'Smith' } },
                    { player: { firstName: 'Bob', lastName: 'Lee' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    });

    await act(async () => {
      render(<TargetsView />);
    });

    await screen.findByText(/Targets|Cibles/i);
    expect(await screen.findByText('A1')).toBeInTheDocument();
    expect(screen.getByText(/Free|Libre/i)).toBeInTheDocument();
    expect(screen.getByText(/Match queue|File des matchs/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Stage 1|Phase 1/i).length).toBeGreaterThan(0);
    expect(vi.mocked(updateMatchStatus)).not.toHaveBeenCalled();
  });

  it('allows completing an in-progress match from targets view', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Live Tournament', status: 'LIVE' }],
      }),
    });

    vi.mocked(fetchTournamentLiveView).mockResolvedValue({
      id: 't1',
      name: 'Live Tournament',
      status: 'LIVE',
      targets: [
        {
          id: 'target-1',
          targetNumber: 1,
          targetCode: 'A1',
          status: 'IN_USE',
          currentMatchId: 'match-1',
        },
      ],
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'IN_PROGRESS',
                  targetId: 'target-1',
                  playerMatches: [
                    { playerPosition: 1, player: { id: 'p1', firstName: 'Alice', lastName: 'Smith' } },
                    { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'Lee' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    });

    vi.mocked(completeMatch).mockResolvedValue();

    render(<TargetsView />);

    await screen.findByText(/Targets|Cibles/i);
    const scoreInputs = await screen.findAllByRole('spinbutton');
    await user.clear(scoreInputs[0]);
    await user.type(scoreInputs[0], '3');
    await user.clear(scoreInputs[1]);
    await user.type(scoreInputs[1], '1');

    const completeButton = screen.getByRole('button', { name: /Complete match|Terminer le match/i });
    await act(async () => {
      await user.click(completeButton);
    });

    await waitFor(() => {
      expect(vi.mocked(completeMatch)).toHaveBeenCalledWith(
        't1',
        'match-1',
        [
          { playerId: 'p1', scoreTotal: 3 },
          { playerId: 'p2', scoreTotal: 1 },
        ],
        undefined
      );
    });

    await waitFor(() => {
      expect(vi.mocked(fetchTournamentLiveView)).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading targets|Chargement des cibles/i)).not.toBeInTheDocument();
    });
  });
});
