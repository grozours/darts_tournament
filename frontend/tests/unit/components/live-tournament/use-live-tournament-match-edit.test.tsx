import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useLiveTournamentMatchEdit from '../../../../src/components/live-tournament/use-live-tournament-match-edit';

describe('useLiveTournamentMatchEdit', () => {
  it('initializes scores and editing key when editing a match', () => {
    const setMatchScoresForMatch = vi.fn();
    const { result } = renderHook(() => useLiveTournamentMatchEdit({
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
      setMatchScoresForMatch,
    }));

    act(() => {
      result.current.handleEditMatch('t1', {
        id: 'm1',
        matchNumber: 1,
        roundNumber: 1,
        status: 'IN_PROGRESS',
        playerMatches: [
          { playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'B' }, scoreTotal: 2 },
          { playerPosition: 2, player: { id: 'p2', firstName: 'C', lastName: 'D' }, legsWon: 1 },
        ],
      });
    });

    expect(setMatchScoresForMatch).toHaveBeenCalledWith('t1:m1', { p1: '2', p2: '1' });
    expect(result.current.editingMatchId).toBe('t1:m1');
  });

  it('cancels edit mode', () => {
    const { result } = renderHook(() => useLiveTournamentMatchEdit({
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
      setMatchScoresForMatch: vi.fn(),
    }));

    act(() => {
      result.current.cancelMatchEdit();
    });

    expect(result.current.editingMatchId).toBeUndefined();
  });
});
