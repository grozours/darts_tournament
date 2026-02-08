import { TournamentModel } from '../models/TournamentModel';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
  StageStatus,
  BracketType,
  BracketStatus,
  AssignmentType,
  PoolStatus,
  MatchStatus,
  TargetStatus,
  CreatePlayerRequest,
  Player,
  SkillLevel,
} from '../../../shared/src/types';
import { AppError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';
import TournamentLogger from '../utils/tournamentLogger';
import { Request } from 'express';
import { config } from '../config/environment';

export interface CreateTournamentData {
  name: string;
  format: TournamentFormat;
  durationType: DurationType;
  startTime: string;
  endTime: string;
  totalParticipants: number;
  targetCount: number;
}

export interface TournamentFilters {
  status?: TournamentStatus;
  format?: TournamentFormat;
  name?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'startTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

type TournamentUpdateData = Parameters<TournamentModel['update']>[1];

export class TournamentService {
  private readonly tournamentModel: TournamentModel;
  private readonly logger: TournamentLogger;

  constructor(prisma: PrismaClient, req?: Request) {
    this.tournamentModel = new TournamentModel(prisma);
    this.logger = new TournamentLogger(req);
  }

  private validatePlayerData(data: CreatePlayerRequest): void {
    if (!data.firstName || data.firstName.trim().length < 2) {
      throw new AppError(
        'First name must be at least 2 characters long',
        400,
        'INVALID_FIRST_NAME'
      );
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      throw new AppError(
        'Last name must be at least 2 characters long',
        400,
        'INVALID_LAST_NAME'
      );
    }

    if (data.surname && data.surname.trim().length > 50) {
      throw new AppError(
        'Surname must be less than 50 characters',
        400,
        'INVALID_SURNAME'
      );
    }

    if (data.teamName && data.teamName.trim().length > 100) {
      throw new AppError(
        'Team name must be less than 100 characters',
        400,
        'INVALID_TEAM_NAME'
      );
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new AppError(
        'Invalid email address',
        400,
        'INVALID_EMAIL'
      );
    }
  }

  private async ensureUniqueSurname(
    tournamentId: string,
    surname: string,
    excludePlayerId?: string
  ): Promise<void> {
    const trimmed = surname.trim();
    if (!trimmed) return;
    const existing = await this.tournamentModel.findPlayerBySurname(
      tournamentId,
      trimmed,
      excludePlayerId
    );
    if (existing) {
      throw new AppError(
        'Surname is already used by another player in this tournament',
        400,
        'DUPLICATE_SURNAME'
      );
    }
  }

  private async ensureUniqueTeamName(
    tournamentId: string,
    teamName: string,
    excludePlayerId?: string
  ): Promise<void> {
    const trimmed = teamName.trim();
    if (!trimmed) return;
    const existing = await this.tournamentModel.findPlayerByTeamName(
      tournamentId,
      trimmed,
      excludePlayerId
    );
    if (existing) {
      throw new AppError(
        'Team name is already used by another player in this tournament',
        400,
        'DUPLICATE_TEAM_NAME'
      );
    }
  }
  /**
   * Create a new tournament with validation
   */
  async createTournament(data: CreateTournamentData): Promise<Tournament> {
    try {
      // Validate input data
      this.validateTournamentData(data);

      // Convert string dates to Date objects
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);

      // Additional date validations
      this.validateDates(startTime, endTime);

      const sanitizedName = this.sanitizeName(data.name);

      const tournament = await this.tournamentModel.create({
        name: sanitizedName,
        format: data.format,
        durationType: data.durationType,
        startTime,
        endTime,
        totalParticipants: data.totalParticipants,
        targetCount: data.targetCount,
      });

      // Log successful tournament creation
      this.logger.tournamentCreated(
        tournament.id,
        tournament.name,
        {
          format: tournament.format,
          durationType: tournament.durationType,
          totalParticipants: tournament.totalParticipants,
          targetCount: tournament.targetCount,
          startTime: tournament.startTime,
          endTime: tournament.endTime,
        }
      );

      return tournament;
    } catch (error) {
      // Log validation errors
      if (error instanceof AppError) {
        this.logger.validationError(
          error.code || 'UNKNOWN_ERROR',
          error.message,
          undefined,
          data.name
        );
        throw error;
      }
      
      // Log unexpected errors
      this.logger.error(
        'Failed to create tournament',
        undefined,
        error
      );
      
      throw new AppError(
        'Failed to create tournament',
        500,
        'TOURNAMENT_SERVICE_CREATE_FAILED'
      );
    }
  }

  /**
   * Get tournament by ID
   */
  async getTournamentById(id: string): Promise<Tournament> {
    this.validateUUID(id);

    const tournament = await this.tournamentModel.findById(id);
    
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    return tournament;
  }

  /**
   * Get live view data for tournament
   */
  async getTournamentLiveView(tournamentId: string): Promise<unknown> {
    this.validateUUID(tournamentId);

    const tournament = await this.tournamentModel.findLiveView(tournamentId) as (Tournament & {
      status: TournamentStatus;
    }) | null;
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    if (tournament.status !== TournamentStatus.LIVE && tournament.status !== TournamentStatus.FINISHED) {
      throw new AppError(
        'Tournament is not live',
        400,
        'TOURNAMENT_NOT_LIVE'
      );
    }

    if (tournament.status === TournamentStatus.LIVE) {
      await this.reconcileTargetAvailability(tournament);
    }

    return tournament;
  }

  private async reconcileTargetAvailability(
    tournament: Tournament & {
      targets?: Array<{ id: string; status?: TargetStatus; currentMatchId?: string | null; lastUsedAt?: Date | null }>;
      poolStages?: Array<{ pools?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }> }>;
      brackets?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }>;
    }
  ): Promise<void> {
    const targets = tournament.targets ?? [];
    if (!targets.length) {
      return;
    }

    const matchStatusById = this.buildMatchStatusMap(tournament);

    for (const target of targets) {
      if (target.status !== TargetStatus.IN_USE) {
        continue;
      }

      if (!target.currentMatchId) {
        await this.tournamentModel.setTargetAvailable(target.id, null);
        target.status = TargetStatus.AVAILABLE;
        target.currentMatchId = null;
        continue;
      }

      const matchStatus = matchStatusById.get(target.currentMatchId);
      if (matchStatus === MatchStatus.IN_PROGRESS) {
        continue;
      }

      let completedAt: Date | null | undefined;
      if (!matchStatus) {
        const match = await this.tournamentModel.getMatchById(target.currentMatchId);
        completedAt = match?.completedAt ?? null;
        if (match?.status === MatchStatus.IN_PROGRESS) {
          continue;
        }
      }

      await this.tournamentModel.setTargetAvailable(target.id, completedAt ?? null);
      target.status = TargetStatus.AVAILABLE;
      target.currentMatchId = null;
    }
  }

  private buildMatchStatusMap(
    tournament: Tournament & {
      poolStages?: Array<{ pools?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }> }>;
      brackets?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }>;
    }
  ): Map<string, MatchStatus> {
    const matchStatusById = new Map<string, MatchStatus>();
    this.addMatchStatusFromPools(tournament, matchStatusById);
    this.addMatchStatusFromBrackets(tournament, matchStatusById);
    return matchStatusById;
  }

  private addMatchStatusFromPools(
    tournament: { poolStages?: Array<{ pools?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }> }> },
    matchStatusById: Map<string, MatchStatus>
  ): void {
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
  }

  private addMatchStatusFromBrackets(
    tournament: { brackets?: Array<{ matches?: Array<{ id: string; status: MatchStatus }> }> },
    matchStatusById: Map<string, MatchStatus>
  ): void {
    const brackets = tournament.brackets ?? [];
    for (const bracket of brackets) {
      for (const match of bracket.matches ?? []) {
        if (match?.id) {
          matchStatusById.set(match.id, match.status);
        }
      }
    }
  }

  /**
   * Get all tournaments with filtering and pagination
   */
  async getTournaments(filters: TournamentFilters = {}) {
    // Validate pagination parameters
    if (filters.page && filters.page < 1) {
      throw new AppError(
        'Page number must be greater than 0',
        400,
        'INVALID_PAGE_NUMBER'
      );
    }

    if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
      throw new AppError(
        'Limit must be between 1 and 100',
        400,
        'INVALID_LIMIT'
      );
    }

    return await this.tournamentModel.findAll(filters);
  }

  /**
   * Update tournament
   */
  async updateTournament(
    id: string,
    updateData: Partial<CreateTournamentData>
  ): Promise<Tournament> {
    this.validateUUID(id);
    await this.ensureTournamentEditable(id);

    const sanitizedUpdateData = this.sanitizeUpdateData(updateData);
    const processedData = this.buildTournamentUpdateData(sanitizedUpdateData);
    await this.validateUpdateDates(id, processedData);

    const existing = await this.tournamentModel.findById(id);
    if (!existing) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const updated = await this.tournamentModel.update(id, processedData);

    if (
      processedData.targetCount !== undefined &&
      processedData.targetCount > existing.targetCount
    ) {
      const startNumber = await this.tournamentModel.getMaxTargetNumber(id) + 1;
      const count = processedData.targetCount - existing.targetCount;
      await this.tournamentModel.createTargetsForTournament(id, startNumber, count);
    }

    return updated;
  }

  /**
   * Delete tournament
   */
  async deleteTournament(id: string): Promise<boolean> {
    this.validateUUID(id);

    // Check if tournament exists and can be deleted
    await this.getTournamentById(id);

    return await this.tournamentModel.delete(id);
  }

  /**
   * Upload tournament logo
   */
  async uploadTournamentLogo(id: string, logoUrl: string): Promise<Tournament> {
    this.validateUUID(id);

    if (!logoUrl || typeof logoUrl !== 'string') {
      throw new AppError(
        'Invalid logo URL',
        400,
        'INVALID_LOGO_URL'
      );
    }

    return await this.tournamentModel.updateLogo(id, logoUrl);
  }

  /**
   * Get tournaments by date range
   */
  async getTournamentsByDateRange(startDate: string, endDate: string): Promise<Tournament[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError(
        'Invalid date format',
        400,
        'INVALID_DATE_FORMAT'
      );
    }

    if (start >= end) {
      throw new AppError(
        'Start date must be before end date',
        400,
        'INVALID_DATE_RANGE'
      );
    }

    return await this.tournamentModel.findByDateRange(start, end);
  }

  /**
   * Check if tournament name is available
   */
  async isTournamentNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    if (!name || name.trim().length === 0) {
      return false;
    }
    const normalizedExcludeId = excludeId?.trim();
    const hasExcludeId = Boolean(normalizedExcludeId);

    try {
      await this.tournamentModel.findAll({
        limit: 1,
      });

      if (hasExcludeId) {
        // Placeholder for future exclusion logic.
      }

      // This is a simplified check - in a real implementation,
      // you'd want a specific method to check name uniqueness
      return true; // Placeholder - actual implementation would check database
    } catch (error) {
      this.logger.error('Failed to check tournament name availability', undefined, error);
      return false;
    }
  }

  /**
   * Get tournament statistics
   */
  async getTournamentStats(id: string) {
    // Get the tournament with details to access related data
    const tournamentWithDetails = await this.tournamentModel.findById(id);
    
    if (!tournamentWithDetails) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }
    
    const tournamentDetails = tournamentWithDetails as Tournament & {
      players?: unknown[];
      matches?: Array<{ status?: string }>;
    };
    const tournament = tournamentDetails;
    const currentParticipants = tournamentDetails.players?.length || 0;
    const matchesTotal = tournamentDetails.matches?.length || 0;
    const matchesCompleted = tournamentDetails.matches?.filter((m) => m.status === 'completed').length || 0;
    
    return {
      totalParticipants: tournament.totalParticipants,
      currentParticipants: currentParticipants,
      targetCount: tournament.targetCount,
      matchesTotal: matchesTotal,
      matchesCompleted: matchesCompleted,
      duration: this.calculateTournamentDuration(tournament.startTime.toString(), tournament.endTime.toString()),
    };
  }

  /**
   * Private validation methods
   */
  private validateTournamentData(data: CreateTournamentData): void {
    this.validateName(data.name);
    this.validateFormat(data.format);
    this.validateDurationType(data.durationType);
    this.validateParticipantCount(data.totalParticipants);
    this.validateTargetCount(data.targetCount);
    
    if (!data.startTime || !data.endTime) {
      throw new AppError(
        'Start time and end time are required',
        400,
        'MISSING_TIME_DATA'
      );
    }
  }

  private async ensureTournamentEditable(id: string): Promise<void> {
    const isEditable = await this.tournamentModel.isEditable(id);
    if (!isEditable) {
      throw new AppError(
        'Tournament cannot be edited in its current status',
        400,
        'TOURNAMENT_NOT_EDITABLE'
      );
    }
  }

  private sanitizeUpdateData(updateData: Partial<CreateTournamentData>): Partial<CreateTournamentData> {
    const sanitized = { ...updateData };

    if (sanitized.name !== undefined) {
      this.validateName(sanitized.name);
      sanitized.name = this.sanitizeName(sanitized.name);
    }

    if (sanitized.totalParticipants !== undefined) {
      this.validateParticipantCount(sanitized.totalParticipants);
    }

    if (sanitized.targetCount !== undefined) {
      this.validateTargetCount(sanitized.targetCount);
    }

    return sanitized;
  }

  private buildTournamentUpdateData(updateData: Partial<CreateTournamentData>): TournamentUpdateData {
    const processedData: TournamentUpdateData = {};

    if (updateData.name !== undefined) {
      processedData.name = updateData.name;
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
    if (updateData.startTime !== undefined) {
      processedData.startTime = new Date(updateData.startTime);
    }
    if (updateData.endTime !== undefined) {
      processedData.endTime = new Date(updateData.endTime);
    }

    return processedData;
  }

  private async validateUpdateDates(id: string, processedData: TournamentUpdateData): Promise<void> {
    if (!processedData.startTime && !processedData.endTime) {
      return;
    }

    const existing = await this.tournamentModel.findById(id);
    const startTime = processedData.startTime || new Date(existing!.startTime);
    const endTime = processedData.endTime || new Date(existing!.endTime);
    const allowPastStart =
      existing?.status === TournamentStatus.SIGNATURE ||
      existing?.status === TournamentStatus.LIVE ||
      existing?.status === TournamentStatus.FINISHED;

    this.validateDates(startTime, endTime, allowPastStart);
  }

  private async getEditableTournamentForPoolStage(tournamentId: string): Promise<void> {
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (!this.isPoolStageEditable(tournament.status)) {
      throw new AppError(
        'Pool stages can only be modified for draft, open, signature, or live tournaments',
        400,
        'POOL_STAGE_NOT_EDITABLE'
      );
    }
  }

  private isPoolStageEditable(status: TournamentStatus): boolean {
    return [
      TournamentStatus.DRAFT,
      TournamentStatus.OPEN,
      TournamentStatus.SIGNATURE,
      TournamentStatus.LIVE,
    ].includes(status);
  }

  private buildPoolStageUpdateData(
    data: Partial<{
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      status: StageStatus;
      completedAt: Date | null;
    }>
  ): {
    nextData: Partial<{
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      status: StageStatus;
      completedAt: Date | null;
    }>;
    shouldRedistribute: boolean;
  } {
    const nextData = { ...data };
    const shouldRedistribute =
      data.poolCount !== undefined || data.playersPerPool !== undefined;

    if (nextData.status === StageStatus.COMPLETED) {
      nextData.completedAt = new Date();
    }

    return { nextData, shouldRedistribute };
  }

  private async applyPoolStageStatusUpdates(
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean,
    completedAt?: Date | null
  ): Promise<void> {
    switch (updatedStage.status) {
      case StageStatus.EDITION:
        await this.handlePoolStageEdition(tournamentId, stageId, updatedStage, shouldRedistribute);
        break;
      case StageStatus.IN_PROGRESS:
        await this.handlePoolStageInProgress(tournamentId, stageId, updatedStage);
        break;
      case StageStatus.COMPLETED:
        await this.handlePoolStageCompleted(tournamentId, stageId, completedAt ?? new Date());
        break;
      default:
        break;
    }
  }

  private async ensurePoolsForStage(
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>
  ): Promise<void> {
    const currentCount = await this.tournamentModel.getPoolCountForStage(stageId);
    if (currentCount < updatedStage.poolCount) {
      await this.tournamentModel.createPoolsForStage(
        stageId,
        updatedStage.poolCount - currentCount,
        currentCount + 1
      );
    }
  }

  private async ensurePoolAssignments(
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean
  ): Promise<void> {
    if (shouldRedistribute) {
      await this.tournamentModel.deletePoolAssignmentsForStage(stageId);
      await this.assignPlayersToPools(
        tournamentId,
        stageId,
        updatedStage.poolCount,
        updatedStage.playersPerPool
      );
      return;
    }

    const assignmentsCount = await this.tournamentModel.getPoolAssignmentCountForStage(stageId);
    if (assignmentsCount === 0) {
      await this.assignPlayersToPools(
        tournamentId,
        stageId,
        updatedStage.poolCount,
        updatedStage.playersPerPool
      );
    }
  }

  private async handlePoolStageEdition(
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean
  ): Promise<void> {
    await this.ensurePoolsForStage(stageId, updatedStage);
    await this.ensurePoolAssignments(tournamentId, stageId, updatedStage, shouldRedistribute);
  }

  private async handlePoolStageInProgress(
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>
  ): Promise<void> {
    await this.ensurePoolsForStage(stageId, updatedStage);
    await this.ensurePoolAssignments(tournamentId, stageId, updatedStage, false);
    await this.createPoolMatchesForStage(tournamentId, stageId);
  }

  private async handlePoolStageCompleted(
    tournamentId: string,
    stageId: string,
    completedAt: Date
  ): Promise<void> {
    await this.tournamentModel.completeMatchesForStage(stageId, completedAt);
    await this.tournamentModel.completePoolsForStage(stageId, completedAt);
    await this.populateBracketsForStage(tournamentId, stageId);
  }

  private buildPlayerLabel(player?: { firstName?: string | null; lastName?: string | null }) {
    const first = player?.firstName ?? '';
    const last = player?.lastName ?? '';
    return `${first} ${last}`.trim();
  }

  private buildPoolStandings(pool: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>[number]) {
    const rows = new Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>();

    const ensureRow = (player?: { id?: string; firstName?: string | null; lastName?: string | null }) => {
      if (!player?.id) return;
      if (!rows.has(player.id)) {
        rows.set(player.id, {
          playerId: player.id,
          name: this.buildPlayerLabel(player),
          legsWon: 0,
          legsLost: 0,
        });
      }
    };

    for (const assignment of pool.assignments ?? []) {
      ensureRow(assignment.player);
    }

    for (const match of pool.matches ?? []) {
      if (match.status !== MatchStatus.COMPLETED) continue;
      const playerMatches = match.playerMatches ?? [];
      for (const pm of playerMatches) {
        ensureRow(pm.player);
      }
      for (const pm of playerMatches) {
        if (!pm.player?.id) continue;
        const row = rows.get(pm.player.id);
        if (!row) continue;
        row.legsWon += pm.scoreTotal ?? pm.legsWon ?? 0;
        let opponentTotal = 0;
        for (const other of playerMatches) {
          if (other.player?.id && other.player.id !== pm.player.id) {
            opponentTotal += other.scoreTotal ?? other.legsWon ?? 0;
          }
        }
        row.legsLost += opponentTotal;
      }
    }

    const sorted = Array.from(rows.values()).sort((a, b) => {
      if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
      if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((row, index) => ({
      ...row,
      position: index + 1,
    }));
  }

  private async populateBracket(
    tournamentId: string,
    bracketId: string,
    entries: Array<{ playerId: string; seedNumber: number }>
  ): Promise<void> {
    await this.tournamentModel.deleteMatchesForBracket(bracketId);
    await this.tournamentModel.deleteBracketEntriesForBracket(bracketId);

    const payload = entries.map((entry) => ({
      bracketId,
      playerId: entry.playerId,
      seedNumber: entry.seedNumber,
      currentRound: 1,
    }));
    await this.tournamentModel.createBracketEntries(payload);

    if (entries.length < 2) {
      await this.tournamentModel.updateBracket(bracketId, { status: BracketStatus.NOT_STARTED });
      return;
    }

    const ordered = [...entries].sort((a, b) => a.seedNumber - b.seedNumber);
    const playerIds = ordered.map((entry) => entry.playerId);
    const matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];
    let matchNumber = 1;
    for (let left = 0, right = playerIds.length - 1; left < right; left += 1, right -= 1) {
      const first = playerIds[left];
      const second = playerIds[right];
      if (!first || !second) continue;
      matches.push({
        roundNumber: 1,
        matchNumber,
        playerIds: [first, second],
      });
      matchNumber += 1;
    }

    await this.tournamentModel.createBracketMatches(tournamentId, bracketId, matches);
    await this.tournamentModel.updateBracket(bracketId, { status: BracketStatus.IN_PROGRESS });
  }

  private async populateBracketsForStage(tournamentId: string, stageId: string): Promise<void> {
    const stage = await this.tournamentModel.getPoolStageById(stageId);
    if (!stage || stage.tournamentId !== tournamentId) {
      return;
    }

    const stages = await this.tournamentModel.getPoolStages(tournamentId);
    const maxStageNumber = stages.reduce((max, item) => Math.max(max, item.stageNumber), stage.stageNumber);
    if (stage.stageNumber !== maxStageNumber) {
      return;
    }

    const brackets = await this.tournamentModel.getBrackets(tournamentId);
    if (brackets.length === 0) {
      return;
    }

    const pools = await this.tournamentModel.getPoolsWithMatchesForStage(stageId);
    const winners: Array<{ playerId: string; seedKey: string; poolNumber: number; position: number }> = [];
    const losers: Array<{ playerId: string; seedKey: string; poolNumber: number; position: number }> = [];

    for (const pool of pools) {
      const standings = this.buildPoolStandings(pool);
      standings.forEach((row, index) => {
        const entry = {
          playerId: row.playerId,
          seedKey: `${pool.poolNumber}-${row.position}`,
          poolNumber: pool.poolNumber,
          position: row.position,
        };
        if (index < stage.advanceCount) {
          winners.push(entry);
        } else {
          losers.push(entry);
        }
      });
    }

    const sortByPool = (a: { poolNumber: number; position: number }, b: { poolNumber: number; position: number }) => {
      if (a.poolNumber !== b.poolNumber) return a.poolNumber - b.poolNumber;
      return a.position - b.position;
    };

    const uniqueByPlayer = (entries: Array<{ playerId: string; poolNumber: number; position: number }>) => {
      const seen = new Set<string>();
      return entries.filter((entry) => {
        if (seen.has(entry.playerId)) return false;
        seen.add(entry.playerId);
        return true;
      });
    };

    const winnerList = uniqueByPlayer([...winners].sort(sortByPool));
    const loserList = uniqueByPlayer([...losers].sort(sortByPool));

    const winnerEntries = winnerList.map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    const loserEntries = loserList.map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    const winnerBracket = brackets.find((bracket) => /winner/i.test(bracket.name)) ?? brackets[0];
    const loserBracket = brackets.find((bracket) => /loser/i.test(bracket.name));

    if (winnerBracket) {
      await this.populateBracket(tournamentId, winnerBracket.id, winnerEntries);
    }

    if (loserBracket) {
      await this.populateBracket(tournamentId, loserBracket.id, loserEntries);
    }
  }

  private sanitizeName(name: string): string {
    return name.replaceAll(/<[^>]*>/g, '').trim();
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new AppError(
        'Tournament name is required',
        400,
        'TOURNAMENT_NAME_REQUIRED'
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      throw new AppError(
        'Tournament name must be at least 3 characters long',
        400,
        'TOURNAMENT_NAME_TOO_SHORT'
      );
    }

    if (trimmedName.length > 100) {
      throw new AppError(
        'Tournament name cannot exceed 100 characters',
        400,
        'TOURNAMENT_NAME_TOO_LONG'
      );
    }
  }

  private validateFormat(format: TournamentFormat): void {
    const validFormats = Object.values(TournamentFormat);
    if (!validFormats.includes(format)) {
      throw new AppError(
        'Invalid tournament format',
        400,
        'INVALID_TOURNAMENT_FORMAT'
      );
    }
  }

  private validateDurationType(durationType: DurationType): void {
    const validTypes = Object.values(DurationType);
    if (!validTypes.includes(durationType)) {
      throw new AppError(
        'Invalid duration type',
        400,
        'INVALID_DURATION_TYPE'
      );
    }
  }

  private validateParticipantCount(count: number): void {
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      throw new AppError(
        'Total participants must be a valid number',
        400,
        'INVALID_PARTICIPANT_COUNT'
      );
    }

    if (count < 2) {
      throw new AppError(
        'Tournament must have at least 2 participants',
        400,
        'MINIMUM_PARTICIPANTS_NOT_MET'
      );
    }

    if (count > 512) {
      throw new AppError(
        'Tournament cannot exceed 512 participants',
        400,
        'MAXIMUM_PARTICIPANTS_EXCEEDED'
      );
    }
  }

  private validateTargetCount(count: number): void {
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      throw new AppError(
        'Target count must be a valid number',
        400,
        'INVALID_TARGET_COUNT'
      );
    }

    if (count < 1) {
      throw new AppError(
        'Tournament must have at least 1 target',
        400,
        'MINIMUM_TARGETS_NOT_MET'
      );
    }

    if (count > 20) {
      throw new AppError(
        'Tournament cannot exceed 20 targets',
        400,
        'MAXIMUM_TARGETS_EXCEEDED'
      );
    }
  }

  private validateDates(startTime: Date, endTime: Date, allowPastStart: boolean = false): void {
    const now = new Date();
    
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new AppError(
        'Invalid date format',
        400,
        'INVALID_DATE_FORMAT'
      );
    }

    if (!allowPastStart && startTime < now) {
      throw new AppError(
        'Tournament start time cannot be in the past',
        400,
        'START_TIME_IN_PAST'
      );
    }

    if (endTime <= startTime) {
      throw new AppError(
        'Tournament end time must be after start time',
        400,
        'INVALID_TIME_RANGE'
      );
    }

    // Validate minimum duration (1 hour)
    const minDuration = 60 * 60 * 1000; // 1 hour in milliseconds
    if (endTime.getTime() - startTime.getTime() < minDuration) {
      throw new AppError(
        'Tournament duration must be at least 1 hour',
        400,
        'MINIMUM_DURATION_NOT_MET'
      );
    }

    // Validate maximum duration (24 hours)
    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (endTime.getTime() - startTime.getTime() > maxDuration) {
      throw new AppError(
        'Tournament duration cannot exceed 24 hours',
        400,
        'MAXIMUM_DURATION_EXCEEDED'
      );
    }
  }

  /**
   * Register player for tournament with validation
   */
  async registerPlayer(tournamentId: string, playerId: string): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(playerId);

    // Check if tournament exists and is accepting registrations
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      this.logger.accessError(
        'TOURNAMENT_NOT_FOUND',
        `Tournament not found during registration: ${tournamentId}`,
        tournamentId
      );
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    try {
      // Check tournament status allows registration
      if (tournament.status !== TournamentStatus.OPEN) {
        this.logger.validationError(
          'REGISTRATION_NOT_OPEN',
          `Registration not open for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError(
          'Tournament registration is not open',
          400,
          'REGISTRATION_NOT_OPEN'
        );
      }

      if (config.auth.enabled) {
        // Check registration deadline (assuming registration closes 1 hour before start)
        const now = new Date();
        const registrationDeadline = new Date(tournament.startTime);
        registrationDeadline.setHours(registrationDeadline.getHours() - 1);

        if (now > registrationDeadline) {
          this.logger.validationError(
            'REGISTRATION_DEADLINE_PASSED',
            `Registration deadline passed for tournament: ${tournament.name}`,
            tournamentId,
            tournament.name
          );
          throw new AppError(
            'Registration deadline has passed',
            400,
            'REGISTRATION_DEADLINE_PASSED'
          );
        }
      }

      // Check if player is already registered
      const isAlreadyRegistered = await this.tournamentModel.isPlayerRegistered(tournamentId, playerId);
      if (isAlreadyRegistered) {
        this.logger.validationError(
          'DUPLICATE_REGISTRATION',
          `Player already registered for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }

      // Check tournament capacity
      const currentParticipants = await this.tournamentModel.getParticipantCount(tournamentId);
      if (currentParticipants >= tournament.totalParticipants) {
        this.logger.validationError(
          'TOURNAMENT_FULL',
          `Tournament is full: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError(
          'Tournament is full',
          400,
          'TOURNAMENT_FULL'
        );
      }

      // Register the player
      await this.tournamentModel.registerPlayer(tournamentId, playerId);

      // Log successful registration
      this.logger.playerRegistered(
        tournamentId,
        tournament.name,
        playerId
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        this.logger.error(
          'Failed to register player for tournament',
          tournamentId,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Register player with details for tournament
   */
  async registerPlayerDetails(
    tournamentId: string,
    playerData: CreatePlayerRequest
  ): Promise<Player> {
    this.validateUUID(tournamentId);
    this.validatePlayerData(playerData);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      this.logger.accessError(
        'TOURNAMENT_NOT_FOUND',
        `Tournament not found during registration: ${tournamentId}`,
        tournamentId
      );
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    try {
      if (tournament.status !== TournamentStatus.OPEN) {
        this.logger.validationError(
          'REGISTRATION_NOT_OPEN',
          `Registration not open for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError(
          'Tournament registration is not open',
          400,
          'REGISTRATION_NOT_OPEN'
        );
      }

      if (config.auth.enabled) {
        const now = new Date();
        const registrationDeadline = new Date(tournament.startTime);
        registrationDeadline.setHours(registrationDeadline.getHours() - 1);

        if (now > registrationDeadline) {
          this.logger.validationError(
            'REGISTRATION_DEADLINE_PASSED',
            `Registration deadline passed for tournament: ${tournament.name}`,
            tournamentId,
            tournament.name
          );
          throw new AppError(
            'Registration deadline has passed',
            400,
            'REGISTRATION_DEADLINE_PASSED'
          );
        }
      }

      const currentParticipants = await this.tournamentModel.getParticipantCount(tournamentId);
      if (currentParticipants >= tournament.totalParticipants) {
        this.logger.validationError(
          'TOURNAMENT_FULL',
          `Tournament is full: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError(
          'Tournament is full',
          400,
          'TOURNAMENT_FULL'
        );
      }

      if (playerData.surname?.trim()) {
        await this.ensureUniqueSurname(tournamentId, playerData.surname);
      }

      if (
        playerData.teamName?.trim() &&
        (tournament.format === TournamentFormat.DOUBLE ||
          tournament.format === TournamentFormat.TEAM_4_PLAYER)
      ) {
        await this.ensureUniqueTeamName(tournamentId, playerData.teamName);
      }

      const playerPayload = await this.buildPlayerPayload(playerData);

      const player = await this.tournamentModel.createPlayer(tournamentId, playerPayload);

      this.logger.playerRegistered(
        tournamentId,
        tournament.name,
        player.id
      );

      return player;
    } catch (error) {
      if (!(error instanceof AppError)) {
        this.logger.error(
          'Failed to register player for tournament',
          tournamentId,
          error
        );
      }
      throw error;
    }
  }

  private async buildPlayerPayload(playerData: CreatePlayerRequest) {
    const payload: {
      personId?: string | null;
      firstName: string;
      lastName: string;
      surname?: string;
      teamName?: string;
      email?: string;
      phone?: string;
      skillLevel?: SkillLevel;
    } = {
      firstName: playerData.firstName.trim(),
      lastName: playerData.lastName.trim(),
    };

    payload.personId = await this.resolvePersonId(payload.firstName, payload.lastName, playerData.email, playerData.phone);

    if (playerData.surname?.trim()) {
      payload.surname = playerData.surname.trim();
    }

    if (playerData.teamName?.trim()) {
      payload.teamName = playerData.teamName.trim();
    }

    if (playerData.email?.trim()) {
      payload.email = playerData.email.trim();
    }

    if (playerData.phone?.trim()) {
      payload.phone = playerData.phone.trim();
    }

    if (playerData.skillLevel) {
      payload.skillLevel = playerData.skillLevel;
    }

    return payload;
  }

  private async resolvePersonId(
    firstName: string,
    lastName: string,
    email?: string,
    phone?: string
  ): Promise<string> {
    const normalizedEmail = email?.trim() || null;
    const normalizedPhone = phone?.trim() || null;
    if (normalizedEmail && normalizedPhone) {
      const existingPerson = await this.tournamentModel.findPersonByEmailAndPhone(
        normalizedEmail,
        normalizedPhone
      );
      if (existingPerson) {
        return existingPerson.id;
      }
    }

    const createdPerson = await this.tournamentModel.createPerson({
      firstName,
      lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
    });
    return createdPerson.id;
  }

  /**
   * Unregister player from tournament
   */
  async unregisterPlayer(tournamentId: string, playerId: string): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(playerId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    // Check if tournament allows unregistration
    if (tournament.status === TournamentStatus.LIVE || tournament.status === TournamentStatus.FINISHED) {
      throw new AppError(
        'Cannot unregister from tournament that is live or finished',
        400,
        'UNREGISTRATION_NOT_ALLOWED'
      );
    }

    // Check if player is registered
    const isRegistered = await this.tournamentModel.isPlayerRegistered(tournamentId, playerId);
    if (!isRegistered) {
      throw new AppError(
        'Player is not registered for this tournament',
        400,
        'PLAYER_NOT_REGISTERED'
      );
    }

    await this.tournamentModel.unregisterPlayer(tournamentId, playerId);
  }

  /**
   * Update player details for tournament
   */
  async updateTournamentPlayer(
    tournamentId: string,
    playerId: string,
    updateData: CreatePlayerRequest
  ): Promise<Player> {
    this.validateUUID(tournamentId);
    this.validateUUID(playerId);
    this.validatePlayerData(updateData);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    if (
      ![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(
        tournament.status
      )
    ) {
      throw new AppError(
        'Cannot update player details for this tournament status',
        400,
        'PLAYER_UPDATE_NOT_ALLOWED'
      );
    }

    const player = await this.tournamentModel.getPlayerById(playerId);
    if (player?.personId) {
      await this.tournamentModel.updatePerson(player.personId, {
        firstName: updateData.firstName.trim(),
        lastName: updateData.lastName.trim(),
        email: updateData.email?.trim() || null,
        phone: updateData.phone?.trim() || null,
      });
    }

    if (updateData.surname?.trim()) {
      await this.ensureUniqueSurname(tournamentId, updateData.surname, playerId);
    }

    if (
      updateData.teamName?.trim() &&
      (tournament.format === TournamentFormat.DOUBLE ||
        tournament.format === TournamentFormat.TEAM_4_PLAYER)
    ) {
      await this.ensureUniqueTeamName(tournamentId, updateData.teamName, playerId);
    }

    return await this.tournamentModel.updatePlayer(tournamentId, playerId, {
      personId: player?.personId ?? null,
      firstName: updateData.firstName.trim(),
      lastName: updateData.lastName.trim(),
      surname: updateData.surname?.trim() || null,
      teamName: updateData.teamName?.trim() || null,
      email: updateData.email?.trim() || null,
      phone: updateData.phone?.trim() || null,
      skillLevel: updateData.skillLevel ?? null,
    });
  }

  /**
   * Update player check-in status during signature
   */
  async updateTournamentPlayerCheckIn(
    tournamentId: string,
    playerId: string,
    checkedIn: boolean
  ): Promise<Player> {
    this.validateUUID(tournamentId);
    this.validateUUID(playerId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    if (tournament.status !== TournamentStatus.SIGNATURE) {
      throw new AppError(
        'Check-in is only available during signature',
        400,
        'PLAYER_CHECKIN_NOT_ALLOWED'
      );
    }

    return await this.tournamentModel.updatePlayerCheckIn(
      tournamentId,
      playerId,
      checkedIn
    );
  }

  /**
   * Get tournament participants
   */
  async getTournamentParticipants(tournamentId: string): Promise<Awaited<ReturnType<TournamentModel['getParticipants']>>> {
    this.validateUUID(tournamentId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    return await this.tournamentModel.getParticipants(tournamentId);
  }

  /**
   * Pool stage configuration
   */
  async getPoolStages(tournamentId: string) {
    this.validateUUID(tournamentId);
    return await this.tournamentModel.getPoolStages(tournamentId);
  }

  async createPoolStage(
    tournamentId: string,
    data: {
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
    }
  ) {
    this.validateUUID(tournamentId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new AppError(
        'Pool stages can only be modified for draft, open, signature, or live tournaments',
        400,
        'POOL_STAGE_NOT_EDITABLE'
      );
    }

    const poolStage = await this.tournamentModel.createPoolStage(tournamentId, data);
    if (poolStage.poolCount > 0) {
      await this.tournamentModel.createPoolsForStage(poolStage.id, poolStage.poolCount);
    }
    return poolStage;
  }

  async updatePoolStage(
    tournamentId: string,
    stageId: string,
    data: Partial<{
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      status: StageStatus;
      completedAt: Date | null;
    }>
  ) {
    this.validateUUID(tournamentId);
    this.validateUUID(stageId);
    await this.getEditableTournamentForPoolStage(tournamentId);

    const { nextData, shouldRedistribute } = this.buildPoolStageUpdateData(data);
    const updatedStage = await this.tournamentModel.updatePoolStage(stageId, nextData);

    await this.applyPoolStageStatusUpdates(
      tournamentId,
      stageId,
      updatedStage,
      shouldRedistribute,
      nextData.completedAt
    );

    return updatedStage;
  }

  async completePoolStageWithRandomScores(
    tournamentId: string,
    stageId: string
  ): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(stageId);
    await this.getEditableTournamentForPoolStage(tournamentId);

    const stage = await this.tournamentModel.getPoolStageById(stageId);
    if (!stage || stage.tournamentId !== tournamentId) {
      throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
    }

    if (stage.status === StageStatus.COMPLETED) {
      await this.populateBracketsForStage(tournamentId, stageId);
      return;
    }

    if (stage.status !== StageStatus.IN_PROGRESS) {
      throw new AppError(
        'Pool stage must be in progress to complete',
        400,
        'POOL_STAGE_NOT_IN_PROGRESS'
      );
    }

    const matches = await this.tournamentModel.getMatchesForPoolStage(stageId);
    const invalidMatch = matches.find((match) => (match.playerMatches?.length ?? 0) < 2);
    if (invalidMatch) {
      throw new AppError(
        'Pool stage has matches without two players',
        400,
        'POOL_STAGE_MATCH_INCOMPLETE'
      );
    }

    const now = new Date();
    const randomInt = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    for (const match of matches) {
      if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
        continue;
      }

      const playerIds = (match.playerMatches || [])
        .map((pm) => pm.playerId)
        .filter((id): id is string => Boolean(id));

      if (playerIds.length < 2) {
        continue;
      }

      const winnerFirst = Math.random() < 0.5;
      const winnerId = winnerFirst ? playerIds[0] : playerIds[1];
      const loserId = winnerFirst ? playerIds[1] : playerIds[0];
      const winnerScore = randomInt(1, 5);
      const loserScore = randomInt(0, winnerScore - 1);

      const scores = [
        { playerId: winnerId, scoreTotal: winnerScore, isWinner: true },
        { playerId: loserId, scoreTotal: loserScore, isWinner: false },
      ];
      const timestamps: { startedAt?: Date | null; completedAt?: Date | null } = {
        startedAt: match.startedAt ?? now,
        completedAt: now,
      };

      await this.tournamentModel.completeMatch(match.id, scores, winnerId, timestamps);

      if (match.targetId) {
        await this.tournamentModel.finishMatchAndReleaseTarget(
          match.id,
          match.targetId,
          MatchStatus.COMPLETED,
          timestamps
        );
      }
    }

    await this.tournamentModel.completePoolsForStage(stageId, now);
    await this.tournamentModel.updatePoolStage(stageId, {
      status: StageStatus.COMPLETED,
      completedAt: now,
    });
    await this.populateBracketsForStage(tournamentId, stageId);
  }

  private buildRoundRobinSchedule(playerIds: string[]) {
    const players = [...playerIds];
    if (players.length < 2) {
      return [] as Array<{ roundNumber: number; pairs: Array<[string, string]> }>;
    }

    if (players.length % 2 !== 0) {
      players.push('');
    }

    const rounds = players.length - 1;
    const half = players.length / 2;
    const schedule: Array<{ roundNumber: number; pairs: Array<[string, string]> }> = [];
    const rotation = [...players];

    for (let round = 0; round < rounds; round += 1) {
      const pairs: Array<[string, string]> = [];
      for (let i = 0; i < half; i += 1) {
        const home = rotation[i];
        const away = rotation[rotation.length - 1 - i];
        if (home && away) {
          pairs.push([home, away]);
        }
      }

      schedule.push({ roundNumber: round + 1, pairs });

      const fixed = rotation[0] ?? '';
      const rest = rotation.slice(1);
      rest.unshift(rest.pop() as string);
      rotation.splice(0, rotation.length, fixed, ...rest);
    }

    return schedule;
  }

  private async createPoolMatchesForStage(tournamentId: string, stageId: string): Promise<void> {
    const pools = await this.tournamentModel.getPoolsWithAssignmentsForStage(stageId);
    const poolsToUpdate: string[] = [];

    for (const pool of pools) {
      const matchCount = await this.tournamentModel.getMatchCountForPool(pool.id);
      if (matchCount > 0) {
        continue;
      }

      const playerIds = (pool.assignments || [])
        .map((assignment) => assignment.player?.id)
        .filter((id): id is string => Boolean(id));

      if (playerIds.length < 2) {
        continue;
      }

      const schedule = this.buildRoundRobinSchedule(playerIds);
      const matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];

      for (const round of schedule) {
        for (const pair of round.pairs) {
          matches.push({
            roundNumber: round.roundNumber,
            matchNumber: matches.length + 1,
            playerIds: pair,
          });
        }
      }

      await this.tournamentModel.createPoolMatches(tournamentId, pool.id, matches);
      if (matches.length > 0) {
        poolsToUpdate.push(pool.id);
      }
    }

    await this.tournamentModel.updatePoolStatuses(poolsToUpdate, PoolStatus.IN_PROGRESS);
  }

  async deletePoolStage(tournamentId: string, stageId: string): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(stageId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new AppError(
        'Pool stages can only be modified for draft, open, signature, or live tournaments',
        400,
        'POOL_STAGE_NOT_EDITABLE'
      );
    }

    await this.tournamentModel.deletePoolStage(stageId);
  }

  async getPoolStagePools(tournamentId: string, stageId: string) {
    this.validateUUID(tournamentId);
    this.validateUUID(stageId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const stage = await this.tournamentModel.getPoolStageById(stageId);
    if (stage?.tournamentId !== tournamentId) {
      throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
    }

    return await this.tournamentModel.getPoolsWithAssignmentsForStage(stageId);
  }

  async updatePoolAssignments(
    tournamentId: string,
    stageId: string,
    assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }>
  ): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(stageId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new AppError(
        'Pool assignments can only be modified for draft, open, signature, or live tournaments',
        400,
        'POOL_ASSIGNMENTS_NOT_EDITABLE'
      );
    }

    const stage = await this.tournamentModel.getPoolStageById(stageId);
    if (stage?.tournamentId !== tournamentId) {
      throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
    }

    if (stage.status !== StageStatus.EDITION) {
      throw new AppError(
        'Pool assignments can only be edited in edition stage',
        400,
        'POOL_ASSIGNMENTS_NOT_EDITABLE'
      );
    }

    const pools = await this.tournamentModel.getPoolsForStage(stageId);
    const poolIds = new Set(pools.map((pool) => pool.id));
    const players = await this.tournamentModel.getActivePlayersForTournament(tournamentId);
    const playerIds = new Set(players.map((player) => player.id));

    const invalidPool = assignments.find((assignment) => !poolIds.has(assignment.poolId));
    if (invalidPool) {
      throw new AppError('Invalid pool assignment target', 400, 'POOL_ASSIGNMENTS_INVALID_POOL');
    }

    const invalidPlayer = assignments.find((assignment) => !playerIds.has(assignment.playerId));
    if (invalidPlayer) {
      throw new AppError('Invalid player assignment', 400, 'POOL_ASSIGNMENTS_INVALID_PLAYER');
    }

    await this.tournamentModel.deletePoolAssignmentsForStage(stageId);
    await this.tournamentModel.createPoolAssignments(assignments);
  }

  async updateMatchStatus(
    tournamentId: string,
    matchId: string,
    status: MatchStatus,
    targetId?: string
  ): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(matchId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await this.tournamentModel.getMatchById(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    this.ensureValidMatchTransition(match.status as MatchStatus, status);

    const now = new Date();
    const timestamps: { startedAt?: Date | null; completedAt?: Date | null } = {};

    if (status === MatchStatus.IN_PROGRESS) {
      const targetToUse = await this.ensureTargetForMatchStart(match, targetId, tournamentId);

      if (!match.startedAt) {
        timestamps.startedAt = now;
      }

      if (match.poolId) {
        await this.ensurePoolStageInProgress(matchId);
      }

      await this.tournamentModel.startMatchWithTarget(matchId, targetToUse, timestamps.startedAt ?? now);
      return;
    }

    if (status === MatchStatus.COMPLETED || status === MatchStatus.CANCELLED) {
      timestamps.completedAt = now;
      if (!match.startedAt && status === MatchStatus.COMPLETED) {
        timestamps.startedAt = now;
      }

      if (match.targetId) {
        await this.tournamentModel.finishMatchAndReleaseTarget(
          matchId,
          match.targetId,
          status,
          timestamps
        );
        return;
      }
    }

    await this.tournamentModel.updateMatchStatus(matchId, status, timestamps);
  }

  private ensureValidMatchTransition(currentStatus: MatchStatus, nextStatus: MatchStatus) {
    const validTransitions: Record<MatchStatus, MatchStatus[]> = {
      [MatchStatus.SCHEDULED]: [MatchStatus.IN_PROGRESS, MatchStatus.CANCELLED],
      [MatchStatus.IN_PROGRESS]: [MatchStatus.COMPLETED, MatchStatus.CANCELLED],
      [MatchStatus.COMPLETED]: [],
      [MatchStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(nextStatus)) {
      throw new AppError(
        `Invalid match status transition from ${currentStatus} to ${nextStatus}`,
        400,
        'INVALID_MATCH_STATUS_TRANSITION'
      );
    }
  }

  private async ensureTargetForMatchStart(
    match: Awaited<ReturnType<TournamentModel['getMatchById']>>,
    targetId: string | undefined,
    tournamentId: string
  ): Promise<string> {
    if (!match?.targetId && !targetId) {
      throw new AppError('Target must be selected before starting a match', 400, 'TARGET_REQUIRED');
    }

    const targetToUse = match?.targetId ?? targetId;
    if (!targetToUse) {
      throw new AppError('Target must be selected before starting a match', 400, 'TARGET_REQUIRED');
    }

    const target = await this.tournamentModel.getTargetById(targetToUse);
    if (target?.tournamentId !== tournamentId) {
      throw new AppError('Target not found', 404, 'TARGET_NOT_FOUND');
    }

    if (target.status === TargetStatus.IN_USE) {
      await this.releaseStaleTargetUsage(target);
    } else if (target.status !== TargetStatus.AVAILABLE) {
      throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
    }

    return targetToUse;
  }

  private async releaseStaleTargetUsage(target: { id: string; currentMatchId?: string | null }): Promise<void> {
    if (!target.currentMatchId) {
      await this.tournamentModel.setTargetAvailable(target.id, null);
      return;
    }

    const currentMatch = await this.tournamentModel.getMatchById(target.currentMatchId);
    if (currentMatch?.status === MatchStatus.IN_PROGRESS) {
      throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
    }

    if (currentMatch && (currentMatch.status === MatchStatus.COMPLETED || currentMatch.status === MatchStatus.CANCELLED)) {
      await this.tournamentModel.finishMatchAndReleaseTarget(
        target.currentMatchId,
        target.id,
        currentMatch.status as MatchStatus,
        { completedAt: currentMatch.completedAt ?? new Date() }
      );
      return;
    }

    await this.tournamentModel.setTargetAvailable(target.id, null);
  }

  private async ensurePoolStageInProgress(matchId: string): Promise<void> {
    const poolStageId = await this.tournamentModel.getMatchPoolStageId(matchId);
    if (!poolStageId) {
      return;
    }
    const poolStage = await this.tournamentModel.getPoolStageById(poolStageId);
    if (poolStage && poolStage.status !== StageStatus.IN_PROGRESS) {
      await this.tournamentModel.updatePoolStage(poolStageId, { status: StageStatus.IN_PROGRESS });
    }
  }

  async completeMatch(
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(matchId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await this.tournamentModel.getMatchWithPlayerMatches(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new AppError('Match must be in progress to complete', 400, 'MATCH_NOT_IN_PROGRESS');
    }

    const participantIds = new Set(match.playerMatches.map((pm) => pm.playerId));
    if (scores.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }

    const invalidScore = scores.find((score) => !participantIds.has(score.playerId));
    if (invalidScore) {
      throw new AppError('Invalid player score entry', 400, 'MATCH_SCORE_INVALID_PLAYER');
    }

    const normalizedScores = scores
      .filter((score) => participantIds.has(score.playerId))
      .map((score) => ({
        playerId: score.playerId,
        scoreTotal: score.scoreTotal,
      }));

    const sorted = [...normalizedScores].sort((a, b) => b.scoreTotal - a.scoreTotal);
    if (sorted.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    const [first, second] = sorted;
    if (!first || !second) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    if (first.scoreTotal === second.scoreTotal) {
      throw new AppError('Match cannot end in a tie', 400, 'MATCH_SCORE_TIED');
    }

    const winnerId = first.playerId;
    const resultScores = normalizedScores.map((score) => ({
      ...score,
      isWinner: score.playerId === winnerId,
    }));

    const now = new Date();
    const timestamps: { startedAt?: Date | null; completedAt?: Date | null } = {
      completedAt: now,
    };
    if (!match.startedAt) {
      timestamps.startedAt = now;
    }

    await this.tournamentModel.completeMatch(matchId, resultScores, winnerId, timestamps);

    if (match.targetId) {
      await this.tournamentModel.finishMatchAndReleaseTarget(
        matchId,
        match.targetId,
        MatchStatus.COMPLETED,
        timestamps
      );
    }

    await this.advanceBracketIfReady(matchId, tournamentId);
  }

  async updateCompletedMatchScores(
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(matchId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await this.tournamentModel.getMatchWithPlayerMatches(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    if (match.status !== MatchStatus.COMPLETED) {
      throw new AppError('Match must be completed to edit scores', 400, 'MATCH_NOT_COMPLETED');
    }

    const participantIds = new Set(match.playerMatches.map((pm) => pm.playerId));
    if (scores.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }

    const invalidScore = scores.find((score) => !participantIds.has(score.playerId));
    if (invalidScore) {
      throw new AppError('Invalid player score entry', 400, 'MATCH_SCORE_INVALID_PLAYER');
    }

    const normalizedScores = scores
      .filter((score) => participantIds.has(score.playerId))
      .map((score) => ({
        playerId: score.playerId,
        scoreTotal: score.scoreTotal,
      }));

    const sorted = [...normalizedScores].sort((a, b) => b.scoreTotal - a.scoreTotal);
    if (sorted.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    const [first, second] = sorted;
    if (!first || !second) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    if (first.scoreTotal === second.scoreTotal) {
      throw new AppError('Match cannot end in a tie', 400, 'MATCH_SCORE_TIED');
    }

    const winnerId = first.playerId;
    const resultScores = normalizedScores.map((score) => ({
      ...score,
      isWinner: score.playerId === winnerId,
    }));

    await this.tournamentModel.updateMatchScores(matchId, resultScores, winnerId);

    if (match.targetId) {
      const target = await this.tournamentModel.getTargetById(match.targetId);
      if (target?.currentMatchId === matchId && target.status === TargetStatus.IN_USE) {
        await this.tournamentModel.finishMatchAndReleaseTarget(
          matchId,
          match.targetId,
          MatchStatus.COMPLETED,
          { completedAt: new Date() }
        );
      }
    }

    await this.advanceBracketIfReady(matchId, tournamentId);
  }

  private async advanceBracketIfReady(matchId: string, tournamentId: string): Promise<void> {
    const match = await this.tournamentModel.getMatchById(matchId);
    if (!match?.bracketId) {
      return;
    }

    const bracket = await this.tournamentModel.getBracketById(match.bracketId);
    if (!bracket || bracket.tournamentId !== tournamentId) {
      return;
    }

    const roundNumber = match.roundNumber || 1;
    const roundMatches = await this.tournamentModel.getBracketMatchesByRound(bracket.id, roundNumber);
    const allCompleted = roundMatches.length > 0
      && roundMatches.every((item) => item.status === MatchStatus.COMPLETED);

    if (!allCompleted) {
      return;
    }

    if (roundNumber >= bracket.totalRounds) {
      await this.tournamentModel.updateBracket(bracket.id, {
        status: BracketStatus.COMPLETED,
        completedAt: new Date(),
      });
      await this.tryFinishTournament(tournamentId);
      return;
    }

    const nextRound = roundNumber + 1;
    const nextRoundCount = await this.tournamentModel.getBracketMatchCountByRound(bracket.id, nextRound);
    if (nextRoundCount > 0) {
      await this.tournamentModel.updateBracket(bracket.id, { status: BracketStatus.IN_PROGRESS });
      return;
    }

    const winners = roundMatches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((item) => item.winnerId)
      .filter((id): id is string => Boolean(id));

    if (winners.length < 2) {
      return;
    }

    const nextMatches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];
    let matchNumber = 1;
    for (let i = 0; i < winners.length; i += 2) {
      const first = winners[i];
      const second = winners[i + 1];
      if (!first || !second) {
        continue;
      }
      nextMatches.push({
        roundNumber: nextRound,
        matchNumber,
        playerIds: [first, second],
      });
      matchNumber += 1;
    }

    await this.tournamentModel.createBracketMatches(tournamentId, bracket.id, nextMatches);
    await this.tournamentModel.updateBracket(bracket.id, { status: BracketStatus.IN_PROGRESS });
  }

  private async tryFinishTournament(tournamentId: string): Promise<void> {
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.LIVE) {
      return;
    }

    const poolStages = await this.tournamentModel.getPoolStages(tournamentId);
    const brackets = await this.tournamentModel.getBrackets(tournamentId);

    const poolsComplete = poolStages.length === 0
      || poolStages.every((stage) => stage.status === StageStatus.COMPLETED);
    const bracketsComplete = brackets.length === 0
      || brackets.every((bracket) => bracket.status === BracketStatus.COMPLETED);

    if (poolsComplete && bracketsComplete) {
      await this.transitionTournamentStatus(tournamentId, TournamentStatus.FINISHED);
    }
  }

  private async assignPlayersToPools(
    tournamentId: string,
    stageId: string,
    poolCount: number,
    playersPerPool: number
  ): Promise<void> {
    const pools = await this.tournamentModel.getPoolsForStage(stageId);
    if (pools.length === 0) return;

    const stage = await this.tournamentModel.getPoolStageById(stageId);
    if (!stage) return;

    const players = await this.tournamentModel.getActivePlayersForTournament(tournamentId);
    if (players.length === 0) return;

    const opponentMap = await this.buildOpponentMap(tournamentId, stage.stageNumber);

    const skillScore: Record<string, number> = {
      EXPERT: 4,
      ADVANCED: 3,
      INTERMEDIATE: 2,
      BEGINNER: 1,
    };

    const shuffled = players
      .map((player) => ({
        player,
        score: skillScore[player.skillLevel || ''] || 0,
        tiebreaker: Math.random(),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.tiebreaker - b.tiebreaker;
      })
      .map((item) => item.player);

    const capacity = poolCount * playersPerPool;
    const selected = shuffled.slice(0, capacity);
    const assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }> = [];
    const poolState = pools.map((pool) => ({ pool, players: [] as string[] }));

    for (let i = 0; i < selected.length; i += 1) {
      const player = selected[i];
      if (!player) continue;
      const chosenPoolState = this.pickPoolForPlayer(
        player.id,
        poolState,
        playersPerPool,
        opponentMap
      );
      if (!chosenPoolState) continue;

      chosenPoolState.players.push(player.id);
      assignments.push({
        poolId: chosenPoolState.pool.id,
        playerId: player.id,
        assignmentType: AssignmentType.SEEDED,
        seedNumber: i + 1,
      });
    }

    await this.tournamentModel.createPoolAssignments(assignments);
  }

  private async buildOpponentMap(
    tournamentId: string,
    stageNumber: number
  ): Promise<Map<string, Set<string>>> {
    const opponentMap = new Map<string, Set<string>>();
    if (stageNumber <= 1) {
      return opponentMap;
    }

    const opponentPairs = await this.tournamentModel.getOpponentPairsBeforeStage(
      tournamentId,
      stageNumber
    );
    for (const [first, second] of opponentPairs) {
      if (!opponentMap.has(first)) {
        opponentMap.set(first, new Set());
      }
      if (!opponentMap.has(second)) {
        opponentMap.set(second, new Set());
      }
      opponentMap.get(first)?.add(second);
      opponentMap.get(second)?.add(first);
    }

    return opponentMap;
  }

  private countOpponentConflicts(
    playerId: string,
    poolPlayers: string[],
    opponentMap: Map<string, Set<string>>
  ): number {
    const opponents = opponentMap.get(playerId);
    if (!opponents || opponents.size === 0) {
      return 0;
    }
    let conflicts = 0;
    for (const existing of poolPlayers) {
      if (opponents.has(existing)) {
        conflicts += 1;
      }
    }
    return conflicts;
  }

  private pickPoolForPlayer(
    playerId: string,
    poolState: Array<{ pool: { id: string }; players: string[] }>,
    playersPerPool: number,
    opponentMap: Map<string, Set<string>>
  ) {
    let best: { state: typeof poolState[number]; conflicts: number } | null = null;

    for (const state of poolState) {
      if (state.players.length >= playersPerPool) continue;
      const conflicts = this.countOpponentConflicts(playerId, state.players, opponentMap);

      if (!best || this.isBetterPoolCandidate(conflicts, state.players.length, best)) {
        best = { state, conflicts };
      }
    }

    return best?.state ?? poolState.find((state) => state.players.length < playersPerPool);
  }

  private isBetterPoolCandidate(
    conflicts: number,
    size: number,
    best: { state: { players: string[] }; conflicts: number }
  ): boolean {
    if (conflicts !== best.conflicts) {
      return conflicts < best.conflicts;
    }

    const bestSize = best.state.players.length;
    if (size !== bestSize) {
      return size < bestSize;
    }

    return Math.random() < 0.5;
  }

  /**
   * Bracket configuration
   */
  async getBrackets(tournamentId: string) {
    this.validateUUID(tournamentId);
    return await this.tournamentModel.getBrackets(tournamentId);
  }

  async createBracket(
    tournamentId: string,
    data: { name: string; bracketType: BracketType; totalRounds: number }
  ) {
    this.validateUUID(tournamentId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    return await this.tournamentModel.createBracket(tournamentId, data);
  }

  async updateBracket(
    tournamentId: string,
    bracketId: string,
    data: Partial<{ name: string; bracketType: BracketType; totalRounds: number; status: BracketStatus }>
  ) {
    this.validateUUID(tournamentId);
    this.validateUUID(bracketId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    return await this.tournamentModel.updateBracket(bracketId, data);
  }

  async deleteBracket(tournamentId: string, bracketId: string): Promise<void> {
    this.validateUUID(tournamentId);
    this.validateUUID(bracketId);
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    await this.tournamentModel.deleteBracket(bracketId);
  }

  /**
   * Validate tournament registration constraints
   */
  async validateRegistrationConstraints(tournamentId: string, playerId: string): Promise<{
    canRegister: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      await this.registerPlayer(tournamentId, playerId);
      return { canRegister: true, reasons: [] };
    } catch (error) {
      if (error instanceof AppError) {
        reasons.push(error.message);
      } else {
        reasons.push('Unknown registration error');
      }
    }

    return { canRegister: false, reasons };
  }

  /**
   * Transition tournament status with validation
   */
  async transitionTournamentStatus(
    tournamentId: string, 
    newStatus: TournamentStatus,
    force: boolean = false
  ): Promise<Tournament> {
    this.validateUUID(tournamentId);

    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      this.logger.accessError(
        'TOURNAMENT_NOT_FOUND',
        `Tournament not found: ${tournamentId}`,
        tournamentId
      );
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }

    const previousStatus = tournament.status;

    try {
      // Validate status transition
      if (!force) {
        await this.validateStatusTransition(tournament.status, newStatus, tournament);
      }

      // Apply business rules for specific transitions
      await this.applyTransitionRules(tournament, newStatus);

      // Update tournament status
      const updatedTournament = await this.tournamentModel.updateStatus(
        tournamentId, 
        newStatus,
        newStatus === 'FINISHED' ? new Date() : undefined
      );

      // Log successful status transition
      this.logger.tournamentStatusChanged(
        tournamentId,
        tournament.name,
        previousStatus,
        newStatus
      );

      return updatedTournament;
    } catch (error) {
      if (error instanceof AppError) {
        this.logger.validationError(
          error.code || 'UNKNOWN_ERROR',
          error.message,
          tournamentId,
          tournament.name
        );
        throw error;
      }
      
      this.logger.error(
        `Failed to transition tournament status from ${previousStatus} to ${newStatus}`,
        tournamentId,
        error
      );
      throw error;
    }
  }

  /**
   * Open registration for tournament
   */
  async openTournamentRegistration(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.OPEN);
  }

  /**
   * Start tournament
   */
  async startTournament(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.LIVE);
  }

  /**
   * Complete tournament
   */
  async completeTournament(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.FINISHED);
  }

  /**
   * Validate status transition rules
   */
  private async validateStatusTransition(
    currentStatus: TournamentStatus, 
    newStatus: TournamentStatus, 
    tournament: Tournament
  ): Promise<void> {
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [TournamentStatus.OPEN],
      [TournamentStatus.OPEN]: [TournamentStatus.SIGNATURE, TournamentStatus.DRAFT],
      [TournamentStatus.SIGNATURE]: [TournamentStatus.LIVE, TournamentStatus.OPEN],
      [TournamentStatus.LIVE]: [TournamentStatus.FINISHED],
      [TournamentStatus.FINISHED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Additional business rule validations
    if (newStatus === TournamentStatus.OPEN) {
      const now = new Date();
      if (now > tournament.endTime) {
        throw new AppError(
          'Cannot open registration for past tournament',
          400,
          'TOURNAMENT_END_TIME_PASSED'
        );
      }
    }

    if (newStatus === TournamentStatus.LIVE) {
      const now = new Date();
      if (now < tournament.startTime) {
        const participantCount = await this.tournamentModel.getParticipantCount(tournament.id);
        const checkedInCount = await this.tournamentModel.getCheckedInCount(tournament.id);

        if (participantCount === 0 || checkedInCount < participantCount) {
          throw new AppError(
            'Cannot start tournament before scheduled start time',
            400,
            'TOURNAMENT_START_TIME_NOT_REACHED'
          );
        }
      }
    }
  }

  /**
   * Apply transition-specific business rules
   */
  private async applyTransitionRules(
    tournament: Tournament, 
    newStatus: TournamentStatus
  ): Promise<void> {
    switch (newStatus) {
      case TournamentStatus.OPEN: {
        // Ensure tournament has minimum configuration
        if (tournament.totalParticipants < 2) {
          throw new AppError(
            'Tournament must allow at least 2 participants',
            400,
            'INSUFFICIENT_PARTICIPANT_CAPACITY'
          );
        }
        if (tournament.targetCount < 1) {
          throw new AppError(
            'Tournament must have at least 1 target',
            400,
            'INSUFFICIENT_TARGET_COUNT'
          );
        }
        break;
      }

      case TournamentStatus.LIVE: {
        // Check minimum participants registered
        const participantCount = await this.tournamentModel.getParticipantCount(tournament.id);
        if (participantCount < 2) {
          throw new AppError(
            'Tournament needs at least 2 registered participants to start',
            400,
            'INSUFFICIENT_PARTICIPANTS'
          );
        }
        break;
      }

      case TournamentStatus.FINISHED: {
        // Verify all matches are completed (this would require match tracking)
        // For now, just ensure tournament was in progress
        if (tournament.status !== TournamentStatus.LIVE) {
          throw new AppError(
            'Only live tournaments can be finished',
            400,
            'TOURNAMENT_NOT_LIVE'
          );
        }
        break;
      }
    }
  }

  private validateUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError(
        'Invalid tournament ID format',
        400,
        'INVALID_TOURNAMENT_ID'
      );
    }
  }

  private calculateTournamentDuration(startTime: string, endTime: string): {
    hours: number;
    minutes: number;
    total: string;
  } {
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
  }

  /**
   * Get overall tournament statistics
   */
  async getOverallTournamentStats() {
    try {
      const stats = await this.tournamentModel.getOverallStats();
      return stats;
    } catch (error) {
      this.logger.error('Failed to retrieve tournament statistics', undefined, error);
      throw new AppError(
        'Failed to retrieve tournament statistics',
        500,
        'STATS_RETRIEVAL_ERROR'
      );
    }
  }
}

export default TournamentService;