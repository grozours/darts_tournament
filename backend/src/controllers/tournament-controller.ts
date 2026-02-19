import { Request, Response } from 'express';
import { TournamentService, TournamentFilters } from '../services/tournament-service';
import { TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/error-handler';
import { PrismaClient } from '@prisma/client';
import { isAdmin } from '../middleware/auth';
import { createExtendedHandlers } from './tournament-controller/extended-handlers';

export class TournamentController {
  private readonly prisma: PrismaClient;

  public registerPlayer!: (request: Request, response: Response) => Promise<void>;
  public registerPlayerDetails!: (request: Request, response: Response) => Promise<void>;
  public unregisterPlayer!: (request: Request, response: Response) => Promise<void>;
  public getTournamentParticipants!: (request: Request, response: Response) => Promise<void>;
  public getTournamentPlayers!: (request: Request, response: Response) => Promise<void>;
  public getOrphanPlayers!: (request: Request, response: Response) => Promise<void>;
  public getPoolStages!: (request: Request, response: Response) => Promise<void>;
  public createPoolStage!: (request: Request, response: Response) => Promise<void>;
  public updatePoolStage!: (request: Request, response: Response) => Promise<void>;
  public completePoolStageWithScores!: (request: Request, response: Response) => Promise<void>;
  public deletePoolStage!: (request: Request, response: Response) => Promise<void>;
  public getPoolStagePools!: (request: Request, response: Response) => Promise<void>;
  public updatePoolStageAssignments!: (request: Request, response: Response) => Promise<void>;
  public updateMatchStatus!: (request: Request, response: Response) => Promise<void>;
  public completeMatch!: (request: Request, response: Response) => Promise<void>;
  public updateMatchScores!: (request: Request, response: Response) => Promise<void>;
  public completeBracketRoundWithScores!: (request: Request, response: Response) => Promise<void>;
  public getBrackets!: (request: Request, response: Response) => Promise<void>;
  public createBracket!: (request: Request, response: Response) => Promise<void>;
  public updateBracket!: (request: Request, response: Response) => Promise<void>;
  public deleteBracket!: (request: Request, response: Response) => Promise<void>;
  public updateTournamentPlayer!: (request: Request, response: Response) => Promise<void>;
  public updateTournamentPlayerCheckIn!: (request: Request, response: Response) => Promise<void>;
  public deleteTournamentPlayer!: (request: Request, response: Response) => Promise<void>;
  public validateRegistration!: (request: Request, response: Response) => Promise<void>;
  public updateTournamentStatus!: (request: Request, response: Response) => Promise<void>;
  public openTournamentRegistration!: (request: Request, response: Response) => Promise<void>;
  public startTournament!: (request: Request, response: Response) => Promise<void>;
  public completeTournament!: (request: Request, response: Response) => Promise<void>;
  public getOverallTournamentStats!: (request: Request, response: Response) => Promise<void>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const context = {
      getTournamentService: (request: Request) => this.getTournamentService(request),
      handleError: (response: Response, error: unknown) => this.handleError(response, error),
    };
    Object.assign(this, createExtendedHandlers(context));
  }

  /**
   * Get tournament service instance with request context
   */
  private getTournamentService(request: Request): TournamentService {
    return new TournamentService(this.prisma, request);
  }

  private handleError(response: Response, error: unknown): void {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          details: (error as AppError & { details?: unknown }).details,
        },
      });
      return;
    }

    response.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }

  /**
   * Create a new tournament
   * POST /api/tournaments
   */
  createTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const tournamentService = this.getTournamentService(request);
      
      const {
        name,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
      } = request.body;

      const tournament = await tournamentService.createTournament({
        name,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
      });

      response.status(201).json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
            details: (error as AppError & { details?: unknown }).details,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get tournament by ID
   * GET /api/tournaments/:id
   */
  getTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const tournament = await this.getTournamentService(request).getTournamentById(id);

      response.json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get live view for tournament
   * GET /api/tournaments/:id/live
   */
  getTournamentLiveView = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const liveView = await this.getTournamentService(request).getTournamentLiveView(id);

      response.json(liveView);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get all tournaments with filtering and pagination
   * GET /api/tournaments
   */
  getTournaments = async (request: Request, response: Response): Promise<void> => {
    try {
      const {
        status,
        format,
        name,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = request.query;

      const parsedPage = Number(page);
      const parsedLimit = Number(limit);

      const filters: TournamentFilters = {
        page: Number.isFinite(parsedPage) ? parsedPage : 1,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : 10,
        sortBy: sortBy as 'name' | 'startTime' | 'createdAt',
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      if (typeof status === 'string') {
        filters.status = status as TournamentStatus;
      }
      if (typeof format === 'string') {
        filters.format = format as TournamentFormat;
      }
      if (typeof name === 'string') {
        filters.name = name;
      }

      const isAdminRequest = isAdmin(request);
      if (!isAdminRequest && filters.status === TournamentStatus.DRAFT) {
        response.json({ tournaments: [], total: 0, page: filters.page ?? 1, limit: filters.limit ?? 10 });
        return;
      }
      if (!isAdminRequest) {
        filters.excludeDraft = true;
      }

      const result = await this.getTournamentService(request).getTournaments(filters);

      response.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Update tournament
   * PUT /api/tournaments/:id
   */
  updateTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body;

      const tournament = await this.getTournamentService(request).updateTournament(id, updateData);

      response.json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Delete tournament
   * DELETE /api/tournaments/:id
   */
  deleteTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      await this.getTournamentService(request).deleteTournament(id);

      response.status(204).send();
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Upload tournament logo
   * POST /api/tournaments/:id/logo
   */
  uploadTournamentLogo = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };

      if (!request.file) {
        throw new AppError(
          'No file uploaded',
          400,
          'NO_FILE_UPLOADED'
        );
      }

      // Generate logo URL path
      const logoUrl = `/uploads/${request.file.filename}`;

      const tournament = await this.getTournamentService(request).uploadTournamentLogo(id, logoUrl);

      response.json({
        logo_url: logoUrl,
        logoUrl: logoUrl,
        tournament: tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get tournaments by date range
   * GET /api/tournaments/date-range
   */
  getTournamentsByDateRange = async (request: Request, response: Response): Promise<void> => {
    try {
      const { startDate, endDate } = request.query;

      if (!startDate || !endDate) {
        throw new AppError(
          'Start date and end date are required',
          400,
          'MISSING_DATE_PARAMS'
        );
      }

      const tournaments = await this.getTournamentService(request).getTournamentsByDateRange(
        startDate as string,
        endDate as string
      );

      response.json(tournaments);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get tournament statistics
   * GET /api/tournaments/:id/stats
   */
  getTournamentStats = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const stats = await this.getTournamentService(request).getTournamentStats(id);

      response.json(stats);
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Check tournament name availability
   * GET /api/tournaments/check-name/:name
   */
  checkTournamentNameAvailability = async (request: Request, response: Response): Promise<void> => {
    try {
      const { name } = request.params as { name: string };
      const { excludeId } = request.query;

      const isAvailable = await this.getTournamentService(request).isTournamentNameAvailable(
        name,
        excludeId as string
      );

      response.json({
        name,
        available: isAvailable,
      });
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        response.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };
}

export default TournamentController;