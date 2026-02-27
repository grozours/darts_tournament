import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTargetsViewActions from '../../../../src/components/targets-view/use-targets-view-actions';

const updateMatchStatus = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  updateMatchStatus: (...args: unknown[]) => updateMatchStatus(...args),
}));

vi.mock('../../../../src/components/targets-view/use-targets-view-match-scores', () => ({
  default: () => ({
    matchScores: { m1: { p1: '2' } },
    handleScoreChange: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/targets-view/use-targets-view-start-match', () => ({
  default: () => ({
    matchSelectionByTarget: { '5': 'm1' },
    startingMatchId: undefined,
    handleQueueSelectionChange: vi.fn(),
    handleStartMatch: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../../src/components/targets-view/use-targets-view-complete-match', () => ({
  default: () => ({
    updatingMatchId: undefined,
    handleCompleteMatch: vi.fn(async () => undefined),
  }),
}));

describe('useTargetsViewActions', () => {
  beforeEach(() => {
    updateMatchStatus.mockReset();
  });

  it('sets explicit error when match tournament is missing', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useTargetsViewActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets: vi.fn(async () => undefined),
      setLiveViews: vi.fn(),
      setError,
      matchTournamentById: new Map(),
      sharedTargets: [],
    }));

    await act(async () => {
      await result.current.handleCancelMatch({ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' });
    });

    expect(setError).toHaveBeenCalledWith('Match tournament not found.');
    expect(updateMatchStatus).not.toHaveBeenCalled();
  });

  it('cancels match and reloads targets on success', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();
    updateMatchStatus.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTargetsViewActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets,
      setLiveViews: vi.fn(),
      setError,
      matchTournamentById: new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]),
      sharedTargets: [],
    }));

    await act(async () => {
      await result.current.handleCancelMatch({ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' });
    });

    expect(updateMatchStatus).toHaveBeenCalledWith('t1', 'm1', 'SCHEDULED', undefined, 'token');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
    expect(setError).toHaveBeenCalledWith(undefined);
  });

  it('sets translated error and reloads silently on cancel failure', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();
    updateMatchStatus.mockRejectedValue('boom');

    const { result } = renderHook(() => useTargetsViewActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets,
      setLiveViews: vi.fn(),
      setError,
      matchTournamentById: new Map([['m1', { tournamentId: 't1', tournamentName: 'Cup' }]]),
      sharedTargets: [],
    }));

    await act(async () => {
      await result.current.handleCancelMatch({ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' });
    });

    expect(setError).toHaveBeenCalledWith('targets.error');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
  });
});
