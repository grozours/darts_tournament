import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TournamentFormat } from '@shared/types';
import RegistrationSection from '../../../../src/components/tournament-list/registration-section';

describe('registration-section', () => {
  const baseProperties = (format = TournamentFormat.SINGLE) => ({
    t: (key: string) => key,
    editingTournament: {
      format,
      totalParticipants: 16,
    },
    players: [
      {
        playerId: 'p1',
        name: 'Ada Lovelace',
        checkedIn: false,
      },
    ],
    playersLoading: false,
    playersError: undefined,
    playerForm: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      surname: '',
      teamName: '',
      email: '',
      phone: '',
      skillLevel: undefined,
    },
    editingPlayerId: undefined,
    playerActionLabel: 'edit.addPlayer',
    isRegisteringPlayer: false,
    isAutoFillingPlayers: false,
    autoFillProgress: undefined,
    skillLevelOptions: [{ value: 'BEGINNER', label: 'Beginner' }],
    onPlayerFormChange: vi.fn(),
    onStartEditPlayer: vi.fn(),
    onCancelEditPlayer: vi.fn(),
    onSubmitPlayer: vi.fn(),
    onAutoFillPlayers: vi.fn(),
    onRemovePlayer: vi.fn(),
    onFetchPlayers: vi.fn(),
  });

  it('uses players, doublettes and equipes labels based on format', () => {
    const single = render(<RegistrationSection {...baseProperties(TournamentFormat.SINGLE)} />);
    expect(screen.getByText('1 edit.spotsFilled.of 16 common.players')).toBeInTheDocument();
    single.unmount();

    const double = render(<RegistrationSection {...baseProperties(TournamentFormat.DOUBLE)} />);
    expect(screen.getByText('1 edit.spotsFilled.of 16 groups.doublettes')).toBeInTheDocument();
    double.unmount();

    render(<RegistrationSection {...baseProperties(TournamentFormat.TEAM_4_PLAYER)} />);
    expect(screen.getByText('1 edit.spotsFilled.of 16 groups.equipes')).toBeInTheDocument();
  });

  it('shows team field only for double and team formats and propagates form changes', () => {
    const single = baseProperties(TournamentFormat.SINGLE);
    const singleRender = render(<RegistrationSection {...single} />);
    expect(screen.queryByLabelText('edit.teamName')).not.toBeInTheDocument();
    singleRender.unmount();

    const double = baseProperties(TournamentFormat.DOUBLE);
    render(<RegistrationSection {...double} />);
    expect(screen.getByLabelText('edit.teamName')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('edit.firstName'), {
      target: { value: 'Grace' },
    });
    expect(double.onPlayerFormChange).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Grace' }));

    fireEvent.change(screen.getByLabelText('edit.skillLevel'), { target: { value: '' } });
    expect(double.onPlayerFormChange).toHaveBeenCalledWith(expect.objectContaining({ skillLevel: undefined }));
  });

  it('renders editing/error/autofill states and action handlers', () => {
    const properties = baseProperties(TournamentFormat.DOUBLE);
    properties.editingPlayerId = 'p1';
    properties.playersError = 'players failed';
    properties.isAutoFillingPlayers = true;
    properties.autoFillProgress = { current: 2, total: 4 };

    render(<RegistrationSection {...properties} />);

    expect(screen.getByText('players failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'edit.cancelEdit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'edit.filling (2/4)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'edit.addPlayer' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit.cancelEdit' }));

    expect(properties.onFetchPlayers).toHaveBeenCalledTimes(1);
    expect(properties.onCancelEditPlayer).toHaveBeenCalledTimes(1);
  });
});
