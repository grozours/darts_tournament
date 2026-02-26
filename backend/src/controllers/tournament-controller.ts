import { Request, Response } from 'express';
import { TournamentService, TournamentFilters } from '../services/tournament-service';
import { MATCH_FORMAT_PRESETS, TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/error-handler';
import { Prisma, PrismaClient } from '@prisma/client';
import { isAdmin } from '../middleware/auth';
import { createExtendedHandlers } from './tournament-controller/extended-handlers';
import { createCoreHandlers } from './tournament-controller/core-handlers';

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
  public saveMatchScores!: (request: Request, response: Response) => Promise<void>;
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
  public createTournament!: (request: Request, response: Response) => Promise<void>;
  public getTournamentPresets!: (request: Request, response: Response) => Promise<void>;
  public createTournamentPreset!: (request: Request, response: Response) => Promise<void>;
  public updateTournamentPreset!: (request: Request, response: Response) => Promise<void>;
  public deleteTournamentPreset!: (request: Request, response: Response) => Promise<void>;
  public getMatchFormatPresets!: (request: Request, response: Response) => Promise<void>;
  public createMatchFormatPreset!: (request: Request, response: Response) => Promise<void>;
  public updateMatchFormatPreset!: (request: Request, response: Response) => Promise<void>;
  public deleteMatchFormatPreset!: (request: Request, response: Response) => Promise<void>;
  public getTournament!: (request: Request, response: Response) => Promise<void>;
  public getTournamentLiveView!: (request: Request, response: Response) => Promise<void>;
  public getTournaments!: (request: Request, response: Response) => Promise<void>;
  public updateTournament!: (request: Request, response: Response) => Promise<void>;
  public deleteTournament!: (request: Request, response: Response) => Promise<void>;
  public uploadTournamentLogo!: (request: Request, response: Response) => Promise<void>;
  public getTournamentsByDateRange!: (request: Request, response: Response) => Promise<void>;
  public getTournamentStats!: (request: Request, response: Response) => Promise<void>;
  public checkTournamentNameAvailability!: (request: Request, response: Response) => Promise<void>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const context = {
      getTournamentService: (request: Request) => this.getTournamentService(request),
      handleError: (response: Response, error: unknown) => this.handleError(response, error),
    };
    Object.assign(this, createCoreHandlers({
      prisma: this.prisma,
      getTournamentService: context.getTournamentService,
      ensureDefaultTournamentPresets: () => this.ensureDefaultTournamentPresets(),
      ensureDefaultMatchFormatPresets: () => this.ensureDefaultMatchFormatPresets(),
      handleError: context.handleError,
      buildTournamentFilters: (query) => this.buildTournamentFilters(query),
      applyTournamentAccessFilters: (request, response, filters) =>
        this.applyTournamentAccessFilters(request, response, filters),
    }), createExtendedHandlers(context));
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

}

export type TournamentServiceLike = TournamentService;

export default TournamentController;