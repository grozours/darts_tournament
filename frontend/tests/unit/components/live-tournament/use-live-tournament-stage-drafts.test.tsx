import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import useLiveTournamentStageDrafts from '../../../../src/components/live-tournament/use-live-tournament-stage-drafts';

describe('useLiveTournamentStageDrafts', () => {
  it('initializes and updates stage drafts from edition handlers', () => {
    const { result } = renderHook(() => useLiveTournamentStageDrafts());

    expect(result.current.editingStageId).toBeUndefined();
    expect(result.current.stageStatusDrafts).toEqual({});
    expect(result.current.stagePoolCountDrafts).toEqual({});
    expect(result.current.stagePlayersPerPoolDrafts).toEqual({});

    act(() => {
      result.current.handleEditStage({
        id: 's1',
        status: 'EDITION',
        pools: [{ id: 'p1' }, { id: 'p2' }],
        playersPerPool: 4,
      } as never);
    });

    expect(result.current.editingStageId).toBe('s1');
    expect(result.current.stageStatusDrafts).toEqual({ s1: 'EDITION' });
    expect(result.current.stagePoolCountDrafts).toEqual({ s1: '2' });
    expect(result.current.stagePlayersPerPoolDrafts).toEqual({ s1: '4' });

    act(() => {
      result.current.handleStageStatusChange('s1', 'IN_PROGRESS');
      result.current.handleStagePoolCountChange('s1', '3');
      result.current.handleStagePlayersPerPoolChange('s1', '6');
    });

    expect(result.current.stageStatusDrafts).toEqual({ s1: 'IN_PROGRESS' });
    expect(result.current.stagePoolCountDrafts).toEqual({ s1: '3' });
    expect(result.current.stagePlayersPerPoolDrafts).toEqual({ s1: '6' });

    act(() => {
      result.current.cancelEditStage();
    });

    expect(result.current.editingStageId).toBeUndefined();
  });

  it('handles missing pools and players per pool by using empty strings', () => {
    const { result } = renderHook(() => useLiveTournamentStageDrafts());

    act(() => {
      result.current.handleEditStage({
        id: 's2',
        status: 'NOT_STARTED',
      } as never);
    });

    expect(result.current.stageStatusDrafts).toEqual({ s2: 'NOT_STARTED' });
    expect(result.current.stagePoolCountDrafts).toEqual({ s2: '' });
    expect(result.current.stagePlayersPerPoolDrafts).toEqual({ s2: '' });
  });
});
