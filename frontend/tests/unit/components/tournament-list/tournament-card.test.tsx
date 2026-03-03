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
    onRegisterGroup: vi.fn(),
    onUnregisterGroup: vi.fn(),
    onUnregister: vi.fn(),
    onOpenRegistration: vi.fn(),
    onOpenSignature: vi.fn(),
    onAutoFillPlayers: vi.fn(),
    onConfirmAllPlayers: vi.fn(),
    userRegistrations: new Set<string>(),
    userGroupStatus: undefined,
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

  it('hides admin and registration action buttons for FINISHED cards', () => {
    const { rerender } = render(
      <TournamentCard
        {...baseProperties}
        isAdmin
        normalizedStatus="FINISHED"
      />
    );

    expect(screen.queryByText('tournaments.edit')).not.toBeInTheDocument();
    expect(screen.queryByText('tournaments.register')).not.toBeInTheDocument();

    rerender(
      <TournamentCard
        {...baseProperties}
        normalizedStatus="FINISHED"
        tournament={{ ...baseTournament, format: 'DOUBLE' } as never}
      />
    );

    expect(screen.queryByRole('link', { name: 'tournaments.createOwnDoublette' })).not.toBeInTheDocument();

    rerender(
      <TournamentCard
        {...baseProperties}
        normalizedStatus="FINISHED"
        tournament={{ ...baseTournament, format: 'TEAM_4_PLAYER' } as never}
      />
    );

    expect(screen.queryByRole('link', { name: 'tournaments.createOwnEquipe' })).not.toBeInTheDocument();
  });

  it('renders a mini live QR link with tournamentId in URL', () => {
    render(<TournamentCard {...baseProperties} />);

    const qrLink = screen.getByRole('link', { name: 'Live QR Cup' });
    expect(qrLink).toHaveAttribute('href', '/?view=live&tournamentId=t1');
    expect(qrLink).toHaveAttribute('title', expect.stringContaining('/?view=live&tournamentId=t1'));
  });

  it('opens QR SVG in new tab for admin click', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr-test-url');
    const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => null);

    render(<TournamentCard {...baseProperties} isAdmin />);

    const qrLink = screen.getByRole('link', { name: 'Live QR Cup' });
    fireEvent.click(qrLink);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      'blob:qr-test-url',
      '_blank',
      'noopener,noreferrer'
    );

    createObjectURLSpy.mockRestore();
    openSpy.mockRestore();
  });

  it('renders auto-fill action for OPEN admin tournaments', () => {
    const onAutoFillPlayers = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        isAdmin
        normalizedStatus="OPEN"
        showOpenAutoFillAction
        onAutoFillPlayers={onAutoFillPlayers}
      />
    );

    fireEvent.click(screen.getByText('edit.autoFillPlayers'));
    expect(onAutoFillPlayers).toHaveBeenCalledWith('t1');
  });

  it('renders signature auto action for SIGNATURE admin tournaments', () => {
    const onConfirmAllPlayers = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        isAdmin
        normalizedStatus="SIGNATURE"
        showSignatureAutoConfirmAction
        onConfirmAllPlayers={onConfirmAllPlayers}
      />
    );

    fireEvent.click(screen.getByText('tournaments.autoSignature'));
    expect(onConfirmAllPlayers).toHaveBeenCalledWith('t1');
  });

  it('routes registered link to format-specific views', () => {
    const { rerender } = render(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'DOUBLE' } as never}
      />
    );

    expect(screen.getByRole('link', { name: 'tournaments.registered' })).toHaveAttribute(
      'href',
      '/?view=doublettes&tournamentId=t1'
    );

    rerender(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'TEAM_4_PLAYER' } as never}
      />
    );

    expect(screen.getByRole('link', { name: 'tournaments.registered' })).toHaveAttribute(
      'href',
      '/?view=equipes&tournamentId=t1'
    );

    rerender(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'SINGLE' } as never}
      />
    );

    expect(screen.getByRole('link', { name: 'tournaments.registered' })).toHaveAttribute(
      'href',
      '/?view=tournament-players&tournamentId=t1'
    );
  });

  it('shows format-aware participant label on the stats card', () => {
    const { rerender } = render(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'SINGLE' } as never}
      />
    );

    expect(screen.getByText('common.players')).toBeInTheDocument();

    rerender(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'DOUBLE' } as never}
      />
    );

    expect(screen.getAllByText('groups.doublettes').length).toBeGreaterThan(0);

    rerender(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'TEAM_4_PLAYER' } as never}
      />
    );

    expect(screen.getAllByText('groups.equipes').length).toBeGreaterThan(0);
  });

  it('shows create-own-group links for DOUBLE and TEAM when user has no group', () => {
    const { rerender } = render(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'DOUBLE' } as never}
      />
    );

    const doubleRegisterLink = screen.getByRole('link', { name: 'tournaments.createOwnDoublette' });
    expect(doubleRegisterLink).toHaveAttribute(
      'href',
      '/?view=doublettes&tournamentId=t1'
    );
    expect(doubleRegisterLink.className).toContain('border-emerald-500/60');

    rerender(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'TEAM_4_PLAYER' } as never}
      />
    );

    const teamRegisterLink = screen.getByRole('link', { name: 'tournaments.createOwnEquipe' });
    expect(teamRegisterLink).toHaveAttribute(
      'href',
      '/?view=equipes&tournamentId=t1'
    );
    expect(teamRegisterLink.className).toContain('border-emerald-500/60');
  });

  it('renders admin unregister action for registered DOUBLE group', () => {
    const onUnregisterGroup = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'DOUBLE' } as never}
        isAdmin
        onUnregisterGroup={onUnregisterGroup}
        userGroupStatus={{
          groupId: 'd1',
          hasGroup: true,
          isGroupCaptain: false,
          isGroupComplete: true,
          isGroupRegistered: true,
        }}
      />
    );

    fireEvent.click(screen.getByText('tournaments.unregister'));
    expect(onUnregisterGroup).toHaveBeenCalledWith('t1');
  });

  it('renders admin unregister action for registered TEAM group', () => {
    const onUnregisterGroup = vi.fn();

    render(
      <TournamentCard
        {...baseProperties}
        tournament={{ ...baseTournament, format: 'TEAM_4_PLAYER' } as never}
        isAdmin
        onUnregisterGroup={onUnregisterGroup}
        userGroupStatus={{
          groupId: 'e1',
          hasGroup: true,
          isGroupCaptain: false,
          isGroupComplete: true,
          isGroupRegistered: true,
        }}
      />
    );

    fireEvent.click(screen.getByText('tournaments.unregister'));
    expect(onUnregisterGroup).toHaveBeenCalledWith('t1');
  });
});
