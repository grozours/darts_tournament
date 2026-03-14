import type { TournamentModel } from '../../models/tournament-model';
import type TournamentLogger from '../../utils/tournament-logger';
import type { CreatePlayerRequest, Player, Tournament, SkillLevel } from '../../../../shared/src/types';
import { TournamentStatus, TournamentFormat } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { config } from '../../config/environment';
import {
  buildPlayerPayload,
  buildPlayerUpdate,
  ensureTournamentAllowsPlayerUpdate,
  ensureUniquePlayerAttributes,
  ensureUniqueSurname,
  updateLinkedPerson,
  validatePlayerData,
} from './player-helpers';
import { getPlayerCapacityFromSlots } from './slot-capacity';

type PlayerHandlerContext = {
  tournamentModel: TournamentModel;
  logger: TournamentLogger;
  validateUUID: (id: string) => void;
  transitionTournamentStatus: (tournamentId: string, status: TournamentStatus) => Promise<Tournament>;
  isAdminAction: () => boolean;
};

const resolveRequestedPersonId = async (
  context: PlayerHandlerContext,
  playerData: CreatePlayerRequest
): Promise<string | undefined> => {
  const requestedPersonId = playerData.personId?.trim();
  if (!requestedPersonId) {
    return undefined;
  }

  if (!context.isAdminAction()) {
    throw new AppError('Only admins can assign personId during registration', 403, 'FORBIDDEN');
  }

  const person = await context.tournamentModel.getPersonById(requestedPersonId);
  if (!person) {
    throw new AppError('Target person not found', 404, 'PERSON_NOT_FOUND');
  }

  return person.id;
};

const requiresGroupCaptainRegistration = (format: TournamentFormat) =>
  format === TournamentFormat.DOUBLE || format === TournamentFormat.TEAM_4_PLAYER;

export const createPlayerHandlers = (context: PlayerHandlerContext) => ({
  registerPlayer: async (tournamentId: string, playerId: string): Promise<void> => {
    context.validateUUID(tournamentId);
    context.validateUUID(playerId);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      context.logger.accessError(
        'TOURNAMENT_NOT_FOUND',
        `Tournament not found during registration: ${tournamentId}`,
        tournamentId
      );
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    try {
      if (tournament.status !== TournamentStatus.OPEN) {
        context.logger.validationError(
          'REGISTRATION_NOT_OPEN',
          `Registration not open for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError('Tournament registration is not open', 400, 'REGISTRATION_NOT_OPEN');
      }

      if (requiresGroupCaptainRegistration(tournament.format) && !context.isAdminAction()) {
        throw new AppError(
          'For this tournament format, registration must be completed by a doublette/equipe captain',
          400,
          'REGISTRATION_REQUIRES_GROUP_CAPTAIN'
        );
      }

      if (config.auth.enabled) {
        const now = new Date();
        const registrationDeadline = new Date(tournament.startTime);
        registrationDeadline.setHours(registrationDeadline.getHours() - 1);

        if (now > registrationDeadline) {
          context.logger.validationError(
            'REGISTRATION_DEADLINE_PASSED',
            `Registration deadline passed for tournament: ${tournament.name}`,
            tournamentId,
            tournament.name
          );
          throw new AppError('Registration deadline has passed', 400, 'REGISTRATION_DEADLINE_PASSED');
        }
      }

      const isAlreadyRegistered = await context.tournamentModel.isPlayerRegistered(
        tournamentId,
        playerId
      );
      if (isAlreadyRegistered) {
        context.logger.validationError(
          'DUPLICATE_REGISTRATION',
          `Player already registered for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError('Player is already registered for this tournament', 400, 'DUPLICATE_REGISTRATION');
      }

      const currentParticipants = await context.tournamentModel.getParticipantCount(tournamentId);
      const playerCapacity = getPlayerCapacityFromSlots(tournament.totalParticipants, tournament.format);
      if (currentParticipants >= playerCapacity) {
        context.logger.validationError(
          'TOURNAMENT_FULL',
          `Tournament is full: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
      }

      await context.tournamentModel.registerPlayer(tournamentId, playerId);

      context.logger.playerRegistered(tournamentId, tournament.name, playerId);
    } catch (error) {
      if (!(error instanceof AppError)) {
        context.logger.error('Failed to register player for tournament', tournamentId, error);
      }
      throw error;
    }
  },

  registerPlayerDetails: async (
    tournamentId: string,
    playerData: CreatePlayerRequest
  ): Promise<Player> => {
    context.validateUUID(tournamentId);
    validatePlayerData(playerData);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      context.logger.accessError(
        'TOURNAMENT_NOT_FOUND',
        `Tournament not found during registration: ${tournamentId}`,
        tournamentId
      );
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    try {
        const linkedPersonId = await resolveRequestedPersonId(context, playerData);

      if (tournament.status !== TournamentStatus.OPEN) {
        context.logger.validationError(
          'REGISTRATION_NOT_OPEN',
          `Registration not open for tournament: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError('Tournament registration is not open', 400, 'REGISTRATION_NOT_OPEN');
      }

      if (requiresGroupCaptainRegistration(tournament.format) && !context.isAdminAction()) {
        throw new AppError(
          'For this tournament format, registration must be completed by a doublette/equipe captain',
          400,
          'REGISTRATION_REQUIRES_GROUP_CAPTAIN'
        );
      }

      if (config.auth.enabled) {
        const now = new Date();
        const registrationDeadline = new Date(tournament.startTime);
        registrationDeadline.setHours(registrationDeadline.getHours() - 1);

        if (now > registrationDeadline) {
          context.logger.validationError(
            'REGISTRATION_DEADLINE_PASSED',
            `Registration deadline passed for tournament: ${tournament.name}`,
            tournamentId,
            tournament.name
          );
          throw new AppError('Registration deadline has passed', 400, 'REGISTRATION_DEADLINE_PASSED');
        }
      }

      const currentParticipants = await context.tournamentModel.getParticipantCount(tournamentId);
      const playerCapacity = getPlayerCapacityFromSlots(tournament.totalParticipants, tournament.format);
      if (currentParticipants >= playerCapacity) {
        context.logger.validationError(
          'TOURNAMENT_FULL',
          `Tournament is full: ${tournament.name}`,
          tournamentId,
          tournament.name
        );
        throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
      }

      if (playerData.surname?.trim()) {
        await ensureUniqueSurname(context, tournamentId, playerData.surname);
      }

      const playerPayload = await buildPlayerPayload(context, playerData, linkedPersonId);

      const player = await context.tournamentModel.createPlayer(tournamentId, playerPayload);

      context.logger.playerRegistered(tournamentId, tournament.name, player.id);

      return player;
    } catch (error) {
      if (!(error instanceof AppError)) {
        context.logger.error('Failed to register player for tournament', tournamentId, error);
      }
      throw error;
    }
  },

  unregisterPlayer: async (tournamentId: string, playerId: string): Promise<void> => {
    context.validateUUID(tournamentId);
    context.validateUUID(playerId);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (tournament.status === TournamentStatus.LIVE || tournament.status === TournamentStatus.FINISHED) {
      throw new AppError('Cannot unregister from tournament that is live or finished', 400, 'UNREGISTRATION_NOT_ALLOWED');
    }

    const isRegistered = await context.tournamentModel.isPlayerRegistered(tournamentId, playerId);
    if (!isRegistered) {
      throw new AppError('Player is not registered for this tournament', 400, 'PLAYER_NOT_REGISTERED');
    }

    await context.tournamentModel.unregisterPlayer(tournamentId, playerId);
  },

  getPlayerById: async (playerId: string): Promise<Player | undefined> => {
    context.validateUUID(playerId);
    const player = await context.tournamentModel.getPlayerById(playerId);
    if (!player) {
      return undefined;
    }
    return {
      id: player.id,
      tournamentId: player.tournamentId,
      firstName: player.firstName,
      lastName: player.lastName,
      registeredAt: player.registeredAt,
      isActive: player.isActive,
      checkedIn: player.checkedIn,
      ...(player.personId ? { personId: player.personId } : {}),
      ...(player.surname ? { surname: player.surname } : {}),
      ...(player.teamName ? { teamName: player.teamName } : {}),
      ...(player.email ? { email: player.email } : {}),
      ...(player.skillLevel ? { skillLevel: player.skillLevel as SkillLevel } : {}),
    };
  },

  updateTournamentPlayer: async (
    tournamentId: string,
    playerId: string,
    updateData: CreatePlayerRequest
  ): Promise<Player> => {
    context.validateUUID(tournamentId);
    context.validateUUID(playerId);
    validatePlayerData(updateData);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    ensureTournamentAllowsPlayerUpdate(tournament);

    const player = await context.tournamentModel.getPlayerById(playerId);
    const requestedPersonId = updateData.personId?.trim();
    const hasPersonReassignment = Boolean(requestedPersonId && requestedPersonId !== player?.personId);

    if (hasPersonReassignment && !context.isAdminAction()) {
      throw new AppError('Admin access required to reassign player account', 403, 'PLAYER_REASSIGN_FORBIDDEN');
    }

    if (requestedPersonId) {
      const person = await context.tournamentModel.getPersonById(requestedPersonId);
      if (!person) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }
    }

    const targetPersonId = requestedPersonId || player?.personId;

    if (player?.personId && targetPersonId === player.personId) {
      await updateLinkedPerson(context, player.personId, updateData);
    }

    await ensureUniquePlayerAttributes(context, tournament, tournamentId, updateData, playerId);

    const playerUpdate = buildPlayerUpdate(updateData, targetPersonId);
    return await context.tournamentModel.updatePlayer(tournamentId, playerId, playerUpdate);
  },

  updateTournamentPlayerCheckIn: async (
    tournamentId: string,
    playerId: string,
    checkedIn: boolean
  ): Promise<Player> => {
    context.validateUUID(tournamentId);
    context.validateUUID(playerId);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (tournament.status !== TournamentStatus.SIGNATURE) {
      throw new AppError('Check-in is only available during signature', 400, 'PLAYER_CHECKIN_NOT_ALLOWED');
    }

    const updatedPlayer = await context.tournamentModel.updatePlayerCheckIn(
      tournamentId,
      playerId,
      checkedIn
    );

    if (checkedIn && tournament.status === TournamentStatus.SIGNATURE) {
      const participantCount = await context.tournamentModel.getParticipantCount(tournamentId);
      const checkedInCount = await context.tournamentModel.getCheckedInCount(tournamentId);
      if (participantCount >= 2 && checkedInCount >= participantCount) {
        try {
          await context.transitionTournamentStatus(tournamentId, TournamentStatus.LIVE);
        } catch (error) {
          context.logger.error(
            'Failed to auto-transition tournament to LIVE after check-in',
            tournamentId,
            error
          );
        }
      }
    }

    return updatedPlayer;
  },

  getTournamentParticipants: async (
    tournamentId: string
  ): Promise<Awaited<ReturnType<TournamentModel['getParticipants']>>> => {
    context.validateUUID(tournamentId);

    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    return await context.tournamentModel.getParticipants(tournamentId);
  },

  getOrphanParticipants: async (): Promise<Awaited<ReturnType<TournamentModel['getOrphanParticipants']>>> => {
    return await context.tournamentModel.getOrphanParticipants();
  },

  deleteOrphanParticipants: async (): Promise<number> => {
    return await context.tournamentModel.deleteOrphanParticipants();
  },

});
