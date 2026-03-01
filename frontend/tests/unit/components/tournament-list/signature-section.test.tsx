import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SignatureSection from '../../../../src/components/tournament-list/signature-section';

describe('SignatureSection', () => {
  const t = (key: string) => key;

  it('renders controls and triggers callbacks', () => {
    const onConfirmAllPlayers = vi.fn();
    const onFetchPlayers = vi.fn();
    const onTogglePlayerCheckIn = vi.fn();

    render(
      <SignatureSection
        t={t}
        players={[{ playerId: 'p1', name: 'Player One', checkedIn: false }] as never}
        playersLoading={false}
        isConfirmingAll={false}
        onConfirmAllPlayers={onConfirmAllPlayers}
        onFetchPlayers={onFetchPlayers}
        onTogglePlayerCheckIn={onTogglePlayerCheckIn}
      />
    );

    fireEvent.click(screen.getByText('edit.confirmAll'));
    fireEvent.click(screen.getByText('common.refresh'));
    fireEvent.click(screen.getByText('edit.confirmCheckIn'));

    expect(onConfirmAllPlayers).toHaveBeenCalledTimes(1);
    expect(onFetchPlayers).toHaveBeenCalledTimes(1);
    expect(onTogglePlayerCheckIn).toHaveBeenCalledTimes(1);
  });

  it('disables confirm-all when everyone is checked in', () => {
    render(
      <SignatureSection
        t={t}
        players={[
          { playerId: 'p1', name: 'Player One', checkedIn: true },
          { playerId: 'p2', name: 'Player Two', checkedIn: true },
        ] as never}
        playersLoading={false}
        isConfirmingAll={false}
        onConfirmAllPlayers={vi.fn()}
        onFetchPlayers={vi.fn()}
        onTogglePlayerCheckIn={vi.fn()}
      />
    );

    expect(screen.getByText('edit.confirmAll')).toBeDisabled();
  });

  it('shows players error and empty list message', () => {
    render(
      <SignatureSection
        t={t}
        players={[]}
        playersLoading={false}
        playersError="error"
        isConfirmingAll={false}
        onConfirmAllPlayers={vi.fn()}
        onFetchPlayers={vi.fn()}
        onTogglePlayerCheckIn={vi.fn()}
      />
    );

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('edit.noPlayersRegistered')).toBeInTheDocument();
  });

  it('shows confirming progress label and disables confirm-all while running', () => {
    render(
      <SignatureSection
        t={t}
        players={[{ playerId: 'p1', name: 'Player One', checkedIn: false }] as never}
        playersLoading={false}
        checkingInPlayerId="p1"
        isConfirmingAll
        confirmAllProgress={{ current: 3, total: 8 }}
        onConfirmAllPlayers={vi.fn()}
        onFetchPlayers={vi.fn()}
        onTogglePlayerCheckIn={vi.fn()}
      />
    );

    expect(screen.getByText('edit.confirming (3/8)')).toBeDisabled();
    expect(screen.getByText('edit.saving')).toBeDisabled();
  });
});
