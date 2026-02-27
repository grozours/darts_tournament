import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTargetsViewStartMatch from '../../../../src/components/targets-view/use-targets-view-start-match';

const updateMatchStatus = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  updateMatchStatus: (...args: unknown[]) => updateMatchStatus(...args),
}));

describe('useTargetsViewStartMatch', () => {
  beforeEach(() => {
    updateMatchStatus.mockReset();
  });

  it('starts a match successfully and clears target selection', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();
    const getSafeAccessToken = vi.fn(async () => 'token');
    const matchTournamentById = new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]);
    const sharedTargets = [
      { targetNumber: 5, isInUse: false, targetIdsByTournament: new Map([['t1', 'target-1']]) },
    ];

    const { result } = renderHook(() => useTargetsViewStartMatch({
      t: (key: string) => key,
      getSafeAccessToken,
      loadTargets,
      setError,
      matchTournamentById,
      sharedTargets,
    }));

    act(() => {
      result.current.handleQueueSelectionChange('5', 'm1');
    });

    await act(async () => {
      await result.current.handleStartMatch('m1', 5);
    });

    expect(updateMatchStatus).toHaveBeenCalledWith('t1', 'm1', 'IN_PROGRESS', 'target-1', 'token');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
    expect(result.current.matchSelectionByTarget).toEqual({});
  });

  it('sets error when tournament mapping is missing', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();

    const { result } = renderHook(() => useTargetsViewStartMatch({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets,
      setError,
      matchTournamentById: new Map(),
      sharedTargets: [],
    }));

    await act(async () => {
      await result.current.handleStartMatch('m1', 5);
    });

    expect(setError).toHaveBeenCalledWith('Match tournament not found');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
  });

  it('sets error when target is unavailable', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();

    const sharedTargets = [
      { targetNumber: 5, isInUse: true, targetIdsByTournament: new Map([['t1', 'target-1']]) },
    ];

    const { result } = renderHook(() => useTargetsViewStartMatch({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets,
      setError,
      matchTournamentById: new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]),
      sharedTargets,
    }));

    await act(async () => {
      await result.current.handleStartMatch('m1', 5);
    });

    expect(setError).toHaveBeenCalledWith('Target is not available');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
    expect(updateMatchStatus).not.toHaveBeenCalled();
  });
});
