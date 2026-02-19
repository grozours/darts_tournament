import type { Prisma, PrismaClient } from '@prisma/client';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
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
    }): Promise<{ tournaments: Array<Tournament & { currentParticipants: number }>; total: number; page: number; limit: number }> => {
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
          prisma.tournament.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
              [sortBy]: sortOrder,
            },
          }),
          prisma.tournament.count({ where }),
        ]);

        const tournamentIds = tournaments.map((tournament) => tournament.id);
        const participantCounts = tournamentIds.length > 0
          ? await prisma.player.groupBy({
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
            ...mapToTournament(tournament),
            currentParticipants: participantCountByTournament.get(tournament.id) ?? 0,
          })),
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
      format: TournamentFormat;
      durationType: DurationType;
      startTime: Date;
      endTime: Date;
      totalParticipants: number;
      targetCount: number;
      logoUrl?: string;
    }): Promise<Tournament> => {
      try {
        const tournament = await prisma.tournament.create({
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
            status: 'DRAFT',
            createdAt: new Date(),
          },
        });

        if (tournamentData.targetCount > 0) {
          const targets = Array.from({ length: tournamentData.targetCount }, (_, index) => ({
            tournamentId: tournament.id,
            targetNumber: index + 1,
            targetCode: `target${index + 1}`,
          }));
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
        format: TournamentFormat;
        durationType: DurationType;
        startTime: Date;
        endTime: Date;
        totalParticipants: number;
        targetCount: number;
        logoUrl: string;
        status: TournamentStatus;
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
