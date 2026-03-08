import type { PrismaClient } from '@prisma/client';
import type { Player, SkillLevel } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError, mapToPlayer } from './helpers';

export const createTournamentModelPlayers = (prisma: PrismaClient) => ({
  findPersonByEmailAndPhone: async (email: string, phone: string) => {
    try {
      return await prisma.person.findUnique({
        where: {
          email_phone: {
            email,
            phone,
          },
        },
      });
    } catch (error) {
      logModelError('findPersonByEmailAndPhone', error);
      throw new AppError('Failed to fetch person', 500, 'PERSON_FETCH_FAILED');
    }
  },

  createPerson: async (data: { firstName: string; lastName: string; email?: string; phone?: string }) => {
    try {
      return await prisma.person.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          // eslint-disable-next-line unicorn/no-null
          email: data.email ?? null,
          // eslint-disable-next-line unicorn/no-null
          phone: data.phone ?? null,
        },
      });
    } catch (error) {
      logModelError('createPerson', error);
      throw new AppError('Failed to create person', 500, 'PERSON_CREATE_FAILED');
    }
  },

  updatePerson: async (
    personId: string,
    data: { firstName?: string; lastName?: string; email?: string; phone?: string }
  ) => {
    try {
      return await prisma.person.update({
        where: { id: personId },
        data,
      });
    } catch (error) {
      logModelError('updatePerson', error);
      throw new AppError('Failed to update person', 500, 'PERSON_UPDATE_FAILED');
    }
  },

  getPlayerById: async (playerId: string) => {
    try {
      return await prisma.player.findUnique({ where: { id: playerId } });
    } catch (error) {
      logModelError('getPlayerById', error);
      throw new AppError('Failed to fetch player', 500, 'PLAYER_FETCH_FAILED');
    }
  },

  registerPlayer: async (tournamentId: string, playerId: string): Promise<void> => {
    try {
      await prisma.player.create({
        data: {
          id: playerId,
          tournamentId,
          firstName: 'TBD',
          lastName: 'TBD',
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      logModelError('registerPlayer', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError('Failed to register player', 500, 'PLAYER_REGISTRATION_FAILED');
    }
  },

  createPlayer: async (
    tournamentId: string,
    playerData: {
      personId?: string;
      firstName: string;
      lastName: string;
      surname?: string;
      teamName?: string;
      email?: string;
      phone?: string;
      skillLevel?: SkillLevel;
    }
  ): Promise<Player> => {
    try {
      const player = await prisma.player.create({
        data: {
          tournamentId,
          // eslint-disable-next-line unicorn/no-null
          personId: playerData.personId ?? null,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          // eslint-disable-next-line unicorn/no-null
          surname: playerData.surname ?? null,
          // eslint-disable-next-line unicorn/no-null
          teamName: playerData.teamName ?? null,
          // eslint-disable-next-line unicorn/no-null
          email: playerData.email ?? null,
          // eslint-disable-next-line unicorn/no-null
          phone: playerData.phone ?? null,
          // eslint-disable-next-line unicorn/no-null
          skillLevel: playerData.skillLevel ?? null,
          registeredAt: new Date(),
        },
      });

      return mapToPlayer(player);
    } catch (error) {
      logModelError('createPlayer', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError('Failed to register player', 500, 'PLAYER_REGISTRATION_FAILED');
    }
  },

  unregisterPlayer: async (tournamentId: string, playerId: string): Promise<void> => {
    try {
      const deleted = await prisma.player.deleteMany({
        where: {
          id: playerId,
          tournamentId,
        },
      });

      if (deleted.count === 0) {
        throw new AppError('Player not registered for this tournament', 400, 'PLAYER_NOT_REGISTERED');
      }
    } catch (error) {
      logModelError('unregisterPlayer', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to unregister player', 500, 'PLAYER_UNREGISTRATION_FAILED');
    }
  },

  isPlayerRegistered: async (tournamentId: string, playerId: string): Promise<boolean> => {
    try {
      const player = await prisma.player.findUnique({
        where: {
          id: playerId,
        },
      });
      return player?.tournamentId === tournamentId;
    } catch (error) {
      logModelError('isPlayerRegistered', error);
      return false;
    }
  },

  getParticipantCount: async (tournamentId: string): Promise<number> => {
    try {
      return await prisma.player.count({
        where: {
          tournamentId,
          isActive: true,
        },
      });
    } catch (error) {
      logModelError('getParticipantCount', error);
      return 0;
    }
  },

  getCheckedInCount: async (tournamentId: string): Promise<number> => {
    try {
      return await prisma.player.count({
        where: {
          tournamentId,
          isActive: true,
          checkedIn: true,
        },
      });
    } catch (error) {
      logModelError('getCheckedInCount', error);
      return 0;
    }
  },

  getParticipants: async (tournamentId: string): Promise<Array<{
    playerId: string;
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    name: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
    registeredAt: Date;
    checkedIn: boolean;
  }>> => {
    try {
      const participants = await prisma.player.findMany({
        where: {
          tournamentId,
          isActive: true,
        },
        select: {
          id: true,
          personId: true,
          firstName: true,
          lastName: true,
          surname: true,
          teamName: true,
          email: true,
          phone: true,
          skillLevel: true,
          registeredAt: true,
          checkedIn: true,
        },
        orderBy: {
          registeredAt: 'asc',
        },
      });

  type ParticipantRow = (typeof participants)[number];
  return participants.map((player: ParticipantRow) => ({
        playerId: player.id,
        ...(player.personId ? { personId: player.personId } : {}),
        firstName: player.firstName,
        lastName: player.lastName,
        ...(player.surname ? { surname: player.surname } : {}),
        ...(player.teamName ? { teamName: player.teamName } : {}),
        name: `${player.firstName} ${player.lastName}`,
        ...(player.email ? { email: player.email } : {}),
        ...(player.phone ? { phone: player.phone } : {}),
        ...(player.skillLevel ? { skillLevel: player.skillLevel as SkillLevel } : {}),
        registeredAt: player.registeredAt,
        checkedIn: player.checkedIn,
      }));
    } catch (error) {
      logModelError('getParticipants', error);
      throw new AppError('Failed to fetch tournament participants', 500, 'PARTICIPANTS_FETCH_FAILED');
    }
  },

  getOrphanParticipants: async (): Promise<Array<{
    playerId: string;
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    name: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
    registeredAt: Date;
    checkedIn: boolean;
  }>> => {
    try {
      const participants = await prisma.player.findMany({
        where: {
          // eslint-disable-next-line unicorn/no-null
          tournamentId: null,
          isActive: true,
        },
        select: {
          id: true,
          personId: true,
          firstName: true,
          lastName: true,
          surname: true,
          teamName: true,
          email: true,
          phone: true,
          skillLevel: true,
          registeredAt: true,
          checkedIn: true,
        },
        orderBy: {
          registeredAt: 'asc',
        },
      });

  type ParticipantRow = (typeof participants)[number];
  return participants.map((player: ParticipantRow) => ({
        playerId: player.id,
        ...(player.personId ? { personId: player.personId } : {}),
        firstName: player.firstName,
        lastName: player.lastName,
        ...(player.surname ? { surname: player.surname } : {}),
        ...(player.teamName ? { teamName: player.teamName } : {}),
        name: `${player.firstName} ${player.lastName}`,
        ...(player.email ? { email: player.email } : {}),
        ...(player.phone ? { phone: player.phone } : {}),
        ...(player.skillLevel ? { skillLevel: player.skillLevel as SkillLevel } : {}),
        registeredAt: player.registeredAt,
        checkedIn: player.checkedIn,
      }));
    } catch (error) {
      logModelError('getOrphanParticipants', error);
      throw new AppError('Failed to fetch orphan participants', 500, 'ORPHAN_PARTICIPANTS_FETCH_FAILED');
    }
  },

  deleteOrphanParticipants: async (): Promise<number> => {
    try {
      const result = await prisma.player.deleteMany({
        where: {
          // eslint-disable-next-line unicorn/no-null
          tournamentId: null,
          isActive: true,
          poolAssignments: { none: {} },
          playerMatches: { none: {} },
          bracketEntries: { none: {} },
          wonMatches: { none: {} },
          scores: { none: {} },
          captainOfDoublettes: { none: {} },
          doubletteMemberships: { none: {} },
          captainOfEquipes: { none: {} },
          equipeMemberships: { none: {} },
        },
      });
      return result.count;
    } catch (error) {
      logModelError('deleteOrphanParticipants', error);
      throw new AppError('Failed to delete orphan participants', 500, 'ORPHAN_PARTICIPANTS_DELETE_FAILED');
    }
  },

  updatePlayerCheckIn: async (
    tournamentId: string,
    playerId: string,
    checkedIn: boolean
  ): Promise<Player> => {
    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          checkedIn,
          tournamentId,
        },
      });

      return mapToPlayer(player);
    } catch (error) {
      logModelError('updatePlayerCheckIn', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
      }
      throw new AppError('Failed to update player check-in status', 500, 'PLAYER_CHECKIN_UPDATE_FAILED');
    }
  },

  updatePlayer: async (
    tournamentId: string,
    playerId: string,
    updateData: {
      personId?: string;
      firstName?: string;
      lastName?: string;
      surname?: string;
      teamName?: string;
      email?: string;
      phone?: string;
      skillLevel?: SkillLevel;
    }
  ): Promise<Player> => {
    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          ...updateData,
          tournamentId,
        },
      });

      return mapToPlayer(player);
    } catch (error) {
      logModelError('updatePlayer', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
      }
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Player is already registered for this tournament',
          400,
          'DUPLICATE_REGISTRATION'
        );
      }
      throw new AppError('Failed to update player', 500, 'PLAYER_UPDATE_FAILED');
    }
  },

  findPlayerBySurname: async (
    tournamentId: string,
    surname: string,
    excludePlayerId?: string
  ) => {
    return await prisma.player.findFirst({
      where: {
        tournamentId,
        surname: { equals: surname, mode: 'insensitive' },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
      },
    });
  },

  findPlayerByTeamName: async (
    tournamentId: string,
    teamName: string,
    excludePlayerId?: string
  ) => {
    return await prisma.player.findFirst({
      where: {
        tournamentId,
        teamName: { equals: teamName, mode: 'insensitive' },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
      },
    });
  },

  findPlayerByEmail: async (tournamentId: string, email: string) => {
    return await prisma.player.findFirst({
      where: {
        tournamentId,
        email: { equals: email, mode: 'insensitive' },
      },
    });
  },
});

export type TournamentModelPlayerHandlers = ReturnType<typeof createTournamentModelPlayers>;
