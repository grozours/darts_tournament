import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useLiveTournamentMatchScores from '../../../../src/components/live-tournament/use-live-tournament-match-scores';

describe('useLiveTournamentMatchScores', () => {
  it('sets and updates score for the same match key', () => {
    const { result } = renderHook(() => useLiveTournamentMatchScores());

    act(() => {
      result.current.handleScoreChange('t1:m1', 'p1', '2');
    });

    expect(result.current.matchScores).toEqual({
      't1:m1': { p1: '2' },
    });

    act(() => {
      result.current.handleScoreChange('t1:m1', 'p2', '3');
    });

    expect(result.current.matchScores).toEqual({
      't1:m1': { p1: '2', p2: '3' },
    });
  });

  it('replaces scores for a match with setMatchScoresForMatch', () => {
    const { result } = renderHook(() => useLiveTournamentMatchScores());

    act(() => {
      result.current.setMatchScoresForMatch('t1:m1', { p1: '1' });
    });

    expect(result.current.matchScores).toEqual({ 't1:m1': { p1: '1' } });

    act(() => {
      result.current.setMatchScoresForMatch('t1:m1', { p1: '4', p2: '0' });
    });

    expect(result.current.matchScores).toEqual({ 't1:m1': { p1: '4', p2: '0' } });
  });
});
