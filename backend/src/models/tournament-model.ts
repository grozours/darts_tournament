import { Prisma, PrismaClient, Tournament as PrismaTournament, Player as PrismaPlayer } from '@prisma/client';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
  StageStatus,
  PoolStatus,
  MatchStatus,
  BracketType,
  BracketStatus,
  AssignmentType,
  Player,
  SkillLevel,
  TargetStatus,
} from '../../../shared/src/types';
import { AppError } from '../middleware/error-handler';

type PrismaError = { code?: string; meta?: { target?: unknown } };

const getPrismaErrorCode = (error: unknown): string | undefined => {
  const code = (error as PrismaError)?.code;
  return typeof code === 'string' ? code : undefined;
};

const logModelError = (context: string, error: unknown) => {
  console.error(`[TournamentModel] ${context}`, error);
};

const liveViewArguments = {
  include: {
    targets: {
      orderBy: { targetNumber: 'asc' },
    },
    poolStages: {
      orderBy: { stageNumber: 'asc' },
      include: {
        pools: {
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
                winner: true,
                target: true,
              },
            },
          },
        },
      },
    },
    brackets: {
      orderBy: { createdAt: 'asc' },
      include: {
        entries: {
          orderBy: { seedNumber: 'asc' },
          include: { player: true },
        },
        matches: {
          orderBy: { matchNumber: 'asc' },
          include: {
            playerMatches: { include: { player: true } },
            winner: true,
            target: true,
          },
        },
      },
    },
  },
} as const;

type TournamentLiveView = Prisma.TournamentGetPayload<typeof liveViewArguments>;


export class TournamentModel {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findPersonByEmailAndPhone(email: string, phone: string) {
    try {
      return await this.prisma.person.findUnique({
        where: {
          email_phone: {
            email,
            phone,
          },
        },
      });
    } catch (error) {
      logModelError('findPersonByEmailAndPhone', error);
      throw new AppError('Failed to fetch person', 500, 'PERSON_FETCH_FAILED');
    }
  }

  async createPerson(data: { firstName: string; lastName: string; email?: string; phone?: string }) {
    try {
      return await this.prisma.person.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          // eslint-disable-next-line unicorn/no-null
          email: data.email ?? null,
          // eslint-disable-next-line unicorn/no-null
          phone: data.phone ?? null,
        },
      });
    } catch (error) {
      logModelError('createPerson', error);
      throw new AppError('Failed to create person', 500, 'PERSON_CREATE_FAILED');
    }
  }

  async updatePerson(
    personId: string,
    data: { firstName?: string; lastName?: string; email?: string; phone?: string }
  ) {
    try {
      return await this.prisma.person.update({
        where: { id: personId },
        data,
      });
    } catch (error) {
      logModelError('updatePerson', error);
      throw new AppError('Failed to update person', 500, 'PERSON_UPDATE_FAILED');
    }
  }

  async getPlayerById(playerId: string) {
    try {
      return await this.prisma.player.findUnique({ where: { id: playerId } });
    } catch (error) {
      logModelError('getPlayerById', error);
      throw new AppError('Failed to fetch player', 500, 'PLAYER_FETCH_FAILED');
    }
  }

  /**
   * Create a new tournament
   */
  async create(tournamentData: {
    name: string;
    format: TournamentFormat;
    durationType: DurationType;
    startTime: Date;
    endTime: Date;
    totalParticipants: number;
    targetCount: number;
    logoUrl?: string;
  }): Promise<Tournament> {
    try {
      const tournament = await this.prisma.tournament.create({
        data: {
          name: tournamentData.name,
          format: tournamentData.format,
          durationType: tournamentData.durationType,
          startTime: tournamentData.startTime,
          endTime: tournamentData.endTime,
          totalParticipants: tournamentData.totalParticipants,
          targetCount: tournamentData.targetCount,
          // eslint-disable-next-line unicorn/no-null
          logoUrl: tournamentData.logoUrl ?? null,
          status: 'DRAFT', // Default status using enum
          createdAt: new Date(),
        },
      });

      if (tournamentData.targetCount > 0) {
        const targets = Array.from({ length: tournamentData.targetCount }, (_, index) => ({
          tournamentId: tournament.id,
          targetNumber: index + 1,
          targetCode: `target${index + 1}`,
        }));
        await this.prisma.target.createMany({ data: targets });
      }

      return this.mapToTournament(tournament);
    } catch (error) {
      logModelError('create', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        // Unique constraint violation
        throw new AppError(
          'Tournament with this name already exists',
          400,
          'TOURNAMENT_NAME_EXISTS'
        );
      }
      throw new AppError(
        'Failed to create tournament',
        500,
        'TOURNAMENT_CREATE_FAILED'
      );
    }
  }

  async getMaxTargetNumber(tournamentId: string): Promise<number> {
    try {
      const target = await this.prisma.target.findFirst({
        where: { tournamentId },
        orderBy: { targetNumber: 'desc' },
        select: { targetNumber: true },
      });
      return target?.targetNumber ?? 0;
    } catch (error) {
      logModelError('getMaxTargetNumber', error);
      return 0;
    }
  }

  async createTargetsForTournament(tournamentId: string, startNumber: number, count: number) {
    if (count <= 0) return;
    const targets = Array.from({ length: count }, (_, index) => {
      const targetNumber = startNumber + index;
      return {
        tournamentId,
        targetNumber,
        targetCode: `target${targetNumber}`,
      };
    });
    await this.prisma.target.createMany({ data: targets, skipDuplicates: true });
  }

  /**
   * Find tournament by ID
   */
  async findById(id: string): Promise<Tournament | undefined> {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
      });

      return tournament ? this.mapToTournament(tournament) : undefined;
    } catch (error) {
      logModelError('findById', error);
      throw new AppError(
        'Failed to fetch tournament',
        500,
        'TOURNAMENT_FETCH_FAILED'
      );
    }
  }

  /**
   * Find tournament with live view details
   */
  async findLiveView(id: string): Promise<TournamentLiveView | undefined> {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
        ...liveViewArguments,
      });
      return tournament ?? undefined;
    } catch (error) {
      logModelError('findLiveView', error);
      throw new AppError(
        'Failed to fetch live tournament view',
        500,
        'TOURNAMENT_LIVE_VIEW_FAILED'
      );
    }
  }

  /**
   * Find all tournaments with optional filtering
   */
  async findAll(options?: {
    status?: TournamentStatus;
    format?: TournamentFormat;
    name?: string;
    excludeDraft?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'startTime' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ tournaments: Array<Tournament & { currentParticipants: number }>; total: number; page: number; limit: number }> {
    try {
      const {
        status,
        format,
        name,
        excludeDraft,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options || {};

      const where: Prisma.TournamentWhereInput = {};
      
      if (status) {
        where.status = status;
      } else if (excludeDraft) {
        where.status = { not: TournamentStatus.DRAFT };
      }
      
      if (format) {
        where.format = format;
      }

      if (name) {
        where.name = {
          contains: name,
          mode: 'insensitive',
        };
      }

      const skip = (page - 1) * limit;

      const [tournaments, total] = await Promise.all([
        this.prisma.tournament.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
        }),
        this.prisma.tournament.count({ where }),
      ]);

      const tournamentIds = tournaments.map((tournament) => tournament.id);
      const participantCounts = tournamentIds.length > 0
        ? await this.prisma.player.groupBy({
          by: ['tournamentId'],
          where: { tournamentId: { in: tournamentIds }, isActive: true },
          _count: { _all: true },
        })
        : [];
      const participantCountByTournament = new Map(
        participantCounts.map((entry) => [entry.tournamentId, entry._count._all])
      );

      return {
        tournaments: tournaments.map((tournament) => ({
          ...this.mapToTournament(tournament),
          currentParticipants: participantCountByTournament.get(tournament.id) ?? 0,
        })),
        total,
        page,
        limit,
      };
    } catch (error) {
      logModelError('findAll', error);
      throw new AppError(
        'Failed to fetch tournaments',
        500,
        'TOURNAMENTS_FETCH_FAILED'
      );
    }
  }

  /**
   * Pool stage configuration
   */
  async getPoolStages(tournamentId: string) {
    try {
      return await this.prisma.poolStage.findMany({
        where: { tournamentId },
        orderBy: { stageNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getPoolStages', error);
      throw new AppError(
        'Failed to fetch pool stages',
        500,
        'POOL_STAGE_FETCH_FAILED'
      );
    }
  }

  async createPoolStage(tournamentId: string, data: {
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket?: boolean;
  }) {
    try {
      return await this.prisma.poolStage.create({
        data: {
          tournamentId,
          stageNumber: data.stageNumber,
          name: data.name,
          poolCount: data.poolCount,
          playersPerPool: data.playersPerPool,
          advanceCount: data.advanceCount,
          losersAdvanceToBracket: data.losersAdvanceToBracket ?? false,
        },
      });
    } catch (error) {
      logModelError('createPoolStage', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Pool stage already exists for this stage number',
          400,
          'POOL_STAGE_EXISTS'
        );
      }
      throw new AppError(
        'Failed to create pool stage',
        500,
        'POOL_STAGE_CREATE_FAILED'
      );
    }
  }

  async updatePoolStage(
    stageId: string,
    data: Partial<{
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      losersAdvanceToBracket: boolean;
      status: StageStatus;
      // eslint-disable-next-line unicorn/no-null
      completedAt: Date | null;
    }>
  ) {
    try {
      return await this.prisma.poolStage.update({
        where: { id: stageId },
        data,
      });
    } catch (error) {
      logModelError('updatePoolStage', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Pool stage not found',
          404,
          'POOL_STAGE_NOT_FOUND'
        );
      }
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Pool stage already exists for this stage number',
          400,
          'POOL_STAGE_EXISTS'
        );
      }
      throw new AppError(
        'Failed to update pool stage',
        500,
        'POOL_STAGE_UPDATE_FAILED'
      );
    }
  }

  async getPoolStageById(stageId: string) {
    try {
      return await this.prisma.poolStage.findUnique({
        where: { id: stageId },
      });
    } catch (error) {
      logModelError('getPoolStageById', error);
      throw new AppError(
        'Failed to fetch pool stage',
        500,
        'POOL_STAGE_FETCH_FAILED'
      );
    }
  }

  async getPoolCountForStage(stageId: string): Promise<number> {
    try {
      return await this.prisma.pool.count({
        where: { poolStageId: stageId },
      });
    } catch (error) {
      logModelError('getPoolCountForStage', error);
      return 0;
    }
  }

  async getPoolsForStage(stageId: string) {
    try {
      return await this.prisma.pool.findMany({
        where: { poolStageId: stageId },
        orderBy: { poolNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getPoolsForStage', error);
      throw new AppError(
        'Failed to fetch pools',
        500,
        'POOLS_FETCH_FAILED'
      );
    }
  }

  async getPoolsWithAssignmentsForStage(stageId: string) {
    try {
      return await this.prisma.pool.findMany({
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
      throw new AppError(
        'Failed to fetch pools',
        500,
        'POOLS_FETCH_FAILED'
      );
    }
  }

  async getPoolsWithMatchesForStage(stageId: string) {
    try {
      return await this.prisma.pool.findMany({
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
      throw new AppError(
        'Failed to fetch pools',
        500,
        'POOLS_FETCH_FAILED'
      );
    }
  }

  async getMatchesForPoolStage(stageId: string) {
    try {
      return await this.prisma.match.findMany({
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
  }

  async getPoolAssignmentCountForStage(stageId: string): Promise<number> {
    try {
      return await this.prisma.poolAssignment.count({
        where: { pool: { poolStageId: stageId } },
      });
    } catch (error) {
      logModelError('getPoolAssignmentCountForStage', error);
      return 0;
    }
  }

  async getOpponentPairsBeforeStage(tournamentId: string, stageNumber: number): Promise<Array<[string, string]>> {
    try {
      const matches = await this.prisma.match.findMany({
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
        const ids = match.playerMatches.map((pm) => pm.playerId).filter(Boolean);
        if (ids.length < 2) continue;
        for (let index = 0; index < ids.length; index += 1) {
          for (let index_ = index + 1; index_ < ids.length; index_ += 1) {
            const first = ids[index];
            const second = ids[index_];
            if (first && second) {
              pairs.push([first, second]);
            }
          }
        }
      }

      return pairs;
    } catch (error) {
      logModelError('getOpponentPairsBeforeStage', error);
      throw new AppError(
        'Failed to fetch opponent pairs',
        500,
        'OPPONENT_PAIRS_FETCH_FAILED'
      );
    }
  }

  async getActivePlayersForTournament(tournamentId: string) {
    try {
      return await this.prisma.player.findMany({
        where: { tournamentId, isActive: true },
        orderBy: { registeredAt: 'asc' },
      });
    } catch (error) {
      logModelError('getActivePlayersForTournament', error);
      throw new AppError(
        'Failed to fetch tournament players',
        500,
        'PLAYERS_FETCH_FAILED'
      );
    }
  }

  async createPoolAssignments(assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }>) {
    if (assignments.length === 0) return;
    await this.prisma.poolAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
  }

  async createBracketEntries(entries: Array<{ bracketId: string; playerId: string; seedNumber: number; currentRound: number }>) {
    if (entries.length === 0) return;
    await this.prisma.bracketEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });
  }

  async deleteBracketEntriesForBracket(bracketId: string) {
    await this.prisma.bracketEntry.deleteMany({
      where: { bracketId },
    });
  }

  async getMatchCountForBracket(bracketId: string): Promise<number> {
    try {
      return await this.prisma.match.count({
        where: { bracketId },
      });
    } catch (error) {
      logModelError('getMatchCountForBracket', error);
      return 0;
    }
  }

  async deleteMatchesForBracket(bracketId: string) {
    await this.prisma.match.deleteMany({
      where: { bracketId },
    });
  }

  async deletePoolAssignmentsForStage(stageId: string) {
    await this.prisma.poolAssignment.deleteMany({
      where: { pool: { poolStageId: stageId } },
    });
  }

  async getMatchCountForPool(poolId: string): Promise<number> {
    try {
      return await this.prisma.match.count({
        where: { poolId },
      });
    } catch (error) {
      logModelError('getMatchCountForPool', error);
      return 0;
    }
  }

  async createPoolMatches(
    tournamentId: string,
    poolId: string,
    matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>
  ): Promise<void> {
    if (matches.length === 0) return;

    await this.prisma.$transaction(
      matches.map((match) =>
        this.prisma.match.create({
          data: {
            tournamentId,
            poolId,
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
  }

  async createBracketMatches(
    tournamentId: string,
    bracketId: string,
    matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>
  ): Promise<void> {
    if (matches.length === 0) return;

    await this.prisma.$transaction(
      matches.map((match) =>
        this.prisma.match.create({
          data: {
            tournamentId,
            bracketId,
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
  }

  async createBracketMatchWithSlots(
    tournamentId: string,
    bracketId: string,
    roundNumber: number,
    matchNumber: number,
    players: Array<{ playerId: string; playerPosition: number }>
  ): Promise<void> {
    if (players.length === 0) return;
    try {
      await this.prisma.match.create({
        data: {
          tournamentId,
          bracketId,
          roundNumber,
          matchNumber,
          playerMatches: {
            create: players.map((player) => ({
              playerId: player.playerId,
              playerPosition: player.playerPosition,
            })),
          },
        },
      });
    } catch (error) {
      logModelError('createBracketMatchWithSlots', error);
      throw new AppError('Failed to create bracket match', 500, 'BRACKET_MATCH_CREATE_FAILED');
    }
  }

  async updatePoolStatuses(poolIds: string[], status: PoolStatus): Promise<void> {
    if (poolIds.length === 0) return;
    await this.prisma.pool.updateMany({
      where: { id: { in: poolIds } },
      data: { status },
    });
  }

  async completePoolsForStage(stageId: string, completedAt: Date): Promise<void> {
    await this.prisma.pool.updateMany({
      where: { poolStageId: stageId },
      data: { status: PoolStatus.COMPLETED, completedAt },
    });
  }

  async completeMatchesForStage(stageId: string, completedAt: Date): Promise<void> {
    await this.prisma.match.updateMany({
      where: {
        pool: { poolStageId: stageId },
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] },
      },
      data: { status: MatchStatus.COMPLETED, completedAt },
    });
  }

  async getMatchById(matchId: string) {
    try {
      return await this.prisma.match.findUnique({
        where: { id: matchId },
      });
    } catch (error) {
      logModelError('getMatchById', error);
      throw new AppError(
        'Failed to fetch match',
        500,
        'MATCH_FETCH_FAILED'
      );
    }
  }

  async getBracketById(bracketId: string) {
    try {
      return await this.prisma.bracket.findUnique({
        where: { id: bracketId },
      });
    } catch (error) {
      logModelError('getBracketById', error);
      throw new AppError('Failed to fetch bracket', 500, 'BRACKET_FETCH_FAILED');
    }
  }

  async getBracketMatchesByRound(bracketId: string, roundNumber: number) {
    try {
      return await this.prisma.match.findMany({
        where: { bracketId, roundNumber },
        orderBy: { matchNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getBracketMatchesByRound', error);
      throw new AppError('Failed to fetch bracket matches', 500, 'BRACKET_MATCH_FETCH_FAILED');
    }
  }

  async getBracketMatchesByRoundWithPlayers(bracketId: string, roundNumber: number) {
    try {
      return await this.prisma.match.findMany({
        where: { bracketId, roundNumber },
        orderBy: { matchNumber: 'asc' },
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getBracketMatchesByRoundWithPlayers', error);
      throw new AppError('Failed to fetch bracket matches', 500, 'BRACKET_MATCH_FETCH_FAILED');
    }
  }

  async getBracketMatchCountByRound(bracketId: string, roundNumber: number): Promise<number> {
    try {
      return await this.prisma.match.count({
        where: { bracketId, roundNumber },
      });
    } catch (error) {
      logModelError('getBracketMatchCountByRound', error);
      return 0;
    }
  }

  async getBracketEntryCount(bracketId: string): Promise<number> {
    try {
      return await this.prisma.bracketEntry.count({
        where: { bracketId },
      });
    } catch (error) {
      logModelError('getBracketEntryCount', error);
      return 0;
    }
  }

  async setBracketMatchPlayers(matchId: string, playerIds: [string, string]) {
    try {
      await this.prisma.$transaction([
        this.prisma.playerMatch.deleteMany({
          where: { matchId },
        }),
        this.prisma.playerMatch.createMany({
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
      logModelError('setBracketMatchPlayers', error);
      throw new AppError('Failed to seed bracket match players', 500, 'BRACKET_MATCH_SEED_FAILED');
    }
  }

  async setBracketMatchPlayerPosition(matchId: string, playerId: string, playerPosition: number) {
    try {
      await this.prisma.$transaction([
        this.prisma.playerMatch.deleteMany({
          where: {
            matchId,
            OR: [
              { playerPosition },
              { playerId },
            ],
          },
        }),
        this.prisma.playerMatch.create({
          data: {
            matchId,
            playerId,
            playerPosition,
          },
        }),
      ]);
    } catch (error) {
      logModelError('setBracketMatchPlayerPosition', error);
      throw new AppError('Failed to seed bracket match player', 500, 'BRACKET_MATCH_SEED_FAILED');
    }
  }

  async getMatchPoolStageId(matchId: string): Promise<string | undefined> {
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { pool: { select: { poolStageId: true } } },
      });
      return match?.pool?.poolStageId ?? undefined;
    } catch (error) {
      logModelError('getMatchPoolStageId', error);
      return undefined;
    }
  }

  async getTargetById(targetId: string) {
    try {
      return await this.prisma.target.findUnique({
        where: { id: targetId },
      });
    } catch (error) {
      logModelError('getTargetById', error);
      throw new AppError('Failed to fetch target', 500, 'TARGET_FETCH_FAILED');
    }
  }

  async updateMatchStatus(
    matchId: string,
    status: MatchStatus,
    timestamps?: { startedAt?: Date; completedAt?: Date }
  ) {
    try {
      return await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status,
          ...(timestamps?.startedAt !== undefined && { startedAt: timestamps.startedAt }),
          ...(timestamps?.completedAt !== undefined && { completedAt: timestamps.completedAt }),
        },
      });
    } catch (error) {
      logModelError('updateMatchStatus', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Match not found',
          404,
          'MATCH_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to update match status',
        500,
        'MATCH_STATUS_UPDATE_FAILED'
      );
    }
  }

  async startMatchWithTarget(matchId: string, targetId: string, startedAt: Date) {
    try {
      return await this.prisma.$transaction([
        this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.IN_PROGRESS,
            startedAt,
            targetId,
          },
        }),
        this.prisma.target.update({
          where: { id: targetId },
          data: {
            status: TargetStatus.IN_USE,
            currentMatchId: matchId,
            lastUsedAt: startedAt,
          },
        }),
      ]);
    } catch (error) {
      logModelError('startMatchWithTarget', error);
      throw new AppError('Failed to start match', 500, 'MATCH_START_FAILED');
    }
  }

  async finishMatchAndReleaseTarget(
    matchId: string,
    targetId: string,
    status: MatchStatus,
    timestamps: { startedAt?: Date; completedAt?: Date }
  ) {
    try {
      return await this.prisma.$transaction([
        this.prisma.match.update({
          where: { id: matchId },
          data: {
            status,
            ...(timestamps.startedAt !== undefined && { startedAt: timestamps.startedAt }),
            ...(timestamps.completedAt !== undefined && { completedAt: timestamps.completedAt }),
          },
        }),
        this.prisma.target.update({
          where: { id: targetId },
          data: {
            status: TargetStatus.AVAILABLE,
            // eslint-disable-next-line unicorn/no-null
            currentMatchId: null,
            lastUsedAt: timestamps.completedAt ?? new Date(),
          },
        }),
      ]);
    } catch (error) {
      logModelError('finishMatchAndReleaseTarget', error);
      throw new AppError('Failed to finish match', 500, 'MATCH_FINISH_FAILED');
    }
  }

  async setTargetAvailable(targetId: string, completedAt?: Date) {
    try {
      return await this.prisma.target.update({
        where: { id: targetId },
        data: {
          status: TargetStatus.AVAILABLE,
          // eslint-disable-next-line unicorn/no-null
          currentMatchId: null,
          lastUsedAt: completedAt ?? new Date(),
        },
      });
    } catch (error) {
      logModelError('setTargetAvailable', error);
      throw new AppError('Failed to update target', 500, 'TARGET_UPDATE_FAILED');
    }
  }

  async getMatchWithPlayerMatches(matchId: string) {
    try {
      return await this.prisma.match.findUnique({
        where: { id: matchId },
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getMatchWithPlayerMatches', error);
      throw new AppError(
        'Failed to fetch match',
        500,
        'MATCH_FETCH_FAILED'
      );
    }
  }

  async getMatchDetailsForNotification(matchId: string) {
    try {
      return await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          target: true,
          pool: { include: { poolStage: true } },
          bracket: true,
          playerMatches: { include: { player: true } },
        },
      });
    } catch (error) {
      logModelError('getMatchDetailsForNotification', error);
      throw new AppError('Failed to fetch match details', 500, 'MATCH_DETAILS_FETCH_FAILED');
    }
  }

  async completeMatch(
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number; isWinner: boolean }>,
    winnerId: string,
    timestamps: { startedAt?: Date; completedAt?: Date }
  ) {
    try {
      await this.prisma.$transaction([
        ...scores.map((score) =>
          this.prisma.playerMatch.update({
            where: { matchId_playerId: { matchId, playerId: score.playerId } },
            data: {
              scoreTotal: score.scoreTotal,
              legsWon: score.scoreTotal,
              isWinner: score.isWinner,
            },
          })
        ),
        this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            winnerId,
            ...(timestamps.startedAt !== undefined && { startedAt: timestamps.startedAt }),
            ...(timestamps.completedAt !== undefined && { completedAt: timestamps.completedAt }),
          },
        }),
      ]);
    } catch (error) {
      logModelError('completeMatch', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError(
        'Failed to complete match',
        500,
        'MATCH_COMPLETE_FAILED'
      );
    }
  }

  async updateMatchScores(
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number; isWinner: boolean }>,
    winnerId: string
  ) {
    try {
      await this.prisma.$transaction([
        ...scores.map((score) =>
          this.prisma.playerMatch.update({
            where: { matchId_playerId: { matchId, playerId: score.playerId } },
            data: {
              scoreTotal: score.scoreTotal,
              legsWon: score.scoreTotal,
              isWinner: score.isWinner,
            },
          })
        ),
        this.prisma.match.update({
          where: { id: matchId },
          data: {
            winnerId,
            completedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      logModelError('updateMatchScores', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError(
        'Failed to update match scores',
        500,
        'MATCH_SCORE_UPDATE_FAILED'
      );
    }
  }

  async createPoolsForStage(stageId: string, poolCount: number, startNumber: number = 1) {
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

    await this.prisma.pool.createMany({
      data: pools,
      skipDuplicates: true,
    });
  }

  async deletePoolStage(stageId: string) {
    try {
      await this.prisma.poolStage.delete({
        where: { id: stageId },
      });
    } catch (error) {
      logModelError('deletePoolStage', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Pool stage not found',
          404,
          'POOL_STAGE_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to delete pool stage',
        500,
        'POOL_STAGE_DELETE_FAILED'
      );
    }
  }

  /**
   * Bracket configuration
   */
  async getBrackets(tournamentId: string) {
    try {
      return await this.prisma.bracket.findMany({
        where: { tournamentId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logModelError('getBrackets', error);
      throw new AppError(
        'Failed to fetch brackets',
        500,
        'BRACKET_FETCH_FAILED'
      );
    }
  }

  async createBracket(tournamentId: string, data: {
    name: string;
    bracketType: BracketType;
    totalRounds: number;
  }) {
    try {
      return await this.prisma.bracket.create({
        data: {
          tournamentId,
          name: data.name,
          bracketType: data.bracketType,
          totalRounds: data.totalRounds,
        },
      });
    } catch (error) {
      logModelError('createBracket', error);
      throw new AppError(
        'Failed to create bracket',
        500,
        'BRACKET_CREATE_FAILED'
      );
    }
  }

  async updateBracket(
    bracketId: string,
    data: Partial<{
      name: string;
      bracketType: BracketType;
      totalRounds: number;
      status: BracketStatus;
      // eslint-disable-next-line unicorn/no-null
      completedAt: Date | null;
    }>
  ) {
    try {
      return await this.prisma.bracket.update({
        where: { id: bracketId },
        data,
      });
    } catch (error) {
      logModelError('updateBracket', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Bracket not found',
          404,
          'BRACKET_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to update bracket',
        500,
        'BRACKET_UPDATE_FAILED'
      );
    }
  }

  async deleteBracket(bracketId: string) {
    try {
      await this.prisma.bracket.delete({
        where: { id: bracketId },
      });
    } catch (error) {
      logModelError('deleteBracket', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Bracket not found',
          404,
          'BRACKET_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to delete bracket',
        500,
        'BRACKET_DELETE_FAILED'
      );
    }
  }

  /**
   * Update tournament
   */
  async update(
    id: string,
    updateData: Partial<{
      name: string;
      format: TournamentFormat;
      durationType: DurationType;
      startTime: Date;
      endTime: Date;
      totalParticipants: number;
      targetCount: number;
      logoUrl: string;
      status: TournamentStatus;
    }>
  ): Promise<Tournament> {
    try {
      const tournament = await this.prisma.tournament.update({
        where: { id },
        data: {
          ...updateData,
        },
      });

      return this.mapToTournament(tournament);
    } catch (error) {
      logModelError('update', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Tournament not found',
          404,
          'TOURNAMENT_NOT_FOUND'
        );
      }
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Tournament with this name already exists',
          400,
          'TOURNAMENT_NAME_EXISTS'
        );
      }
      throw new AppError(
        'Failed to update tournament',
        500,
        'TOURNAMENT_UPDATE_FAILED'
      );
    }
  }

  /**
   * Delete tournament
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.tournament.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      logModelError('delete', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Tournament not found',
          404,
          'TOURNAMENT_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to delete tournament',
        500,
        'TOURNAMENT_DELETE_FAILED'
      );
    }
  }

  /**
   * Update tournament logo URL
   */
  async updateLogo(id: string, logoUrl: string): Promise<Tournament> {
    return this.update(id, { logoUrl });
  }

  /**
   * Find tournaments by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Tournament[]> {
    try {
      const tournaments = await this.prisma.tournament.findMany({
        where: {
          AND: [
            { startTime: { gte: startDate } },
            { endTime: { lte: endDate } },
          ],
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      return tournaments.map(tournament => this.mapToTournament(tournament));
    } catch (error) {
      logModelError('findByDateRange', error);
      throw new AppError(
        'Failed to fetch tournaments by date range',
        500,
        'TOURNAMENTS_DATE_RANGE_FAILED'
      );
    }
  }

  /**
   * Check if tournament exists and is editable
   */
  async isEditable(id: string): Promise<boolean> {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!tournament) {
        throw new AppError(
          'Tournament not found',
          404,
          'TOURNAMENT_NOT_FOUND'
        );
      }

      // Tournament is editable if it's in draft, open, signature, or live status
      return [
        TournamentStatus.DRAFT,
        TournamentStatus.OPEN,
        TournamentStatus.SIGNATURE,
        TournamentStatus.LIVE,
      ].includes(tournament.status as TournamentStatus);
    } catch (error) {
      logModelError('isEditable', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to check tournament status',
        500,
        'TOURNAMENT_STATUS_CHECK_FAILED'
      );
    }
  }

  /**
   * Register player for tournament
   */
  async registerPlayer(tournamentId: string, playerId: string): Promise<void> {
    try {
      // Create player entry in the tournament
      await this.prisma.player.create({
        data: {
          id: playerId,
          tournamentId,
          firstName: 'TBD', // These should be provided separately
          lastName: 'TBD',
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      logModelError('registerPlayer', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError(
        'Failed to register player',
        500,
        'PLAYER_REGISTRATION_FAILED'
      );
    }
  }

  /**
   * Create player registration with details
   */
  async createPlayer(
    tournamentId: string,
    playerData: {
      personId?: string;
      firstName: string;
      lastName: string;
      surname?: string;
      teamName?: string;
      email?: string;
      phone?: string;
      skillLevel?: SkillLevel;
    }
  ): Promise<Player> {
    try {
      const player = await this.prisma.player.create({
        data: {
          tournamentId,
          // eslint-disable-next-line unicorn/no-null
          personId: playerData.personId ?? null,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          // eslint-disable-next-line unicorn/no-null
          surname: playerData.surname ?? null,
          // eslint-disable-next-line unicorn/no-null
          teamName: playerData.teamName ?? null,
          // eslint-disable-next-line unicorn/no-null
          email: playerData.email ?? null,
          // eslint-disable-next-line unicorn/no-null
          phone: playerData.phone ?? null,
          // eslint-disable-next-line unicorn/no-null
          skillLevel: playerData.skillLevel ?? null,
          registeredAt: new Date(),
        },
      });

      return this.mapToPlayer(player);
    } catch (error) {
      logModelError('createPlayer', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError(
        'Failed to register player',
        500,
        'PLAYER_REGISTRATION_FAILED'
      );
    }
  }

  /**
   * Unregister player from tournament
   */
  async unregisterPlayer(tournamentId: string, playerId: string): Promise<void> {
    try {
      const deleted = await this.prisma.player.deleteMany({
        where: {
          id: playerId,
          tournamentId,
        },
      });

      if (deleted.count === 0) {
        throw new AppError(
          'Player not registered for this tournament',
          400,
          'PLAYER_NOT_REGISTERED'
        );
      }
    } catch (error) {
      logModelError('unregisterPlayer', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to unregister player',
        500,
        'PLAYER_UNREGISTRATION_FAILED'
      );
    }
  }

  /**
   * Check if player is registered for tournament
   */
  async isPlayerRegistered(tournamentId: string, playerId: string): Promise<boolean> {
    try {
      const player = await this.prisma.player.findUnique({
        where: {
          id: playerId,
        },
      });
      return player?.tournamentId === tournamentId;
    } catch (error) {
      logModelError('isPlayerRegistered', error);
      return false;
    }
  }

  /**
   * Get current participant count
   */
  async getParticipantCount(tournamentId: string): Promise<number> {
    try {
      return await this.prisma.player.count({
        where: {
          tournamentId,
          isActive: true,
        },
      });
    } catch (error) {
      logModelError('getParticipantCount', error);
      return 0;
    }
  }

  /**
   * Get checked-in participant count
   */
  async getCheckedInCount(tournamentId: string): Promise<number> {
    try {
      return await this.prisma.player.count({
        where: {
          tournamentId,
          isActive: true,
          checkedIn: true,
        },
      });
    } catch (error) {
      logModelError('getCheckedInCount', error);
      return 0;
    }
  }

  /**
   * Get tournament participants with player details
   */
  async getParticipants(tournamentId: string): Promise<Array<{
    playerId: string;
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    name: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
    registeredAt: Date;
    checkedIn: boolean;
  }>> {
    try {
      type ParticipantRow = Prisma.PlayerGetPayload<{
        select: {
          id: true;
          personId: true;
          firstName: true;
          lastName: true;
          surname: true;
          teamName: true;
          email: true;
          phone: true;
          skillLevel: true;
          registeredAt: true;
          checkedIn: true;
        };
      }>;

      const participants: ParticipantRow[] = await this.prisma.player.findMany({
        where: {
          tournamentId,
          isActive: true,
        },
        select: {
          id: true,
          personId: true,
          firstName: true,
          lastName: true,
          surname: true,
          teamName: true,
          email: true,
          phone: true,
          skillLevel: true,
          registeredAt: true,
          checkedIn: true,
        },
        orderBy: {
          registeredAt: 'asc',
        },
      });

      return participants.map((player) => ({
        playerId: player.id,
        ...(player.personId ? { personId: player.personId } : {}),
        firstName: player.firstName,
        lastName: player.lastName,
        ...(player.surname ? { surname: player.surname } : {}),
        ...(player.teamName ? { teamName: player.teamName } : {}),
        name: `${player.firstName} ${player.lastName}`,
        ...(player.email ? { email: player.email } : {}),
        ...(player.phone ? { phone: player.phone } : {}),
        ...(player.skillLevel ? { skillLevel: player.skillLevel as SkillLevel } : {}),
        registeredAt: player.registeredAt,
        checkedIn: player.checkedIn,
      }));
    } catch (error) {
      logModelError('getParticipants', error);
      throw new AppError(
        'Failed to fetch tournament participants',
        500,
        'PARTICIPANTS_FETCH_FAILED'
      );
    }
  }

  async getOrphanParticipants(): Promise<Array<{
    playerId: string;
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    name: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
    registeredAt: Date;
    checkedIn: boolean;
  }>> {
    try {
      type ParticipantRow = Prisma.PlayerGetPayload<{
        select: {
          id: true;
          personId: true;
          firstName: true;
          lastName: true;
          surname: true;
          teamName: true;
          email: true;
          phone: true;
          skillLevel: true;
          registeredAt: true;
          checkedIn: true;
        };
      }>;

      const participants: ParticipantRow[] = await this.prisma.player.findMany({
        where: {
          // eslint-disable-next-line unicorn/no-null
          tournamentId: null,
          isActive: true,
        },
        select: {
          id: true,
          personId: true,
          firstName: true,
          lastName: true,
          surname: true,
          teamName: true,
          email: true,
          phone: true,
          skillLevel: true,
          registeredAt: true,
          checkedIn: true,
        },
        orderBy: {
          registeredAt: 'asc',
        },
      });

      return participants.map((player) => ({
        playerId: player.id,
        ...(player.personId ? { personId: player.personId } : {}),
        firstName: player.firstName,
        lastName: player.lastName,
        ...(player.surname ? { surname: player.surname } : {}),
        ...(player.teamName ? { teamName: player.teamName } : {}),
        name: `${player.firstName} ${player.lastName}`,
        ...(player.email ? { email: player.email } : {}),
        ...(player.phone ? { phone: player.phone } : {}),
        ...(player.skillLevel ? { skillLevel: player.skillLevel as SkillLevel } : {}),
        registeredAt: player.registeredAt,
        checkedIn: player.checkedIn,
      }));
    } catch (error) {
      logModelError('getOrphanParticipants', error);
      throw new AppError(
        'Failed to fetch orphan participants',
        500,
        'ORPHAN_PARTICIPANTS_FETCH_FAILED'
      );
    }
  }

  /**
   * Update player check-in status
   */
  async updatePlayerCheckIn(
    tournamentId: string,
    playerId: string,
    checkedIn: boolean
  ): Promise<Player> {
    try {
      const player = await this.prisma.player.update({
        where: { id: playerId },
        data: {
          checkedIn,
          tournamentId,
        },
      });

      return this.mapToPlayer(player);
    } catch (error) {
      logModelError('updatePlayerCheckIn', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Player not found',
          404,
          'PLAYER_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to update player check-in status',
        500,
        'PLAYER_CHECKIN_UPDATE_FAILED'
      );
    }
  }

  /**
   * Update player details
   */
  async updatePlayer(
    tournamentId: string,
    playerId: string,
    updateData: {
      personId?: string;
      firstName?: string;
      lastName?: string;
      surname?: string;
      teamName?: string;
      email?: string;
      phone?: string;
      skillLevel?: SkillLevel;
    }
  ): Promise<Player> {
    try {
      const player = await this.prisma.player.update({
        where: { id: playerId },
        data: {
          ...updateData,
          tournamentId,
        },
      });

      return this.mapToPlayer(player);
    } catch (error) {
      logModelError('updatePlayer', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Player not found',
          404,
          'PLAYER_NOT_FOUND'
        );
      }
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError(
        'Failed to update player',
        500,
        'PLAYER_UPDATE_FAILED'
      );
    }
  }

  async findPlayerBySurname(
    tournamentId: string,
    surname: string,
    excludePlayerId?: string
  ) {
    return this.prisma.player.findFirst({
      where: {
        tournamentId,
        surname: { equals: surname, mode: 'insensitive' },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
      },
    });
  }

  async findPlayerByTeamName(
    tournamentId: string,
    teamName: string,
    excludePlayerId?: string
  ) {
    return this.prisma.player.findFirst({
      where: {
        tournamentId,
        teamName: { equals: teamName, mode: 'insensitive' },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
      },
    });
  }

  /**
   * Update tournament status
   */
  async updateStatus(
    id: string, 
    status: TournamentStatus, 
    completedAt?: Date
  ): Promise<Tournament> {
    try {
      const tournament = await this.prisma.tournament.update({
        where: { id },
        data: {
          status,
          ...(completedAt && { completedAt }),
        },
      });

      return this.mapToTournament(tournament);
    } catch (error) {
      logModelError('updateStatus', error);
      if (error instanceof Error && error.name === 'PrismaClientValidationError') {
        const updatedTournament = await this.updateStatusWithRaw(id, status, completedAt);
        if (!updatedTournament) {
          throw new AppError(
            'Tournament not found',
            404,
            'TOURNAMENT_NOT_FOUND'
          );
        }
        return updatedTournament;
      }
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError(
          'Tournament not found',
          404,
          'TOURNAMENT_NOT_FOUND'
        );
      }
      throw new AppError(
        'Failed to update tournament status',
        500,
        'TOURNAMENT_STATUS_UPDATE_FAILED'
      );
    }
  }

  private async updateStatusWithRaw(
    id: string,
    status: TournamentStatus,
    completedAt?: Date
  ): Promise<Tournament | undefined> {
    await (completedAt
      ? this.prisma.$executeRaw`
          UPDATE tournaments
          SET status = ${status}::tournament_status,
              completed_at = ${completedAt}
          WHERE id = ${id}
        `
      : this.prisma.$executeRaw`
          UPDATE tournaments
          SET status = ${status}::tournament_status
          WHERE id = ${id}
        `);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    return tournament ? this.mapToTournament(tournament) : undefined;
  }

  /**
   * Map Prisma tournament result to Tournament type
   */
  private mapToTournament(
    prismaResult: PrismaTournament & { players?: unknown; targets?: unknown; matches?: unknown }
  ): Tournament {
    return {
      id: prismaResult.id,
      name: prismaResult.name,
      format: prismaResult.format as TournamentFormat,
      durationType: prismaResult.durationType as DurationType,
      status: prismaResult.status as TournamentStatus,
      startTime: prismaResult.startTime, // Keep as Date object
      endTime: prismaResult.endTime, // Keep as Date object
      totalParticipants: prismaResult.totalParticipants,
      targetCount: prismaResult.targetCount,
      ...(prismaResult.logoUrl ? { logoUrl: prismaResult.logoUrl } : {}),
      createdAt: prismaResult.createdAt, // Keep as Date object
      ...(prismaResult.completedAt ? { completedAt: prismaResult.completedAt } : {}),
      historicalFlag: prismaResult.historicalFlag || false,
      // Include related data if available for extended interface compatibility
      ...(prismaResult.players ? { players: prismaResult.players } : {}),
      ...(prismaResult.targets ? { targets: prismaResult.targets } : {}),
      ...(prismaResult.matches ? { matches: prismaResult.matches } : {}),
    };
  }

  /**
   * Map Prisma player result to Player type
   */
  private mapToPlayer(prismaResult: PrismaPlayer): Player {
    return {
      id: prismaResult.id,
      tournamentId: prismaResult.tournamentId,
      ...(prismaResult.personId ? { personId: prismaResult.personId } : {}),
      firstName: prismaResult.firstName,
      lastName: prismaResult.lastName,
      ...(prismaResult.surname ? { surname: prismaResult.surname } : {}),
      ...(prismaResult.teamName ? { teamName: prismaResult.teamName } : {}),
      ...(prismaResult.email ? { email: prismaResult.email } : {}),
      ...(prismaResult.phone ? { phone: prismaResult.phone } : {}),
      ...(prismaResult.skillLevel
        ? { skillLevel: prismaResult.skillLevel as SkillLevel }
        : {}),
      registeredAt: prismaResult.registeredAt,
      isActive: prismaResult.isActive,
      checkedIn: prismaResult.checkedIn,
    };
  }

  /**
   * Get overall tournament statistics
   */
  async getOverallStats() {
    try {
      // Get total tournaments
      const totalTournaments = await this.prisma.tournament.count();

      // Get tournaments by status
      const statusStats = await this.prisma.tournament.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      });

      // Get tournaments by format
      const formatStats = await this.prisma.tournament.groupBy({
        by: ['format'],
        _count: {
          format: true,
        },
      });

      // Get participant statistics
      const participantStats = await this.prisma.tournament.aggregate({
        _sum: {
          totalParticipants: true,
        },
        _avg: {
          totalParticipants: true,
        },
        _max: {
          totalParticipants: true,
        },
        _min: {
          totalParticipants: true,
        },
      });

      // Get current participants (assuming we have a Player model with tournamentId)
      const currentParticipants = await this.prisma.player.count();

      // Calculate completion rates
      const completedTournaments = statusStats.find(s => s.status === 'FINISHED')?._count.status || 0;
      const inProgressTournaments = statusStats.find(s => s.status === 'LIVE')?._count.status || 0;
      const totalNonDraft = totalTournaments - (statusStats.find(s => s.status === 'DRAFT')?._count.status || 0);
      
      const completionRate = totalNonDraft > 0 ? (completedTournaments / totalNonDraft) * 100 : 0;

      // Get recent tournaments (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentTournaments = await this.prisma.tournament.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      return {
        overview: {
          totalTournaments,
          activeTournaments: inProgressTournaments,
          completedTournaments,
          completionRate: Math.round(completionRate * 100) / 100,
          recentTournaments,
        },
        participants: {
          totalCapacity: participantStats._sum.totalParticipants || 0,
          currentParticipants,
          averageParticipants: Math.round((participantStats._avg.totalParticipants || 0) * 100) / 100,
          maxParticipants: participantStats._max.totalParticipants || 0,
          minParticipants: participantStats._min.totalParticipants || 0,
        },
        distribution: {
          byStatus: statusStats.map(stat => ({
            status: stat.status,
            count: stat._count.status,
            percentage: Math.round((stat._count.status / totalTournaments) * 100 * 100) / 100,
          })),
          byFormat: formatStats.map(stat => ({
            format: stat.format,
            count: stat._count.format,
            percentage: Math.round((stat._count.format / totalTournaments) * 100 * 100) / 100,
          })),
        },
      };
    } catch (error) {
      logModelError('getTournamentStatistics', error);
      throw new AppError(
        `Failed to get tournament statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'STATS_QUERY_ERROR'
      );
    }
  }
}

export default TournamentModel;