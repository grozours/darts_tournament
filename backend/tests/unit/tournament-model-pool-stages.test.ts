import { describe, expect, it, jest } from '@jest/globals';
import { PoolStatus } from '../../../shared/src/types';
import { createTournamentModelPoolStages } from '../../src/models/tournament-model/pool-stages';

const buildPrisma = () => ({
  poolStage: {
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  pool: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  poolAssignment: {
    count: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  player: {
    findMany: jest.fn(),
  },
  match: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  playerMatch: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
  },
  score: {
    deleteMany: jest.fn(),
  },
  target: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(async (steps: unknown[]) => steps),
});

describe('tournament model pool stages', () => {
  it('returns [] when stage list is empty', async () => {
    const prisma = buildPrisma();
    prisma.poolStage.findMany.mockReturnValue(Promise.resolve([]));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.getPoolStages('t1')).resolves.toEqual([]);
  });

  it('returns 0 on count failures', async () => {
    const prisma = buildPrisma();
    prisma.pool.count.mockReturnValueOnce(Promise.reject(new Error('boom')));
    prisma.poolAssignment.count.mockReturnValueOnce(Promise.reject(new Error('boom')));
    prisma.match.count.mockReturnValueOnce(Promise.reject(new Error('boom')));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.getPoolCountForStage('ps-1')).resolves.toBe(0);
    await expect(handlers.getPoolAssignmentCountForStage('ps-1')).resolves.toBe(0);
    await expect(handlers.getMatchCountForPool('pool-1')).resolves.toBe(0);
  });

  it('handles createPoolAssignments and updatePoolStatuses early returns', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.createPoolAssignments([]);
    await handlers.updatePoolStatuses([], PoolStatus.IN_PROGRESS);

    expect(prisma.poolAssignment.createMany).not.toHaveBeenCalled();
    expect(prisma.pool.updateMany).not.toHaveBeenCalled();
  });

  it('handles createPoolMatches and createEmptyPoolMatches early returns', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.createPoolMatches('t1', 'pool-1', []);
    await handlers.createEmptyPoolMatches('t1', 'pool-1', []);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('builds pool names with alphabet fallback branch', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.createPoolsForStage('ps-1', 27, 1);

    const createManyCall = prisma.pool.createMany.mock.calls[0]?.[0] as
      | { data: Array<{ name: string }> }
      | undefined;
    const payload = createManyCall?.data ?? [];
    expect(payload[0]?.name).toBe('Pool A');
    expect(payload[26]?.name).toBe('Pool 27');
  });

  it('throws wrapped error for deletePoolStage when prisma fails', async () => {
    const prisma = buildPrisma();
    prisma.poolStage.delete.mockReturnValue(Promise.reject(new Error('boom')));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.deletePoolStage('ps-1')).rejects.toThrow('Failed to delete pool stage');
  });

  it('throws wrapped error for setPoolMatchPlayers on transaction failure', async () => {
    const prisma = buildPrisma();
    prisma.$transaction.mockRejectedValue(new Error('tx fail'));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.setPoolMatchPlayers('m1', ['p1', 'p2']))
      .rejects.toThrow('Failed to seed pool match players');
  });

  it('resets pool matches and covers transaction branches', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany
      .mockReturnValueOnce(Promise.resolve([{ id: 'm1', targetId: 'target-1' }]))
      .mockReturnValueOnce(Promise.resolve([]));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.resetPoolMatches('pool-1');
    await handlers.resetPoolMatches('pool-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('throws wrapped error when resetPoolMatches transaction fails', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany.mockReturnValue(Promise.resolve([]));
    prisma.$transaction.mockRejectedValue(new Error('tx fail'));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.resetPoolMatches('pool-1')).rejects.toThrow('Failed to reset pool matches');
  });

  it('builds opponent pairs and skips single-player matches', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany.mockReturnValue(Promise.resolve([
      {
        playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }],
      },
      {
        playerMatches: [{ playerId: 'solo' }],
      },
    ]));
    const handlers = createTournamentModelPoolStages(prisma as never);

    const pairs = await handlers.getOpponentPairsBeforeStage('t1', 2);
    expect(pairs).toEqual([
      ['p1', 'p2'],
      ['p1', 'p3'],
      ['p2', 'p3'],
    ]);
  });
});
