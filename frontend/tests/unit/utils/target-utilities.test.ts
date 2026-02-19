import { describe, expect, it } from 'vitest';
import {
  buildInUseTargetNumbers,
  formatTargetLabel,
  getHasLoserBracket,
  getMatchTargetLabel,
  getSharedAvailableTargets,
  getTargetLabel,
} from '../../../src/components/live-tournament/target-utilities';
import type { LiveViewData } from '../../../src/components/live-tournament/types';

const t = (key: string) => key;

describe('target-utilities', () => {
  it('formats target labels and detects loser brackets', () => {
    expect(formatTargetLabel('target 3', t)).toBe('targets.target 3');
    expect(formatTargetLabel('Board A', t)).toBe('Board A');

    const matchLabel = getMatchTargetLabel({ targetCode: 'target 5', targetNumber: 5 }, t);
    expect(matchLabel).toBe('targets.target 5');

    const targetLabel = getTargetLabel({ id: 't-1', targetNumber: 7, targetCode: 'target 7' }, t);
    expect(targetLabel).toBe('targets.target 7');

    expect(getHasLoserBracket([{ id: 'b-1', name: 'Loser Bracket', bracketType: 'SINGLE', status: 'DRAFT' }])).toBe(true);
    expect(getHasLoserBracket([{ id: 'b-2', name: 'Main', bracketType: 'DOUBLE_ELIMINATION', status: 'DRAFT' }])).toBe(true);
    expect(getHasLoserBracket([{ id: 'b-3', name: 'Main', bracketType: 'SINGLE', status: 'DRAFT' }])).toBe(false);
  });

  it('builds in-use targets and filters shared available targets', () => {
    const view: LiveViewData = {
      id: 't-1',
      name: 'Alpha',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          status: 'IN_PROGRESS',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              status: 'IN_PROGRESS',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'COMPLETED',
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
      targets: [
        { id: 'target-1', targetNumber: 1, status: 'IN_USE', currentMatchId: 'match-1' },
        { id: 'target-2', targetNumber: 2, status: 'IN_USE' },
        { id: 'target-3', targetNumber: 3, status: 'MAINTENANCE' },
        { id: 'target-4', targetNumber: 4, status: 'AVAILABLE' },
      ],
    };

    const inUse = buildInUseTargetNumbers([view]);
    expect(inUse.has(1)).toBe(false);
    expect(inUse.has(2)).toBe(true);

    const available = getSharedAvailableTargets(view, inUse);
    expect(available.map((target) => target.targetNumber)).toEqual([1, 4]);
  });
});
