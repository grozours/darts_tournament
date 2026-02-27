import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayersView from '../../../src/components/players-view';
import { TournamentFormat, SkillLevel } from '@shared/types';

const fetchTournamentPlayersMock = vi.fn();
const fetchOrphanPlayersMock = vi.fn();
const updateTournamentPlayerMock = vi.fn();
const removeTournamentPlayerMock = vi.fn();
const translate = (key: string) => key;

const authState = {
  enabled: true,
  getAccessTokenSilently: vi.fn(async () => 'token'),
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: translate }),
}));

vi.mock('../../../src/services/tournament-service', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/tournament-service')>(
    '../../../src/services/tournament-service'
  );
  return {
    ...actual,
    fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayersMock(...args),
    fetchOrphanPlayers: (...args: unknown[]) => fetchOrphanPlayersMock(...args),
    updateTournamentPlayer: (...args: unknown[]) => updateTournamentPlayerMock(...args),
    removeTournamentPlayer: (...args: unknown[]) => removeTournamentPlayerMock(...args),
  };
});

describe('PlayersView branches', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.getAccessTokenSilently = vi.fn(async () => 'token');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tournaments: [{ id: 't1', name: 'Double cup', format: TournamentFormat.DOUBLE }],
      }),
    })));

    fetchTournamentPlayersMock.mockReset();
    fetchOrphanPlayersMock.mockReset();
    updateTournamentPlayerMock.mockReset();
    removeTournamentPlayerMock.mockReset();

    fetchTournamentPlayersMock.mockResolvedValue([
      {
        playerId: 'p1',
        firstName: 'Ava',
        lastName: 'Archer',
        name: 'Ava Archer',
        tournamentId: 't1',
        teamName: 'Old Team',
      },
      {
        playerId: 'p2',
        firstName: 'Bea',
        lastName: 'Bell',
        name: 'Bea Bell',
        tournamentId: 't1',
      },
    ]);
    fetchOrphanPlayersMock.mockResolvedValue([]);
    updateTournamentPlayerMock.mockResolvedValue(undefined);
    removeTournamentPlayerMock.mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('saves edited player with optional fields for grouped tournament', async () => {
    render(<PlayersView />);

    await screen.findByText('Ava Archer');
    const editButtons = screen.getAllByRole('button', { name: 'edit.edit' });
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);

    fireEvent.change(screen.getByLabelText('edit.firstName'), { target: { value: ' Ava ' } });
    fireEvent.change(screen.getByLabelText('edit.lastName'), { target: { value: ' Archer ' } });
    fireEvent.change(screen.getByLabelText('edit.surname'), { target: { value: ' Falcon ' } });
    fireEvent.change(screen.getByLabelText('edit.teamName'), { target: { value: ' Team X ' } });
    fireEvent.change(screen.getByLabelText('edit.email'), { target: { value: ' ava@example.com ' } });
    fireEvent.change(screen.getByLabelText('edit.phone'), { target: { value: ' 123 ' } });
    fireEvent.change(screen.getByLabelText('edit.skillLevel'), { target: { value: SkillLevel.ADVANCED } });

    fireEvent.click(screen.getByRole('button', { name: 'edit.saveChanges' }));

    await waitFor(() => {
      expect(updateTournamentPlayerMock).toHaveBeenCalledWith(
        't1',
        'p1',
        {
          firstName: 'Ava',
          lastName: 'Archer',
          surname: 'Falcon',
          teamName: 'Team X',
          email: 'ava@example.com',
          phone: '123',
          skillLevel: SkillLevel.ADVANCED,
        },
        'token'
      );
    });
  });

  it('shows fallback error when save fails with non-Error value', async () => {
    updateTournamentPlayerMock.mockRejectedValueOnce('save failed');

    render(<PlayersView />);

    await screen.findByText('Ava Archer');
    const editButtons = screen.getAllByRole('button', { name: 'edit.edit' });
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'edit.saveChanges' }));

    await waitFor(() => {
      expect(screen.getByText('Error: players.error')).toBeInTheDocument();
    });
  });

  it('deletes all deletable players when confirmed', async () => {
    render(<PlayersView />);

    await screen.findByText('Ava Archer');
    fireEvent.click(screen.getByRole('button', { name: 'players.deleteAll' }));

    await waitFor(() => {
      expect(removeTournamentPlayerMock).toHaveBeenCalledTimes(2);
    });
    expect(removeTournamentPlayerMock).toHaveBeenCalledWith('t1', 'p1', 'token');
    expect(removeTournamentPlayerMock).toHaveBeenCalledWith('t1', 'p2', 'token');
  });
});
