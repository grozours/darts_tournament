import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentStageUpdate from '../../../../src/components/live-tournament/use-live-tournament-stage-update';

const completePoolStageWithScores = vi.fn();
const deletePoolStage = vi.fn();
const updatePoolStage = vi.fn();
const recomputeDoubleStageProgression = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  completePoolStageWithScores: (...args: unknown[]) => completePoolStageWithScores(...args),
  deletePoolStage: (...args: unknown[]) => deletePoolStage(...args),
  updatePoolStage: (...args: unknown[]) => updatePoolStage(...args),
  recomputeDoubleStageProgression: (...args: unknown[]) => recomputeDoubleStageProgression(...args),
}));

describe('useLiveTournamentStageUpdate', () => {
  const stage = { id: 's1', status: 'EDITION', pools: [{ assignments: [{ playerId: 'p1' }] }] } as never;

  beforeEach(() => {
    completePoolStageWithScores.mockReset();
    deletePoolStage.mockReset();
    updatePoolStage.mockReset();
    recomputeDoubleStageProgression.mockReset();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  const build = (override: Record<string, unknown> = {}) => renderHook(() => useLiveTournamentStageUpdate({
    t: (key: string) => key,
    getSafeAccessToken: vi.fn(async () => 'token'),
    reloadLiveViews: vi.fn(async () => undefined),
    setError: vi.fn(),
    stageStatusDrafts: { s1: 'IN_PROGRESS' },
    stagePoolCountDrafts: { s1: '3' },
    stagePlayersPerPoolDrafts: { s1: '4' },
    onFinishEdit: vi.fn(),
    ...override,
  }));

  it('launches stage with IN_PROGRESS when assignments exist', async () => {
    const { result } = build();

    await act(async () => {
      await result.current.handleLaunchStage('t1', stage);
    });

    expect(updatePoolStage).toHaveBeenCalledWith('t1', 's1', { status: 'IN_PROGRESS' }, 'token');
  });

  it('resets/deletes/completes/recomputes only when confirmed', async () => {
    const { result } = build();

    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);
    await act(async () => {
      await result.current.handleResetStage('t1', stage);
    });
    expect(updatePoolStage).toHaveBeenCalledTimes(0);

    await act(async () => {
      await result.current.handleDeleteStage('t1', stage);
      await result.current.handleCompleteStageWithScores('t1', stage);
      await result.current.handleRecomputeDoubleStage('t1', stage);
    });

    expect(deletePoolStage).toHaveBeenCalledWith('t1', 's1', 'token');
    expect(completePoolStageWithScores).toHaveBeenCalledWith('t1', 's1', 'token');
    expect(recomputeDoubleStageProgression).toHaveBeenCalledWith('t1', 's1', 'token');
  });

  it('updates stage using numeric drafts and reports fallback error', async () => {
    updatePoolStage.mockRejectedValueOnce('boom');
    const setError = vi.fn();
    const onFinishEdit = vi.fn();
    const { result } = build({
      setError,
      onFinishEdit,
      stagePoolCountDrafts: { s1: 'not-a-number' },
      stagePlayersPerPoolDrafts: { s1: '0' },
    });

    await act(async () => {
      await result.current.handleUpdateStage('t1', stage);
    });

    expect(setError).toHaveBeenCalledWith('Failed to update pool stage');
    expect(onFinishEdit).not.toHaveBeenCalled();
  });
});
