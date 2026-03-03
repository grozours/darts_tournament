import type { Prisma, PrismaClient } from '@prisma/client';
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

    findAll: async (options?: {
      status?: TournamentStatus;
      format?: TournamentFormat;
      name?: string;
      excludeDraft?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'startTime' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    }): Promise<{ tournaments: Array<Tournament & { currentParticipants: number; hasLiveBrackets: boolean }>; total: number; page: number; limit: number }> => {
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

        const tournaments = await prisma.tournament.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
        });
        const total = await prisma.tournament.count({ where });

        const tournamentIds = tournaments.map((tournament) => tournament.id);
        type ParticipantCountRow = { tournamentId: string | null; _count: { _all: number } };
        const participantCounts = tournamentIds.length > 0
          ? await prisma.player.groupBy({
            by: ['tournamentId'],
            where: { tournamentId: { in: tournamentIds }, isActive: true },
            _count: { _all: true },
          })
          : [];
        const registeredDoubletteCounts = tournamentIds.length > 0
          ? await prisma.doublette.groupBy({
            by: ['tournamentId'],
            where: { tournamentId: { in: tournamentIds }, isRegistered: true },
            _count: { _all: true },
          })
          : [];
        const registeredEquipeCounts = tournamentIds.length > 0
          ? await prisma.equipe.groupBy({
            by: ['tournamentId'],
            where: { tournamentId: { in: tournamentIds }, isRegistered: true },
            _count: { _all: true },
          })
          : [];
        const liveBracketCounts = tournamentIds.length > 0
          ? await prisma.bracket.groupBy({
            by: ['tournamentId'],
            where: {
              tournamentId: { in: tournamentIds },
              status: BracketStatus.IN_PROGRESS,
            },
            _count: { _all: true },
          })
          : [];
        const participantCountByTournament = new Map(
          participantCounts
            .filter((entry: ParticipantCountRow): entry is ParticipantCountRow & { tournamentId: string } => Boolean(entry.tournamentId))
            .map((entry) => [entry.tournamentId, entry._count._all])
        );
        const registeredDoubletteCountByTournament = new Map(
          registeredDoubletteCounts
            .filter((entry: ParticipantCountRow): entry is ParticipantCountRow & { tournamentId: string } => Boolean(entry.tournamentId))
            .map((entry) => [entry.tournamentId, entry._count._all])
        );
        const registeredEquipeCountByTournament = new Map(
          registeredEquipeCounts
            .filter((entry: ParticipantCountRow): entry is ParticipantCountRow & { tournamentId: string } => Boolean(entry.tournamentId))
            .map((entry) => [entry.tournamentId, entry._count._all])
        );
        const liveBracketCountByTournament = new Map(
          liveBracketCounts
            .filter((entry: ParticipantCountRow): entry is ParticipantCountRow & { tournamentId: string } => Boolean(entry.tournamentId))
            .map((entry) => [entry.tournamentId, entry._count._all])
        );

        return {
          tournaments: tournaments.map((tournament) => {
            let currentParticipants = participantCountByTournament.get(tournament.id) ?? 0;
            if (tournament.format === TournamentFormat.DOUBLE) {
              currentParticipants = registeredDoubletteCountByTournament.get(tournament.id) ?? 0;
            } else if (tournament.format === TournamentFormat.TEAM_4_PLAYER) {
              currentParticipants = registeredEquipeCountByTournament.get(tournament.id) ?? 0;
            }

            return {
              ...mapToTournament(tournament),
              currentParticipants,
              hasLiveBrackets: (liveBracketCountByTournament.get(tournament.id) ?? 0) > 0,
            };
          }),
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
        const query: Prisma.TournamentFindManyArgs = {
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
        return tournaments.map((tournament) => ({
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

    updateLogo: async (id: string, logoUrl: string): Promise<Tournament> => {
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

        return tournaments.map((tournament) => mapToTournament(tournament));
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
