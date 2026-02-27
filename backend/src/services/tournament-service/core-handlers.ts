import type { TournamentModel } from '../../models/tournament-model';
import type { TournamentLiveView } from '../../models/tournament-model/helpers';
import type TournamentLogger from '../../utils/tournament-logger';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
  MatchStatus,
  TargetStatus,
} from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';

export interface CreateTournamentData {
  name: string;
  location?: string;
  format: TournamentFormat;
  durationType: DurationType;
  startTime: string;
  endTime: string;
  totalParticipants: number;
  targetCount: number;
  targetStartNumber?: number;
  shareTargets?: boolean;
  doubleStageEnabled?: boolean;
}

export interface TournamentFilters {
  status?: TournamentStatus;
  format?: TournamentFormat;
  name?: string;
  excludeDraft?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'startTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

type TournamentUpdateData = Parameters<TournamentModel['update']>[1];

type TournamentCoreContext = {
  tournamentModel: TournamentModel;
  logger: TournamentLogger;
  validateUUID: (id: string) => void;
  registerPlayer: (tournamentId: string, playerId: string) => Promise<void>;
  canViewDraftLive?: () => boolean;
};

export const createTournamentCoreHandlers = (context: TournamentCoreContext) => {
  const { tournamentModel, logger, validateUUID, registerPlayer, canViewDraftLive } = context;

  const sanitizeName = (name: string): string => {
    let sanitized = '';
    let inTag = false;
    for (const char of name) {
      if (char === '<') {
        inTag = true;
        continue;
      }
      if (char === '>') {
        inTag = false;
        continue;
      }
      if (!inTag) {
        sanitized += char;
      }
    }
    return sanitized.trim();
  };

  const validateName = (name: string): void => {
    if (!name || typeof name !== 'string') {
      throw new AppError('Tournament name is required', 400, 'TOURNAMENT_NAME_REQUIRED');
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      throw new AppError('Tournament name must be at least 3 characters long', 400, 'TOURNAMENT_NAME_TOO_SHORT');
    }

    if (trimmedName.length > 100) {
      throw new AppError('Tournament name cannot exceed 100 characters', 400, 'TOURNAMENT_NAME_TOO_LONG');
    }
  };

  const validateLocation = (location: string): void => {
    if (location.length > 150) {
      throw new AppError('Tournament location cannot exceed 150 characters', 400, 'TOURNAMENT_LOCATION_TOO_LONG');
    }
  };

  const validateFormat = (format: TournamentFormat): void => {
    const validFormats = Object.values(TournamentFormat);
    if (!validFormats.includes(format)) {
      throw new AppError('Invalid tournament format', 400, 'INVALID_TOURNAMENT_FORMAT');
    }
  };

  const validateDurationType = (durationType: DurationType): void => {
    const validTypes = Object.values(DurationType);
    if (!validTypes.includes(durationType)) {
      throw new AppError('Invalid duration type', 400, 'INVALID_DURATION_TYPE');
    }
  };

  const validateParticipantCount = (count: number): void => {
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      throw new AppError('Total participants must be a valid number', 400, 'INVALID_PARTICIPANT_COUNT');
    }

    if (count < 2) {
      throw new AppError('Tournament must have at least 2 participants', 400, 'MINIMUM_PARTICIPANTS_NOT_MET');
    }

    if (count > 512) {
      throw new AppError('Tournament cannot exceed 512 participants', 400, 'MAXIMUM_PARTICIPANTS_EXCEEDED');
    }
  };

  const validateTargetCount = (count: number): void => {
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      throw new AppError('Target count must be a valid number', 400, 'INVALID_TARGET_COUNT');
    }

    if (count < 1) {
      throw new AppError('Tournament must have at least 1 target', 400, 'MINIMUM_TARGETS_NOT_MET');
    }

    if (count > 20) {
      throw new AppError('Tournament cannot exceed 20 targets', 400, 'MAXIMUM_TARGETS_EXCEEDED');
    }
  };

  const validateTargetStartNumber = (startNumber: number): void => {
    if (typeof startNumber !== 'number' || !Number.isInteger(startNumber)) {
      throw new AppError('Target start number must be a valid number', 400, 'INVALID_TARGET_START');
    }

    if (startNumber < 1) {
      throw new AppError('Target start number must be at least 1', 400, 'TARGET_START_TOO_LOW');
    }
  };

  const validateDates = (startTime: Date, endTime: Date, allowPastStart: boolean = false): void => {
    const now = new Date();

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
    }

    if (!allowPastStart && startTime < now) {
      throw new AppError('Tournament start time cannot be in the past', 400, 'START_TIME_IN_PAST');
    }

    if (endTime <= startTime) {
      throw new AppError('Tournament end time must be after start time', 400, 'INVALID_TIME_RANGE');
    }

    const minDuration = 60 * 60 * 1000;
    if (endTime.getTime() - startTime.getTime() < minDuration) {
      throw new AppError('Tournament duration must be at least 1 hour', 400, 'MINIMUM_DURATION_NOT_MET');
    }

    const maxDuration = 24 * 60 * 60 * 1000;
    if (endTime.getTime() - startTime.getTime() > maxDuration) {
      throw new AppError('Tournament duration cannot exceed 24 hours', 400, 'MAXIMUM_DURATION_EXCEEDED');
    }
  };

  const validateTournamentData = (data: CreateTournamentData): void => {
    validateName(data.name);
    if (data.location !== undefined) {
      validateLocation(data.location);
    }
    validateFormat(data.format);
    validateDurationType(data.durationType);
    validateParticipantCount(data.totalParticipants);
    validateTargetCount(data.targetCount);
    if (data.targetStartNumber !== undefined) {
      validateTargetStartNumber(data.targetStartNumber);
    }

    if (!data.startTime || !data.endTime) {
      throw new AppError('Start time and end time are required', 400, 'MISSING_TIME_DATA');
    }
  };

  const ensureTournamentEditable = async (id: string): Promise<void> => {
    const isEditable = await tournamentModel.isEditable(id);
    if (!isEditable) {
      throw new AppError('Tournament cannot be edited in its current status', 400, 'TOURNAMENT_NOT_EDITABLE');
    }
  };

  const sanitizeUpdateData = (updateData: Partial<CreateTournamentData>): Partial<CreateTournamentData> => {
    const sanitized = { ...updateData };

    if (sanitized.name !== undefined) {
      validateName(sanitized.name);
      sanitized.name = sanitizeName(sanitized.name);
    }

    if (sanitized.totalParticipants !== undefined) {
      validateParticipantCount(sanitized.totalParticipants);
    }

    if (sanitized.location !== undefined) {
      validateLocation(sanitized.location);
      sanitized.location = sanitized.location.trim();
    }

    if (sanitized.targetCount !== undefined) {
      validateTargetCount(sanitized.targetCount);
    }

    if (sanitized.targetStartNumber !== undefined) {
      validateTargetStartNumber(sanitized.targetStartNumber);
    }

    if (sanitized.shareTargets !== undefined) {
      sanitized.shareTargets = Boolean(sanitized.shareTargets);
    }

    if (sanitized.doubleStageEnabled !== undefined) {
      sanitized.doubleStageEnabled = Boolean(sanitized.doubleStageEnabled);
    }

    return sanitized;
  };

  const buildTournamentUpdateData = (updateData: Partial<CreateTournamentData>): TournamentUpdateData => {
    const processedData: TournamentUpdateData = {};

    if (updateData.name !== undefined) {
      processedData.name = updateData.name;
    }
    if (updateData.location !== undefined) {
      processedData.location = updateData.location;
    }
    if (updateData.format !== undefined) {
      processedData.format = updateData.format;
    }
    if (updateData.durationType !== undefined) {
      processedData.durationType = updateData.durationType;
    }
    if (updateData.totalParticipants !== undefined) {
      processedData.totalParticipants = updateData.totalParticipants;
    }
    if (updateData.targetCount !== undefined) {
      processedData.targetCount = updateData.targetCount;
    }
    if (updateData.targetStartNumber !== undefined) {
      processedData.targetStartNumber = updateData.targetStartNumber;
    }
    if (updateData.shareTargets !== undefined) {
      processedData.shareTargets = updateData.shareTargets;
    }
    if (updateData.doubleStageEnabled !== undefined) {
      processedData.doubleStageEnabled = updateData.doubleStageEnabled;
    }
    if (updateData.startTime !== undefined) {
      processedData.startTime = new Date(updateData.startTime);
    }
    if (updateData.endTime !== undefined) {
      processedData.endTime = new Date(updateData.endTime);
    }

    return processedData;
  };

  const validateUpdateDates = async (id: string, processedData: TournamentUpdateData): Promise<void> => {
    if (!processedData.startTime && !processedData.endTime) {
      return;
    }

    const existing = await tournamentModel.findById(id);
    const startTime = processedData.startTime || new Date(existing!.startTime);
    const endTime = processedData.endTime || new Date(existing!.endTime);
    const allowPastStart =
      existing?.status === TournamentStatus.SIGNATURE ||
      existing?.status === TournamentStatus.LIVE ||
      existing?.status === TournamentStatus.FINISHED;

    validateDates(startTime, endTime, allowPastStart);
  };

  const buildTargetRange = (startNumber: number, count: number) => ({
    start: startNumber,
    end: startNumber + Math.max(0, count - 1),
  });

  const rangesOverlap = (first: { start: number; end: number }, second: { start: number; end: number }) => (
    first.start <= second.end && second.start <= first.end
  );

  const ensureTargetRangeAvailable = async (
    tournamentId: string | undefined,
    startNumber: number,
    count: number,
    shareTargets: boolean
  ): Promise<void> => {
    if (count <= 0) return;

    const ranges = await tournamentModel.getTargetRanges(tournamentId);
    const requestedRange = buildTargetRange(startNumber, count);

    const conflicts = ranges.filter((range) => {
      const otherRange = buildTargetRange(range.targetStartNumber ?? 1, range.targetCount);
      if (!rangesOverlap(requestedRange, otherRange)) return false;
      return !shareTargets || !range.shareTargets;
    });

    if (conflicts.length > 0) {
      const conflictNames = conflicts.map((range) => range.name).join(', ');
      throw new AppError(
        `Target range overlaps with another tournament: ${conflictNames}`,
        400,
        'TARGET_RANGE_CONFLICT',
        { conflicts: conflicts.map((range) => range.id) }
      );
    }
  };

  const syncTournamentTargets = async (
    tournamentId: string,
    startNumber: number,
    count: number
  ): Promise<void> => {
    const existingTargets = await tournamentModel.getTargetsForTournament(tournamentId);
    const deleteTargets = existingTargets.slice(count);
    if (deleteTargets.length > 0) {
      const matchCount = await tournamentModel.getMatchCountForTargets(
        deleteTargets.map((target) => target.id)
      );
      if (matchCount > 0) {
        throw new AppError(
          'Cannot reduce targets while matches are assigned',
          400,
          'TARGETS_IN_USE'
        );
      }
    }

    await tournamentModel.rebuildTargetsForTournament(tournamentId, startNumber, count);
  };

  const calculateTournamentDuration = (startTime: string, endTime: string): {
    hours: number;
    minutes: number;
    total: string;
  } => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      hours,
      minutes,
      total: `${hours}h ${minutes}m`,
    };
  };

  type TargetAvailabilityTournament = {
    targets?: Array<{
      id: string;
      status?: string;
      // eslint-disable-next-line unicorn/no-null
      currentMatchId?: string | null;
      // eslint-disable-next-line unicorn/no-null
      lastUsedAt?: Date | null;
    }>;
    poolStages?: Array<{ pools?: Array<{ matches?: Array<{ id: string; status: string }> }> }>;
    brackets?: Array<{ matches?: Array<{ id: string; status: string }> }>;
  };

  const buildMatchStatusMap = (tournament: TargetAvailabilityTournament): Map<string, string> => {
    const matchStatusById = new Map<string, string>();
    addMatchStatusFromPools(tournament, matchStatusById);
    addMatchStatusFromBrackets(tournament, matchStatusById);
    return matchStatusById;
  };

  const addMatchStatusFromPools = (
    tournament: { poolStages?: Array<{ pools?: Array<{ matches?: Array<{ id: string; status: string }> }> }> },
    matchStatusById: Map<string, string>
  ): void => {
    const poolStages = tournament.poolStages ?? [];
    for (const stage of poolStages) {
      for (const pool of stage.pools ?? []) {
        for (const match of pool.matches ?? []) {
          if (match?.id) {
            matchStatusById.set(match.id, match.status);
          }
        }
      }
    }
  };

  const addMatchStatusFromBrackets = (
    tournament: { brackets?: Array<{ matches?: Array<{ id: string; status: string }> }> },
    matchStatusById: Map<string, string>
  ): void => {
    const brackets = tournament.brackets ?? [];
    for (const bracket of brackets) {
      for (const match of bracket.matches ?? []) {
        if (match?.id) {
          matchStatusById.set(match.id, match.status);
        }
      }
    }
  };

  const reconcileTargetAvailability = async (
    tournament: TargetAvailabilityTournament
  ): Promise<void> => {
    const targets = tournament.targets ?? [];
    if (targets.length === 0) {
      return;
    }

    const matchStatusById = buildMatchStatusMap(tournament);

    for (const target of targets) {
      if (target.status !== TargetStatus.IN_USE) {
        continue;
      }

      if (!target.currentMatchId) {
        await tournamentModel.setTargetAvailable(target.id);
        target.status = TargetStatus.AVAILABLE;
        // eslint-disable-next-line unicorn/no-null
        target.currentMatchId = null;
        continue;
      }

      const matchStatus = matchStatusById.get(target.currentMatchId);
      if (matchStatus === MatchStatus.IN_PROGRESS) {
        continue;
      }

      let completedAt: Date | undefined;
      if (!matchStatus) {
        const match = await tournamentModel.getMatchById(target.currentMatchId);
        completedAt = match?.completedAt ?? undefined;
        if (match?.status === MatchStatus.IN_PROGRESS) {
          continue;
        }
      }

      await tournamentModel.setTargetAvailable(target.id, completedAt);
      target.status = TargetStatus.AVAILABLE;
      // eslint-disable-next-line unicorn/no-null
      target.currentMatchId = null;
    }
  };

  return {
    createTournament: async (data: CreateTournamentData): Promise<Tournament> => {
      try {
        validateTournamentData(data);

        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        const targetStartNumber = data.targetStartNumber ?? 1;
        const shareTargets = data.shareTargets ?? true;

        validateDates(startTime, endTime);
        validateTargetStartNumber(targetStartNumber);
        await ensureTargetRangeAvailable(undefined, targetStartNumber, data.targetCount, shareTargets);

        const sanitizedName = sanitizeName(data.name);

        const tournament = await tournamentModel.create({
          name: sanitizedName,
          ...(data.location?.trim() ? { location: data.location.trim() } : {}),
          format: data.format,
          durationType: data.durationType,
          startTime,
          endTime,
          totalParticipants: data.totalParticipants,
          targetCount: data.targetCount,
          targetStartNumber,
          shareTargets,
          doubleStageEnabled: data.doubleStageEnabled ?? false,
        });

        logger.tournamentCreated(tournament.id, tournament.name, {
          format: tournament.format,
          durationType: tournament.durationType,
          ...(tournament.location ? { location: tournament.location } : {}),
          totalParticipants: tournament.totalParticipants,
          targetCount: tournament.targetCount,
          targetStartNumber: tournament.targetStartNumber,
          shareTargets: tournament.shareTargets,
          startTime: tournament.startTime,
          endTime: tournament.endTime,
        });

        return tournament;
      } catch (error) {
        if (error instanceof AppError) {
          logger.validationError(
            error.code || 'UNKNOWN_ERROR',
            error.message,
            undefined,
            data.name
          );
          throw error;
        }

        logger.error('Failed to create tournament', undefined, error);

        throw new AppError('Failed to create tournament', 500, 'TOURNAMENT_SERVICE_CREATE_FAILED');
      }
    },

    getTournamentById: async (id: string): Promise<Tournament> => {
      validateUUID(id);

      const tournament = await tournamentModel.findById(id);

      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      return tournament;
    },

    getTournamentLiveView: async (tournamentId: string): Promise<TournamentLiveView> => {
      validateUUID(tournamentId);

      const tournament = await tournamentModel.findLiveView(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      const hasConfiguredPools = (tournament.poolStages || []).some((stage) => {
        const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
        return poolCount > 0;
      });
      const isViewableOpenTournament =
        (tournament.status === TournamentStatus.OPEN || tournament.status === TournamentStatus.SIGNATURE)
        && hasConfiguredPools;
      const isAdminDraftView = tournament.status === TournamentStatus.DRAFT && (canViewDraftLive?.() ?? false);

      if (
        tournament.status !== TournamentStatus.LIVE
        && tournament.status !== TournamentStatus.FINISHED
        && !isViewableOpenTournament
        && !isAdminDraftView
      ) {
        throw new AppError('Tournament is not live', 400, 'TOURNAMENT_NOT_LIVE');
      }

      if (tournament.status === TournamentStatus.LIVE) {
        await reconcileTargetAvailability(tournament);
      }

      if (tournament.format === TournamentFormat.DOUBLE && tournament.doubleStageEnabled === false) {
        const hasDoubleStages = (tournament.poolStages || []).some(
          (stage) => stage.stageNumber === 2 || stage.stageNumber === 3
        );
        if (hasDoubleStages) {
          tournament.doubleStageEnabled = true;
        }
      }

      return tournament;
    },

    getTournaments: async (filters: TournamentFilters = {}) => {
      if (filters.page && filters.page < 1) {
        throw new AppError('Page number must be greater than 0', 400, 'INVALID_PAGE_NUMBER');
      }

      if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
        throw new AppError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT');
      }

      return await tournamentModel.findAll(filters);
    },

    updateTournament: async (
      id: string,
      updateData: Partial<CreateTournamentData>
    ): Promise<Tournament> => {
      validateUUID(id);
      await ensureTournamentEditable(id);

      const sanitizedUpdateData = sanitizeUpdateData(updateData);
      const processedData = buildTournamentUpdateData(sanitizedUpdateData);
      await validateUpdateDates(id, processedData);

      const existing = await tournamentModel.findById(id);
      if (!existing) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      const nextTargetCount = processedData.targetCount ?? existing.targetCount;
      const nextTargetStartNumber = processedData.targetStartNumber
        ?? (existing.targetStartNumber ?? 1);
      const nextShareTargets = processedData.shareTargets ?? (existing.shareTargets ?? true);

      if (processedData.targetStartNumber !== undefined || processedData.targetCount !== undefined || processedData.shareTargets !== undefined) {
        validateTargetStartNumber(nextTargetStartNumber);
        await ensureTargetRangeAvailable(id, nextTargetStartNumber, nextTargetCount, nextShareTargets);
      }

      const updated = await tournamentModel.update(id, processedData);

      const targetRangeChanged =
        nextTargetCount !== existing.targetCount
        || nextTargetStartNumber !== (existing.targetStartNumber ?? 1);

      if (targetRangeChanged) {
        await syncTournamentTargets(id, nextTargetStartNumber, nextTargetCount);
      }

      return updated;
    },

    deleteTournament: async (id: string): Promise<boolean> => {
      validateUUID(id);

      await tournamentModel.findById(id).then((tournament) => {
        if (!tournament) {
          throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
        }
      });

      return await tournamentModel.delete(id);
    },

    uploadTournamentLogo: async (id: string, logoUrl: string): Promise<Tournament> => {
      validateUUID(id);

      if (!logoUrl || typeof logoUrl !== 'string') {
        throw new AppError('Invalid logo URL', 400, 'INVALID_LOGO_URL');
      }

      return await tournamentModel.updateLogo(id, logoUrl);
    },

    getTournamentsByDateRange: async (startDate: string, endDate: string): Promise<Tournament[]> => {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
      }

      if (start >= end) {
        throw new AppError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
      }

      return await tournamentModel.findByDateRange(start, end);
    },

    isTournamentNameAvailable: async (name: string, excludeId?: string): Promise<boolean> => {
      if (!name || name.trim().length === 0) {
        return false;
      }
      const normalizedExcludeId = excludeId?.trim();
      const hasExcludeId = Boolean(normalizedExcludeId);

      try {
        await tournamentModel.findAll({
          limit: 1,
        });

        if (hasExcludeId) {
          // Placeholder for future exclusion logic.
        }

        return true;
      } catch (error) {
        logger.error('Failed to check tournament name availability', undefined, error);
        return false;
      }
    },

    getTournamentStats: async (id: string) => {
      const tournamentWithDetails = await tournamentModel.findById(id);

      if (!tournamentWithDetails) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      const tournamentDetails = tournamentWithDetails as Tournament & {
        players?: unknown[];
        matches?: Array<{ status?: string }>;
      };
      const tournament = tournamentDetails;
      let currentParticipants = tournamentDetails.players?.length || 0;
      if (tournament.format === TournamentFormat.DOUBLE) {
        currentParticipants = await tournamentModel.countRegisteredDoublettes(id);
      } else if (tournament.format === TournamentFormat.TEAM_4_PLAYER) {
        currentParticipants = await tournamentModel.countRegisteredEquipes(id);
      }
      const matchesTotal = tournamentDetails.matches?.length || 0;
      const matchesCompleted = tournamentDetails.matches?.filter((m) => m.status === 'completed').length || 0;

      return {
        totalParticipants: tournament.totalParticipants,
        currentParticipants,
        targetCount: tournament.targetCount,
        matchesTotal,
        matchesCompleted,
        duration: calculateTournamentDuration(tournament.startTime.toString(), tournament.endTime.toString()),
      };
    },

    getTournamentTargets: async (id: string) => {
      validateUUID(id);

      const tournament = await tournamentModel.findById(id);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      return await tournamentModel.getTargetsForTournament(id);
    },

    validateRegistrationConstraints: async (
      tournamentId: string,
      playerId: string
    ): Promise<{ canRegister: boolean; reasons: string[] }> => {
      const reasons: string[] = [];

      try {
        await registerPlayer(tournamentId, playerId);
        return { canRegister: true, reasons: [] };
      } catch (error) {
        if (error instanceof AppError) {
          reasons.push(error.message);
        } else {
          reasons.push('Unknown registration error');
        }
      }

      return { canRegister: false, reasons };
    },

    getOverallTournamentStats: async () => {
      try {
        const stats = await tournamentModel.getOverallStats();
        return stats;
      } catch (error) {
        logger.error('Failed to retrieve tournament statistics', undefined, error);
        throw new AppError(
          'Failed to retrieve tournament statistics',
          500,
          'STATS_RETRIEVAL_ERROR'
        );
      }
    },
  };
};

export type TournamentCoreHandlers = ReturnType<typeof createTournamentCoreHandlers>;
