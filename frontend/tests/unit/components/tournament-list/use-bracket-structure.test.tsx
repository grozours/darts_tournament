import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { BracketType } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useBracketStructure from '../../../../src/components/tournament-list/use-bracket-structure';

const createBracket = vi.fn();
const deleteBracket = vi.fn();
const fetchBrackets = vi.fn();
const fetchTournamentTargets = vi.fn();
const updateBracket = vi.fn();
const updateBracketTargets = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  createBracket: (...args: unknown[]) => createBracket(...args),
  deleteBracket: (...args: unknown[]) => deleteBracket(...args),
  fetchBrackets: (...args: unknown[]) => fetchBrackets(...args),
  fetchTournamentTargets: (...args: unknown[]) => fetchTournamentTargets(...args),
  updateBracket: (...args: unknown[]) => updateBracket(...args),
  updateBracketTargets: (...args: unknown[]) => updateBracketTargets(...args),
}));

describe('useBracketStructure', () => {
  beforeEach(() => {
    createBracket.mockReset();
    deleteBracket.mockReset();
    fetchBrackets.mockReset();
    fetchTournamentTargets.mockReset();
    updateBracket.mockReset();
    updateBracketTargets.mockReset();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  const build = (override: Record<string, unknown> = {}) => renderHook(() => useBracketStructure({
    t: (key: string) => key,
    editingTournament: { id: 't1', name: 'Cup' } as never,
    authEnabled: true,
    getSafeAccessToken: vi.fn(async () => 'token'),
    poolStages: [{ stageNumber: 1, poolCount: 2, playersPerPool: 4, advanceCount: 2, losersAdvanceToBracket: false }],
    ...override,
  }));

  it('loads brackets and targets with auth guard', async () => {
    fetchBrackets.mockResolvedValue([{ id: 'b1', name: 'Main', totalRounds: 3, bracketType: 'SINGLE_ELIMINATION', status: 'NOT_STARTED' }]);
    fetchTournamentTargets.mockResolvedValue([{ id: 'target-1', targetNumber: 1 }]);
    const { result } = build();

    await act(async () => {
      await result.current.loadBrackets('t1');
      await result.current.loadTargets('t1');
    });

    expect(result.current.brackets).toHaveLength(1);
    expect(result.current.targets).toHaveLength(1);

    const { result: noToken } = build({
      authEnabled: true,
      getSafeAccessToken: vi.fn(async () => undefined),
    });
    await act(async () => {
      await noToken.current.loadTargets('t1');
    });
    expect(fetchTournamentTargets).toHaveBeenCalledTimes(1);
  });

  it('adds, updates target selection, and removes bracket', async () => {
    fetchBrackets.mockResolvedValue([{ id: 'b1', name: 'Main', totalRounds: 3, bracketType: 'SINGLE_ELIMINATION', status: 'NOT_STARTED', targetIds: [] }]);
    fetchTournamentTargets.mockResolvedValue([]);
    createBracket.mockResolvedValue(undefined);
    updateBracket.mockResolvedValue(undefined);
    updateBracketTargets.mockResolvedValue(undefined);
    deleteBracket.mockResolvedValue(undefined);

    const { result } = build();

    await act(async () => {
      await result.current.addBracket();
    });
    expect(result.current.bracketsError).toBe('edit.error.bracketNameRequired');

    act(() => {
      result.current.startAddBracket();
      result.current.handleNewBracketNameChange('Main Bracket');
      result.current.handleNewBracketTypeChange(BracketType.SINGLE_ELIMINATION);
      result.current.handleNewBracketRoundsChange(2);
      result.current.handleNewBracketRoundMatchFormatChange(2, 'BO5');
    });

    await act(async () => {
      await result.current.addBracket();
      await result.current.loadBrackets('t1');
    });
    expect(createBracket).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleBracketTargetToggle('b1', 'target-1');
    });
    const bracket = result.current.brackets[0]!;

    await act(async () => {
      await result.current.saveBracket(bracket);
      await result.current.saveBracketTargets({ ...bracket, targetIds: ['target-1'] } as never);
    });

    expect(updateBracket).toHaveBeenCalledTimes(1);
    expect(updateBracketTargets).toHaveBeenCalledWith('t1', 'b1', ['target-1'], 'token');

    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);
    await act(async () => {
      await result.current.removeBracket('b1');
    });
    expect(deleteBracket).toHaveBeenCalledTimes(0);

    await act(async () => {
      await result.current.removeBracket('b1');
    });
    expect(deleteBracket).toHaveBeenCalledWith('t1', 'b1', 'token');
  });
});
