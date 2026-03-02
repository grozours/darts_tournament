import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TournamentPlayersView from '../../../src/components/tournament-players-view';
import { TournamentFormat } from '@shared/types';

const fetchTournamentPlayersMock = vi.fn();
const fetchDoublettesMock = vi.fn();
const fetchEquipesMock = vi.fn();
const updateTournamentPlayerCheckInMock = vi.fn();
const updateTournamentPlayerMock = vi.fn();
const removeTournamentPlayerMock = vi.fn();
const translate = (key: string) => key;

const authState = {
  enabled: true,
  getAccessTokenSilently: vi.fn(async () => 'token'),
};

const adminState = {
  isAdmin: true,
};

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: translate }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayersMock(...args),
  fetchDoublettes: (...args: unknown[]) => fetchDoublettesMock(...args),
  fetchEquipes: (...args: unknown[]) => fetchEquipesMock(...args),
  updateTournamentPlayerCheckIn: (...args: unknown[]) => updateTournamentPlayerCheckInMock(...args),
  updateTournamentPlayer: (...args: unknown[]) => updateTournamentPlayerMock(...args),
  removeTournamentPlayer: (...args: unknown[]) => removeTournamentPlayerMock(...args),
}));

describe('TournamentPlayersView branches', () => {
  beforeEach(() => {
    adminState.isAdmin = true;
    authState.enabled = true;
    authState.getAccessTokenSilently = vi.fn(async () => 'token');

    fetchTournamentPlayersMock.mockReset();
    fetchDoublettesMock.mockReset();
    fetchEquipesMock.mockReset();
    updateTournamentPlayerCheckInMock.mockReset();
    updateTournamentPlayerMock.mockReset();
    removeTournamentPlayerMock.mockReset();

    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'alert').mockImplementation(() => undefined);
  });

  it('filters single players by confirmation and toggles contact details', async () => {
    globalThis.window.history.pushState({}, '', '/?tournamentId=t1');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 't1', name: 'Single Cup', status: 'SIGNATURE', format: TournamentFormat.SINGLE }),
    })));

    fetchTournamentPlayersMock.mockResolvedValue([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        email: 'a@example.com',
        phone: '111',
        checkedIn: true,
      },
      {
        playerId: 'p2',
        firstName: 'Bea',
        lastName: 'Bell',
        checkedIn: false,
      },
    ]);

    render(<TournamentPlayersView />);

    await screen.findByText('Ava Archer');
    expect(screen.getByText('Bea Bell')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'players.filterConfirmed' }));
    expect(screen.getByText('Ava Archer')).toBeInTheDocument();
    expect(screen.queryByText('Bea Bell')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'players.showContact' }));
    expect(screen.getByText('📧 a@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'players.hideContact' }));
    expect(screen.queryByText('📧 a@example.com')).not.toBeInTheDocument();
  });

  it('prevents deletion in LIVE tournaments and allows deletion in OPEN tournaments', async () => {
    globalThis.window.history.pushState({}, '', '/?tournamentId=t2');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't2', name: 'Live Cup', status: 'LIVE', format: TournamentFormat.SINGLE }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    fetchTournamentPlayersMock.mockResolvedValue([
      { playerId: 'p1', firstName: 'Ava', lastName: 'Archer', checkedIn: false },
    ]);

    const { unmount } = render(<TournamentPlayersView />);
    await screen.findByText('Ava Archer');

    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();

    unmount();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't2', name: 'Open Cup', status: 'OPEN', format: TournamentFormat.SINGLE }),
    });

    render(<TournamentPlayersView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

    await waitFor(() => {
      expect(removeTournamentPlayerMock).toHaveBeenCalledWith('t2', 'p1', 'token');
    });
  });

  it('loads TEAM tournament groups from equipes service', async () => {
    globalThis.window.history.pushState({}, '', '/?tournamentId=t3');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 't3',
        name: 'Team Cup',
        status: 'OPEN',
        format: TournamentFormat.TEAM_4_PLAYER,
        totalParticipants: 16,
      }),
    })));

    fetchEquipesMock.mockResolvedValue([
      {
        id: 'g1',
        name: 'Squad One',
        memberCount: 2,
        isRegistered: true,
        captainPlayerId: 'p1',
        members: [
          { playerId: 'p1', firstName: 'Ava', lastName: 'Archer' },
          { playerId: 'p2', firstName: 'Bea', lastName: 'Bell' },
        ],
      },
    ]);

    render(<TournamentPlayersView />);

    await waitFor(() => {
      expect(screen.getByText('Squad One')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('players.searchRegistered'), {
      target: { value: 'Bea Bell' },
    });

    expect(screen.getByText('Squad One')).toBeInTheDocument();
    expect(fetchEquipesMock).toHaveBeenCalledWith('t3', 'token');
  });
});
