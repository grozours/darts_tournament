import { Request, Response } from 'express';
import { TournamentService } from '../services/TournamentService';
import { AppError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';

export class TournamentController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get tournament service instance with request context
   */
  private getTournamentService(req: Request): TournamentService {
    return new TournamentService(this.prisma, req);
  }

  /**
   * Create a new tournament
   * POST /api/tournaments
   */
  createTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const tournamentService = this.getTournamentService(req);
      
      const {
        name,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
      } = req.body;

      const tournament = await tournamentService.createTournament({
        name,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
      });

      res.status(201).json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
            details: (error as any).details,
          },
        });
      } else {
        res.status(500).json({
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
  getTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const tournament = await this.getTournamentService(req).getTournamentById(id);

      res.json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  getTournaments = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        status,
        format,
        name,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const filters = {
        status: status as string,
        format: format as any,
        name: name as string,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sortBy: sortBy as 'name' | 'startTime' | 'createdAt',
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await this.getTournamentService(req).getTournaments(filters);

      res.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  updateTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const updateData = req.body;

      const tournament = await this.getTournamentService(req).updateTournament(id, updateData);

      res.json(tournament);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  deleteTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      await this.getTournamentService(req).deleteTournament(id);

      res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  uploadTournamentLogo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };

      if (!req.file) {
        throw new AppError(
          'No file uploaded',
          400,
          'NO_FILE_UPLOADED'
        );
      }

      // Generate logo URL path
      const logoUrl = `/uploads/${req.file.filename}`;

      const tournament = await this.getTournamentService(req).uploadTournamentLogo(id, logoUrl);

      res.json({
        logo_url: logoUrl,
        logoUrl: logoUrl,
        tournament: tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  getTournamentsByDateRange = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError(
          'Start date and end date are required',
          400,
          'MISSING_DATE_PARAMS'
        );
      }

      const tournaments = await this.getTournamentService(req).getTournamentsByDateRange(
        startDate as string,
        endDate as string
      );

      res.json(tournaments);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  getTournamentStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const stats = await this.getTournamentService(req).getTournamentStats(id);

      res.json(stats);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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
  checkTournamentNameAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.params as { name: string };
      const { excludeId } = req.query;

      const isAvailable = await this.getTournamentService(req).isTournamentNameAvailable(
        name,
        excludeId as string
      );

      res.json({
        name,
        available: isAvailable,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Register player for tournament
   * POST /api/tournaments/:id/register
   */
  registerPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { playerId } = req.body as { playerId: string };

      await this.getTournamentService(req).registerPlayer(id, playerId);

      res.status(201).json({
        message: 'Player registered successfully',
        tournamentId: id,
        playerId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Unregister player from tournament
   * DELETE /api/tournaments/:id/register/:playerId
   */
  unregisterPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, playerId } = req.params as { id: string; playerId: string };

      await this.getTournamentService(req).unregisterPlayer(id, playerId);

      res.json({
        message: 'Player unregistered successfully',
        tournamentId: id,
        playerId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get tournament participants
   * GET /api/tournaments/:id/participants
   */
  getTournamentParticipants = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const participants = await this.getTournamentService(req).getTournamentParticipants(id);

      res.json({
        tournamentId: id,
        participants,
        totalCount: participants.length,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Validate registration constraints
   * GET /api/tournaments/:id/registration-validation/:playerId
   */
  validateRegistration = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, playerId } = req.params as { id: string; playerId: string };
      const validation = await this.getTournamentService(req).validateRegistrationConstraints(id, playerId);

      res.json({
        tournamentId: id,
        playerId,
        ...validation,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Update tournament status
   * PATCH /api/tournaments/:id/status
   */
  updateTournamentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { status, force = false } = req.body as { status: string; force?: boolean };

      const tournament = await this.getTournamentService(req).transitionTournamentStatus(
        id, 
        status as any, 
        force
      );

      res.json({
        message: `Tournament status updated to ${status}`,
        tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Open tournament registration
   * POST /api/tournaments/:id/open-registration
   */
  openTournamentRegistration = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      
      const tournament = await this.getTournamentService(req).openTournamentRegistration(id);

      res.json({
        message: 'Tournament registration opened successfully',
        tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Start tournament
   * POST /api/tournaments/:id/start
   */
  startTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      
      const tournament = await this.getTournamentService(req).startTournament(id);

      res.json({
        message: 'Tournament started successfully',
        tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Complete tournament
   * POST /api/tournaments/:id/complete
   */
  completeTournament = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      
      const tournament = await this.getTournamentService(req).completeTournament(id);

      res.json({
        message: 'Tournament completed successfully',
        tournament,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  };

  /**
   * Get overall tournament statistics
   * GET /api/tournaments/stats
   */
  getOverallTournamentStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.getTournamentService(req).getOverallTournamentStats();
      res.json(stats);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        res.status(500).json({
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