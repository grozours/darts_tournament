import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentStageActions from '../../../../src/components/live-tournament/use-live-tournament-stage-actions';

const stageDraftsHookMock = vi.fn();
const stageUpdateHookMock = vi.fn();

vi.mock('../../../../src/components/live-tournament/use-live-tournament-stage-drafts', () => ({
  default: (...args: unknown[]) => stageDraftsHookMock(...args),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-stage-update', () => ({
  default: (...args: unknown[]) => stageUpdateHookMock(...args),
}));

describe('useLiveTournamentStageActions', () => {
  beforeEach(() => {
    stageDraftsHookMock.mockReset();
    stageUpdateHookMock.mockReset();
  });

  it('combines draft and update hooks and wires onFinishEdit', () => {
    const cancelEditStage = vi.fn();
    const handleEditStage = vi.fn();
    const handleStageStatusChange = vi.fn();
    const handleStagePoolCountChange = vi.fn();
    const handleStagePlayersPerPoolChange = vi.fn();

    stageDraftsHookMock.mockReturnValue({
      editingStageId: 'stage-1',
      stageStatusDrafts: { 'stage-1': 'EDITION' },
      stagePoolCountDrafts: { 'stage-1': '2' },
      stagePlayersPerPoolDrafts: { 'stage-1': '4' },
      handleEditStage,
      handleStageStatusChange,
      handleStagePoolCountChange,
      handleStagePlayersPerPoolChange,
      cancelEditStage,
    });

    const handleLaunchStage = vi.fn();
    const handleResetStage = vi.fn();
    const handleUpdateStage = vi.fn();
    const handleDeleteStage = vi.fn();
    const handleCompleteStageWithScores = vi.fn();
    const handleRecomputeDoubleStage = vi.fn();

    stageUpdateHookMock.mockReturnValue({
      updatingStageId: 'stage-2',
      handleLaunchStage,
      handleResetStage,
      handleUpdateStage,
      handleDeleteStage,
      handleCompleteStageWithScores,
      handleRecomputeDoubleStage,
    });

    const properties = {
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      reloadLiveViews: vi.fn(async () => undefined),
      setError: vi.fn(),
    };

    const { result } = renderHook(() => useLiveTournamentStageActions(properties));

    expect(stageUpdateHookMock).toHaveBeenCalledWith(expect.objectContaining({
      t: properties.t,
      getSafeAccessToken: properties.getSafeAccessToken,
      reloadLiveViews: properties.reloadLiveViews,
      setError: properties.setError,
      stageStatusDrafts: { 'stage-1': 'EDITION' },
      stagePoolCountDrafts: { 'stage-1': '2' },
      stagePlayersPerPoolDrafts: { 'stage-1': '4' },
      onFinishEdit: cancelEditStage,
    }));

    expect(result.current.editingStageId).toBe('stage-1');
    expect(result.current.updatingStageId).toBe('stage-2');
    expect(result.current.handleEditStage).toBe(handleEditStage);
    expect(result.current.handleStageStatusChange).toBe(handleStageStatusChange);
    expect(result.current.handleLaunchStage).toBe(handleLaunchStage);
    expect(result.current.handleResetStage).toBe(handleResetStage);
    expect(result.current.handleUpdateStage).toBe(handleUpdateStage);
    expect(result.current.handleDeleteStage).toBe(handleDeleteStage);
    expect(result.current.handleCompleteStageWithScores).toBe(handleCompleteStageWithScores);
    expect(result.current.handleRecomputeDoubleStage).toBe(handleRecomputeDoubleStage);
    expect(result.current.cancelEditStage).toBe(cancelEditStage);
  });
});
