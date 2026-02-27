import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePoolStageAssignments from '../../../../src/components/tournament-list/use-pool-stage-assignments';

const fetchTournamentPlayers = vi.fn();
const fetchPoolStagePools = vi.fn();
const updatePoolAssignments = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...args: unknown[]) => fetchTournamentPlayers(...args),
  fetchPoolStagePools: (...args: unknown[]) => fetchPoolStagePools(...args),
  updatePoolAssignments: (...args: unknown[]) => updatePoolAssignments(...args),
}));

describe('usePoolStageAssignments', () => {
  const tournament = { id: 't1', name: 'Cup' } as never;

  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
    fetchPoolStagePools.mockReset();
    updatePoolAssignments.mockReset();
  });

  it('opens and saves assignments', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player One' }, { playerId: 'p2', name: 'Player Two' }]);
    fetchPoolStagePools.mockResolvedValue([{ id: 'pool-1', poolNumber: 1, assignments: [{ playerId: 'p1' }] }]);
    updatePoolAssignments.mockResolvedValue(undefined);

    const onStopAddingPoolStage = vi.fn();
    const { result } = renderHook(() => usePoolStageAssignments({
      t: (key: string) => key,
      editingTournament: tournament,
      getSafeAccessToken: vi.fn(async () => 'token'),
      onStopAddingPoolStage,
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments({ id: 's1', name: 'Stage 1' } as never);
    });

    expect(onStopAddingPoolStage).toHaveBeenCalledTimes(1);
    expect(result.current.poolStageAssignments).toEqual({ 'pool-1': ['p1'] });

    act(() => {
      result.current.updatePoolStageAssignment('pool-1', 1, 'p2');
    });

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    expect(updatePoolAssignments).toHaveBeenCalledWith(
      't1',
      's1',
      [
        { poolId: 'pool-1', playerId: 'p1', assignmentType: 'RANDOM', seedNumber: 1 },
        { poolId: 'pool-1', playerId: 'p2', assignmentType: 'RANDOM', seedNumber: 2 },
      ],
      'token'
    );
    expect(result.current.editingPoolStage).toBeUndefined();
  });

  it('returns early when no editing tournament', async () => {
    const { result } = renderHook(() => usePoolStageAssignments({
      t: (key: string) => key,
      editingTournament: undefined,
      getSafeAccessToken: vi.fn(async () => 'token'),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments({ id: 's1' } as never);
      await result.current.savePoolStageAssignments();
    });

    expect(fetchTournamentPlayers).not.toHaveBeenCalled();
    expect(updatePoolAssignments).not.toHaveBeenCalled();
  });

  it('sets translated error when open fails with non-error', async () => {
    fetchTournamentPlayers.mockRejectedValue('boom');

    const { result } = renderHook(() => usePoolStageAssignments({
      t: (key: string) => key,
      editingTournament: tournament,
      getSafeAccessToken: vi.fn(async () => 'token'),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments({ id: 's1', name: 'Stage 1' } as never);
    });

    await waitFor(() => {
      expect(result.current.poolStageEditError).toBe('edit.error.failedLoadPoolAssignments');
    });
  });

  it('sets translated error when save fails with non-error', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1', name: 'Player One' }]);
    fetchPoolStagePools.mockResolvedValue([{ id: 'pool-1', poolNumber: 1, assignments: [{ playerId: 'p1' }] }]);
    updatePoolAssignments.mockRejectedValue('boom');

    const { result } = renderHook(() => usePoolStageAssignments({
      t: (key: string) => key,
      editingTournament: tournament,
      getSafeAccessToken: vi.fn(async () => 'token'),
    }));

    await act(async () => {
      await result.current.openPoolStageAssignments({ id: 's1', name: 'Stage 1' } as never);
    });

    await waitFor(() => {
      expect(result.current.editingPoolStage?.id).toBe('s1');
    });

    await act(async () => {
      await result.current.savePoolStageAssignments();
    });

    await waitFor(() => {
      expect(result.current.poolStageEditError).toBe('edit.error.failedUpdatePoolAssignments');
    });
  });
});
