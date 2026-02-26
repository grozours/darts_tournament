import { describe, expect, it } from 'vitest';
import { buildPoolLeaderboard } from '../../../../src/components/live-tournament/pool-leaderboard';

describe('buildPoolLeaderboard', () => {
  it('builds leaderboard from completed matches only', () => {
    const leaderboard = buildPoolLeaderboard({
      id: 'pool-1',
      poolNumber: 1,
      name: 'Pool 1',
      status: 'IN_PROGRESS',
      assignments: [
        { id: 'a1', player: { id: 'p1', firstName: 'Alice', lastName: 'A' } },
        { id: 'a2', player: { id: 'p2', firstName: 'Bob', lastName: 'B' } },
      ],
      matches: [
        {
          id: 'm1',
          matchNumber: 1,
          roundNumber: 1,
          status: 'COMPLETED',
          playerMatches: [
            { playerPosition: 1, player: { id: 'p1', firstName: 'Alice', lastName: 'A' }, scoreTotal: 3 },
            { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'B' }, scoreTotal: 1 },
          ],
        },
        {
          id: 'm2',
          matchNumber: 2,
          roundNumber: 1,
          status: 'SCHEDULED',
          playerMatches: [
            { playerPosition: 1, player: { id: 'p1', firstName: 'Alice', lastName: 'A' }, scoreTotal: 0 },
            { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'B' }, scoreTotal: 0 },
          ],
        },
      ],
    } as never);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.playerId).toBe('p1');
    expect(leaderboard[0]?.legsWon).toBeGreaterThan(leaderboard[1]?.legsWon ?? 0);
    expect(leaderboard[0]?.position).toBe(1);
  });

  it('applies head-to-head bonus when tied on legs won', () => {
    const leaderboard = buildPoolLeaderboard({
      id: 'pool-1',
      poolNumber: 1,
      name: 'Pool 1',
      status: 'IN_PROGRESS',
      assignments: [
        { id: 'a1', player: { id: 'p1', firstName: 'A', lastName: 'A' } },
        { id: 'a2', player: { id: 'p2', firstName: 'B', lastName: 'B' } },
      ],
      matches: [
        {
          id: 'm1',
          matchNumber: 1,
          roundNumber: 1,
          status: 'COMPLETED',
          playerMatches: [
            { playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 2 },
            { playerPosition: 2, player: { id: 'p2', firstName: 'B', lastName: 'B' }, scoreTotal: 1 },
          ],
        },
        {
          id: 'm2',
          matchNumber: 2,
          roundNumber: 1,
          status: 'COMPLETED',
          playerMatches: [
            { playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 1 },
            { playerPosition: 2, player: { id: 'p2', firstName: 'B', lastName: 'B' }, scoreTotal: 2 },
          ],
        },
      ],
    } as never);

    const p1 = leaderboard.find((row) => row.playerId === 'p1');
    expect(p1?.headToHeadBonus).toBe(1);
  });
});
