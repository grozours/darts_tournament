import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTargetsViewCompleteMatch from '../../../../src/components/targets-view/use-targets-view-complete-match';
import type { LiveViewMatch } from '../../../../src/components/targets-view/types';

const completeMatch = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  completeMatch: (...args: unknown[]) => completeMatch(...args),
}));

describe('useTargetsViewCompleteMatch', () => {
  beforeEach(() => {
    completeMatch.mockReset();
  });

  const build = (override: Record<string, unknown> = {}) => renderHook(() => useTargetsViewCompleteMatch({
    t: (key: string) => key,
    getSafeAccessToken: vi.fn(async () => 'token'),
    loadTargets: vi.fn(async () => undefined),
    applyOptimisticMatchStatus: vi.fn(),
    setError: vi.fn(),
    matchTournamentById: new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]),
    matchScores: { m1: { p1: '15', p2: '20' } },
    ...override,
  }));

  const match: LiveViewMatch = {
    id: 'm1',
    status: 'IN_PROGRESS',
    matchNumber: 1,
    roundNumber: 1,
    playerMatches: [
      { player: { id: 'p1', firstName: 'Ana', lastName: 'A' } },
      { player: { id: 'p2', firstName: 'Bob', lastName: 'B' } },
    ],
  };

  it('sets explicit validation errors before calling API', async () => {
    const setError = vi.fn();
    const { result } = build({ setError, matchTournamentById: new Map() });

    await act(async () => {
      await result.current.handleCompleteMatch(match);
    });
    expect(setError).toHaveBeenCalledWith('Match tournament not found.');

    const withMissingPlayers = build({ setError });
    await act(async () => {
      await withMissingPlayers.result.current.handleCompleteMatch({
        ...match,
        playerMatches: [{ player: { id: 'p1', firstName: 'Ana', lastName: 'A' } }],
      });
    });
    expect(setError).toHaveBeenCalledWith('Match does not have enough players to complete.');

    const withInvalidScore = build({ setError, matchScores: { m1: { p1: '10', p2: 'abc' } } });
    await act(async () => {
      await withInvalidScore.result.current.handleCompleteMatch(match);
    });
    expect(setError).toHaveBeenCalledWith('Please enter valid scores for all players.');
    expect(completeMatch).not.toHaveBeenCalled();
  });

  it('completes match with optimistic status and reloads targets', async () => {
    const applyOptimisticMatchStatus = vi.fn();
    const loadTargets = vi.fn(async () => undefined);
    completeMatch.mockResolvedValue(undefined);

    const { result } = build({ applyOptimisticMatchStatus, loadTargets });

    await act(async () => {
      await result.current.handleCompleteMatch(match);
    });

    expect(applyOptimisticMatchStatus).toHaveBeenCalledWith('t1', 'm1', 'COMPLETED');
    expect(completeMatch).toHaveBeenCalledWith('t1', 'm1', [
      { playerId: 'p1', scoreTotal: 15 },
      { playerId: 'p2', scoreTotal: 20 },
    ], 'token');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
  });

  it('uses explicit error message when completion fails', async () => {
    const setError = vi.fn();
    const loadTargets = vi.fn(async () => undefined);
    completeMatch.mockRejectedValue(new Error('complete failed'));

    const { result } = build({ setError, loadTargets });

    await act(async () => {
      await result.current.handleCompleteMatch(match);
    });

    expect(setError).toHaveBeenCalledWith('complete failed');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
  });
});
