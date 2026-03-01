import { describe, expect, it, jest } from '@jest/globals';
import { createTournamentModelStats } from '../../src/models/tournament-model/stats';

describe('tournament model stats', () => {
  it('builds overview, participants and distributions with percentages', async () => {
    let countCall = 0;
    let groupByCall = 0;
    const prisma = {
      tournament: {
        count: jest.fn(async () => {
          countCall += 1;
          return countCall === 1 ? 10 : 3;
        }),
        groupBy: jest.fn(async () => {
          groupByCall += 1;
          if (groupByCall === 1) {
            return [
              { status: 'DRAFT', _count: { status: 2 } },
              { status: 'LIVE', _count: { status: 3 } },
              { status: 'FINISHED', _count: { status: 5 } },
            ];
          }
          return [
            { format: 'SINGLE', _count: { format: 6 } },
            { format: 'DOUBLE', _count: { format: 4 } },
          ];
        }),
        aggregate: jest.fn(async () => ({
          _sum: { totalParticipants: 320 },
          _avg: { totalParticipants: 32 },
          _max: { totalParticipants: 64 },
          _min: { totalParticipants: 8 },
        })),
      },
      player: {
        count: jest.fn(async () => 123),
      },
    } as never;

    const handlers = createTournamentModelStats(prisma);
    const stats = await handlers.getOverallStats();

    expect(stats.overview.totalTournaments).toBe(10);
    expect(stats.overview.activeTournaments).toBe(3);
    expect(stats.overview.completedTournaments).toBe(5);
    expect(stats.overview.completionRate).toBe(62.5);
    expect(stats.participants.currentParticipants).toBe(123);
    expect(stats.distribution.byStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'DRAFT', percentage: 20 }),
        expect.objectContaining({ status: 'FINISHED', percentage: 50 }),
      ])
    );
  });

  it('returns completionRate 0 when all tournaments are draft', async () => {
    let countCall = 0;
    let groupByCall = 0;
    const prisma = {
      tournament: {
        count: jest.fn(async () => {
          countCall += 1;
          return countCall === 1 ? 2 : 0;
        }),
        groupBy: jest.fn(async () => {
          groupByCall += 1;
          return groupByCall === 1 ? [{ status: 'DRAFT', _count: { status: 2 } }] : [];
        }),
        aggregate: jest.fn(async () => ({
          _sum: { totalParticipants: null },
          _avg: { totalParticipants: null },
          _max: { totalParticipants: null },
          _min: { totalParticipants: null },
        })),
      },
      player: { count: jest.fn(async () => 0) },
    } as never;

    const handlers = createTournamentModelStats(prisma);
    const stats = await handlers.getOverallStats();

    expect(stats.overview.completionRate).toBe(0);
    expect(stats.participants.totalCapacity).toBe(0);
  });

  it('maps errors to STATS_QUERY_ERROR app error', async () => {
    const prisma = {
      tournament: {
        count: jest.fn(async () => {
          throw new Error('db-failure');
        }),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      player: { count: jest.fn() },
    } as never;

    const handlers = createTournamentModelStats(prisma);

    await expect(handlers.getOverallStats()).rejects.toMatchObject({ code: 'STATS_QUERY_ERROR' });
  });
});
