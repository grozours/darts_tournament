import type { PrismaClient } from '@prisma/client';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
  BracketStatus,
} from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import {
  getPrismaErrorCode,
  liveViewArguments,
  logModelError,
  mapToTournament,
  type TournamentLiveView,
} from './helpers';

type TournamentRecord = Awaited<ReturnType<PrismaClient['tournament']['findUnique']>>;
type TournamentListRecord = NonNullable<TournamentRecord>;
type GroupCountRow = { tournamentId: string | null; _count: { _all: number } };
type TournamentFindAllOptions = {
  status?: TournamentStatus;
  format?: TournamentFormat;
  name?: string;
  excludeDraft?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'startTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
};
type TournamentFindAllResult = {
  tournaments: Array<Tournament & { currentParticipants: number; hasLiveBrackets: boolean }>;
  total: number;
  page: number;
  limit: number;
};

type TournamentFindWhere = {
  status?: TournamentStatus | { not: TournamentStatus };
  format?: TournamentFormat;
  name?: { contains: string; mode: 'insensitive' };
};

const toTournamentCountMap = (rows: GroupCountRow[]): Map<string, number> => new Map(
  rows
    .filter((entry): entry is GroupCountRow & { tournamentId: string } => Boolean(entry.tournamentId))
    .map((entry) => [entry.tournamentId, entry._count._all] as const)
);

const buildFindAllWhere = (options: TournamentFindAllOptions): TournamentFindWhere => {
  const where: TournamentFindWhere = {};

  if (options.status) {
    where.status = options.status;
  } else if (options.excludeDraft) {
    where.status = { not: TournamentStatus.DRAFT };
  }

  if (options.format) {
    where.format = options.format;
  }

  if (options.name) {
    where.name = {
      contains: options.name,
      mode: 'insensitive',
    };
  }

  return where;
};

const loadCountRows = async (
  prisma: PrismaClient,
  tournamentIds: string[]
): Promise<{
  participantCountByTournament: Map<string, number>;
  registeredDoubletteCountByTournament: Map<string, number>;
  registeredEquipeCountByTournament: Map<string, number>;
  liveBracketCountByTournament: Map<string, number>;
}> => {
  if (tournamentIds.length === 0) {
    return {
      participantCountByTournament: new Map(),
      registeredDoubletteCountByTournament: new Map(),
      registeredEquipeCountByTournament: new Map(),
      liveBracketCountByTournament: new Map(),
    };
  }

  const [participantCounts, registeredDoubletteCounts, registeredEquipeCounts, liveBracketCounts] = await Promise.all([
    prisma.player.groupBy({
      by: ['tournamentId'],
      where: { tournamentId: { in: tournamentIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.doublette.groupBy({
      by: ['tournamentId'],
      where: { tournamentId: { in: tournamentIds }, isRegistered: true },
      _count: { _all: true },
    }),
    prisma.equipe.groupBy({
      by: ['tournamentId'],
      where: { tournamentId: { in: tournamentIds }, isRegistered: true },
      _count: { _all: true },
    }),
    prisma.bracket.groupBy({
      by: ['tournamentId'],
      where: {
        tournamentId: { in: tournamentIds },
        status: BracketStatus.IN_PROGRESS,
      },
      _count: { _all: true },
    }),
  ]);

  return {
    participantCountByTournament: toTournamentCountMap(participantCounts),
    registeredDoubletteCountByTournament: toTournamentCountMap(registeredDoubletteCounts),
    registeredEquipeCountByTournament: toTournamentCountMap(registeredEquipeCounts),
    liveBracketCountByTournament: toTournamentCountMap(liveBracketCounts),
  };
};

const resolveCurrentParticipants = (
  tournament: TournamentListRecord,
  participantCountByTournament: Map<string, number>,
  registeredDoubletteCountByTournament: Map<string, number>,
  registeredEquipeCountByTournament: Map<string, number>
): number => {
  if (tournament.format === TournamentFormat.DOUBLE) {
    return registeredDoubletteCountByTournament.get(tournament.id) ?? 0;
  }

  if (tournament.format === TournamentFormat.TEAM_4_PLAYER) {
    return registeredEquipeCountByTournament.get(tournament.id) ?? 0;
  }

  return participantCountByTournament.get(tournament.id) ?? 0;
};

const enrichTournamentList = (
  tournaments: TournamentListRecord[],
  maps: {
    participantCountByTournament: Map<string, number>;
    registeredDoubletteCountByTournament: Map<string, number>;
    registeredEquipeCountByTournament: Map<string, number>;
    liveBracketCountByTournament: Map<string, number>;
  }
): Array<Tournament & { currentParticipants: number; hasLiveBrackets: boolean }> => (
  tournaments.map((tournament) => {
    const currentParticipants = resolveCurrentParticipants(
      tournament,
      maps.participantCountByTournament,
      maps.registeredDoubletteCountByTournament,
      maps.registeredEquipeCountByTournament
    );
    const liveBracketCount = maps.liveBracketCountByTournament.get(tournament.id);

    return {
      ...mapToTournament(tournament),
      currentParticipants,
      hasLiveBrackets: Number(liveBracketCount ?? 0) > 0,
    };
  })
);

export const createTournamentModelCore = (prisma: PrismaClient) => {
  const updateStatusWithRaw = async (
    id: string,
    status: TournamentStatus,
    completedAt?: Date
  ): Promise<Tournament | undefined> => {
    await (completedAt
      ? prisma.$executeRaw`
          UPDATE tournaments
          SET status = ${status}::tournament_status,
              completed_at = ${completedAt}
          WHERE id = ${id}
        `
      : prisma.$executeRaw`
          UPDATE tournaments
          SET status = ${status}::tournament_status
          WHERE id = ${id}
        `);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    return tournament ? mapToTournament(tournament) : undefined;
  };

  return {
    findById: async (id: string): Promise<Tournament | undefined> => {
      try {
        const tournament = await prisma.tournament.findUnique({
          where: { id },
        });

        return tournament ? mapToTournament(tournament) : undefined;
      } catch (error) {
        logModelError('findById', error);
        throw new AppError('Failed to fetch tournament', 500, 'TOURNAMENT_FETCH_FAILED');
      }
    },

    findLiveView: async (id: string): Promise<TournamentLiveView | undefined> => {
      try {
        const tournament = await prisma.tournament.findUnique({
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
    },

    findAll: async (options?: TournamentFindAllOptions): Promise<TournamentFindAllResult> => {
      try {
        const {
          page = 1,
          limit = 10,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = options || {};

        const where = buildFindAllWhere(options ?? {});

        const skip = (page - 1) * limit;

        const tournaments: TournamentListRecord[] = await prisma.tournament.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
        });
        const total = await prisma.tournament.count({ where });

        const tournamentIds = tournaments.map((tournament: TournamentListRecord) => tournament.id);
        const maps = await loadCountRows(prisma, tournamentIds);

        return {
          tournaments: enrichTournamentList(tournaments, maps),
          total,
          page,
          limit,
        };
      } catch (error) {
        logModelError('findAll', error);
        throw new AppError('Failed to fetch tournaments', 500, 'TOURNAMENTS_FETCH_FAILED');
      }
    },

    create: async (tournamentData: {
      name: string;
      location?: string;
      format: TournamentFormat;
      durationType: DurationType;
      startTime: Date;
      endTime: Date;
      totalParticipants: number;
      targetCount: number;
      targetStartNumber?: number;
      shareTargets?: boolean;
      logoUrl?: string;
      doubleStageEnabled?: boolean;
    }): Promise<Tournament> => {
      try {
        const targetStartNumber = tournamentData.targetStartNumber ?? 1;
        const shareTargets = tournamentData.shareTargets ?? true;
        const tournament = await prisma.tournament.create({
          data: {
            name: tournamentData.name,
            // eslint-disable-next-line unicorn/no-null
            location: tournamentData.location ?? null,
            format: tournamentData.format,
            durationType: tournamentData.durationType,
            startTime: tournamentData.startTime,
            endTime: tournamentData.endTime,
            totalParticipants: tournamentData.totalParticipants,
            targetCount: tournamentData.targetCount,
            targetStartNumber,
            shareTargets,
            doubleStageEnabled: tournamentData.doubleStageEnabled ?? false,
            // eslint-disable-next-line unicorn/no-null
            logoUrl: tournamentData.logoUrl ?? null,
            status: 'DRAFT',
            createdAt: new Date(),
          },
        });

        if (tournamentData.targetCount > 0) {
          const targets = Array.from({ length: tournamentData.targetCount }, (_, index) => {
            const targetNumber = targetStartNumber + index;
            return {
            tournamentId: tournament.id,
              targetNumber,
              targetCode: `target${targetNumber}`,
            };
          });
          await prisma.target.createMany({ data: targets });
        }

        return mapToTournament(tournament);
      } catch (error) {
        logModelError('create', error);
        if (getPrismaErrorCode(error) === 'P2002') {
          throw new AppError(
            'Tournament with this name already exists',
            400,
            'TOURNAMENT_NAME_EXISTS'
          );
        }
        throw new AppError('Failed to create tournament', 500, 'TOURNAMENT_CREATE_FAILED');
      }
    },

    getMaxTargetNumber: async (tournamentId: string): Promise<number> => {
      try {
        const target = await prisma.target.findFirst({
          where: { tournamentId },
          orderBy: { targetNumber: 'desc' },
          select: { targetNumber: true },
        });
        return target?.targetNumber ?? 0;
      } catch (error) {
        logModelError('getMaxTargetNumber', error);
        return 0;
      }
    },

    createTargetsForTournament: async (tournamentId: string, startNumber: number, count: number) => {
      if (count <= 0) return;
      const targets = Array.from({ length: count }, (_, index) => {
        const targetNumber = startNumber + index;
        return {
          tournamentId,
          targetNumber,
          targetCode: `target${targetNumber}`,
        };
      });
      await prisma.target.createMany({ data: targets, skipDuplicates: true });
    },

    update: async (
      id: string,
      updateData: Partial<{
        name: string;
        location: string;
        format: TournamentFormat;
        durationType: DurationType;
        startTime: Date;
        endTime: Date;
        totalParticipants: number;
        targetCount: number;
        targetStartNumber: number;
        shareTargets: boolean;
        logoUrl: string;
        status: TournamentStatus;
        doubleStageEnabled: boolean;
      }>
    ): Promise<Tournament> => {
      try {
        const tournament = await prisma.tournament.update({
          where: { id },
          data: {
            ...updateData,
          },
        });

        return mapToTournament(tournament);
      } catch (error) {
        logModelError('update', error);
        if (getPrismaErrorCode(error) === 'P2025') {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }
        if (getPrismaErrorCode(error) === 'P2002') {
          throw new AppError(
            'Tournament with this name already exists',
            400,
            'TOURNAMENT_NAME_EXISTS'
          );
        }
        throw new AppError('Failed to update tournament', 500, 'TOURNAMENT_UPDATE_FAILED');
      }
    },

    getTargetRanges: async (excludeId?: string): Promise<Array<{
      id: string;
      name: string;
      targetStartNumber: number;
      targetCount: number;
      shareTargets: boolean;
    }>> => {
      try {
        const query = {
          select: {
            id: true,
            name: true,
            targetStartNumber: true,
            targetCount: true,
            shareTargets: true,
          },
          ...(excludeId ? { where: { id: { not: excludeId } } } : {}),
        };
        const tournaments = await prisma.tournament.findMany(query);
  return tournaments.map((tournament: (typeof tournaments)[number]) => ({
          id: tournament.id,
          name: tournament.name,
          targetStartNumber: tournament.targetStartNumber ?? 1,
          targetCount: tournament.targetCount,
          shareTargets: tournament.shareTargets ?? true,
        }));
      } catch (error) {
        logModelError('getTargetRanges', error);
        throw new AppError('Failed to fetch target ranges', 500, 'TARGET_RANGE_FETCH_FAILED');
      }
    },

    getTargetsForTournament: async (tournamentId: string): Promise<Array<{
      id: string;
      targetNumber: number;
    }>> => {
      try {
        return await prisma.target.findMany({
          where: { tournamentId },
          select: { id: true, targetNumber: true },
          orderBy: { targetNumber: 'asc' },
        });
      } catch (error) {
        logModelError('getTargetsForTournament', error);
        throw new AppError('Failed to fetch tournament targets', 500, 'TARGET_FETCH_FAILED');
      }
    },

    getMatchCountForTargets: async (targetIds: string[]): Promise<number> => {
      if (targetIds.length === 0) return 0;
      try {
        return await prisma.match.count({
          where: { targetId: { in: targetIds } },
        });
      } catch (error) {
        logModelError('getMatchCountForTargets', error);
        throw new AppError('Failed to fetch target usage', 500, 'TARGET_USAGE_FETCH_FAILED');
      }
    },

    rebuildTargetsForTournament: async (
      tournamentId: string,
      startNumber: number,
      count: number
    ): Promise<void> => {
      type TargetRow = { id: string; targetNumber: number };
      const targets: TargetRow[] = await prisma.target.findMany({
        where: { tournamentId },
        select: { id: true, targetNumber: true },
        orderBy: { targetNumber: 'asc' },
      });

      const keepTargets = targets.slice(0, count);
      const deleteTargets = targets.slice(count);
      const tempOffset = 1000;

      const tempUpdates = keepTargets.map((target) => prisma.target.update({
        where: { id: target.id },
        data: {
          targetNumber: target.targetNumber + tempOffset,
          targetCode: `temp-${target.id}`,
        },
      }));

      const finalUpdates = keepTargets.map((target, index) => {
        const targetNumber = startNumber + index;
        return prisma.target.update({
          where: { id: target.id },
          data: {
            targetNumber,
            targetCode: `target${targetNumber}`,
          },
        });
      });

      const deleteOperations = deleteTargets.length > 0
        ? [prisma.target.deleteMany({ where: { id: { in: deleteTargets.map((target) => target.id) } } })]
        : [];

      const createCount = count - keepTargets.length;
      const createOperations = createCount > 0
        ? [prisma.target.createMany({
          data: Array.from({ length: createCount }, (_, index) => {
            const targetNumber = startNumber + keepTargets.length + index;
            return {
              tournamentId,
              targetNumber,
              targetCode: `target${targetNumber}`,
            };
          }),
        })]
        : [];

      await prisma.$transaction([
        ...tempUpdates,
        ...finalUpdates,
        ...deleteOperations,
        ...createOperations,
      ]);
    },

    delete: async (id: string): Promise<boolean> => {
      try {
        await prisma.tournament.delete({
          where: { id },
        });
        return true;
      } catch (error) {
        logModelError('delete', error);
        if (getPrismaErrorCode(error) === 'P2025') {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }
        throw new AppError('Failed to delete tournament', 500, 'TOURNAMENT_DELETE_FAILED');
      }
    },

    updateLogo: async (id: string, logoUrl: string | null): Promise<Tournament> => {
      try {
        const tournament = await prisma.tournament.update({
          where: { id },
          data: { logoUrl },
        });
        return mapToTournament(tournament);
      } catch (error) {
        logModelError('updateLogo', error);
        if (getPrismaErrorCode(error) === 'P2025') {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }
        throw new AppError('Failed to update tournament logo', 500, 'TOURNAMENT_LOGO_UPDATE_FAILED');
      }
    },

    findByDateRange: async (startDate: Date, endDate: Date): Promise<Tournament[]> => {
      try {
        const tournaments = await prisma.tournament.findMany({
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

  return tournaments.map((tournament: TournamentListRecord) => mapToTournament(tournament));
      } catch (error) {
        logModelError('findByDateRange', error);
        throw new AppError(
          'Failed to fetch tournaments by date range',
          500,
          'TOURNAMENTS_DATE_RANGE_FAILED'
        );
      }
    },

    isEditable: async (id: string): Promise<boolean> => {
      try {
        const tournament = await prisma.tournament.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!tournament) {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }

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
        throw new AppError('Failed to check tournament status', 500, 'TOURNAMENT_STATUS_CHECK_FAILED');
      }
    },

    updateStatus: async (
      id: string,
      status: TournamentStatus,
      completedAt?: Date
    ): Promise<Tournament> => {
      try {
        const tournament = await prisma.tournament.update({
          where: { id },
          data: {
            status,
            ...(completedAt && { completedAt }),
          },
        });

        return mapToTournament(tournament);
      } catch (error) {
        logModelError('updateStatus', error);
        if (error instanceof Error && error.name === 'PrismaClientValidationError') {
          const updatedTournament = await updateStatusWithRaw(id, status, completedAt);
          if (!updatedTournament) {
            throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
          }
          return updatedTournament;
        }
        if (getPrismaErrorCode(error) === 'P2025') {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }
        throw new AppError(
          'Failed to update tournament status',
          500,
          'TOURNAMENT_STATUS_UPDATE_FAILED'
        );
      }
    },
  };
};

export type TournamentModelCoreHandlers = ReturnType<typeof createTournamentModelCore>;
