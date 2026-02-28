import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActiveMatchScorePanel from '../../../../src/components/targets-view/active-match-score-panel';

const t = (key: string) => key;

describe('active-match-score-panel', () => {
  it('renders players scores and triggers score + complete callbacks', () => {
    const onScoreChange = vi.fn();
    const onCompleteMatch = vi.fn();
    const match = {
      id: 'm1',
      matchNumber: 1,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      playerMatches: [
        { playerPosition: 1, player: { id: 'p1', firstName: 'Alice', lastName: 'A' } },
        { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'B' } },
      ],
    } as never;

    render(
      <ActiveMatchScorePanel
        t={t}
        match={match}
        matchScores={{ m1: { p1: '10', p2: '12' } }}
        updatingMatchId={undefined}
        onScoreChange={onScoreChange}
        onCompleteMatch={onCompleteMatch}
      />
    );

    expect(screen.getByText('live.finalScore')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '15' } });
    expect(onScoreChange).toHaveBeenCalledWith('m1', 'p1', '15');

    fireEvent.click(screen.getByRole('button', { name: 'live.completeMatch' }));
    expect(onCompleteMatch).toHaveBeenCalledWith(match);
  });

  it('disables completion while updating and handles missing player ids', () => {
    const onScoreChange = vi.fn();
    const onCompleteMatch = vi.fn();
    const match = {
      id: 'm2',
      matchNumber: 2,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      playerMatches: [
        { playerPosition: 1, player: { firstName: 'NoId', lastName: 'Player' } },
      ],
    } as never;

    render(
      <ActiveMatchScorePanel
        t={t}
        match={match}
        matchScores={{}}
        updatingMatchId="m2"
        onScoreChange={onScoreChange}
        onCompleteMatch={onCompleteMatch}
      />
    );

    const scoreInput = screen.getByRole('spinbutton');
    fireEvent.change(scoreInput, { target: { value: '3' } });
    expect(onScoreChange).toHaveBeenCalledWith('m2', '', '3');

    const saveButton = screen.getByRole('button', { name: 'live.savingMatch' });
    expect(saveButton).toBeDisabled();
  });
});
