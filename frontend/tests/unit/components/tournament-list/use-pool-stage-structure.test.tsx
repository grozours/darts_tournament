import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
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

  it('surfaces load errors and supports reset state', async () => {
    fetchPoolStages.mockRejectedValueOnce(new Error('load failed'));
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    expect(result.current.poolStagesError).toBe('load failed');

    act(() => {
      result.current.startAddPoolStage();
      result.current.handleNewPoolStageNameChange('Temp stage');
      result.current.resetPoolStageState();
    });

    expect(result.current.isAddingPoolStage).toBe(false);
    expect(result.current.newPoolStage.name).toBe('');
    expect(result.current.poolStages).toEqual([]);
  });

  it('updates stage and draft match format fields including clearing value', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      matchFormatKey: 'BO3',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
        { position: 3, destinationType: 'ELIMINATED' },
        { position: 4, destinationType: 'ELIMINATED' },
      ],
    }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    act(() => {
      result.current.handlePoolStageMatchFormatChange('s1', undefined);
      result.current.handlePoolStageMatchFormatChange('s1', 'BO5');
      result.current.handleNewPoolStageMatchFormatChange(undefined);
      result.current.handleNewPoolStageMatchFormatChange('BO3');
    });

    expect(result.current.poolStages[0]?.matchFormatKey).toBe('BO5');
    expect(result.current.newPoolStage.matchFormatKey).toBe('BO3');
  });

  it('updates stage and draft fields including ranking destinations', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    act(() => {
      result.current.handlePoolStageNumberChange('s1', 2);
      result.current.handlePoolStageNameChange('s1', 'Updated Stage');
      result.current.handlePoolStagePoolCountChange('s1', 3);
      result.current.handlePoolStagePlayersPerPoolChange('s1', 3);
      result.current.handlePoolStageAdvanceCountChange('s1', 2);
      result.current.handlePoolStageLosersAdvanceChange('s1', true);
      result.current.handlePoolStageRankingDestinationChange('s1', 1, {
        destinationType: 'BRACKET',
        bracketId: 'b1',
      });
      result.current.handlePoolStageRankingDestinationChange('s1', 2, {
        destinationType: 'POOL_STAGE',
        poolStageId: 's2',
      });
      result.current.handlePoolStageRankingDestinationChange('s1', 3, {
        destinationType: 'ELIMINATED',
      });

      result.current.handleNewPoolStageStageNumberChange(5);
      result.current.handleNewPoolStageNameChange('Draft Stage');
      result.current.handleNewPoolStagePoolCountChange(4);
      result.current.handleNewPoolStagePlayersPerPoolChange(3);
      result.current.handleNewPoolStageAdvanceCountChange(1);
      result.current.handleNewPoolStageLosersAdvanceChange(true);
      result.current.handleNewPoolStageRankingDestinationChange(1, {
        destinationType: 'BRACKET',
        bracketId: 'b2',
      });
      result.current.handleNewPoolStageRankingDestinationChange(2, {
        destinationType: 'POOL_STAGE',
        poolStageId: 's3',
      });
      result.current.cancelAddPoolStage();
    });

    const updatedStage = result.current.poolStages[0]!;
    expect(updatedStage.stageNumber).toBe(2);
    expect(updatedStage.name).toBe('Updated Stage');
    expect(updatedStage.poolCount).toBe(3);
    expect(updatedStage.playersPerPool).toBe(3);
    expect(updatedStage.advanceCount).toBe(2);
    expect(updatedStage.losersAdvanceToBracket).toBe(true);
    expect(updatedStage.rankingDestinations?.find((destination) => destination.position === 1)).toEqual(
      expect.objectContaining({ destinationType: 'BRACKET', bracketId: 'b1' })
    );
    expect(updatedStage.rankingDestinations?.find((destination) => destination.position === 2)).toEqual(
      expect.objectContaining({ destinationType: 'POOL_STAGE', poolStageId: 's2' })
    );

    expect(result.current.newPoolStage.stageNumber).toBe(5);
    expect(result.current.newPoolStage.name).toBe('Draft Stage');
    expect(result.current.newPoolStage.poolCount).toBe(4);
    expect(result.current.newPoolStage.playersPerPool).toBe(3);
    expect(result.current.newPoolStage.advanceCount).toBe(1);
    expect(result.current.newPoolStage.losersAdvanceToBracket).toBe(true);
    expect(result.current.newPoolStage.rankingDestinations?.find((destination) => destination.position === 1)).toEqual(
      expect.objectContaining({ destinationType: 'BRACKET', bracketId: 'b2' })
    );
    expect(result.current.newPoolStage.rankingDestinations?.find((destination) => destination.position === 2)).toEqual(
      expect.objectContaining({ destinationType: 'POOL_STAGE', poolStageId: 's3' })
    );
    expect(result.current.isAddingPoolStage).toBe(false);
  });

  it('handles missing tournament in mutations and validates pool-stage destinations', async () => {
    const { result } = build({ editingTournament: undefined });

    await act(async () => {
      await result.current.addPoolStage();
      await result.current.savePoolStage({
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        poolCount: 2,
        playersPerPool: 2,
        advanceCount: 1,
        losersAdvanceToBracket: false,
        status: 'EDITION',
        rankingDestinations: [
          { position: 1, destinationType: 'POOL_STAGE' },
          { position: 2, destinationType: 'ELIMINATED' },
        ],
      } as never);
      await result.current.removePoolStage('s1');
    });

    expect(createPoolStage).not.toHaveBeenCalled();
    expect(updatePoolStage).not.toHaveBeenCalled();
    expect(deletePoolStage).not.toHaveBeenCalled();

    const withTournament = build();
    fetchPoolStages.mockResolvedValueOnce([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE' },
      ],
    }]);

    await act(async () => {
      await withTournament.result.current.loadPoolStages('t1');
    });

    await act(async () => {
      await withTournament.result.current.savePoolStage(withTournament.result.current.poolStages[0]!);
    });

    expect(withTournament.result.current.poolStagesError).toBe('edit.error.poolDestinationsIncomplete');
  });

  it('toggles add-draft mode with start and cancel handlers', () => {
    const { result } = build();

    act(() => {
      result.current.startAddPoolStage();
    });
    expect(result.current.isAddingPoolStage).toBe(true);

    act(() => {
      result.current.cancelAddPoolStage();
    });
    expect(result.current.isAddingPoolStage).toBe(false);
  });

  it('normalizes draft ranking destinations when players-per-pool changes', () => {
    const { result } = build();

    act(() => {
      result.current.handleNewPoolStagePlayersPerPoolChange(6);
    });

    expect(result.current.newPoolStage.playersPerPool).toBe(6);
    expect(result.current.newPoolStage.rankingDestinations?.length).toBe(6);
  });

  it('normalizes stage ranking destinations when players-per-pool changes', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    act(() => {
      result.current.handlePoolStagePlayersPerPoolChange('s1', 4);
    });

    expect(result.current.poolStages[0]?.playersPerPool).toBe(4);
    expect(result.current.poolStages[0]?.rankingDestinations?.length).toBe(4);
  });

  it('validates new stage destinations when pool-stage destination misses poolStageId', async () => {
    const { result } = build();

    act(() => {
      result.current.startAddPoolStage();
      result.current.handleNewPoolStageNameChange('Stage 2');
      result.current.handleNewPoolStagePlayersPerPoolChange(2);
      result.current.handleNewPoolStageRankingDestinationChange(1, { destinationType: 'POOL_STAGE' });
      result.current.handleNewPoolStageRankingDestinationChange(2, { destinationType: 'ELIMINATED' });
    });

    await act(async () => {
      await result.current.addPoolStage();
    });

    expect(result.current.poolStagesError).toBe('edit.error.poolDestinationsMissingPoolStage');
  });

  it('validates stage save when bracket destination misses bracketId', async () => {
    const stage = {
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    };
    const { result } = build();

    await act(async () => {
      await result.current.savePoolStage(stage as never);
    });

    expect(result.current.poolStagesError).toBe('edit.error.poolDestinationsMissingBracket');
  });

  it('validates stage save when pool-stage destination misses poolStageId', async () => {
    const stage = {
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    };
    const { result } = build();

    await act(async () => {
      await result.current.savePoolStage(stage as never);
    });

    expect(result.current.poolStagesError).toBe('edit.error.poolDestinationsMissingPoolStage');
  });

  it('surfaces fallback update error when save mutation rejects with non-error', async () => {
    updatePoolStage.mockRejectedValueOnce('failed');
    const stage = {
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    };
    const { result } = build();

    await act(async () => {
      await result.current.savePoolStage(stage as never);
    });

    expect(result.current.poolStagesError).toBe('edit.error.failedUpdatePoolStage');
  });

  it('surfaces fallback add error when create mutation rejects with non-error', async () => {
    createPoolStage.mockRejectedValueOnce('failed');
    const { result } = build();

    act(() => {
      result.current.startAddPoolStage();
      result.current.handleNewPoolStageNameChange('Stage 2');
      result.current.handleNewPoolStagePlayersPerPoolChange(2);
      result.current.handleNewPoolStageRankingDestinationChange(1, { destinationType: 'ELIMINATED' });
      result.current.handleNewPoolStageRankingDestinationChange(2, { destinationType: 'ELIMINATED' });
    });

    await act(async () => {
      await result.current.addPoolStage();
    });

    expect(result.current.poolStagesError).toBe('edit.error.failedAddPoolStage');
  });

  it('surfaces fallback delete error when delete mutation rejects with non-error', async () => {
    deletePoolStage.mockRejectedValueOnce('failed');
    const { result } = build();

    await act(async () => {
      await result.current.removePoolStage('s1');
    });

    expect(result.current.poolStagesError).toBe('edit.error.failedDeletePoolStage');
  });

  it('surfaces fallback load error when fetching stages rejects with non-error', async () => {
    fetchPoolStages.mockRejectedValueOnce('failed');
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    expect(result.current.poolStagesError).toBe('edit.error.failedLoadPoolStages');
  });

  it('updates stage status locally when handlePoolStageStatusChange is called', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'NOT_STARTED',
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    }]);
    updatePoolStage.mockResolvedValue(undefined);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    const currentStage = result.current.poolStages[0]!;
    act(() => {
      result.current.handlePoolStageStatusChange(currentStage, 'IN_PROGRESS');
    });

    expect(result.current.poolStages[0]?.status).toBe('IN_PROGRESS');
  });

  it('can set stage ranking destination back to eliminated', async () => {
    fetchPoolStages.mockResolvedValue([{
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      losersAdvanceToBracket: false,
      status: 'EDITION',
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET', bracketId: 'b1' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadPoolStages('t1');
    });

    act(() => {
      result.current.handlePoolStageRankingDestinationChange('s1', 1, { destinationType: 'ELIMINATED' });
    });

    expect(result.current.poolStages[0]?.rankingDestinations?.[0]).toEqual(
      expect.objectContaining({ position: 1, destinationType: 'ELIMINATED' })
    );
  });

  it('can set draft ranking destination back to eliminated', () => {
    const { result } = build();

    act(() => {
      result.current.handleNewPoolStageRankingDestinationChange(1, {
        destinationType: 'BRACKET',
        bracketId: 'b1',
      });
      result.current.handleNewPoolStageRankingDestinationChange(1, {
        destinationType: 'ELIMINATED',
      });
    });

    expect(result.current.newPoolStage.rankingDestinations?.[0]).toEqual(
      expect.objectContaining({ position: 1, destinationType: 'ELIMINATED' })
    );
  });
});
