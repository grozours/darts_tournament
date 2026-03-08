import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AppError } from '../../middleware/error-handler';
import { isAdmin } from '../../middleware/auth';
import { TournamentService, TournamentFilters } from '../../services/tournament-service';
import { redis } from '../../config/redis';
import { config } from '../../config/environment';
import { TournamentStatus } from '../../../../shared/src/types';
import {
  listTournamentSnapshots,
  readTournamentSnapshot,
  restoreTournamentSnapshotById,
  restoreTournamentSnapshot,
  type TournamentSnapshot,
} from '../../services/tournament-service/autosave';
import { restoreTournamentStateFromSnapshot } from '../../services/tournament-service/snapshot-restore';

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

const toPrismaJson = (value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput => (
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
);

const toPrismaNullableJson = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => (
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
);

const isLiveEndpointCacheEnabled = (): boolean => config.env !== 'test';

const getCacheScope = (request: Request): 'admin' | 'public' => (isAdmin(request) ? 'admin' : 'public');

const normalizeQueryForCacheKey = (query: Request['query']): string => {
  const keys = Object.keys(query).sort((first, second) => first.localeCompare(second));
  const pairs: string[] = [];

  for (const key of keys) {
    const rawValue = query[key];
    if (rawValue === undefined) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value === undefined) {
        continue;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        pairs.push(`${key}=${String(value)}`);
        continue;
      }
      pairs.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  return pairs.join('&');
};

const readJsonCache = async <T>(key: string): Promise<T | undefined> => {
  if (!isLiveEndpointCacheEnabled()) {
    return undefined;
  }

  try {
    const value = await redis.getClient().get(key);
    if (!value) {
      return undefined;
    }
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const writeJsonCache = async (key: string, value: unknown): Promise<void> => {
  if (!isLiveEndpointCacheEnabled()) {
    return;
  }

  try {
    await redis.getClient().setex(
      key,
      config.performance.liveEndpointCacheTtlSeconds,
      JSON.stringify(value)
    );
  } catch {
    return;
  }
};

const parseLiveSummaryStatuses = (query: Request['query']): TournamentStatus[] => {
  const rawValues: string[] = [];

  const singleStatus = query.status;
  if (typeof singleStatus === 'string' && singleStatus.trim() !== '') {
    rawValues.push(singleStatus);
  }

  const multipleStatuses = query.statuses;
  if (typeof multipleStatuses === 'string' && multipleStatuses.trim() !== '') {
    rawValues.push(...multipleStatuses.split(','));
  }

  if (rawValues.length === 0) {
    return [TournamentStatus.LIVE];
  }

  const validStatuses = new Set(Object.values(TournamentStatus));
  const normalized = rawValues
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is TournamentStatus => validStatuses.has(value as TournamentStatus));

  if (normalized.length === 0) {
    return [TournamentStatus.LIVE];
  }

  return [...new Set(normalized)];
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
              templateConfig: toPrismaNullableJson(templateConfig),
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
        templateConfig: toPrismaNullableJson(templateConfigValue),
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
          segments: toPrismaJson(segments),
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
          ...(segments === undefined ? {} : { segments: toPrismaJson(segments) }),
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

      const cacheKey = `tournaments:live:${id}:${getCacheScope(request)}`;
      const cachedLiveView = await readJsonCache(cacheKey);
      if (cachedLiveView !== undefined) {
        response.json(cachedLiveView);
        return;
      }

      const liveView = await context.getTournamentService(request).getTournamentLiveView(id);
      await writeJsonCache(cacheKey, liveView);
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

      const shouldUseCache = typeof request.query.status === 'string';
      const cacheKey = shouldUseCache
        ? `tournaments:list:${getCacheScope(request)}:${normalizeQueryForCacheKey(request.query) || 'default'}`
        : undefined;

      if (cacheKey) {
        const cachedResult = await readJsonCache(cacheKey);
        if (cachedResult !== undefined) {
          response.json(cachedResult);
          return;
        }
      }

      const result = await context.getTournamentService(request).getTournaments(filters);
      if (cacheKey) {
        await writeJsonCache(cacheKey, result);
      }
      response.json(result);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  getLiveSummary: async (request: Request, response: Response): Promise<void> => {
    try {
      const requestedStatuses = parseLiveSummaryStatuses(request.query);
      const scope = getCacheScope(request);
      const cacheKey = `tournaments:live-summary:${scope}:${requestedStatuses.join(',')}`;

      const cachedSummary = await readJsonCache<{ tournaments: unknown[] }>(cacheKey);
      if (cachedSummary !== undefined) {
        response.json(cachedSummary);
        return;
      }

      const visibleStatuses = scope === 'admin'
        ? requestedStatuses
        : requestedStatuses.filter((status) => status !== TournamentStatus.DRAFT);

      if (visibleStatuses.length === 0) {
        response.json({ tournaments: [] });
        return;
      }

      const tournaments = await context.prisma.tournament.findMany({
        where: { status: { in: visibleStatuses } },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const tournamentService = context.getTournamentService(request);
      const results = await Promise.allSettled(
        tournaments.map((tournament: (typeof tournaments)[number]) => tournamentService.getTournamentLiveView(tournament.id))
      );

      const liveViews: unknown[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          liveViews.push(result.value);
        }
      }

      const payload = { tournaments: liveViews };
      await writeJsonCache(cacheKey, payload);
      response.json(payload);
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

  exportTournamentSnapshot: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      await context.getTournamentService(request).getTournamentById(id);

      const snapshot = await readTournamentSnapshot(id);

      if (!snapshot) {
        throw new AppError('Tournament snapshot not found', 404, 'TOURNAMENT_SNAPSHOT_NOT_FOUND');
      }

      response
        .status(200)
        .type('application/json')
        .setHeader('Content-Disposition', `attachment; filename="tournament-${id}-snapshot.json"`)
        .send(snapshot);
    } catch (error) {
      handleAppError(response, error);
    }
  },

  listTournamentSnapshots: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      await context.getTournamentService(request).getTournamentById(id);

      const snapshots = await listTournamentSnapshots(id);
      response.json({
        tournamentId: id,
        total: snapshots.length,
        snapshots,
      });
    } catch (error) {
      handleAppError(response, error);
    }
  },

  restoreTournamentSnapshot: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const payload = request.body as TournamentSnapshot;

      if (!payload || typeof payload !== 'object' || payload.schemaVersion !== 1 || payload.data === undefined) {
        throw new AppError('Invalid snapshot payload', 400, 'INVALID_SNAPSHOT_PAYLOAD');
      }

      await context.getTournamentService(request).getTournamentById(id);
      await restoreTournamentSnapshot(id, payload);
      await restoreTournamentStateFromSnapshot(context.prisma, id, payload);

      response.status(200).json({
        message: 'Tournament snapshot restored successfully',
        tournamentId: id,
      });
    } catch (error) {
      handleAppError(response, error);
    }
  },

  restoreTournamentSnapshotById: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, snapshotId } = request.params as { id: string; snapshotId: string };
      await context.getTournamentService(request).getTournamentById(id);

      const restored = await restoreTournamentSnapshotById(id, snapshotId);
      if (!restored) {
        throw new AppError('Tournament snapshot not found', 404, 'TOURNAMENT_SNAPSHOT_NOT_FOUND');
      }
      await restoreTournamentStateFromSnapshot(context.prisma, id, restored);

      response.status(200).json({
        message: 'Tournament snapshot restored successfully',
        tournamentId: id,
        snapshotId,
      });
    } catch (error) {
      handleAppError(response, error);
    }
  },
});
