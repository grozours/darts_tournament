import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillLevel } from '@shared/types';
import type { TournamentPlayer } from '../../../../src/services/tournament-service';
import { RegistrationPlayersList, SignaturePlayersList } from '../../../../src/components/tournament-list/player-lists';

let isAdmin = false;

vi.mock('../../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin }),
}));

const t = (key: string) => key;

const basePlayer: TournamentPlayer = {
  playerId: 'p1',
  name: 'Alice',
  email: 'alice@example.com',
  skillLevel: SkillLevel.EXPERT,
  checkedIn: false,
};

const renderRegistrationList = (overrides?: Partial<Parameters<typeof RegistrationPlayersList>[0]>) => render(
  <RegistrationPlayersList
    players={[basePlayer]}
    playersLoading={false}
    t={t}
    onEdit={() => {}}
    onRemove={() => {}}
    {...overrides}
  />
);

const renderSignatureList = (overrides?: Partial<Parameters<typeof SignaturePlayersList>[0]>) => render(
  <SignaturePlayersList
    players={[basePlayer]}
    playersLoading={false}
    t={t}
    checkingInPlayerId={undefined}
    onToggleCheckIn={() => {}}
    {...overrides}
  />
);

describe('registration player list skill visibility', () => {
  beforeEach(() => {
    isAdmin = false;
  });

  it('hides skill badge for non-admin accounts', () => {
    renderRegistrationList();
    expect(screen.queryByText('EXPERT')).not.toBeInTheDocument();
  });

  it('renders loading and empty states', () => {
    const { rerender } = renderRegistrationList({ players: [], playersLoading: true });
    expect(screen.getByText('edit.loadingPlayers')).toBeInTheDocument();

    rerender(
      <RegistrationPlayersList
        players={[]}
        playersLoading={false}
        t={t}
        onEdit={() => {}}
        onRemove={() => {}}
      />
    );

    expect(screen.getByText('edit.noPlayersRegistered')).toBeInTheDocument();
  });

  it('triggers edit and remove callbacks', () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();

    renderRegistrationList({ onEdit, onRemove });

    screen.getByRole('button', { name: 'edit.edit' }).click();
    screen.getByRole('button', { name: 'edit.remove' }).click();

    expect(onEdit).toHaveBeenCalledWith(basePlayer);
    expect(onRemove).toHaveBeenCalledWith('p1');
  });

  it('shows skill badge for admin accounts', () => {
    isAdmin = true;
    renderRegistrationList();
    expect(screen.getByText('EXPERT')).toBeInTheDocument();
  });
});

describe('signature player list skill visibility', () => {
  beforeEach(() => {
    isAdmin = false;
  });

  it('hides skill badge for non-admin accounts', () => {
    renderSignatureList();
    expect(screen.queryByText('EXPERT')).not.toBeInTheDocument();
  });

  it('switches check-in labels by player state', () => {
    const checkedInPlayer: TournamentPlayer = { ...basePlayer, checkedIn: true };
    const { rerender } = renderSignatureList();

    expect(screen.getByRole('button', { name: 'edit.confirmCheckIn' })).toBeInTheDocument();

    rerender(
      <SignaturePlayersList
        players={[checkedInPlayer]}
        playersLoading={false}
        t={t}
        checkingInPlayerId={undefined}
        onToggleCheckIn={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'edit.undo' })).toBeInTheDocument();

    rerender(
      <SignaturePlayersList
        players={[basePlayer]}
        playersLoading={false}
        t={t}
        checkingInPlayerId="p1"
        onToggleCheckIn={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'edit.saving' })).toBeDisabled();
  });

  it('triggers check-in callback', () => {
    const onToggleCheckIn = vi.fn();
    renderSignatureList({ onToggleCheckIn });
    screen.getByRole('button', { name: 'edit.confirmCheckIn' }).click();
    expect(onToggleCheckIn).toHaveBeenCalledWith(basePlayer);
  });

  it('shows skill badge for admin accounts', () => {
    isAdmin = true;
    renderSignatureList();
    expect(screen.getByText('EXPERT')).toBeInTheDocument();
  });
});
