import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AppError } from '../../middleware/error-handler';
import { TournamentService, TournamentFilters } from '../../services/tournament-service';

type CoreHandlerContext = {
  prisma: PrismaClient;
  getTournamentService: (request: Request) => TournamentService;
  ensureDefaultTournamentPresets: () => Promise<unknown>;
  ensureDefaultMatchFormatPresets: () => Promise<unknown>;
  handleError: (response: Response, error: unknown) => void;
  buildTournamentFilters: (query: Request['query']) => TournamentFilters;
  applyTournamentAccessFilters: (
    request: Request,
    response: Response,
    filters: TournamentFilters
  ) => boolean;
};

const handleAppError = (response: Response, error: unknown) => {
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
};

export const createCoreHandlers = (context: CoreHandlerContext) => ({
  createTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const tournamentService = context.getTournamentService(request);

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
      handleAppError(response, error);
    }
  },

  getTournamentPresets: async (_request: Request, response: Response): Promise<void> => {
    try {
      const presets = await context.ensureDefaultTournamentPresets();
      response.json({ presets });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createTournamentPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { name, presetType, totalParticipants, targetCount, templateConfig } = request.body as {
        name: string;
        presetType: 'single-pool-stage' | 'three-pool-stages' | 'custom';
        totalParticipants: number;
        targetCount: number;
        templateConfig?: unknown;
      };

      const preset = await context.prisma.tournamentPreset.create({
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
      context.handleError(response, error);
    }
  },

  updateTournamentPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { presetId } = request.params as { presetId: string };
      const existing = await context.prisma.tournamentPreset.findUnique({ where: { id: presetId } });
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

      const preset = await context.prisma.tournamentPreset.update({
        where: { id: presetId },
        data: updateData,
      });

      response.json(preset);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deleteTournamentPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { presetId } = request.params as { presetId: string };
      const existing = await context.prisma.tournamentPreset.findUnique({ where: { id: presetId } });
      if (!existing) {
        throw new AppError('Preset not found', 404, 'PRESET_NOT_FOUND');
      }

      await context.prisma.tournamentPreset.delete({ where: { id: presetId } });
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getMatchFormatPresets: async (_request: Request, response: Response): Promise<void> => {
    try {
      const presets = await context.ensureDefaultMatchFormatPresets();
      response.json({ presets });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createMatchFormatPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { key, durationMinutes, segments, isSystem } = request.body as {
        key: string;
        durationMinutes: number;
        segments: unknown;
        isSystem?: boolean;
      };

      const preset = await context.prisma.matchFormatPreset.create({
        data: {
          key,
          durationMinutes,
          segments: segments as Prisma.InputJsonValue,
          isSystem: isSystem ?? false,
        },
      });

      response.status(201).json(preset);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateMatchFormatPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { formatId } = request.params as { formatId: string };
      const existing = await context.prisma.matchFormatPreset.findUnique({ where: { id: formatId } });
      if (!existing) {
        throw new AppError('Match format preset not found', 404, 'MATCH_FORMAT_PRESET_NOT_FOUND');
      }

      const { key, durationMinutes, segments, isSystem } = request.body as Partial<{
        key: string;
        durationMinutes: number;
        segments: unknown;
        isSystem: boolean;
      }>;

      const preset = await context.prisma.matchFormatPreset.update({
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
      context.handleError(response, error);
    }
  },

  deleteMatchFormatPreset: async (request: Request, response: Response): Promise<void> => {
    try {
      const { formatId } = request.params as { formatId: string };
      const existing = await context.prisma.matchFormatPreset.findUnique({ where: { id: formatId } });
      if (!existing) {
        throw new AppError('Match format preset not found', 404, 'MATCH_FORMAT_PRESET_NOT_FOUND');
      }

      await context.prisma.matchFormatPreset.delete({ where: { id: formatId } });
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const tournament = await context.getTournamentService(request).getTournamentById(id);
      response.json(tournament);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  getTournamentLiveView: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const liveView = await context.getTournamentService(request).getTournamentLiveView(id);
      response.json(liveView);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  getTournaments: async (request: Request, response: Response): Promise<void> => {
    try {
      const filters = context.buildTournamentFilters(request.query);
      if (!context.applyTournamentAccessFilters(request, response, filters)) {
        return;
      }

      const result = await context.getTournamentService(request).getTournaments(filters);
      response.json(result);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  updateTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body;

      const tournament = await context.getTournamentService(request).updateTournament(id, updateData);
      response.json(tournament);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  deleteTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      await context.getTournamentService(request).deleteTournament(id);
      response.status(204).send();
    } catch (error) {
      handleAppError(response, error);
    }
  },

  uploadTournamentLogo: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };

      if (!request.file) {
        throw new AppError(
          'No file uploaded',
          400,
          'NO_FILE_UPLOADED'
        );
      }

      const logoUrl = `/uploads/${request.file.filename}`;
      const tournament = await context.getTournamentService(request).uploadTournamentLogo(id, logoUrl);

      response.json({
        logo_url: logoUrl,
        logoUrl,
        tournament,
      });
    } catch (error) {
      handleAppError(response, error);
    }
  },

  getTournamentsByDateRange: async (request: Request, response: Response): Promise<void> => {
    try {
      const { startDate, endDate } = request.query;

      if (!startDate || !endDate) {
        throw new AppError(
          'Start date and end date are required',
          400,
          'MISSING_DATE_PARAMS'
        );
      }

      const tournaments = await context.getTournamentService(request).getTournamentsByDateRange(
        startDate as string,
        endDate as string
      );

      response.json(tournaments);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  getTournamentStats: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const stats = await context.getTournamentService(request).getTournamentStats(id);

      response.json(stats);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  checkTournamentNameAvailability: async (request: Request, response: Response): Promise<void> => {
    try {
      const { name } = request.params as { name: string };
      const { excludeId } = request.query;

      const isAvailable = await context.getTournamentService(request).isTournamentNameAvailable(
        name,
        excludeId as string
      );

      response.json({
        name,
        available: isAvailable,
      });
    } catch (error) {
      handleAppError(response, error);
    }
  },
});
