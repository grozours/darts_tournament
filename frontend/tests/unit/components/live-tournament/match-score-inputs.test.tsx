import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LiveViewMatch } from '../../../../src/components/live-tournament/types';
import MatchScoreInputs from '../../../../src/components/live-tournament/match-score-inputs';

const match: LiveViewMatch = {
  id: 'm1',
  matchNumber: 1,
  roundNumber: 1,
  status: 'IN_PROGRESS',
  playerMatches: [
    { playerPosition: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
    { playerPosition: 2, player: { id: 'p2', firstName: 'Bo', lastName: 'Bowen' } },
  ],
};

describe('MatchScoreInputs', () => {
  it('renders inputs and triggers score changes', () => {
    const onScoreChange = vi.fn();

    render(
      <MatchScoreInputs
        matchTournamentId="t1"
        match={match}
        matchScores={{ 't1:m1': { p1: '1' } }}
        getMatchKey={() => 't1:m1'}
        onScoreChange={onScoreChange}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).value).toBe('1');

    fireEvent.change(inputs[1], { target: { value: '2' } });
    expect(onScoreChange).toHaveBeenCalledWith('t1:m1', 'p2', '2');
  });

  it('uses optional participant label formatter', () => {
    render(
      <MatchScoreInputs
        matchTournamentId="t1"
        match={match}
        matchScores={{}}
        getMatchKey={() => 't1:m1'}
        onScoreChange={vi.fn()}
        getParticipantLabel={(player) => `LABEL:${player?.firstName ?? 'NA'}`}
      />
    );

    expect(screen.getByText('LABEL:Ava')).toBeInTheDocument();
    expect(screen.getByText('LABEL:Bo')).toBeInTheDocument();
  });

  it('handles players without id using empty key', () => {
    const onScoreChange = vi.fn();
    render(
      <MatchScoreInputs
        matchTournamentId="t1"
        match={{
          ...match,
          playerMatches: [{ playerPosition: 1, player: { firstName: 'No', lastName: 'Id' } }],
        }}
        matchScores={{ 't1:m1': { '': '4' } }}
        getMatchKey={() => 't1:m1'}
        onScoreChange={onScoreChange}
      />
    );

    const input = screen.getByRole('spinbutton');
    expect(input.value).toBe('4');
    fireEvent.change(input, { target: { value: '5' } });
    expect(onScoreChange).toHaveBeenCalledWith('t1:m1', '', '5');
  });
});
