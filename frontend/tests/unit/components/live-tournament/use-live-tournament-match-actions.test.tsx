import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import useLiveTournamentMatchActions from '../../../../src/components/live-tournament/use-live-tournament-match-actions';

const resetPoolMatches = vi.fn();
const handleScoreChange = vi.fn();
const setMatchScoresForMatch = vi.fn();
const handleEditMatch = vi.fn();
const cancelMatchEdit = vi.fn();
const handleMatchStatusUpdate = vi.fn();
const handleCompleteMatch = vi.fn();
const handleSaveMatchScores = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  resetPoolMatches: (...args: unknown[]) => resetPoolMatches(...args),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-scores', () => ({
  default: () => ({
    matchScores: { match: { p1: '2' } },
    handleScoreChange,
    setMatchScoresForMatch,
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-edit', () => ({
  default: () => ({
    editingMatchId: 'match',
    handleEditMatch,
    cancelMatchEdit,
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-update', () => ({
  default: () => ({
    updatingMatchId: 'm1',
    handleMatchStatusUpdate,
    handleCompleteMatch,
    handleSaveMatchScores,
  }),
}));

describe('useLiveTournamentMatchActions', () => {
  beforeEach(() => {
    resetPoolMatches.mockReset();
  });

  it('resets pool matches and reloads views on success', async () => {
    const reloadLiveViews = vi.fn(async () => undefined);
    const setError = vi.fn();
    const getSafeAccessToken = vi.fn(async () => 'token');
    resetPoolMatches.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLiveTournamentMatchActions({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      clearMatchTargetSelection: vi.fn(),
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
    }));

    await act(async () => {
      await result.current.handleResetPoolMatches('t1', 's1', 'p1');
    });

    expect(resetPoolMatches).toHaveBeenCalledWith('t1', 's1', 'p1', 'token');
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(setError).toHaveBeenCalledWith(undefined);
  });

  it('sets error when reset fails', async () => {
    const reloadLiveViews = vi.fn(async () => undefined);
    const setError = vi.fn();
    resetPoolMatches.mockRejectedValue(new Error('reset failed'));

    const { result } = renderHook(() => useLiveTournamentMatchActions({
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews,
      setError,
      clearMatchTargetSelection: vi.fn(),
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
    }));

    await act(async () => {
      await result.current.handleResetPoolMatches('t1', 's1', 'p1');
    });

    expect(setError).toHaveBeenCalledWith('reset failed');
  });

  it('uses fallback error when reset throws non-Error value', async () => {
    const setError = vi.fn();
    resetPoolMatches.mockRejectedValue('oops');

    const { result } = renderHook(() => useLiveTournamentMatchActions({
      getSafeAccessToken: vi.fn(async () => undefined),
      reloadLiveViews: vi.fn(async () => undefined),
      setError,
      clearMatchTargetSelection: vi.fn(),
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
    }));

    await act(async () => {
      await result.current.handleResetPoolMatches('t1', 's1', 'p1');
    });

    expect(setError).toHaveBeenCalledWith('Failed to reset pool matches');
  });
});
