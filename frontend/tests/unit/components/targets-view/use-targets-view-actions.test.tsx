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
    let updatedViews: unknown;
    const setLiveViews = vi.fn((updater: (views: unknown[]) => unknown[]) => {
      const initialViews = [
        {
          id: 't1',
          poolStages: [
            { id: 's-no-pools' },
            {
              id: 's1',
              pools: [
                { id: 'p-no-matches' },
                {
                  id: 'p1',
                  matches: [
                    { id: 'm1', status: 'IN_PROGRESS', targetId: 'target-1', target: { id: 'target-1' } },
                    { id: 'm2', status: 'SCHEDULED', targetId: 'target-2', target: { id: 'target-2' } },
                  ],
                },
              ],
            },
          ],
          brackets: [
            { id: 'b-no-matches' },
            {
              id: 'b1',
              matches: [
                { id: 'm1', status: 'IN_PROGRESS', targetId: 'target-1', target: { id: 'target-1' } },
              ],
            },
          ],
          targets: [
            { id: 'target-1', targetNumber: 1, status: 'IN_USE', currentMatchId: 'm1' },
            { id: 'target-2', targetNumber: 2, status: 'IN_USE', currentMatchId: 'm2' },
            { id: 'target-3', targetNumber: 3, status: 'AVAILABLE' },
          ],
        },
        { id: 'other-tournament', targets: [{ id: 'x', targetNumber: 4, status: 'IN_USE', currentMatchId: 'm1' }] },
      ];
      updatedViews = updater(initialViews);
    });
    updateMatchStatus.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTargetsViewActions({
      t: (key: string) => key,
      getSafeAccessToken: vi.fn(async () => 'token'),
      loadTargets,
      setLiveViews,
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

    expect(Array.isArray(updatedViews)).toBe(true);
    const [updatedCurrentView, untouchedView] = updatedViews as Array<Record<string, unknown>>;
    const updatedStageMatch = ((updatedCurrentView.poolStages as Array<Record<string, unknown>>)[1].pools as Array<Record<string, unknown>>)[1]
      .matches as Array<Record<string, unknown>>;
    expect(updatedStageMatch[0]).toMatchObject({ id: 'm1', status: 'SCHEDULED' });
    expect(updatedStageMatch[0]).not.toHaveProperty('targetId');
    expect(updatedStageMatch[0]).not.toHaveProperty('target');

    const updatedBracketMatch = ((updatedCurrentView.brackets as Array<Record<string, unknown>>)[1].matches as Array<Record<string, unknown>>)[0];
    expect(updatedBracketMatch).toMatchObject({ id: 'm1', status: 'SCHEDULED' });

    const updatedTargets = updatedCurrentView.targets as Array<Record<string, unknown>>;
    expect(updatedTargets[0]).toMatchObject({ id: 'target-1', status: 'AVAILABLE' });
    expect(updatedTargets[0]).not.toHaveProperty('currentMatchId');
    expect(updatedTargets[1]).toMatchObject({ id: 'target-2', status: 'IN_USE', currentMatchId: 'm2' });
    expect(untouchedView).toEqual({
      id: 'other-tournament',
      targets: [{ id: 'x', targetNumber: 4, status: 'IN_USE', currentMatchId: 'm1' }],
    });
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

  it('uses explicit error message object on cancel failure', async () => {
    const loadTargets = vi.fn(async () => undefined);
    const setError = vi.fn();
    updateMatchStatus.mockRejectedValue(new Error('cancel failed'));

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

    expect(setError).toHaveBeenCalledWith('cancel failed');
    expect(loadTargets).toHaveBeenCalledWith({ silent: true });
  });
});
