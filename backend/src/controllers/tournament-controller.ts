import { Request, Response } from 'express';
import { TournamentService, TournamentFilters } from '../services/tournament-service';
import { MATCH_FORMAT_PRESETS, TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/error-handler';
import { Prisma, PrismaClient } from '@prisma/client';
import { isAdmin } from '../middleware/auth';
import { createExtendedHandlers } from './tournament-controller/extended-handlers';

export class TournamentController {
  private readonly prisma: PrismaClient;

  public registerPlayer!: (request: Request, response: Response) => Promise<void>;
  public registerPlayerDetails!: (request: Request, response: Response) => Promise<void>;
  public unregisterPlayer!: (request: Request, response: Response) => Promise<void>;
    public getTournamentTargets!: (request: Request, response: Response) => Promise<void>;
  public getTournamentParticipants!: (request: Request, response: Response) => Promise<void>;
  public getTournamentPlayers!: (request: Request, response: Response) => Promise<void>;
  public getOrphanPlayers!: (request: Request, response: Response) => Promise<void>;
  public getPoolStages!: (request: Request, response: Response) => Promise<void>;
  public createPoolStage!: (request: Request, response: Response) => Promise<void>;
  public updatePoolStage!: (request: Request, response: Response) => Promise<void>;
  public recomputeDoubleStageProgression!: (request: Request, response: Response) => Promise<void>;
  public populateBracketFromPools!: (request: Request, response: Response) => Promise<void>;
  public completePoolStageWithScores!: (request: Request, response: Response) => Promise<void>;
  public deletePoolStage!: (request: Request, response: Response) => Promise<void>;
  public getPoolStagePools!: (request: Request, response: Response) => Promise<void>;
  public resetPoolMatches!: (request: Request, response: Response) => Promise<void>;
  public updatePoolStageAssignments!: (request: Request, response: Response) => Promise<void>;
  public updateMatchStatus!: (request: Request, response: Response) => Promise<void>;
  public completeMatch!: (request: Request, response: Response) => Promise<void>;
  public updateMatchScores!: (request: Request, response: Response) => Promise<void>;
  public completeBracketRoundWithScores!: (request: Request, response: Response) => Promise<void>;
  public resetBracketMatches!: (request: Request, response: Response) => Promise<void>;
  public getBrackets!: (request: Request, response: Response) => Promise<void>;
  public createBracket!: (request: Request, response: Response) => Promise<void>;
  public updateBracket!: (request: Request, response: Response) => Promise<void>;
  public updateBracketTargets!: (request: Request, response: Response) => Promise<void>;
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

  private async ensureDefaultTournamentPresets() {
    const existingCount = await this.prisma.tournamentPreset.count();
    if (existingCount === 0) {
      await this.prisma.tournamentPreset.createMany({
        data: [
          {
            name: 'Single pool stage',
            presetType: 'single-pool-stage',
            totalParticipants: 16,
            targetCount: 4,
            isSystem: true,
          },
          {
            name: 'Three pool stages',
            presetType: 'three-pool-stages',
            totalParticipants: 16,
            targetCount: 4,
            isSystem: true,
          },
        ],
        skipDuplicates: true,
      });
    }

    return await this.prisma.tournamentPreset.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureDefaultMatchFormatPresets() {
    const existingCount = await this.prisma.matchFormatPreset.count();
    if (existingCount === 0) {
      await this.prisma.matchFormatPreset.createMany({
        data: MATCH_FORMAT_PRESETS.map((preset) => ({
          key: preset.key,
          durationMinutes: preset.durationMinutes,
          segments: preset.segments as Prisma.InputJsonValue,
          isSystem: true,
        })),
        skipDuplicates: true,
      });
    }

    return await this.prisma.matchFormatPreset.findMany({
      orderBy: { updatedAt: 'desc' },
    });
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

  private buildTournamentFilters(query: Request['query']): TournamentFilters {
    const {
      status,
      format,
      name,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

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

    return filters;
  }

  private applyTournamentAccessFilters(
    request: Request,
    response: Response,
    filters: TournamentFilters
  ): boolean {
    const isAdminRequest = isAdmin(request);
    if (!isAdminRequest && filters.status === TournamentStatus.DRAFT) {
      response.json({
        tournaments: [],
        total: 0,
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
      });
      return false;
    }
    if (!isAdminRequest) {
      filters.excludeDraft = true;
    }
    return true;
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
        location,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
        targetStartNumber,
        shareTargets,
      } = request.body;

      const tournament = await tournamentService.createTournament({
        name,
        location,
        format,
        durationType,
        startTime,
        endTime,
        totalParticipants,
        targetCount,
        targetStartNumber,
        shareTargets,
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
   * Get all tournament presets
   * GET /api/tournaments/presets
   */
  getTournamentPresets = async (_request: Request, response: Response): Promise<void> => {
    try {
      const presets = await this.ensureDefaultTournamentPresets();
      response.json({ presets });
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Create tournament preset
   * POST /api/tournaments/presets
   */
  createTournamentPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { name, presetType, totalParticipants, targetCount, templateConfig } = request.body as {
        name: string;
        presetType: 'single-pool-stage' | 'three-pool-stages' | 'custom';
        totalParticipants: number;
        targetCount: number;
        templateConfig?: unknown;
      };

      const preset = await this.prisma.tournamentPreset.create({
        data: {
          name,
          presetType,
          totalParticipants,
          targetCount,
          ...(templateConfig === undefined
            ? {}
            : {
              templateConfig: templateConfig === null
                ? Prisma.JsonNull
                : templateConfig as Prisma.InputJsonValue,
            }),
        },
      });

      response.status(201).json(preset);
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Update tournament preset
   * PATCH /api/tournaments/presets/:presetId
   */
  updateTournamentPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { presetId } = request.params as { presetId: string };
      const existing = await this.prisma.tournamentPreset.findUnique({ where: { id: presetId } });
      if (!existing) {
        throw new AppError('Preset not found', 404, 'PRESET_NOT_FOUND');
      }

      const { name, presetType, totalParticipants, targetCount, templateConfig } = request.body as Partial<{
        name: string;
        presetType: 'single-pool-stage' | 'three-pool-stages' | 'custom';
        totalParticipants: number;
        targetCount: number;
        templateConfig: unknown;
      }>;

      const templateConfigValue = templateConfig === undefined
        ? existing.templateConfig
        : templateConfig;

      const updateData = {
        name: name ?? existing.name,
        presetType: presetType ?? existing.presetType,
        totalParticipants: totalParticipants ?? existing.totalParticipants,
        targetCount: targetCount ?? existing.targetCount,
        templateConfig: templateConfigValue === null
          ? Prisma.JsonNull
          : templateConfigValue as Prisma.InputJsonValue,
      };

      const preset = await this.prisma.tournamentPreset.update({
        where: { id: presetId },
        data: updateData,
      });

      response.json(preset);
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Delete tournament preset
   * DELETE /api/tournaments/presets/:presetId
   */
  deleteTournamentPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { presetId } = request.params as { presetId: string };
      const existing = await this.prisma.tournamentPreset.findUnique({ where: { id: presetId } });
      if (!existing) {
        throw new AppError('Preset not found', 404, 'PRESET_NOT_FOUND');
      }

      await this.prisma.tournamentPreset.delete({ where: { id: presetId } });
      response.status(204).send();
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Get all match format presets
   * GET /api/tournaments/match-formats
   */
  getMatchFormatPresets = async (_request: Request, response: Response): Promise<void> => {
    try {
      const presets = await this.ensureDefaultMatchFormatPresets();
      response.json({ presets });
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Create match format preset
   * POST /api/tournaments/match-formats
   */
  createMatchFormatPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { key, durationMinutes, segments, isSystem } = request.body as {
        key: string;
        durationMinutes: number;
        segments: unknown;
        isSystem?: boolean;
      };

      const preset = await this.prisma.matchFormatPreset.create({
        data: {
          key,
          durationMinutes,
          segments: segments as Prisma.InputJsonValue,
          isSystem: isSystem ?? false,
        },
      });

      response.status(201).json(preset);
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Update match format preset
   * PATCH /api/tournaments/match-formats/:formatId
   */
  updateMatchFormatPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { formatId } = request.params as { formatId: string };
      const existing = await this.prisma.matchFormatPreset.findUnique({ where: { id: formatId } });
      if (!existing) {
        throw new AppError('Match format preset not found', 404, 'MATCH_FORMAT_PRESET_NOT_FOUND');
      }

      const { key, durationMinutes, segments, isSystem } = request.body as Partial<{
        key: string;
        durationMinutes: number;
        segments: unknown;
        isSystem: boolean;
      }>;

      const preset = await this.prisma.matchFormatPreset.update({
        where: { id: formatId },
        data: {
          ...(key === undefined ? {} : { key }),
          ...(durationMinutes === undefined ? {} : { durationMinutes }),
          ...(segments === undefined ? {} : { segments: segments as Prisma.InputJsonValue }),
          ...(isSystem === undefined ? {} : { isSystem }),
        },
      });

      response.json(preset);
    } catch (error) {
      this.handleError(response, error);
    }
  };

  /**
   * Delete match format preset
   * DELETE /api/tournaments/match-formats/:formatId
   */
  deleteMatchFormatPreset = async (request: Request, response: Response): Promise<void> => {
    try {
      const { formatId } = request.params as { formatId: string };
      const existing = await this.prisma.matchFormatPreset.findUnique({ where: { id: formatId } });
      if (!existing) {
        throw new AppError('Match format preset not found', 404, 'MATCH_FORMAT_PRESET_NOT_FOUND');
      }

      await this.prisma.matchFormatPreset.delete({ where: { id: formatId } });
      response.status(204).send();
    } catch (error) {
      this.handleError(response, error);
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
      const filters = this.buildTournamentFilters(request.query);
      if (!this.applyTournamentAccessFilters(request, response, filters)) {
        return;
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

export type TournamentServiceLike = TournamentService;

export default TournamentController;