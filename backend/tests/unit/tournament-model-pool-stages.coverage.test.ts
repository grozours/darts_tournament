// @ts-nocheck
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { PoolStatus, StageStatus, MatchStatus } from '../../../shared/src/types';
import { Prisma } from '@prisma/client';
import { createTournamentModelPoolStages } from '../../src/models/tournament-model/pool-stages';

const mk = () => jest.fn() as jest.Mock;

const buildPrisma = () => ({
  poolStage: {
    findMany: mk(),
    findUnique: mk(),
    create: mk(),
    update: mk(),
    delete: mk(),
  },
  pool: {
    findUnique: mk(),
    findMany: mk(),
    count: mk(),
    createMany: mk(),
    updateMany: mk(),
    update: mk(),
  },
  poolAssignment: {
    count: mk(),
    createMany: mk(),
    deleteMany: mk(),
  },
  player: {
    findMany: mk(),
  },
  doublette: {
    findMany: mk(),
  },
  equipe: {
    findMany: mk(),
  },
  match: {
    count: mk(),
    findMany: mk(),
    create: mk(),
    updateMany: mk(),
  },
  playerMatch: {
    deleteMany: mk(),
    createMany: mk(),
    updateMany: mk(),
  },
  score: {
    deleteMany: mk(),
  },
  target: {
    updateMany: mk(),
  },
  $transaction: mk().mockImplementation(async (steps: unknown[]) => steps),
});

describe('tournament model pool stages coverage', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  it('creates pool stage with nullable json payload branches', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.create.mockResolvedValue({ id: 'ps1' });

    await handlers.createPoolStage('t1', {
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      losersAdvanceToBracket: true,
      inParallelWith: null,
      rankingDestinations: ['x'],
      matchFormatKey: 'BO5',
    });

    expect(prisma.poolStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: 't1',
        inParallelWith: Prisma.JsonNull,
        rankingDestinations: ['x'],
        matchFormatKey: 'BO5',
      }),
    });
  });

  it('maps create and update prisma known errors to app errors', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.create.mockRejectedValue({ code: 'P2002' });
    prisma.poolStage.update.mockRejectedValueOnce({ code: 'P2025' }).mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      handlers.createPoolStage('t1', {
        stageNumber: 1,
        name: 'S',
        poolCount: 1,
        playersPerPool: 2,
        advanceCount: 1,
      })
    ).rejects.toThrow('Pool stage already exists for this stage number');

    await expect(handlers.updatePoolStage('ps1', { name: 'X' })).rejects.toThrow('Pool stage not found');
    await expect(handlers.updatePoolStage('ps1', { name: 'X' })).rejects.toThrow('Pool stage already exists for this stage number');
  });

  it('updates pool stage with selective payload fields', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.update.mockResolvedValue({ id: 'ps1' });

    await handlers.updatePoolStage('ps1', {
      stageNumber: 2,
      name: 'Updated',
      inParallelWith: Prisma.JsonNull,
      rankingDestinations: ['A'],
      status: StageStatus.COMPLETED,
      completedAt: null,
    });

    expect(prisma.poolStage.update).toHaveBeenCalledWith({
      where: { id: 'ps1' },
      data: expect.objectContaining({
        stageNumber: 2,
        name: 'Updated',
        status: StageStatus.COMPLETED,
        completedAt: null,
      }),
    });
  });

  it('covers pool and match read helpers success paths', async () => {
    prisma.pool.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.pool.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.match.findMany.mockResolvedValue([{ id: 'm1' }]);
    prisma.poolStage.findUnique.mockResolvedValue({ id: 'ps1' });
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.getPoolById('p1')).resolves.toEqual({ id: 'p1' });
    await expect(handlers.getPoolStageById('ps1')).resolves.toEqual({ id: 'ps1' });
    await expect(handlers.getPoolsForStage('ps1')).resolves.toEqual([{ id: 'p1' }]);
    await expect(handlers.getPoolsWithAssignmentsForStage('ps1')).resolves.toEqual([{ id: 'p1' }]);
    await expect(handlers.getPoolsWithMatchesForStage('ps1')).resolves.toEqual([{ id: 'p1' }]);
    await expect(handlers.getMatchesForPoolStage('ps1')).resolves.toEqual([{ id: 'm1' }]);
    await expect(handlers.getPoolMatchesWithPlayers('p1')).resolves.toEqual([{ id: 'm1' }]);
  });

  it('wraps failures for pool and match read helpers', async () => {
    prisma.pool.findUnique.mockRejectedValue(new Error('boom'));
    prisma.pool.findMany.mockRejectedValue(new Error('boom'));
    prisma.match.findMany.mockRejectedValue(new Error('boom'));
    prisma.poolStage.findUnique.mockRejectedValue(new Error('boom'));
    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.getPoolById('p1')).rejects.toThrow('Failed to fetch pool');
    await expect(handlers.getPoolStageById('ps1')).rejects.toThrow('Failed to fetch pool stage');
    await expect(handlers.getPoolsForStage('ps1')).rejects.toThrow('Failed to fetch pools');
    await expect(handlers.getPoolsWithAssignmentsForStage('ps1')).rejects.toThrow('Failed to fetch pools');
    await expect(handlers.getPoolsWithMatchesForStage('ps1')).rejects.toThrow('Failed to fetch pools');
    await expect(handlers.getMatchesForPoolStage('ps1')).rejects.toThrow('Failed to fetch pool stage matches');
    await expect(handlers.getPoolMatchesWithPlayers('p1')).rejects.toThrow('Failed to fetch pool matches');
  });

  it('covers opponent pairs and active players wrappers', async () => {
    prisma.match.findMany.mockResolvedValue([
      { playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }] },
      { playerMatches: [{ playerId: null }, { playerId: 'p3' }] },
    ]);
    prisma.player.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.doublette.findMany.mockResolvedValue([
      {
        name: 'Duo A',
        captainPlayerId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        registeredAt: null,
        skillLevel: 'BEGINNER',
        members: [{ player: { id: 'p10' } }],
      },
      {
        name: 'Duo B',
        captainPlayerId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        registeredAt: null,
        skillLevel: null,
        members: [],
      },
    ]);
    prisma.equipe.findMany.mockResolvedValue([
      {
        name: 'Team A',
        captainPlayerId: 'cap-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        registeredAt: new Date('2026-01-02T00:00:00.000Z'),
        skillLevel: 'ADVANCED',
        members: [{ player: { id: 'p20' } }],
      },
    ]);

    const handlers = createTournamentModelPoolStages(prisma as never);
    await expect(handlers.getOpponentPairsBeforeStage('t1', 2)).resolves.toEqual([['p1', 'p2']]);
    await expect(handlers.getActivePlayersForTournament('t1')).resolves.toEqual([{ id: 'p1' }]);

    const doublettes = await handlers.getActiveDoublettePlayersForTournament('t1');
    expect(doublettes).toHaveLength(1);
    expect(doublettes[0]).toEqual(expect.objectContaining({ id: 'p10', teamName: 'Duo A' }));

    const equipes = await handlers.getActiveEquipePlayersForTournament('t1');
    expect(equipes).toHaveLength(1);
    expect(equipes[0]).toEqual(expect.objectContaining({ id: 'cap-1', teamName: 'Team A' }));
  });

  it('wraps active players retrieval failures', async () => {
    prisma.match.findMany.mockRejectedValue(new Error('boom'));
    prisma.player.findMany.mockRejectedValue(new Error('boom'));
    prisma.doublette.findMany.mockRejectedValue(new Error('boom'));
    prisma.equipe.findMany.mockRejectedValue(new Error('boom'));

    const handlers = createTournamentModelPoolStages(prisma as never);

    await expect(handlers.getOpponentPairsBeforeStage('t1', 2)).rejects.toThrow('Failed to fetch opponent pairs');
    await expect(handlers.getActivePlayersForTournament('t1')).rejects.toThrow('Failed to fetch tournament players');
    await expect(handlers.getActiveDoublettePlayersForTournament('t1')).rejects.toThrow('Failed to fetch registered doublettes');
    await expect(handlers.getActiveEquipePlayersForTournament('t1')).rejects.toThrow('Failed to fetch registered equipes');
  });

  it('covers create and delete assignment helpers', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.createPoolAssignments([
      { poolId: 'p1', playerId: 'x', assignmentType: 'POOL' as never, seedNumber: 1 },
    ]);
    await handlers.deletePoolAssignmentsForStage('ps1');

    expect(prisma.poolAssignment.createMany).toHaveBeenCalled();
    expect(prisma.poolAssignment.deleteMany).toHaveBeenCalledWith({
      where: { pool: { poolStageId: 'ps1' } },
    });
  });

  it('covers create matches and empty matches transaction payloads', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.createPoolMatches('t1', 'pool-1', [
      { roundNumber: 1, matchNumber: 1, playerIds: ['p1', 'p2'] },
    ], 'BO3');

    await handlers.createEmptyPoolMatches('t1', 'pool-1', [
      { roundNumber: 1, matchNumber: 2 },
    ]);

    expect(prisma.match.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('covers status update helpers and delete not found branch', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.delete.mockRejectedValue({ code: 'P2025' });

    await handlers.updatePoolStatuses(['p1', 'p2'], PoolStatus.IN_PROGRESS);
    await handlers.completePoolsForStage('ps1', new Date('2026-03-09T10:00:00.000Z'));
    await handlers.completeMatchesForStage('ps1', new Date('2026-03-09T10:00:00.000Z'));

    expect(prisma.pool.updateMany).toHaveBeenCalled();
    expect(prisma.match.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        pool: { poolStageId: 'ps1' },
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] },
      }),
    }));

    await expect(handlers.deletePoolStage('missing')).rejects.toThrow('Pool stage not found');
  });

  it('covers list and count helper branches including fallbacks', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.findMany.mockResolvedValue([{ id: 'ps1' }]);
    prisma.pool.count.mockResolvedValueOnce(3).mockRejectedValueOnce(new Error('boom'));
    prisma.poolAssignment.count.mockResolvedValueOnce(5).mockRejectedValueOnce(new Error('boom'));
    prisma.match.count.mockResolvedValueOnce(7).mockRejectedValueOnce(new Error('boom'));

    await expect(handlers.getPoolStages('t1')).resolves.toEqual([{ id: 'ps1' }]);
    await expect(handlers.getPoolCountForStage('ps1')).resolves.toBe(3);
    await expect(handlers.getPoolCountForStage('ps1')).resolves.toBe(0);
    await expect(handlers.getPoolAssignmentCountForStage('ps1')).resolves.toBe(5);
    await expect(handlers.getPoolAssignmentCountForStage('ps1')).resolves.toBe(0);
    await expect(handlers.getMatchCountForPool('p1')).resolves.toBe(7);
    await expect(handlers.getMatchCountForPool('p1')).resolves.toBe(0);
  });

  it('wraps getPoolStages and updatePoolStage unknown errors', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.poolStage.findMany.mockRejectedValue(new Error('boom'));
    prisma.poolStage.update.mockRejectedValue(new Error('boom'));

    await expect(handlers.getPoolStages('t1')).rejects.toThrow('Failed to fetch pool stages');
    await expect(handlers.updatePoolStage('ps1', { name: 'x' })).rejects.toThrow('Failed to update pool stage');
  });

  it('covers setPoolMatchPlayers success and resetPoolMatches branches', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);

    await handlers.setPoolMatchPlayers('m1', ['p1', 'p2']);
    expect(prisma.playerMatch.deleteMany).toHaveBeenCalledWith({ where: { matchId: 'm1' } });

    prisma.match.findMany
      .mockResolvedValueOnce([{ id: 'm1', targetId: 'target-1' }])
      .mockResolvedValueOnce([]);

    await handlers.resetPoolMatches('pool-1');
    await handlers.resetPoolMatches('pool-2');

    expect(prisma.target.updateMany).toHaveBeenCalled();
    expect(prisma.pool.update).toHaveBeenCalledTimes(2);
  });

  it('covers resetPoolMatches and deletePoolStage unknown error branches', async () => {
    const handlers = createTournamentModelPoolStages(prisma as never);
    prisma.match.findMany.mockResolvedValue([]);
    prisma.$transaction.mockRejectedValueOnce(new Error('tx fail'));
    prisma.poolStage.delete.mockRejectedValueOnce(new Error('boom'));

    await expect(handlers.resetPoolMatches('pool-1')).rejects.toThrow('Failed to reset pool matches');
    await expect(handlers.deletePoolStage('ps1')).rejects.toThrow('Failed to delete pool stage');
  });
});
