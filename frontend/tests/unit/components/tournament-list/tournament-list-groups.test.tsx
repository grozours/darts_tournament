import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TournamentListGroups from '../../../../src/components/tournament-list/tournament-list-groups';

const tournamentCardSpy = vi.fn();

vi.mock('../../../../src/components/tournament-list/tournament-card', () => ({
  default: (properties: unknown) => {
    tournamentCardSpy(properties);
    const props = properties as { tournament: { id: string; name: string }; statusLabel: string };
    return (
      <div data-testid={`card-${props.tournament.id}`}>
        <span>{props.tournament.name}</span>
        <span>{props.statusLabel}</span>
      </div>
    );
  },
}));

const translate = (key: string) => key;

describe('TournamentListGroups', () => {
  const baseProperties = {
    normalizeStatus: (status?: string) => status ?? 'OPEN',
    isAuthenticated: true,
    t: translate,
    userRegistrations: new Set<string>(),
    onOpenRegistration: vi.fn(),
    onOpenSignature: vi.fn(),
    onAutoFillPlayers: vi.fn(),
    onConfirmAllPlayers: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRegister: vi.fn(),
    onUnregister: vi.fn(),
  };

  beforeEach(() => {
    tournamentCardSpy.mockReset();
  });

  it('hides DRAFT group for non-admin users', () => {
    render(
      <TournamentListGroups
        {...baseProperties}
        isAdmin={false}
        groupedTournaments={[
          {
            status: 'DRAFT',
            title: 'Draft',
            items: [{ id: 'd1', name: 'Draft Cup', status: 'DRAFT' }],
          },
          {
            status: 'OPEN',
            title: 'Open',
            items: [{ id: 'o1', name: 'Open Cup', status: 'OPEN' }],
          },
        ] as never}
      />
    );

    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByTestId('card-o1')).toBeInTheDocument();
  });

  it('uses waiting signature label for registered non-admin user', () => {
    render(
      <TournamentListGroups
        {...baseProperties}
        isAdmin={false}
        userRegistrations={new Set(['s1'])}
        groupedTournaments={[
          {
            status: 'SIGNATURE',
            title: 'Signature',
            items: [{ id: 's1', name: 'Signature Cup', status: 'SIGNATURE' }],
          },
        ] as never}
      />
    );

    expect(screen.getByTestId('card-s1')).toBeInTheDocument();
    expect(screen.getByText('tournaments.waitingSignature')).toBeInTheDocument();
  });
});
