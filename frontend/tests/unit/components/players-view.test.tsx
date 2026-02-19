import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PlayersView from '../../../src/components/players-view';
import { TournamentFormat } from '@shared/types';
import { fetchTournamentPlayers } from '../../../src/services/tournament-service';

type MockFetch = ReturnType<typeof vi.fn>;

vi.mock('../../../src/services/tournament-service', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/tournament-service')>(
    '../../../src/services/tournament-service'
  );
  return {
    ...actual,
    fetchTournamentPlayers: vi.fn(),
    updateTournamentPlayer: vi.fn(),
  };
});

describe('PlayersView', () => {
  const mockFetch = vi.fn() as MockFetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders players across tournaments', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', name: 'Spring Open', format: TournamentFormat.SINGLE },
          { id: 't2', name: 'Doubles Night', format: TournamentFormat.DOUBLE },
        ],
      }),
    });

    const playersByTournament = {
      t1: [
        {
          playerId: 'p1',
          firstName: 'Alice',
          lastName: 'Smith',
          surname: 'Falcon',
          name: 'Alice Smith',
        },
      ],
      t2: [
        {
          playerId: 'p2',
          firstName: 'Bob',
          lastName: 'Lee',
          name: 'Bob Lee',
          teamName: 'Team Rocket',
        },
      ],
    } as const;

    vi.mocked(fetchTournamentPlayers).mockImplementation(async (tournamentId: string) => {
      return playersByTournament[tournamentId as keyof typeof playersByTournament] ?? [];
    });

    render(<PlayersView />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Smith \(Falcon\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Team Rocket/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Spring Open/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Doubles Night/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2\s+(Players|Joueurs)/i)).toBeInTheDocument();
  });

  it('filters players by search input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Spring Open', format: TournamentFormat.SINGLE }],
      }),
    });

    vi.mocked(fetchTournamentPlayers).mockResolvedValue([
      {
        playerId: 'p1',
        firstName: 'Alice',
        lastName: 'Smith',
        surname: 'Falcon',
        name: 'Alice Smith',
      },
      {
        playerId: 'p2',
        firstName: 'Bob',
        lastName: 'Lee',
        name: 'Bob Lee',
      },
    ]);

    render(<PlayersView />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Smith \(Falcon\)/i)).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText(/search name, team, email, phone, tournament|Rechercher nom, équipe, email, téléphone, tournoi/i),
      {
        target: { value: 'falcon' },
      }
    );

    expect(screen.getByText(/Alice Smith \(Falcon\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Lee/i)).not.toBeInTheDocument();
  });
});
