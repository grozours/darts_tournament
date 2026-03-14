import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PlayersView from '../../../src/components/players-view';
import { TournamentFormat } from '@shared/types';
import { fetchOrphanPlayers, fetchTournamentPlayers, removeTournamentPlayer } from '../../../src/services/tournament-service';

type MockFetch = ReturnType<typeof vi.fn>;

vi.mock('../../../src/services/tournament-service', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/tournament-service')>(
    '../../../src/services/tournament-service'
  );
  return {
    ...actual,
    fetchTournamentPlayers: vi.fn(),
    fetchOrphanPlayers: vi.fn(),
    updateTournamentPlayer: vi.fn(),
    removeTournamentPlayer: vi.fn(),
  };
});

describe('PlayersView', () => {
  const mockFetch: MockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.mocked(fetchOrphanPlayers).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders players for single tournaments only', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', name: 'Spring Open', format: TournamentFormat.SINGLE },
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
    } as const;

    vi.mocked(fetchTournamentPlayers).mockImplementation(async (tournamentId: string) => {
      return playersByTournament[tournamentId as keyof typeof playersByTournament] ?? [];
    });

    render(<PlayersView />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Smith \(Falcon\)/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Spring Open/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Doubles Night/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1\s+(Players|Joueurs)/i)).toBeInTheDocument();
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
      screen.getByPlaceholderText(/search name, team, email, tournament|Rechercher nom, équipe, email, tournoi/i),
      {
        target: { value: 'falcon' },
      }
    );

    expect(screen.getByText(/Alice Smith \(Falcon\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Lee/i)).not.toBeInTheDocument();
  });

  it('filters orphan players when orphan option is selected', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Spring Open', format: TournamentFormat.SINGLE }],
      }),
    });

    vi.mocked(fetchTournamentPlayers).mockResolvedValue([
      { playerId: 'p1', firstName: 'Alice', lastName: 'Smith', name: 'Alice Smith' },
    ]);
    vi.mocked(fetchOrphanPlayers).mockResolvedValue([
      { playerId: 'p-orphan', firstName: 'Orphan', lastName: 'Player', name: 'Orphan Player' },
    ]);

    render(<PlayersView />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ORPHAN' } });

    expect(screen.getByText(/Orphan Player/i)).toBeInTheDocument();
    expect(screen.queryByText(/Alice Smith/i)).not.toBeInTheDocument();
  });

  it('does not delete players when delete-all confirmation is cancelled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Spring Open', format: TournamentFormat.SINGLE }],
      }),
    });
    vi.mocked(fetchTournamentPlayers).mockResolvedValue([
      { playerId: 'p1', firstName: 'Alice', lastName: 'Smith', name: 'Alice Smith' },
    ]);
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);

    render(<PlayersView />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete all|supprimer tous/i }));

    expect(removeTournamentPlayer).not.toHaveBeenCalled();
  });

  it('shows error state when tournaments cannot be loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<PlayersView />);

    expect(await screen.findByText(/failed to fetch tournaments/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh|actualiser/i })).toBeInTheDocument();
  });
});
