import { describe, expect, it } from 'vitest';
import {
  applyPoolConcurrencySlots,
  buildMissingRoundRobinMatches,
  estimateConflictAwareMinutes,
  getRoundRobinPairKey,
} from '../../../../src/components/live-tournament/conflict-aware-estimator';

describe('conflict-aware-estimator', () => {
  it('applies pool concurrency slots and handles empty list', () => {
    expect(applyPoolConcurrencySlots([], 'pool-1', ['p1', 'p2'])).toEqual([]);

    const result = applyPoolConcurrencySlots([
      { id: 'm1', durationMinutes: 10, playerIds: ['p1', 'p2'] },
      { id: 'm2', durationMinutes: 10, playerIds: ['p3', 'p4'] },
    ], 'pool-1', ['p1', 'p2', 'p3', 'p4']);

    expect(result[0]?.playerIds.some((id) => id.startsWith('__pool_slot:pool-1'))).toBe(true);
  });

  it('computes pair key and missing round robin matches', () => {
    expect(getRoundRobinPairKey(['p2', 'p1'])).toBe('p1::p2');
    expect(getRoundRobinPairKey(['p1'])).toBeUndefined();

    const missing = buildMissingRoundRobinMatches({
      idPrefix: 'pool-1',
      playerIds: ['p1', 'p2', 'p3'],
      existingPairKeys: new Set(['p1::p2']),
      durationMinutes: 12,
    });

    expect(missing).toHaveLength(2);
    expect(missing[0]?.id).toContain('pool-1-missing-');
  });

  it('estimates duration with conflicts and minimum target capacity', () => {
    const minutes = estimateConflictAwareMinutes([
      { id: 'm1', durationMinutes: 10, playerIds: ['p1', 'p2'] },
      { id: 'm2', durationMinutes: 10, playerIds: ['p1', 'p3'] },
      { id: 'm3', durationMinutes: 10, playerIds: ['p4', 'p5'] },
    ], 0);

    expect(minutes).toBeGreaterThanOrEqual(20);
    expect(estimateConflictAwareMinutes([], 2)).toBe(0);
  });
});
