import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TargetsView from '../../../src/components/TargetsView';
import { fetchTournamentLiveView, updateMatchStatus } from '../../../src/services/tournamentService';

type MockFetch = ReturnType<typeof vi.fn>;

vi.mock('../../../src/services/tournamentService', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/tournamentService')>(
    '../../../src/services/tournamentService'
  );
  return {
    ...actual,
    fetchTournamentLiveView: vi.fn(),
    updateMatchStatus: vi.fn(),
  };
});

describe('TargetsView', () => {
  const mockFetch = vi.fn() as MockFetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    render(<TargetsView />);

    await screen.findByRole('heading', { name: /Live Tournament/i });
    expect(await screen.findByText('A1')).toBeInTheDocument();
    expect(screen.getByText(/Free/i)).toBeInTheDocument();
    expect(screen.getByText(/Match queue/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Stage 1/i).length).toBeGreaterThan(0);
    expect(vi.mocked(updateMatchStatus)).not.toHaveBeenCalled();
  });
});
