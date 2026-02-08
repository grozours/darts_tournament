import { Request, Response } from 'express';
import { TournamentService, TournamentFilters } from '../services/TournamentService';
import { TournamentFormat, MatchStatus, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';

export class TournamentController {
  private readonly prisma: PrismaClient;

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
            details: (error as AppError & { details?: unknown }).details,
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
   * Get live view for tournament
   * GET /api/tournaments/:id/live
   */
  getTournamentLiveView = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const liveView = await this.getTournamentService(req).getTournamentLiveView(id);

      res.json(liveView);
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
   * Register player with details for tournament
   * POST /api/tournaments/:id/players
   */
  registerPlayerDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const player = await this.getTournamentService(req).registerPlayerDetails(id, req.body);

      res.status(201).json(player);
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
   * Get tournament players
   * GET /api/tournaments/:id/players
   */
  getTournamentPlayers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const participants = await this.getTournamentService(req).getTournamentParticipants(id);

      res.json({
        tournamentId: id,
        players: participants,
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
   * Get orphan players (no tournament)
   * GET /api/tournaments/players/orphans
   */
  getOrphanPlayers = async (req: Request, res: Response): Promise<void> => {
    try {
      const players = await this.getTournamentService(req).getOrphanParticipants();
      res.json({ players, totalCount: players.length });
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
   * Get pool stages
   * GET /api/tournaments/:id/pool-stages
   */
  getPoolStages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const poolStages = await this.getTournamentService(req).getPoolStages(id);
      res.json({ poolStages });
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
   * Create pool stage
   * POST /api/tournaments/:id/pool-stages
   */
  createPoolStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const poolStage = await this.getTournamentService(req).createPoolStage(id, req.body);
      res.status(201).json(poolStage);
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
   * Update pool stage
   * PATCH /api/tournaments/:id/pool-stages/:stageId
   */
  updatePoolStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, stageId } = req.params as { id: string; stageId: string };
      const poolStage = await this.getTournamentService(req).updatePoolStage(id, stageId, req.body);
      res.json(poolStage);
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
   * Complete pool stage with random scores
   * POST /api/tournaments/:id/pool-stages/:stageId/complete
   */
  completePoolStageWithScores = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, stageId } = req.params as { id: string; stageId: string };
      await this.getTournamentService(req).completePoolStageWithRandomScores(id, stageId);
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
   * Delete pool stage
   * DELETE /api/tournaments/:id/pool-stages/:stageId
   */
  deletePoolStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, stageId } = req.params as { id: string; stageId: string };
      await this.getTournamentService(req).deletePoolStage(id, stageId);
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
   * Get pools for a pool stage
   * GET /api/tournaments/:id/pool-stages/:stageId/pools
   */
  getPoolStagePools = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, stageId } = req.params as { id: string; stageId: string };
      const pools = await this.getTournamentService(req).getPoolStagePools(id, stageId);
      res.json({ pools });
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
   * Update pool assignments for a pool stage
   * PUT /api/tournaments/:id/pool-stages/:stageId/assignments
   */
  updatePoolStageAssignments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, stageId } = req.params as { id: string; stageId: string };
      await this.getTournamentService(req).updatePoolAssignments(id, stageId, req.body.assignments || []);
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
   * Update match status
   * PATCH /api/tournaments/:id/matches/:matchId/status
   */
  updateMatchStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, matchId } = req.params as { id: string; matchId: string };
      const { status, targetId } = req.body as { status: string; targetId?: string };
      await this.getTournamentService(req).updateMatchStatus(
        id,
        matchId,
        status as MatchStatus,
        targetId
      );
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
   * Complete a match with final scores
   * PATCH /api/tournaments/:id/matches/:matchId/complete
   */
  completeMatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, matchId } = req.params as { id: string; matchId: string };
      const { scores } = req.body as { scores: Array<{ playerId: string; scoreTotal: number }> };
      await this.getTournamentService(req).completeMatch(id, matchId, scores || []);
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
   * Update scores for a completed match
   * PATCH /api/tournaments/:id/matches/:matchId/scores
   */
  updateMatchScores = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, matchId } = req.params as { id: string; matchId: string };
      const { scores } = req.body as { scores: Array<{ playerId: string; scoreTotal: number }> };
      await this.getTournamentService(req).updateCompletedMatchScores(id, matchId, scores || []);
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
   * Get brackets
   * GET /api/tournaments/:id/brackets
   */
  getBrackets = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const brackets = await this.getTournamentService(req).getBrackets(id);
      res.json({ brackets });
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
   * Create bracket
   * POST /api/tournaments/:id/brackets
   */
  createBracket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const bracket = await this.getTournamentService(req).createBracket(id, req.body);
      res.status(201).json(bracket);
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
   * Update bracket
   * PATCH /api/tournaments/:id/brackets/:bracketId
   */
  updateBracket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, bracketId } = req.params as { id: string; bracketId: string };
      const bracket = await this.getTournamentService(req).updateBracket(id, bracketId, req.body);
      res.json(bracket);
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
   * Delete bracket
   * DELETE /api/tournaments/:id/brackets/:bracketId
   */
  deleteBracket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, bracketId } = req.params as { id: string; bracketId: string };
      await this.getTournamentService(req).deleteBracket(id, bracketId);
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
   * Update tournament player
   * PATCH /api/tournaments/:id/players/:playerId
   */
  updateTournamentPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, playerId } = req.params as { id: string; playerId: string };
      const player = await this.getTournamentService(req).updateTournamentPlayer(
        id,
        playerId,
        req.body
      );

      res.json(player);
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
   * Update player check-in status
   * PATCH /api/tournaments/:id/players/:playerId/check-in
   */
  updateTournamentPlayerCheckIn = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, playerId } = req.params as { id: string; playerId: string };
      const { checkedIn } = req.body as { checkedIn: boolean };

      const player = await this.getTournamentService(req).updateTournamentPlayerCheckIn(
        id,
        playerId,
        checkedIn
      );

      res.json({
        message: 'Player check-in status updated',
        player,
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
   * Remove tournament player
   * DELETE /api/tournaments/:id/players/:playerId
   */
  deleteTournamentPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, playerId } = req.params as { id: string; playerId: string };
      await this.getTournamentService(req).unregisterPlayer(id, playerId);

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
        status as TournamentStatus,
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
        message: 'Tournament finished successfully',
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