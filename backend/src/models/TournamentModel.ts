import { PrismaClient } from '@prisma/client';
import { Tournament, TournamentFormat, DurationType, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/errorHandler';

export class TournamentModel {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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
          logoUrl: tournamentData.logoUrl || null,
          status: 'DRAFT', // Default status using enum
          createdAt: new Date(),
        },
      });

      return this.mapToTournament(tournament);
    } catch (error: any) {
      if (error.code === 'P2002') {
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

  /**
   * Find tournament by ID
   */
  async findById(id: string): Promise<Tournament | null> {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
      });

      return tournament ? this.mapToTournament(tournament) : null;
    } catch (error: any) {
      throw new AppError(
        'Failed to fetch tournament',
        500,
        'TOURNAMENT_FETCH_FAILED'
      );
    }
  }

  /**
   * Find all tournaments with optional filtering
   */
  async findAll(options?: {
    status?: string;
    format?: TournamentFormat;
    name?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'startTime' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ tournaments: Tournament[]; total: number; page: number; limit: number }> {
    try {
      const {
        status,
        format,
        name,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options || {};

      const where: any = {};
      
      if (status) {
        where.status = status;
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

      return {
        tournaments: tournaments.map(tournament => this.mapToTournament(tournament)),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      throw new AppError(
        'Failed to fetch tournaments',
        500,
        'TOURNAMENTS_FETCH_FAILED'
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
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError(
          'Tournament not found',
          404,
          'TOURNAMENT_NOT_FOUND'
        );
      }
      if (error.code === 'P2002') {
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
    } catch (error: any) {
      if (error.code === 'P2025') {
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
    } catch (error: any) {
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

      // Tournament is editable if it's in draft or registration open status
      return [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN].includes(tournament.status as TournamentStatus);
    } catch (error: any) {
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
    } catch (error: any) {
      if (error.code === 'P2002') {
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
    } catch (error: any) {
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
      return !!(player && player.tournamentId === tournamentId);
    } catch (error: any) {
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
    } catch (error: any) {
      return 0;
    }
  }

  /**
   * Get tournament participants with player details
   */
  async getParticipants(tournamentId: string): Promise<any[]> {
    try {
      const participants = await this.prisma.player.findMany({
        where: {
          tournamentId,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          skillLevel: true,
          registeredAt: true,
        },
        orderBy: {
          registeredAt: 'asc',
        },
      });

      return participants.map((player: any) => ({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        email: player.email,
        phone: player.phone,
        skillLevel: player.skillLevel,
        registeredAt: player.registeredAt,
      }));
    } catch (error: any) {
      throw new AppError(
        'Failed to fetch tournament participants',
        500,
        'PARTICIPANTS_FETCH_FAILED'
      );
    }
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
    } catch (error: any) {
      if (error.code === 'P2025') {
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

  /**
   * Map Prisma tournament result to Tournament type
   */
  private mapToTournament(prismaResult: any): Tournament {
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
      logoUrl: prismaResult.logoUrl || undefined,
      createdAt: prismaResult.createdAt, // Keep as Date object
      completedAt: prismaResult.completedAt || undefined,
      historicalFlag: prismaResult.historicalFlag || false,
      // Include related data if available for extended interface compatibility
      ...(prismaResult.players && { players: prismaResult.players }),
      ...(prismaResult.targets && { targets: prismaResult.targets }),
      ...(prismaResult.matches && { matches: prismaResult.matches }),
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
      const completedTournaments = statusStats.find(s => s.status === 'COMPLETED')?._count.status || 0;
      const inProgressTournaments = statusStats.find(s => s.status === 'IN_PROGRESS')?._count.status || 0;
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
    } catch (error: any) {
      throw new AppError(
        `Failed to get tournament statistics: ${error.message}`,
        500,
        'STATS_QUERY_ERROR'
      );
    }
  }
}

export default TournamentModel;