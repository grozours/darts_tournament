import type { PrismaClient, Prisma } from '@prisma/client';
import {
  AssignmentType,
  PoolStatus,
  StageStatus,
  MatchStatus,
  TargetStatus,
} from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError } from './helpers';

const buildOpponentPairs = (ids: string[]): Array<[string, string]> => {
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < ids.length; index += 1) {
    for (let index_ = index + 1; index_ < ids.length; index_ += 1) {
      const first = ids[index];
      const second = ids[index_];
      if (first && second) {
        pairs.push([first, second]);
      }
    }
  }
  return pairs;
};

export const createTournamentModelPoolStages = (prisma: PrismaClient) => ({
  getPoolStages: async (tournamentId: string) => {
    try {
      return await prisma.poolStage.findMany({
        where: { tournamentId },
        orderBy: { stageNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getPoolStages', error);
      throw new AppError('Failed to fetch pool stages', 500, 'POOL_STAGE_FETCH_FAILED');
    }
  },

  getPoolById: async (poolId: string) => {
    try {
      return await prisma.pool.findUnique({
        where: { id: poolId },
      });
    } catch (error) {
      logModelError('getPoolById', error);
      throw new AppError('Failed to fetch pool', 500, 'POOL_FETCH_FAILED');
    }
  },

  createPoolStage: async (tournamentId: string, data: {
    stageNumber: number;
    name: string;
    matchFormatKey?: string;
    inParallelWith?: Prisma.InputJsonValue;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket?: boolean;
    rankingDestinations?: Prisma.InputJsonValue;
  }) => {
    try {
      const payload: Parameters<typeof prisma.poolStage.create>[0]['data'] = {
        tournamentId,
        stageNumber: data.stageNumber,
        name: data.name,
        poolCount: data.poolCount,
        playersPerPool: data.playersPerPool,
        advanceCount: data.advanceCount,
        losersAdvanceToBracket: data.losersAdvanceToBracket ?? false,
      };
      if (data.matchFormatKey !== undefined) {
        payload.matchFormatKey = data.matchFormatKey;
      }
      if (data.inParallelWith !== undefined) {
        payload.inParallelWith = data.inParallelWith;
      }
      if (data.rankingDestinations !== undefined) {
        payload.rankingDestinations = data.rankingDestinations;
      }

      return await prisma.poolStage.create({ data: payload });
    } catch (error) {
      logModelError('createPoolStage', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Pool stage already exists for this stage number',
          400,
          'POOL_STAGE_EXISTS'
        );
      }
      throw new AppError('Failed to create pool stage', 500, 'POOL_STAGE_CREATE_FAILED');
    }
  },

  updatePoolStage: async (
    stageId: string,
    data: Partial<{
      stageNumber: number;
      name: string;
      matchFormatKey: string;
      inParallelWith: Prisma.InputJsonValue;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      losersAdvanceToBracket: boolean;
      rankingDestinations: Prisma.InputJsonValue;
      status: StageStatus;
      // eslint-disable-next-line unicorn/no-null
      completedAt: Date | null;
    }>
  ) => {
    try {
      return await prisma.poolStage.update({
        where: { id: stageId },
        data,
      });
    } catch (error) {
      logModelError('updatePoolStage', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Pool stage already exists for this stage number',
          400,
          'POOL_STAGE_EXISTS'
        );
      }
      throw new AppError('Failed to update pool stage', 500, 'POOL_STAGE_UPDATE_FAILED');
    }
  },

  getPoolStageById: async (stageId: string) => {
    try {
      return await prisma.poolStage.findUnique({
        where: { id: stageId },
      });
    } catch (error) {
      logModelError('getPoolStageById', error);
      throw new AppError('Failed to fetch pool stage', 500, 'POOL_STAGE_FETCH_FAILED');
    }
  },

  getPoolCountForStage: async (stageId: string): Promise<number> => {
    try {
      return await prisma.pool.count({
        where: { poolStageId: stageId },
      });
    } catch (error) {
      logModelError('getPoolCountForStage', error);
      return 0;
    }
  },

  getPoolsForStage: async (stageId: string) => {
    try {
      return await prisma.pool.findMany({
        where: { poolStageId: stageId },
        orderBy: { poolNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getPoolsForStage', error);
      throw new AppError('Failed to fetch pools', 500, 'POOLS_FETCH_FAILED');
    }
  },

  getPoolsWithAssignmentsForStage: async (stageId: string) => {
    try {
      return await prisma.pool.findMany({
        where: { poolStageId: stageId },
        orderBy: { poolNumber: 'asc' },
        include: {
          assignments: {
            orderBy: { assignedAt: 'asc' },
            include: { player: true },
          },
        },
      });
    } catch (error) {
      logModelError('getPoolsWithAssignmentsForStage', error);
      throw new AppError('Failed to fetch pools', 500, 'POOLS_FETCH_FAILED');
    }
  },

  getPoolsWithMatchesForStage: async (stageId: string) => {
    try {
      return await prisma.pool.findMany({
        where: { poolStageId: stageId },
        orderBy: { poolNumber: 'asc' },
        include: {
          assignments: {
            orderBy: { assignedAt: 'asc' },
            include: { player: true },
          },
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: {
              playerMatches: { include: { player: true } },
            },
          },
        },
      });
    } catch (error) {
      logModelError('getPoolsWithMatchesForStage', error);
      throw new AppError('Failed to fetch pools', 500, 'POOLS_FETCH_FAILED');
    }
  },

  getMatchesForPoolStage: async (stageId: string) => {
    try {
      return await prisma.match.findMany({
        where: { pool: { poolStageId: stageId } },
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getMatchesForPoolStage', error);
      throw new AppError(
        'Failed to fetch pool stage matches',
        500,
        'POOL_STAGE_MATCH_FETCH_FAILED'
      );
    }
  },

  getPoolAssignmentCountForStage: async (stageId: string): Promise<number> => {
    try {
      return await prisma.poolAssignment.count({
        where: { pool: { poolStageId: stageId } },
      });
    } catch (error) {
      logModelError('getPoolAssignmentCountForStage', error);
      return 0;
    }
  },

  getOpponentPairsBeforeStage: async (
    tournamentId: string,
    stageNumber: number
  ): Promise<Array<[string, string]>> => {
    try {
      const matches = await prisma.match.findMany({
        where: {
          tournamentId,
          pool: { poolStage: { stageNumber: { lt: stageNumber } } },
        },
        select: {
          playerMatches: {
            select: { playerId: true },
          },
        },
      });

      const pairs: Array<[string, string]> = [];
      for (const match of matches) {
        const ids = match.playerMatches
          .map((pm) => pm.playerId)
          .filter((playerId): playerId is string => Boolean(playerId));
        if (ids.length < 2) continue;
        pairs.push(...buildOpponentPairs(ids));
      }

      return pairs;
    } catch (error) {
      logModelError('getOpponentPairsBeforeStage', error);
      throw new AppError('Failed to fetch opponent pairs', 500, 'OPPONENT_PAIRS_FETCH_FAILED');
    }
  },

  getActivePlayersForTournament: async (tournamentId: string) => {
    try {
      return await prisma.player.findMany({
        where: { tournamentId, isActive: true },
        orderBy: { registeredAt: 'asc' },
      });
    } catch (error) {
      logModelError('getActivePlayersForTournament', error);
      throw new AppError('Failed to fetch tournament players', 500, 'PLAYERS_FETCH_FAILED');
    }
  },

  createPoolAssignments: async (
    assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }>
  ) => {
    if (assignments.length === 0) return;
    await prisma.poolAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
  },

  deletePoolAssignmentsForStage: async (stageId: string) => {
    await prisma.poolAssignment.deleteMany({
      where: { pool: { poolStageId: stageId } },
    });
  },

  getMatchCountForPool: async (poolId: string): Promise<number> => {
    try {
      return await prisma.match.count({
        where: { poolId },
      });
    } catch (error) {
      logModelError('getMatchCountForPool', error);
      return 0;
    }
  },

  getPoolMatchesWithPlayers: async (poolId: string) => {
    try {
      return await prisma.match.findMany({
        where: { poolId },
        orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getPoolMatchesWithPlayers', error);
      throw new AppError('Failed to fetch pool matches', 500, 'POOL_MATCH_FETCH_FAILED');
    }
  },

  createPoolMatches: async (
    tournamentId: string,
    poolId: string,
    matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>,
    matchFormatKey?: string
  ): Promise<void> => {
    if (matches.length === 0) return;

    await prisma.$transaction(
      matches.map((match) =>
        prisma.match.create({
          data: {
            tournamentId,
            poolId,
            ...(matchFormatKey ? { matchFormatKey } : {}),
            roundNumber: match.roundNumber,
            matchNumber: match.matchNumber,
            playerMatches: {
              create: [
                {
                  playerId: match.playerIds[0],
                  playerPosition: 1,
                },
                {
                  playerId: match.playerIds[1],
                  playerPosition: 2,
                },
              ],
            },
          },
        })
      )
    );
  },

  createEmptyPoolMatches: async (
    tournamentId: string,
    poolId: string,
    matches: Array<{ roundNumber: number; matchNumber: number }>,
    matchFormatKey?: string
  ): Promise<void> => {
    if (matches.length === 0) return;

    await prisma.$transaction(
      matches.map((match) =>
        prisma.match.create({
          data: {
            tournamentId,
            poolId,
            ...(matchFormatKey ? { matchFormatKey } : {}),
            roundNumber: match.roundNumber,
            matchNumber: match.matchNumber,
          },
        })
      )
    );
  },

  setPoolMatchPlayers: async (matchId: string, playerIds: [string, string]) => {
    try {
      await prisma.$transaction([
        prisma.playerMatch.deleteMany({
          where: { matchId },
        }),
        prisma.playerMatch.createMany({
          data: [
            {
              matchId,
              playerId: playerIds[0],
              playerPosition: 1,
            },
            {
              matchId,
              playerId: playerIds[1],
              playerPosition: 2,
            },
          ],
        }),
      ]);
    } catch (error) {
      logModelError('setPoolMatchPlayers', error);
      throw new AppError('Failed to seed pool match players', 500, 'POOL_MATCH_SEED_FAILED');
    }
  },

  createPoolsForStage: async (stageId: string, poolCount: number, startNumber: number = 1) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const pools = Array.from({ length: poolCount }, (_, index) => {
      const poolNumber = startNumber + index;
      const letterIndex = poolNumber - 1;
      return {
        poolStageId: stageId,
        poolNumber,
        name: `Pool ${alphabet[letterIndex] || poolNumber}`,
      };
    });

    await prisma.pool.createMany({
      data: pools,
      skipDuplicates: true,
    });
  },

  deletePoolStage: async (stageId: string) => {
    try {
      await prisma.poolStage.delete({
        where: { id: stageId },
      });
    } catch (error) {
      logModelError('deletePoolStage', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }
      throw new AppError('Failed to delete pool stage', 500, 'POOL_STAGE_DELETE_FAILED');
    }
  },

  updatePoolStatuses: async (poolIds: string[], status: PoolStatus): Promise<void> => {
    if (poolIds.length === 0) return;
    await prisma.pool.updateMany({
      where: { id: { in: poolIds } },
      data: { status },
    });
  },

  completePoolsForStage: async (stageId: string, completedAt: Date): Promise<void> => {
    await prisma.pool.updateMany({
      where: { poolStageId: stageId },
      data: { status: PoolStatus.COMPLETED, completedAt },
    });
  },

  completeMatchesForStage: async (stageId: string, completedAt: Date): Promise<void> => {
    await prisma.match.updateMany({
      where: {
        pool: { poolStageId: stageId },
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] },
      },
      data: { status: MatchStatus.COMPLETED, completedAt },
    });
  },

  resetPoolMatches: async (poolId: string): Promise<void> => {
    try {
      type MatchTargetRow = { id: string; targetId: string | null };
      const matches: MatchTargetRow[] = await prisma.match.findMany({
        where: { poolId },
        select: { id: true, targetId: true },
      });
      const matchIds = matches.map((match) => match.id);
      const targetIds = matches
        .map((match) => match.targetId)
        .filter((targetId): targetId is string => Boolean(targetId));

      await prisma.$transaction([
        ...(targetIds.length > 0
          ? [
            prisma.target.updateMany({
              where: { id: { in: targetIds } },
              data: {
                status: TargetStatus.AVAILABLE,
                // eslint-disable-next-line unicorn/no-null
                currentMatchId: null,
              },
            }),
          ]
          : []),
        ...(matchIds.length > 0
          ? [
            prisma.score.deleteMany({
              where: { matchId: { in: matchIds } },
            }),
            prisma.playerMatch.updateMany({
              where: { matchId: { in: matchIds } },
              data: {
                scoreTotal: 0,
                legsWon: 0,
                setsWon: 0,
                isWinner: false,
              },
            }),
            prisma.match.updateMany({
              where: { id: { in: matchIds } },
              data: {
                status: MatchStatus.SCHEDULED,
                // eslint-disable-next-line unicorn/no-null
                startedAt: null,
                // eslint-disable-next-line unicorn/no-null
                completedAt: null,
                // eslint-disable-next-line unicorn/no-null
                winnerId: null,
                // eslint-disable-next-line unicorn/no-null
                targetId: null,
              },
            }),
          ]
          : []),
        prisma.pool.update({
          where: { id: poolId },
          data: {
            status: PoolStatus.NOT_STARTED,
            // eslint-disable-next-line unicorn/no-null
            completedAt: null,
          },
        }),
      ]);
    } catch (error) {
      logModelError('resetPoolMatches', error);
      throw new AppError('Failed to reset pool matches', 500, 'POOL_MATCH_RESET_FAILED');
    }
  },
});

export type TournamentModelPoolStageHandlers = ReturnType<typeof createTournamentModelPoolStages>;
