import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TournamentCard from '../../../../src/components/tournament-list/tournament-card';

describe('TournamentCard', () => {
  const t = (key: string) => key;
  const baseTournament = {
    id: 't1',
    name: 'Cup',
    format: 'SINGLE',
    totalParticipants: 16,
    status: 'OPEN',
  };

  const baseProperties = {
    tournament: baseTournament as never,
    normalizedStatus: 'OPEN',
    statusLabel: 'Open',
    showWaitingSignature: false,
    isAdmin: false,
    isAuthenticated: true,
    t,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRegister: vi.fn(),
    onUnregister: vi.fn(),
    onOpenRegistration: vi.fn(),
    onOpenSignature: vi.fn(),
    userRegistrations: new Set<string>(),
  };

  it('renders admin draft actions and triggers callbacks', () => {
    const onOpenRegistration = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        isAdmin
        normalizedStatus="DRAFT"
        onOpenRegistration={onOpenRegistration}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByText('tournaments.openRegistration'));
    fireEvent.click(screen.getByText('tournaments.edit'));
    fireEvent.click(screen.getByText('tournaments.delete'));

    expect(onOpenRegistration).toHaveBeenCalledWith('t1');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('renders unregister action for authenticated registered player', () => {
    const onUnregister = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        userRegistrations={new Set(['t1'])}
        onUnregister={onUnregister}
      />
    );

    fireEvent.click(screen.getByText('tournaments.unregister'));
    expect(onUnregister).toHaveBeenCalledWith('t1');
  });

  it('renders live link for LIVE status and hides actions when waiting signature', () => {
    const { rerender } = render(
      <TournamentCard
        {...baseProperties}
        normalizedStatus="LIVE"
      />
    );

    expect(screen.getByText('tournaments.viewLive')).toBeInTheDocument();
    expect(screen.queryByText('tournaments.register')).not.toBeInTheDocument();

    rerender(
      <TournamentCard
        {...baseProperties}
        showWaitingSignature
      />
    );

    expect(screen.queryByText('tournaments.registered')).not.toBeInTheDocument();
  });
});
