import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePoolStageStructure from '../../../../src/components/tournament-list/use-pool-stage-structure';

const createPoolStage = vi.fn();
const deletePoolStage = vi.fn();
const fetchPoolStages = vi.fn();
const updatePoolStage = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  createPoolStage: (...args: unknown[]) => createPoolStage(...args),
  deletePoolStage: (...args: unknown[]) => deletePoolStage(...args),
  fetchPoolStages: (...args: unknown[]) => fetchPoolStages(...args),
  updatePoolStage: (...args: unknown[]) => updatePoolStage(...args),
}));

describe('usePoolStageStructure', () => {
  beforeEach(() => {
    createPoolStage.mockReset();
    deletePoolStage.mockReset();
    fetchPoolStages.mockReset();
    updatePoolStage.mockReset();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  const build = (override: Record<string, unknown> = {}) => renderHook(() => usePoolStageStructure({
    t: (key: string) => key,
    editingTournament: { id: 't1', name: 'Cup' } as never,
    authEnabled: false,
    getSafeAccessToken: vi.fn(async () => 'token'),
    ...override,
  }));

  it('loads pool stages and computes next stage number', async () => {
    fetchPoolStages.mockResolvedValue([{ stageNumber: 2 }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    expect(result.current.newPoolStage.stageNumber).toBe(3);
  });

  it('validates add and handles successful add', async () => {
    fetchPoolStages.mockResolvedValue([]);
    createPoolStage.mockResolvedValue(undefined);
    const { result } = build();

    await act(async () => {
      await result.current.addPoolStage();
    });
    expect(result.current.poolStagesError).toBe('edit.error.stageNameRequired');

    act(() => {
      result.current.startAddPoolStage();
      result.current.handleNewPoolStageNameChange('Stage 1');
      result.current.handleNewPoolStageRankingDestinationChange(1, { destinationType: 'BRACKET' });
    });

    await act(async () => {
      await result.current.addPoolStage();
    });
    expect(result.current.poolStagesError).toBe('edit.error.poolDestinationsMissingBracket');

    act(() => {
      result.current.handleNewPoolStageRankingDestinationChange(1, { destinationType: 'ELIMINATED' });
    });

    await act(async () => {
      await result.current.addPoolStage();
    });

    expect(createPoolStage).toHaveBeenCalledTimes(1);
    expect(result.current.isAddingPoolStage).toBe(false);
  });

  it('saves stage status and remove branch honors confirm', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      losersAdvanceToBracket: false,
      status: 'NOT_STARTED',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
        { position: 3, destinationType: 'ELIMINATED' },
        { position: 4, destinationType: 'ELIMINATED' },
      ],
    }]);
    updatePoolStage.mockResolvedValue(undefined);
    deletePoolStage.mockResolvedValue(undefined);

    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    const stage = result.current.poolStages[0]!;
    act(() => {
      result.current.handlePoolStageStatusChange(stage, 'IN_PROGRESS');
    });

    await waitFor(() => {
      expect(updatePoolStage).toHaveBeenCalled();
    });

    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);
    await act(async () => {
      await result.current.removePoolStage('s1');
    });
    expect(deletePoolStage).toHaveBeenCalledTimes(0);

    await act(async () => {
      await result.current.removePoolStage('s1');
    });
    expect(deletePoolStage).toHaveBeenCalledWith('t1', 's1', 'token');
  });
});
