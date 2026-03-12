import type { TournamentModel } from '../../models/tournament-model';
import type TournamentLogger from '../../utils/tournament-logger';
import type { Tournament } from '../../../../shared/src/types';
import { TournamentFormat, TournamentStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';

export type StatusHandlerContext = {
  tournamentModel: TournamentModel;
  logger: TournamentLogger;
  validateUUID: (id: string) => void;
};

export const createStatusHandlers = (context: StatusHandlerContext) => {
  const { tournamentModel, logger, validateUUID } = context;

  const getRegisteredSlotCount = async (tournament: Tournament): Promise<number> => {
    if (tournament.format === TournamentFormat.DOUBLE) {
      return await tournamentModel.countRegisteredDoublettes(tournament.id);
    }

    if (tournament.format === TournamentFormat.TEAM_4_PLAYER) {
      return await tournamentModel.countRegisteredEquipes(tournament.id);
    }

    return await tournamentModel.getParticipantCount(tournament.id);
  };

  const validateStatusTransition = async (
    currentStatus: TournamentStatus,
    newStatus: TournamentStatus,
    tournament: Tournament
  ): Promise<void> => {
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [TournamentStatus.OPEN],
      [TournamentStatus.OPEN]: [TournamentStatus.SIGNATURE, TournamentStatus.DRAFT],
      [TournamentStatus.SIGNATURE]: [TournamentStatus.LIVE, TournamentStatus.OPEN],
      [TournamentStatus.LIVE]: [TournamentStatus.FINISHED, TournamentStatus.SIGNATURE],
      [TournamentStatus.FINISHED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

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
        const participantCount = await tournamentModel.getParticipantCount(tournament.id);
        const checkedInCount = await tournamentModel.getCheckedInCount(tournament.id);

        if (participantCount === 0 || checkedInCount < participantCount) {
          throw new AppError(
            'Cannot start tournament before scheduled start time',
            400,
            'TOURNAMENT_START_TIME_NOT_REACHED'
          );
        }
      }
    }
  };

  const applyTransitionRules = async (
    tournament: Tournament,
    newStatus: TournamentStatus
  ): Promise<void> => {
    switch (newStatus) {
      case TournamentStatus.OPEN: {
        if (tournament.totalParticipants < 2) {
          throw new AppError(
            'Tournament must allow at least 2 slots',
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
        const slotCount = await getRegisteredSlotCount(tournament);
        if (slotCount < 2) {
          throw new AppError(
            'Tournament needs at least 2 registered slots to start',
            400,
            'INSUFFICIENT_PARTICIPANTS'
          );
        }
        break;
      }

      case TournamentStatus.FINISHED: {
        if (tournament.status !== TournamentStatus.LIVE) {
          throw new AppError(
            'Only live tournaments can be finished',
            400,
            'TOURNAMENT_NOT_LIVE'
          );
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  const transitionTournamentStatus = async (
    tournamentId: string,
    newStatus: TournamentStatus,
    force: boolean = false
  ): Promise<Tournament> => {
    validateUUID(tournamentId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      logger.accessError(
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
      if (!force) {
        await validateStatusTransition(tournament.status, newStatus, tournament);
      }

      await applyTransitionRules(tournament, newStatus);

      const updatedTournament = await tournamentModel.updateStatus(
        tournamentId,
        newStatus,
        newStatus === 'FINISHED' ? new Date() : undefined
      );

      logger.tournamentStatusChanged(
        tournamentId,
        tournament.name,
        previousStatus,
        newStatus
      );

      return updatedTournament;
    } catch (error) {
      if (error instanceof AppError) {
        logger.validationError(
          error.code || 'UNKNOWN_ERROR',
          error.message,
          tournamentId,
          tournament.name
        );
        throw error;
      }

      logger.error(
        `Failed to transition tournament status from ${previousStatus} to ${newStatus}`,
        tournamentId,
        error
      );
      throw error;
    }
  };

  return {
    transitionTournamentStatus,
    openTournamentRegistration: async (tournamentId: string): Promise<Tournament> =>
      transitionTournamentStatus(tournamentId, TournamentStatus.OPEN),
    startTournament: async (tournamentId: string): Promise<Tournament> =>
      transitionTournamentStatus(tournamentId, TournamentStatus.LIVE),
    completeTournament: async (tournamentId: string): Promise<Tournament> =>
      transitionTournamentStatus(tournamentId, TournamentStatus.FINISHED),
  };
};
