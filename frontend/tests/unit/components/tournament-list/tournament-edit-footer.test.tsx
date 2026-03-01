import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TournamentEditFooter from '../../../../src/components/tournament-list/tournament-edit-footer';

describe('tournament-edit-footer', () => {
  const baseProperties = () => ({
    t: (key: string) => key,
    normalizedStatus: 'OPEN',
    isSaving: false,
    players: [{ playerId: 'p1', checkedIn: true }],
    canOpenRegistration: true,
    onClose: vi.fn(),
    onMoveToSignature: vi.fn(),
    onMoveToLive: vi.fn(),
    onOpenRegistration: vi.fn(),
    onSaveEdit: vi.fn(),
  });

  it('renders open-state actions and disables open-registration while already open', () => {
    const properties = baseProperties();
    render(<TournamentEditFooter {...properties} />);

    const openRegistration = screen.getByRole('button', { name: 'edit.registrationOpen' });
    expect(screen.getByRole('button', { name: 'edit.moveToSignature' })).toBeInTheDocument();
    expect(openRegistration).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit.moveToSignature' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit.saveChanges' }));

    expect(properties.onClose).toHaveBeenCalledTimes(1);
    expect(properties.onMoveToSignature).toHaveBeenCalledTimes(1);
    expect(properties.onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it('handles signature and live statuses with proper visibility/disabled rules', () => {
    const signatureWithUnchecked = baseProperties();
    const first = render(
      <TournamentEditFooter
        {...signatureWithUnchecked}
        normalizedStatus="SIGNATURE"
        players={[{ playerId: 'p1', checkedIn: false }]}
      />
    );

    expect(screen.getByRole('button', { name: 'edit.startLive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'edit.openRegistration' })).toBeEnabled();
    first.unmount();

    const signatureReady = baseProperties();
    const second = render(
      <TournamentEditFooter
        {...signatureReady}
        normalizedStatus="SIGNATURE"
        players={[{ playerId: 'p1', checkedIn: true }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit.startLive' }));
    expect(signatureReady.onMoveToLive).toHaveBeenCalledTimes(1);
    second.unmount();

    const liveProperties = baseProperties();
    render(<TournamentEditFooter {...liveProperties} normalizedStatus="LIVE" />);
    expect(screen.queryByRole('button', { name: 'edit.openRegistration' })).not.toBeInTheDocument();
  });

  it('shows saving label and disables buttons when saving', () => {
    const properties = baseProperties();
    render(<TournamentEditFooter {...properties} isSaving normalizedStatus="SIGNATURE" players={[]} />);

    expect(screen.getByRole('button', { name: 'edit.saving' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'edit.startLive' })).toBeDisabled();
  });
});
