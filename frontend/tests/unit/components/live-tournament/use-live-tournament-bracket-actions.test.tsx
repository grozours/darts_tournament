import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentBracketActions from '../../../../src/components/live-tournament/use-live-tournament-bracket-actions';

const completeBracketRoundWithScores = vi.fn();
const populateBracketFromPools = vi.fn();
const resetBracketMatches = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  completeBracketRoundWithScores: (...args: unknown[]) => completeBracketRoundWithScores(...args),
  populateBracketFromPools: (...args: unknown[]) => populateBracketFromPools(...args),
  resetBracketMatches: (...args: unknown[]) => resetBracketMatches(...args),
}));

describe('useLiveTournamentBracketActions', () => {
  beforeEach(() => {
    completeBracketRoundWithScores.mockReset();
    populateBracketFromPools.mockReset();
    resetBracketMatches.mockReset();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('sets error when no active matches are available', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useLiveTournamentBracketActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError,
    }));

    await act(async () => {
      await result.current.handleCompleteBracketRound('t1', {
        id: 'b1',
        name: 'Bracket',
        status: 'IN_PROGRESS',
        bracketType: 'SINGLE_ELIMINATION',
        matches: [{ id: 'm1', status: 'COMPLETED', roundNumber: 1, matchNumber: 1 }],
      } as never);
    });

    expect(setError).toHaveBeenCalledWith('No matches available to complete in this bracket round.');
    expect(completeBracketRoundWithScores).not.toHaveBeenCalled();
  });

  it('completes round, resets and populates bracket', async () => {
    const reloadLiveViews = vi.fn(async () => undefined);
    const { result } = renderHook(() => useLiveTournamentBracketActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews,
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleCompleteBracketRound('t1', {
        id: 'b1',
        name: 'Bracket',
        status: 'IN_PROGRESS',
        bracketType: 'SINGLE_ELIMINATION',
        matches: [
          { id: 'm1', status: 'SCHEDULED', roundNumber: 2, matchNumber: 1 },
          { id: 'm2', status: 'IN_PROGRESS', roundNumber: 1, matchNumber: 2 },
        ],
      } as never);

      await result.current.handleResetBracketMatches('t1', 'b1');
      await result.current.handlePopulateBracketFromPools('t1', 'b1', { id: 's1' } as never);
    });

    expect(completeBracketRoundWithScores).toHaveBeenCalledWith('t1', 'b1', 1, 'token');
    expect(resetBracketMatches).toHaveBeenCalledWith('t1', 'b1', 'token');
    expect(populateBracketFromPools).toHaveBeenCalledWith('t1', 'b1', 's1', undefined, 'token');
    expect(reloadLiveViews).toHaveBeenCalled();
  });

  it('tracks selected bracket and stops populate when confirmation is cancelled', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);
    const { result } = renderHook(() => useLiveTournamentBracketActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    }));

    act(() => {
      result.current.handleSelectBracket('t1', 'b1');
    });

    await act(async () => {
      await result.current.handlePopulateBracketFromPools('t1', 'b1', { id: 's1' } as never);
    });

    expect(result.current.activeBracketByTournament).toEqual({ t1: 'b1' });
    expect(populateBracketFromPools).not.toHaveBeenCalled();
  });
});
