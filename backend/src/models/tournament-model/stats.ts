import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/error-handler';
import { logModelError } from './helpers';

export const createTournamentModelStats = (prisma: PrismaClient) => ({
  getOverallStats: async () => {
    try {
      const totalTournaments = await prisma.tournament.count();

      type StatusStat = { status: string; _count: { status: number } };
      type FormatStat = { format: string; _count: { format: number } };

      const statusStats = await prisma.tournament.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      });

      const formatStats = await prisma.tournament.groupBy({
        by: ['format'],
        _count: {
          format: true,
        },
      });

      const participantStats = await prisma.tournament.aggregate({
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

      const currentParticipants = await prisma.player.count();

      const completedTournaments = statusStats.find((stat: StatusStat) => stat.status === 'FINISHED')?._count.status || 0;
      const inProgressTournaments = statusStats.find((stat: StatusStat) => stat.status === 'LIVE')?._count.status || 0;
      const totalNonDraft = totalTournaments - (statusStats.find((stat: StatusStat) => stat.status === 'DRAFT')?._count.status || 0);

      const completionRate = totalNonDraft > 0 ? (completedTournaments / totalNonDraft) * 100 : 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTournaments = await prisma.tournament.count({
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
          byStatus: statusStats.map((stat: StatusStat) => ({
            status: stat.status,
            count: stat._count.status,
            percentage: Math.round((stat._count.status / totalTournaments) * 100 * 100) / 100,
          })),
          byFormat: formatStats.map((stat: FormatStat) => ({
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
  },
});

export type TournamentModelStatsHandlers = ReturnType<typeof createTournamentModelStats>;
