import { TournamentModel } from '../models/TournamentModel';
import { Tournament, TournamentFormat, DurationType, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';
import TournamentLogger from '../utils/tournamentLogger';
import { Request } from 'express';

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
  status?: string;
  format?: TournamentFormat;
  name?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'startTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class TournamentService {
  private tournamentModel: TournamentModel;
  private logger: TournamentLogger;

  constructor(prisma: PrismaClient, req?: Request) {
    this.tournamentModel = new TournamentModel(prisma);
    this.logger = new TournamentLogger(req);
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

    // Check if tournament exists and is editable
    const isEditable = await this.tournamentModel.isEditable(id);
    if (!isEditable) {
      throw new AppError(
        'Tournament cannot be edited in its current status',
        400,
        'TOURNAMENT_NOT_EDITABLE'
      );
    }

    // Validate update data
    if (updateData.name !== undefined) {
      this.validateName(updateData.name);
      updateData.name = this.sanitizeName(updateData.name);
    }

    if (updateData.totalParticipants !== undefined) {
      this.validateParticipantCount(updateData.totalParticipants);
    }

    if (updateData.targetCount !== undefined) {
      this.validateTargetCount(updateData.targetCount);
    }

    // Convert dates if provided
    let processedData: any = { ...updateData };
    
    if (updateData.startTime) {
      processedData.startTime = new Date(updateData.startTime);
    }
    
    if (updateData.endTime) {
      processedData.endTime = new Date(updateData.endTime);
    }

    // Validate dates if both are provided or if we need to check against existing
    if (processedData.startTime || processedData.endTime) {
      const existing = await this.tournamentModel.findById(id);
      const startTime = processedData.startTime || new Date(existing!.startTime);
      const endTime = processedData.endTime || new Date(existing!.endTime);
      
      this.validateDates(startTime, endTime);
    }

    return await this.tournamentModel.update(id, processedData);
  }

  /**
   * Delete tournament
   */
  async deleteTournament(id: string): Promise<boolean> {
    this.validateUUID(id);

    // Check if tournament exists and can be deleted
    const tournament = await this.getTournamentById(id);
    
    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new AppError(
        'Cannot delete active tournament',
        400,
        'CANNOT_DELETE_ACTIVE_TOURNAMENT'
      );
    }

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

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
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

    try {
      const tournaments = await this.tournamentModel.findAll({
        limit: 1,
      });

      // This is a simplified check - in a real implementation,
      // you'd want a specific method to check name uniqueness
      return true; // Placeholder - actual implementation would check database
    } catch (error) {
      return false;
    }
  }

  /**
   * Get tournament statistics
   */
  async getTournamentStats(id: string) {
    const tournament = await this.getTournamentById(id);
    
    // Get the tournament with details to access related data
    const tournamentWithDetails = await this.tournamentModel.findById(id);
    
    if (!tournamentWithDetails) {
      throw new AppError(
        'Tournament not found',
        404,
        'TOURNAMENT_NOT_FOUND'
      );
    }
    
    const currentParticipants = (tournamentWithDetails as any).players?.length || 0;
    const matchesTotal = (tournamentWithDetails as any).matches?.length || 0;
    const matchesCompleted = (tournamentWithDetails as any).matches?.filter((m: any) => m.status === 'completed').length || 0;
    
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

  private sanitizeName(name: string): string {
    return name.replace(/<[^>]*>/g, '').trim();
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

  private validateDates(startTime: Date, endTime: Date): void {
    const now = new Date();
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new AppError(
        'Invalid date format',
        400,
        'INVALID_DATE_FORMAT'
      );
    }

    if (startTime < now) {
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
      if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
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
    if (tournament.status === TournamentStatus.IN_PROGRESS || tournament.status === TournamentStatus.COMPLETED) {
      throw new AppError(
        'Cannot unregister from tournament that is in progress or completed',
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
   * Get tournament participants
   */
  async getTournamentParticipants(tournamentId: string): Promise<any[]> {
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
        this.validateStatusTransition(tournament.status, newStatus, tournament);
      }

      // Apply business rules for specific transitions
      await this.applyTransitionRules(tournament, newStatus);

      // Update tournament status
      const updatedTournament = await this.tournamentModel.updateStatus(
        tournamentId, 
        newStatus,
        newStatus === 'COMPLETED' ? new Date() : undefined
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
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.REGISTRATION_OPEN);
  }

  /**
   * Start tournament
   */
  async startTournament(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.IN_PROGRESS);
  }

  /**
   * Complete tournament
   */
  async completeTournament(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.COMPLETED);
  }

  /**
   * Archive tournament
   */
  async archiveTournament(tournamentId: string): Promise<Tournament> {
    return await this.transitionTournamentStatus(tournamentId, TournamentStatus.ARCHIVED);
  }

  /**
   * Validate status transition rules
   */
  private validateStatusTransition(
    currentStatus: TournamentStatus, 
    newStatus: TournamentStatus, 
    tournament: Tournament
  ): void {
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.ARCHIVED],
      [TournamentStatus.REGISTRATION_OPEN]: [TournamentStatus.IN_PROGRESS, TournamentStatus.DRAFT, TournamentStatus.ARCHIVED],
      [TournamentStatus.IN_PROGRESS]: [TournamentStatus.COMPLETED, TournamentStatus.ARCHIVED],
      [TournamentStatus.COMPLETED]: [TournamentStatus.ARCHIVED],
      [TournamentStatus.ARCHIVED]: [], // No transitions from archived state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Additional business rule validations
    if (newStatus === TournamentStatus.REGISTRATION_OPEN) {
      const now = new Date();
      if (now > tournament.endTime) {
        throw new AppError(
          'Cannot open registration for past tournament',
          400,
          'TOURNAMENT_END_TIME_PASSED'
        );
      }
    }

    if (newStatus === TournamentStatus.IN_PROGRESS) {
      const now = new Date();
      if (now < tournament.startTime) {
        throw new AppError(
          'Cannot start tournament before scheduled start time',
          400,
          'TOURNAMENT_START_TIME_NOT_REACHED'
        );
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
      case TournamentStatus.REGISTRATION_OPEN:
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

      case TournamentStatus.IN_PROGRESS:
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

      case TournamentStatus.COMPLETED:
        // Verify all matches are completed (this would require match tracking)
        // For now, just ensure tournament was in progress
        if (tournament.status !== TournamentStatus.IN_PROGRESS) {
          throw new AppError(
            'Only tournaments in progress can be completed',
            400,
            'TOURNAMENT_NOT_IN_PROGRESS'
          );
        }
        break;

      case TournamentStatus.ARCHIVED:
        // Tournaments can only be archived if completed or if they're old drafts
        const daysSinceCreation = Math.floor(
          (Date.now() - tournament.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (tournament.status !== TournamentStatus.COMPLETED && daysSinceCreation < 30) {
          throw new AppError(
            'Only completed tournaments or drafts older than 30 days can be archived',
            400,
            'TOURNAMENT_NOT_ARCHIVABLE'
          );
        }
        break;
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
    } catch (error: any) {
      throw new AppError(
        'Failed to retrieve tournament statistics',
        500,
        'STATS_RETRIEVAL_ERROR'
      );
    }
  }
}

export default TournamentService;