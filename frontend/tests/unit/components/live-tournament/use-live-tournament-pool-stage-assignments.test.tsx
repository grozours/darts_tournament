import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import useLiveTournamentPoolStageAssignments from '../../../../src/components/live-tournament/use-live-tournament-pool-stage-assignments';

const fetchTournamentPlayers = vi.fn();
const fetchPoolStagePools = vi.fn();
const updatePoolAssignments = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
  fetchPoolStagePools: (...args: unknown[]) => fetchPoolStagePools(...args),
  updatePoolAssignments: (...args: unknown[]) => updatePoolAssignments(...args),
}));

describe('useLiveTournamentPoolStageAssignments', () => {
  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
    fetchPoolStagePools.mockReset();
    updatePoolAssignments.mockReset();
  });

  it('opens, edits and saves assignments successfully', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player 1' }, { playerId: 'p2', name: 'Player 2' }]);
    fetchPoolStagePools.mockResolvedValue([
      { id: 'pool-1', name: 'Pool 1', assignments: [{ playerId: 'p1' }] },
      { id: 'pool-2', name: 'Pool 2', assignments: [] },
    ]);
    updatePoolAssignments.mockResolvedValue(undefined);

    const reloadLiveViews = vi.fn(async () => undefined);
    const setError = vi.fn();
    const getSafeAccessToken = vi.fn(async () => 'token');
    const t = (key: string) => key;

    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t,
      getSafeAccessToken,
      reloadLiveViews,
      setError,
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments('t1', {
        id: 'stage-1',
        name: 'Stage 1',
        playersPerPool: 2,
      } as never);
    });

    expect(result.current.editingTournamentId).toBe('t1');
    expect(result.current.poolStageAssignments).toEqual({
      'pool-1': ['p1'],
      'pool-2': [],
    });

    act(() => {
      result.current.updatePoolStageAssignment('pool-1', 1, 'p2');
    });

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    expect(updatePoolAssignments).toHaveBeenCalledWith(
      't1',
      'stage-1',
      [
        { poolId: 'pool-1', playerId: 'p1', assignmentType: 'RANDOM', seedNumber: 1 },
        { poolId: 'pool-1', playerId: 'p2', assignmentType: 'RANDOM', seedNumber: 2 },
      ],
      'token'
    );
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(result.current.editingTournamentId).toBeUndefined();
  });

  it('sets translated error when opening assignments fails with non-error value', async () => {
    fetchTournamentPlayers.mockRejectedValue('boom');
    fetchPoolStagePools.mockResolvedValue([]);

    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments('t1', {
        id: 'stage-1',
        name: 'Stage 1',
        playersPerPool: 2,
      } as never);
    });

    await waitFor(() => {
      expect(result.current.poolStageEditError).toBe('edit.error.failedLoadPoolAssignments');
    });
  });

  it('uses explicit error message when opening assignments throws Error and defaults playersPerPool to 0', async () => {
    fetchTournamentPlayers.mockRejectedValue(new Error('load failed'));
    fetchPoolStagePools.mockResolvedValue([]);
    const setError = vi.fn();

    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError,
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments('t1', {
        id: 'stage-1',
        name: 'Stage 1',
      } as never);
    });

    expect(setError).toHaveBeenCalledWith(undefined);
    expect(result.current.editingPoolStage?.playersPerPool).toBe(0);
    expect(result.current.poolStageEditError).toBe('load failed');
  });

  it('does nothing when save is called without editing context', async () => {
    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    expect(updatePoolAssignments).not.toHaveBeenCalled();
  });

  it('sets translated error when saving assignments fails with non-error value', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player 1' }]);
    fetchPoolStagePools.mockResolvedValue([
      { id: 'pool-1', name: 'Pool 1', assignments: [{ playerId: 'p1' }] },
    ]);
    updatePoolAssignments.mockRejectedValue('boom');

    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments('t1', {
        id: 'stage-1',
        name: 'Stage 1',
        playersPerPool: 2,
      } as never);
    });

    await waitFor(() => {
      expect(result.current.editingPoolStage?.id).toBe('stage-1');
    });

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    await waitFor(() => {
      expect(result.current.poolStageEditError).toBe('edit.error.failedUpdatePoolAssignments');
    });
  });

  it('filters empty assignment slots and uses explicit Error message on save failure', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player 1' }]);
    fetchPoolStagePools.mockResolvedValue([
      { id: 'pool-1', name: 'Pool 1', assignments: [{ playerId: 'p1' }] },
    ]);
    updatePoolAssignments.mockRejectedValue(new Error('save failed'));

    const { result } = renderHook(() => useLiveTournamentPoolStageAssignments({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments('t1', {
        id: 'stage-1',
        name: 'Stage 1',
        playersPerPool: 2,
      } as never);
    });

    act(() => {
      result.current.updatePoolStageAssignment('pool-1', 1, '');
    });

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    expect(updatePoolAssignments).toHaveBeenCalledWith(
      't1',
      'stage-1',
      [{ poolId: 'pool-1', playerId: 'p1', assignmentType: 'RANDOM', seedNumber: 1 }],
      'token'
    );
    expect(result.current.poolStageEditError).toBe('save failed');
  });
});
