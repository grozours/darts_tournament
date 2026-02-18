import { Request, Response } from 'express';
import { TournamentService, TournamentFilters } from '../services/tournament-service';
import { TournamentFormat, MatchStatus, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/error-handler';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { isAdmin } from '../middleware/auth';

export class TournamentController {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get tournament service instance with request context
   */
  private getTournamentService(request: Request): TournamentService {
    return new TournamentService(this.prisma, request);
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

  /**
   * Register player for tournament
   * POST /api/tournaments/:id/register
   */
  registerPlayer = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const { playerId } = request.body as { playerId: string };

      await this.getTournamentService(request).registerPlayer(id, playerId);

      response.status(201).json({
        message: 'Player registered successfully',
        tournamentId: id,
        playerId,
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
   * Register player with details for tournament
   * POST /api/tournaments/:id/players
   */
  registerPlayerDetails = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const player = await this.getTournamentService(request).registerPlayerDetails(id, request.body);

      response.status(201).json(player);
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
   * Unregister player from tournament
   * DELETE /api/tournaments/:id/register/:playerId
   */
  unregisterPlayer = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };

      const canUnregister = await this.canUnregisterPlayer(request, response, id, playerId);
      if (!canUnregister) {
        return;
      }

      await this.getTournamentService(request).unregisterPlayer(id, playerId);

      response.json({
        message: 'Player unregistered successfully',
        tournamentId: id,
        playerId,
      });
    } catch (error) {
      logger.error('Unregister player failed', {
        correlationId: (request as { correlationId?: string }).correlationId,
        tournamentId: request.params?.id,
        playerId: request.params?.playerId,
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.error('[unregisterPlayer] Failed to unregister player', {
        tournamentId: request.params?.id,
        playerId: request.params?.playerId,
        error,
      });
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

  private async canUnregisterPlayer(
    request: Request,
    response: Response,
    tournamentId: string,
    playerId: string
  ): Promise<boolean> {
    if (isAdmin(request)) {
      return true;
    }

    const player = await this.getTournamentService(request).getPlayerById(playerId);
    if (player?.tournamentId !== tournamentId) {
      response.status(404).json({
        error: {
          message: 'Player not found for this tournament',
          code: 'PLAYER_NOT_FOUND',
        },
      });
      return false;
    }

    const userEmail = this.getAuthenticatedUserEmail(request);
    if (!userEmail) {
      response.status(403).json({
        error: {
          message: 'Cannot verify user identity',
          code: 'FORBIDDEN',
        },
      });
      return false;
    }

    const playerEmail = player.email?.toLowerCase();
    if (playerEmail !== userEmail.toLowerCase()) {
      response.status(403).json({
        error: {
          message: 'You can only unregister yourself from tournaments',
          code: 'FORBIDDEN',
        },
      });
      return false;
    }

    return true;
  }

  private getAuthenticatedUserEmail(request: Request): string | undefined {
    const rawPayload = request.auth?.payload;
    const payload = rawPayload && typeof rawPayload === 'object'
      ? (rawPayload as Record<string, unknown>)
      : undefined;
    const email = payload?.email
      ?? payload?.['https://darts-tournament.app/email']
      ?? payload?.['https://your-domain.com/email'];
    return typeof email === 'string' && email ? email : undefined;
  }

  /**
   * Get tournament participants
   * GET /api/tournaments/:id/participants
   */
  getTournamentParticipants = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const participants = await this.getTournamentService(request).getTournamentParticipants(id);

      response.json({
        tournamentId: id,
        participants,
        totalCount: participants.length,
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
   * Get tournament players
   * GET /api/tournaments/:id/players
   */
  getTournamentPlayers = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const participants = await this.getTournamentService(request).getTournamentParticipants(id);

      response.json({
        tournamentId: id,
        players: participants,
        totalCount: participants.length,
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
   * Get orphan players (no tournament)
   * GET /api/tournaments/players/orphans
   */
  getOrphanPlayers = async (request: Request, response: Response): Promise<void> => {
    try {
      const players = await this.getTournamentService(request).getOrphanParticipants();
      response.json({ players, totalCount: players.length });
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
   * Get pool stages
   * GET /api/tournaments/:id/pool-stages
   */
  getPoolStages = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const poolStages = await this.getTournamentService(request).getPoolStages(id);
      response.json({ poolStages });
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
   * Create pool stage
   * POST /api/tournaments/:id/pool-stages
   */
  createPoolStage = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const poolStage = await this.getTournamentService(request).createPoolStage(id, request.body);
      response.status(201).json(poolStage);
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
   * Update pool stage
   * PATCH /api/tournaments/:id/pool-stages/:stageId
   */
  updatePoolStage = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      const poolStage = await this.getTournamentService(request).updatePoolStage(id, stageId, request.body);
      response.json(poolStage);
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
   * Complete pool stage with random scores
   * POST /api/tournaments/:id/pool-stages/:stageId/complete
   */
  completePoolStageWithScores = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await this.getTournamentService(request).completePoolStageWithRandomScores(id, stageId);
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
   * Delete pool stage
   * DELETE /api/tournaments/:id/pool-stages/:stageId
   */
  deletePoolStage = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await this.getTournamentService(request).deletePoolStage(id, stageId);
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
   * Get pools for a pool stage
   * GET /api/tournaments/:id/pool-stages/:stageId/pools
   */
  getPoolStagePools = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      const pools = await this.getTournamentService(request).getPoolStagePools(id, stageId);
      response.json({ pools });
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
   * Update pool assignments for a pool stage
   * PUT /api/tournaments/:id/pool-stages/:stageId/assignments
   */
  updatePoolStageAssignments = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await this.getTournamentService(request).updatePoolAssignments(id, stageId, request.body.assignments || []);
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
   * Update match status
   * PATCH /api/tournaments/:id/matches/:matchId/status
   */
  updateMatchStatus = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { status, targetId } = request.body as { status: string; targetId?: string };
      await this.getTournamentService(request).updateMatchStatus(
        id,
        matchId,
        status as MatchStatus,
        targetId
      );
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
   * Complete a match with final scores
   * PATCH /api/tournaments/:id/matches/:matchId/complete
   */
  completeMatch = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { scores } = request.body as { scores: Array<{ playerId: string; scoreTotal: number }> };
      await this.getTournamentService(request).completeMatch(id, matchId, scores || []);
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
   * Update scores for a completed match
   * PATCH /api/tournaments/:id/matches/:matchId/scores
   */
  updateMatchScores = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { scores } = request.body as { scores: Array<{ playerId: string; scoreTotal: number }> };
      await this.getTournamentService(request).updateCompletedMatchScores(id, matchId, scores || []);
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
   * Complete bracket round with random scores
   * PATCH /api/tournaments/:id/brackets/:bracketId/rounds/:roundNumber/complete
   */
  completeBracketRoundWithScores = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const roundNumber = Number((request.params as { roundNumber?: string }).roundNumber);
      await this.getTournamentService(request).completeBracketRoundWithRandomScores(id, bracketId, roundNumber);
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
   * Get brackets
   * GET /api/tournaments/:id/brackets
   */
  getBrackets = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const brackets = await this.getTournamentService(request).getBrackets(id);
      response.json({ brackets });
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
   * Create bracket
   * POST /api/tournaments/:id/brackets
   */
  createBracket = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const bracket = await this.getTournamentService(request).createBracket(id, request.body);
      response.status(201).json(bracket);
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
   * Update bracket
   * PATCH /api/tournaments/:id/brackets/:bracketId
   */
  updateBracket = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const bracket = await this.getTournamentService(request).updateBracket(id, bracketId, request.body);
      response.json(bracket);
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
   * Delete bracket
   * DELETE /api/tournaments/:id/brackets/:bracketId
   */
  deleteBracket = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      await this.getTournamentService(request).deleteBracket(id, bracketId);
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
   * Update tournament player
   * PATCH /api/tournaments/:id/players/:playerId
   */
  updateTournamentPlayer = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const player = await this.getTournamentService(request).updateTournamentPlayer(
        id,
        playerId,
        request.body
      );

      response.json(player);
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
   * Update player check-in status
   * PATCH /api/tournaments/:id/players/:playerId/check-in
   */
  updateTournamentPlayerCheckIn = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const { checkedIn } = request.body as { checkedIn: boolean };

      const player = await this.getTournamentService(request).updateTournamentPlayerCheckIn(
        id,
        playerId,
        checkedIn
      );

      response.json({
        message: 'Player check-in status updated',
        player,
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
   * Remove tournament player
   * DELETE /api/tournaments/:id/players/:playerId
   */
  deleteTournamentPlayer = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      await this.getTournamentService(request).unregisterPlayer(id, playerId);

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
   * Validate registration constraints
   * GET /api/tournaments/:id/registration-validation/:playerId
   */
  validateRegistration = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const validation = await this.getTournamentService(request).validateRegistrationConstraints(id, playerId);

      response.json({
        tournamentId: id,
        playerId,
        ...validation,
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
   * Update tournament status
   * PATCH /api/tournaments/:id/status
   */
  updateTournamentStatus = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const { status, force = false } = request.body as { status: string; force?: boolean };

      const tournament = await this.getTournamentService(request).transitionTournamentStatus(
        id,
        status as TournamentStatus,
        force
      );

      response.json({
        message: `Tournament status updated to ${status}`,
        tournament,
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
   * Open tournament registration
   * POST /api/tournaments/:id/open-registration
   */
  openTournamentRegistration = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      
      const tournament = await this.getTournamentService(request).openTournamentRegistration(id);

      response.json({
        message: 'Tournament registration opened successfully',
        tournament,
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
   * Start tournament
   * POST /api/tournaments/:id/start
   */
  startTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      
      const tournament = await this.getTournamentService(request).startTournament(id);

      response.json({
        message: 'Tournament started successfully',
        tournament,
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
   * Complete tournament
   * POST /api/tournaments/:id/complete
   */
  completeTournament = async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      
      const tournament = await this.getTournamentService(request).completeTournament(id);

      response.json({
        message: 'Tournament finished successfully',
        tournament,
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
   * Get overall tournament statistics
   * GET /api/tournaments/stats
   */
  getOverallTournamentStats = async (request: Request, response: Response): Promise<void> => {
    try {
      const stats = await this.getTournamentService(request).getOverallTournamentStats();
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
}

export default TournamentController;