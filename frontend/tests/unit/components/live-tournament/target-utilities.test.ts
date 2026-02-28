import { describe, expect, it } from 'vitest';
import {
  buildInUseTargetNumbers,
  formatTargetLabel,
  getHasLoserBracket,
  getMatchTargetLabel,
  getSchedulableTargets,
  getSharedAvailableTargets,
  getTargetLabel,
} from '../../../../src/components/live-tournament/target-utilities';

const t = (key: string) => key;

describe('live-tournament target-utilities', () => {
  it('detects loser bracket variants', () => {
    expect(getHasLoserBracket()).toBe(false);
    expect(getHasLoserBracket([{ id: 'b1', name: 'Main', bracketType: 'SINGLE_ELIMINATION', matches: [] } as never])).toBe(false);
    expect(getHasLoserBracket([{ id: 'b2', name: 'Lower loser tree', bracketType: 'SINGLE_ELIMINATION', matches: [] } as never])).toBe(true);
    expect(getHasLoserBracket([{ id: 'b3', name: 'Main', bracketType: 'DOUBLE_ELIMINATION', matches: [] } as never])).toBe(true);
  });

  it('formats target labels and resolves match target labels', () => {
    expect(formatTargetLabel(' target 12 ', t)).toBe('targets.target 12');
    expect(formatTargetLabel('Board A', t)).toBe('Board A');

    expect(getMatchTargetLabel(undefined, t)).toBeUndefined();
    expect(getMatchTargetLabel({ targetCode: 'target5' } as never, t)).toBe('targets.target 5');
    expect(getMatchTargetLabel({ name: 'Practice board' } as never, t)).toBe('Practice board');
    expect(getMatchTargetLabel({ targetNumber: 7 } as never, t)).toBe('#7');
    expect(getMatchTargetLabel({} as never, t)).toBeUndefined();

    expect(getTargetLabel({ targetCode: 'target2', targetNumber: 2 } as never, t)).toBe('targets.target 2');
    expect(getTargetLabel({ name: 'Center', targetNumber: 9 } as never, t)).toBe('Center');
    expect(getTargetLabel({ targetNumber: 9 } as never, t)).toBe('#9');
  });

  it('builds in-use target numbers based on target and match statuses', () => {
    const inUse = buildInUseTargetNumbers([
      {
        id: 'v1',
        targets: [
          { targetNumber: 1, status: 'IN_USE', currentMatchId: 'm-pool-progress' },
          { targetNumber: 2, status: 'IN_USE', currentMatchId: 'm-pool-done' },
          { targetNumber: 3, status: 'IN_USE', currentMatchId: 'm-bracket-cancelled' },
          { targetNumber: 4, status: 'IN_USE' },
          { targetNumber: 5, status: 'AVAILABLE' },
        ],
        poolStages: [
          {
            pools: [
              {
                matches: [
                  { id: 'm-pool-progress', status: 'IN_PROGRESS' },
                  { id: 'm-pool-done', status: 'COMPLETED' },
                ],
              },
            ],
          },
        ],
        brackets: [{ matches: [{ id: 'm-bracket-cancelled', status: 'CANCELLED' }] }],
      } as never,
    ]);

    expect([...inUse].sort((a, b) => a - b)).toEqual([1, 4]);
  });

  it('filters shared available and schedulable targets', () => {
    const view = {
      targets: [
        { targetNumber: 1, status: 'AVAILABLE' },
        { targetNumber: 2, status: 'maintenance' },
        { targetNumber: 3, status: 'IN_USE' },
      ],
    } as never;

    expect(getSharedAvailableTargets(view, new Set([3])).map((target) => target.targetNumber)).toEqual([1]);
    expect(getSchedulableTargets(view).map((target) => target.targetNumber)).toEqual([1, 3]);
  });
});
