import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TournamentEditHeader from '../../../../src/components/tournament-list/tournament-edit-header';

describe('tournament-edit-header', () => {
  const renderHeader = (format?: string) => {
    const onClose = vi.fn();
    const maybeFormat = format ? { tournamentFormat: format } : {};
    render(
      <TournamentEditHeader
        t={(key: string) => key}
        tournamentId="t1"
        {...maybeFormat}
        onClose={onClose}
      />
    );
    return { onClose };
  };

  it('uses players, doublettes and equipes links based on tournament format', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'tournaments.registered' })).toHaveAttribute(
      'href',
      '/?view=tournament-players&tournamentId=t1'
    );

    renderHeader('DOUBLE');
    expect(screen.getAllByRole('link', { name: 'tournaments.registered' }).at(-1)).toHaveAttribute(
      'href',
      '/?view=doublettes&tournamentId=t1'
    );

    renderHeader('TEAM_4_PLAYER');
    expect(screen.getAllByRole('link', { name: 'tournaments.registered' }).at(-1)).toHaveAttribute(
      'href',
      '/?view=equipes&tournamentId=t1'
    );
  });

  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'edit.close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
