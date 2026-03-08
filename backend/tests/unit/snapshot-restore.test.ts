import { restoreTournamentStateFromSnapshot } from '../../src/services/tournament-service/snapshot-restore';

const buildTransaction = () => ({
  schedule: { deleteMany: jest.fn().mockResolvedValue(undefined) },
  match: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  },
  bracket: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  },
  poolStage: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  },
  target: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue(undefined),
  },
  player: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  },
  pool: { createMany: jest.fn().mockResolvedValue(undefined) },
  poolAssignment: { createMany: jest.fn().mockResolvedValue(undefined) },
  bracketTarget: { createMany: jest.fn().mockResolvedValue(undefined) },
  bracketEntry: { createMany: jest.fn().mockResolvedValue(undefined) },
  playerMatch: { createMany: jest.fn().mockResolvedValue(undefined) },
  tournament: { update: jest.fn().mockResolvedValue(undefined) },
});

describe('snapshot-restore', () => {
  it('restores complete snapshot with nested relations and target current matches', async () => {
    const transaction = buildTransaction();
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
    } as never;

    await restoreTournamentStateFromSnapshot(prisma, 't1', {
      data: {
        name: 'Restored Tournament',
        location: 'Paris',
        format: 'DOUBLE',
        durationType: 'DATE_RANGE',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        totalParticipants: 16,
        targetCount: 8,
        status: 'OPEN',
        players: [
          {
            id: 'p1',
            firstName: 'A',
            lastName: 'B',
            registeredAt: new Date(),
          },
        ],
        targets: [
          {
            id: 'ta1',
            targetNumber: 1,
            targetCode: 'A1',
            currentMatchId: 'm1',
          },
        ],
        poolStages: [
          {
            id: 'ps1',
            stageNumber: 1,
            name: 'Stage 1',
            poolCount: 1,
            playersPerPool: 2,
            advanceCount: 1,
            createdAt: new Date(),
            pools: [
              {
                id: 'pool1',
                poolStageId: 'ps1',
                poolNumber: 1,
                name: 'Pool A',
                createdAt: new Date(),
                assignments: [
                  {
                    id: 'pa1',
                    poolId: 'pool1',
                    playerId: 'p1',
                    assignmentType: 'INITIAL',
                    assignedAt: new Date(),
                  },
                ],
                matches: [
                  {
                    id: 'm1',
                    poolId: 'pool1',
                    roundNumber: 1,
                    matchNumber: 1,
                    playerMatches: [
                      {
                        id: 'pm1',
                        matchId: 'm1',
                        playerId: 'p1',
                        playerPosition: 1,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        brackets: [
          {
            id: 'b1',
            bracketType: 'WINNER',
            name: 'Winner',
            totalRounds: 1,
            createdAt: new Date(),
            matches: [
              {
                id: 'm2',
                bracketId: 'b1',
                roundNumber: 1,
                matchNumber: 1,
              },
            ],
            bracketTargets: [
              {
                id: 'bt1',
                bracketId: 'b1',
                targetId: 'ta1',
                createdAt: new Date(),
              },
            ],
            entries: [
              {
                id: 'be1',
                bracketId: 'b1',
                playerId: 'p1',
                seedNumber: 1,
                currentRound: 1,
                enteredAt: new Date(),
              },
            ],
          },
        ],
      },
    } as never);

    expect(transaction.player.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.target.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.poolStage.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.pool.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.poolAssignment.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.bracket.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.bracketTarget.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.bracketEntry.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.match.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.playerMatch.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.target.updateMany).toHaveBeenCalledWith({
      where: { id: 'ta1', tournamentId: 't1' },
      data: { currentMatchId: 'm1' },
    });

    const matchCreateManyArgument = transaction.match.createMany.mock.calls[0][0] as {
      data: Array<{ id: string }>;
    };
    expect(matchCreateManyArgument.data).toHaveLength(2);
    expect(
      matchCreateManyArgument.data
        .map((match) => match.id)
        .sort((left, right) => left.localeCompare(right))
    ).toEqual(['m1', 'm2']);
  });

  it('restores minimal snapshot and applies fallback defaults', async () => {
    const transaction = buildTransaction();
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
    } as never;

    await restoreTournamentStateFromSnapshot(prisma, 't2', {
      data: {
        format: 'SINGLE',
        durationType: 'DATE_RANGE',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        totalParticipants: 8,
        targetCount: 4,
        status: 'DRAFT',
      },
    } as never);

    expect(transaction.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Tournament',
          targetStartNumber: 1,
          shareTargets: true,
          historicalFlag: false,
          doubleStageEnabled: false,
          location: null,
          completedAt: null,
        }),
      })
    );

    expect(transaction.player.createMany).not.toHaveBeenCalled();
    expect(transaction.target.createMany).not.toHaveBeenCalled();
    expect(transaction.poolStage.createMany).not.toHaveBeenCalled();
    expect(transaction.pool.createMany).not.toHaveBeenCalled();
    expect(transaction.poolAssignment.createMany).not.toHaveBeenCalled();
    expect(transaction.bracket.createMany).not.toHaveBeenCalled();
    expect(transaction.bracketTarget.createMany).not.toHaveBeenCalled();
    expect(transaction.bracketEntry.createMany).not.toHaveBeenCalled();
    expect(transaction.match.createMany).not.toHaveBeenCalled();
    expect(transaction.playerMatch.createMany).not.toHaveBeenCalled();
    expect(transaction.target.updateMany).not.toHaveBeenCalled();
  });
});
