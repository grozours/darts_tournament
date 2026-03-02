import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentMatchUpdate from '../../../../src/components/live-tournament/use-live-tournament-match-update';

const updateMatchStatusMock = vi.fn();
const completeMatchMock = vi.fn();
const saveMatchScoresMock = vi.fn();
const validateMatchScoresMock = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  updateMatchStatus: (...arguments_: unknown[]) => updateMatchStatusMock(...arguments_),
  completeMatch: (...arguments_: unknown[]) => completeMatchMock(...arguments_),
  saveMatchScores: (...arguments_: unknown[]) => saveMatchScoresMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-score-validation', () => ({
  default: (...arguments_: unknown[]) => validateMatchScoresMock(...arguments_),
}));

describe('useLiveTournamentMatchUpdate', () => {
  const getSafeAccessToken = vi.fn(async () => 'token');
  const reloadLiveViews = vi.fn(async () => undefined);
  const setError = vi.fn();
  const clearMatchTargetSelection = vi.fn();
  const onSavedMatchScores = vi.fn();

  beforeEach(() => {
    updateMatchStatusMock.mockReset();
    completeMatchMock.mockReset();
    saveMatchScoresMock.mockReset();
    validateMatchScoresMock.mockReset();
    getSafeAccessToken.mockClear();
    reloadLiveViews.mockClear();
    setError.mockClear();
    clearMatchTargetSelection.mockClear();
    onSavedMatchScores.mockClear();
  });

  it('updates match status and clears target selection for in-progress status', async () => {
    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
      matchScores: {},
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'IN_PROGRESS', 'target-1');
    });

    expect(updateMatchStatusMock).toHaveBeenCalledWith('t1', 'm1', 'IN_PROGRESS', 'target-1', 'token', undefined);
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(clearMatchTargetSelection).toHaveBeenCalledWith('t1:m1');
    expect(result.current.updatingMatchId).toBeUndefined();
  });

  it('does not clear target selection for unsupported status values', async () => {
    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k',
      matchScores: {},
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'PAUSED');
    });

    expect(clearMatchTargetSelection).not.toHaveBeenCalled();
  });

  it('clears target selection for completed status', async () => {
    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k',
      matchScores: {},
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'COMPLETED');
    });

    expect(clearMatchTargetSelection).toHaveBeenCalledWith('k');
  });

  it('clears target selection for cancelled and scheduled statuses', async () => {
    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k2',
      matchScores: {},
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'CANCELLED');
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'SCHEDULED');
    });

    expect(clearMatchTargetSelection).toHaveBeenCalledWith('k2');
  });

  it('uses explicit and fallback messages when status update fails', async () => {
    updateMatchStatusMock
      .mockRejectedValueOnce(new Error('status failed'))
      .mockRejectedValueOnce('not-error');

    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k3',
      matchScores: {},
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'IN_PROGRESS');
      await result.current.handleMatchStatusUpdate('t1', 'm1', 'IN_PROGRESS');
    });

    expect(setError).toHaveBeenCalledWith('status failed');
    expect(setError).toHaveBeenCalledWith('Failed to update match status');
  });

  it('aborts complete match when score validation fails', async () => {
    validateMatchScoresMock.mockReturnValue({ scores: undefined, error: 'bad scores' });

    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k',
      matchScores: { k: {} },
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleCompleteMatch('t1', {
        id: 'm1',
        playerMatches: [],
      } as never);
    });

    expect(setError).toHaveBeenCalledWith('bad scores');
    expect(completeMatchMock).not.toHaveBeenCalled();
  });

  it('saves match scores and invokes post-save callback', async () => {
    validateMatchScoresMock.mockReturnValue({
      scores: [{ playerId: 'p1', scoreTotal: 2 }],
      error: undefined,
    });

    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k',
      matchScores: { k: { p1: '2' } },
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleSaveMatchScores('t1', {
        id: 'm1',
        playerMatches: [{ player: { id: 'p1' } }],
      } as never);
    });

    expect(saveMatchScoresMock).toHaveBeenCalledWith('t1', 'm1', [{ playerId: 'p1', scoreTotal: 2 }], 'token');
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(onSavedMatchScores).toHaveBeenCalled();
  });

  it('uses fallback messages when complete/save fail with non-Error', async () => {
    validateMatchScoresMock.mockReturnValue({
      scores: [{ playerId: 'p1', scoreTotal: 2 }],
      error: undefined,
    });
    completeMatchMock.mockRejectedValueOnce('x');
    saveMatchScoresMock.mockRejectedValueOnce('y');

    const { result } = renderHook(() => useLiveTournamentMatchUpdate({
      getSafeAccessToken,
      reloadLiveViews,
      setError,
      getMatchKey: () => 'k',
      matchScores: { k: { p1: '2' } },
      clearMatchTargetSelection,
      onSavedMatchScores,
    }));

    await act(async () => {
      await result.current.handleCompleteMatch('t1', {
        id: 'm1',
        playerMatches: [{ player: { id: 'p1' } }],
      } as never);
      await result.current.handleSaveMatchScores('t1', {
        id: 'm1',
        playerMatches: [{ player: { id: 'p1' } }],
      } as never);
    });

    expect(setError).toHaveBeenCalledWith('Failed to complete match');
    expect(setError).toHaveBeenCalledWith('Failed to update match scores');
  });
});
