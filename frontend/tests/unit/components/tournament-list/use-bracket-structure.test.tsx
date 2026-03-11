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

  it('computes loser bracket rounds and preserves manual rounds edits', () => {
    const { result } = build({
      poolStages: [{ stageNumber: 2, poolCount: 4, playersPerPool: 4, advanceCount: 2, losersAdvanceToBracket: true }],
    });

    expect(result.current.getDefaultBracketRounds('Losers bracket', BracketType.SINGLE_ELIMINATION)).toBe(3);

    act(() => {
      result.current.startAddBracket();
      result.current.handleNewBracketRoundsChange(4);
    });

    act(() => {
      result.current.handleNewBracketNameChange('Changed after manual rounds');
      result.current.handleNewBracketTypeChange(BracketType.DOUBLE_ELIMINATION);
    });

    expect(result.current.newBracket.totalRounds).toBe(4);

    act(() => {
      result.current.handleNewBracketRoundMatchFormatChange(2, undefined);
      result.current.cancelAddBracket();
      result.current.resetBracketState();
    });

    expect(result.current.newBracket.roundMatchFormats['2']).toBe('BO5');
    expect(result.current.isAddingBracket).toBe(false);
  });

  it('handles loaders and mutations error fallbacks', async () => {
    fetchBrackets.mockRejectedValueOnce({ unexpected: true });
    fetchTournamentTargets.mockRejectedValueOnce({ unexpected: true });
    updateBracket.mockRejectedValueOnce({ unexpected: true });
    updateBracketTargets.mockRejectedValueOnce({ unexpected: true });

    const { result } = build();

    await act(async () => {
      await result.current.loadBrackets('t1');
      await result.current.loadTargets('t1');
      await result.current.saveBracket({
        id: 'b1',
        tournamentId: 't1',
        name: 'Main',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 2,
        status: 'NOT_STARTED',
      });
      await result.current.saveBracketTargets({
        id: 'b1',
        tournamentId: 't1',
        name: 'Main',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 2,
        status: 'NOT_STARTED',
      });
    });

    expect(result.current.bracketsError).toBe('edit.error.failedUpdateBracketTargets');
    expect(result.current.targetsError).toBe('edit.error.failedLoadTargets');
  });

  it('uses defaults when pool stages are missing and skips auth target loading without token', async () => {
    fetchTournamentTargets.mockResolvedValue([{ id: 'target-1', targetNumber: 1 }]);
    const { result } = build({
      poolStages: [],
      getSafeAccessToken: vi.fn(async () => undefined),
    });

    expect(result.current.getDefaultBracketRounds('Main', BracketType.SINGLE_ELIMINATION)).toBe(3);

    await act(async () => {
      await result.current.loadTargets('t1');
    });

    expect(fetchTournamentTargets).not.toHaveBeenCalled();
  });

  it('computes rounds for perdants naming and non-auth target loading path', async () => {
    fetchTournamentTargets.mockResolvedValue([{ id: 'target-2', targetNumber: 2 }]);
    const { result } = build({
      authEnabled: false,
      getSafeAccessToken: vi.fn(async () => undefined),
      poolStages: [{ stageNumber: 3, poolCount: 2, playersPerPool: 6, advanceCount: 2, losersAdvanceToBracket: true }],
    });

    expect(result.current.getDefaultBracketRounds('Tableau des perdants', BracketType.SINGLE_ELIMINATION)).toBe(3);

    await act(async () => {
      await result.current.loadTargets('t1');
    });

    expect(fetchTournamentTargets).toHaveBeenCalledWith('t1', undefined);
    expect(result.current.targets).toHaveLength(1);
  });

  it('returns early for mutations when editing tournament is undefined', async () => {
    const { result } = build({ editingTournament: undefined });

    await act(async () => {
      await result.current.addBracket();
      await result.current.saveBracket({
        id: 'b-early',
        tournamentId: 't1',
        name: 'Early',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 2,
        status: 'NOT_STARTED',
      });
      await result.current.saveBracketTargets({
        id: 'b-early',
        tournamentId: 't1',
        name: 'Early',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 2,
        status: 'NOT_STARTED',
      });
      await result.current.removeBracket('b-early');
    });

    expect(createBracket).not.toHaveBeenCalled();
    expect(updateBracket).not.toHaveBeenCalled();
    expect(updateBracketTargets).not.toHaveBeenCalled();
    expect(deleteBracket).not.toHaveBeenCalled();
  });
});
