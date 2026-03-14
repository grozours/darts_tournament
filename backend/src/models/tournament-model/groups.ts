import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError } from './helpers';

type GroupMemberPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

type DoubletteMemberWithPlayer = {
  playerId: string;
  joinedAt: Date;
  player: GroupMemberPlayer;
};

type EquipeMemberWithPlayer = {
  playerId: string;
  joinedAt: Date;
  player: GroupMemberPlayer;
};

type DoubletteWithMembers = {
  id: string;
  tournamentId: string;
  captainPlayerId: string | null;
  name: string;
  skillLevel: string | null;
  passwordHash: string;
  isRegistered: boolean;
  registeredAt: Date | null;
  createdAt: Date;
  captain: GroupMemberPlayer | null;
  members: DoubletteMemberWithPlayer[];
};

type EquipeWithMembers = {
  id: string;
  tournamentId: string;
  captainPlayerId: string | null;
  name: string;
  skillLevel: string | null;
  passwordHash: string;
  isRegistered: boolean;
  registeredAt: Date | null;
  createdAt: Date;
  captain: GroupMemberPlayer | null;
  members: EquipeMemberWithPlayer[];
};

type DoubletteMembership = {
  playerId: string;
  doubletteId: string;
};

type EquipeMembership = {
  playerId: string;
  equipeId: string;
};

type GroupSearchPlayer = {
  id: string;
  personId?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  teamName: string | null;
  surname: string | null;
  doubletteMemberships: Array<{ doublette: { id: string; name: string } }>;
  equipeMemberships: Array<{ equipe: { id: string; name: string } }>;
};

type GroupPrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findFirst: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<unknown>;
};

type GroupPrismaClient = {
  doublette: GroupPrismaDelegate;
  doubletteMember: Pick<GroupPrismaDelegate, 'create' | 'deleteMany' | 'findFirst'>;
  equipe: GroupPrismaDelegate;
  equipeMember: Pick<GroupPrismaDelegate, 'create' | 'deleteMany' | 'findFirst'>;
  player: Pick<GroupPrismaDelegate, 'findMany'>;
};

export const createTournamentModelGroups = (prisma: PrismaClient) => {
  const groupPrisma = prisma as unknown as GroupPrismaClient;

  return {
  countRegisteredDoublettes: async (tournamentId: string) => {
    try {
      return await groupPrisma.doublette.count({
        where: {
          tournamentId,
          isRegistered: true,
        },
      });
    } catch (error) {
      logModelError('countRegisteredDoublettes', error);
      throw new AppError('Failed to count registered doublettes', 500, 'DOUBLETTE_COUNT_FAILED');
    }
  },

  countRegisteredEquipes: async (tournamentId: string) => {
    try {
      return await groupPrisma.equipe.count({
        where: {
          tournamentId,
          isRegistered: true,
        },
      });
    } catch (error) {
      logModelError('countRegisteredEquipes', error);
      throw new AppError('Failed to count registered equipes', 500, 'EQUIPE_COUNT_FAILED');
    }
  },

  listDoublettes: async (tournamentId: string, search?: string) => {
    try {
      return await groupPrisma.doublette.findMany({
        where: {
          tournamentId,
          ...(search
            ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  members: {
                    some: {
                      player: {
                        OR: [
                          { firstName: { contains: search, mode: 'insensitive' } },
                          { lastName: { contains: search, mode: 'insensitive' } },
                          { surname: { contains: search, mode: 'insensitive' } },
                          { teamName: { contains: search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
            : {}),
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as DoubletteWithMembers[];
    } catch (error) {
      logModelError('listDoublettes', error);
      throw new AppError('Failed to fetch doublettes', 500, 'DOUBLETTE_FETCH_FAILED');
    }
  },

  getDoubletteById: async (tournamentId: string, doubletteId: string) => {
    try {
      return await groupPrisma.doublette.findFirst({
        where: {
          id: doubletteId,
          tournamentId,
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as DoubletteWithMembers | null;
    } catch (error) {
      logModelError('getDoubletteById', error);
      throw new AppError('Failed to fetch doublette', 500, 'DOUBLETTE_FETCH_FAILED');
    }
  },

  createDoublette: async (data: {
    tournamentId: string;
    captainPlayerId?: string;
    name: string;
    skillLevel?: string | null;
    passwordHash: string;
  }) => {
    try {
      return await groupPrisma.doublette.create({
        data: {
          tournamentId: data.tournamentId,
          captainPlayerId: data.captainPlayerId || null,
          name: data.name,
          ...(data.skillLevel === undefined ? {} : { skillLevel: data.skillLevel }),
          passwordHash: data.passwordHash,
          ...(data.captainPlayerId
            ? {
              members: {
                create: {
                  playerId: data.captainPlayerId,
                },
              },
            }
            : {}),
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as DoubletteWithMembers;
    } catch (error) {
      logModelError('createDoublette', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Doublette name is already used in this tournament',
          400,
          'DOUBLETTE_NAME_ALREADY_USED'
        );
      }
      throw new AppError('Failed to create doublette', 500, 'DOUBLETTE_CREATE_FAILED');
    }
  },

  updateDoublettePassword: async (doubletteId: string, passwordHash: string) => {
    try {
      return await groupPrisma.doublette.update({
        where: { id: doubletteId },
        data: { passwordHash },
      });
    } catch (error) {
      logModelError('updateDoublettePassword', error);
      throw new AppError('Failed to update doublette password', 500, 'DOUBLETTE_PASSWORD_UPDATE_FAILED');
    }
  },

  updateDoublette: async (doubletteId: string, data: { name?: string; skillLevel?: string | null }) => {
    try {
      return await groupPrisma.doublette.update({
        where: { id: doubletteId },
        data,
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as DoubletteWithMembers;
    } catch (error) {
      logModelError('updateDoublette', error);
      throw new AppError('Failed to update doublette', 500, 'DOUBLETTE_UPDATE_FAILED');
    }
  },

  addDoubletteMember: async (doubletteId: string, playerId: string) => {
    try {
      return await groupPrisma.doubletteMember.create({
        data: {
          doubletteId,
          playerId,
        },
      });
    } catch (error) {
      logModelError('addDoubletteMember', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError('Player is already in this doublette', 400, 'DOUBLETTE_MEMBER_ALREADY_EXISTS');
      }
      throw new AppError('Failed to join doublette', 500, 'DOUBLETTE_JOIN_FAILED');
    }
  },

  removeDoubletteMember: async (doubletteId: string, playerId: string) => {
    try {
      await groupPrisma.doubletteMember.deleteMany({
        where: {
          doubletteId,
          playerId,
        },
      });
    } catch (error) {
      logModelError('removeDoubletteMember', error);
      throw new AppError('Failed to leave doublette', 500, 'DOUBLETTE_LEAVE_FAILED');
    }
  },

  updateDoubletteCaptain: async (doubletteId: string, captainPlayerId: string) => {
    try {
      return await groupPrisma.doublette.update({
        where: { id: doubletteId },
        data: { captainPlayerId },
      });
    } catch (error) {
      logModelError('updateDoubletteCaptain', error);
      throw new AppError('Failed to update doublette captain', 500, 'DOUBLETTE_CAPTAIN_UPDATE_FAILED');
    }
  },

  markDoubletteRegistered: async (doubletteId: string) => {
    try {
      return await groupPrisma.doublette.update({
        where: { id: doubletteId },
        data: {
          isRegistered: true,
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      logModelError('markDoubletteRegistered', error);
      throw new AppError('Failed to register doublette', 500, 'DOUBLETTE_REGISTER_FAILED');
    }
  },

  markDoubletteUnregistered: async (doubletteId: string) => {
    try {
      return await groupPrisma.doublette.update({
        where: { id: doubletteId },
        data: {
          isRegistered: false,
          registeredAt: null,
        },
      });
    } catch (error) {
      logModelError('markDoubletteUnregistered', error);
      throw new AppError('Failed to unregister doublette', 500, 'DOUBLETTE_UNREGISTER_FAILED');
    }
  },

  deleteDoublette: async (doubletteId: string) => {
    try {
      await groupPrisma.doublette.delete({
        where: {
          id: doubletteId,
        },
      });
    } catch (error) {
      logModelError('deleteDoublette', error);
      throw new AppError('Failed to delete doublette', 500, 'DOUBLETTE_DELETE_FAILED');
    }
  },

  findDoubletteMembershipByPlayer: async (tournamentId: string, playerId: string) => {
    try {
      return await groupPrisma.doubletteMember.findFirst({
        where: {
          playerId,
          doublette: {
            tournamentId,
          },
        },
      }) as DoubletteMembership | null;
    } catch (error) {
      logModelError('findDoubletteMembershipByPlayer', error);
      throw new AppError('Failed to fetch player doublette membership', 500, 'DOUBLETTE_MEMBERSHIP_FETCH_FAILED');
    }
  },

  listEquipes: async (tournamentId: string, search?: string) => {
    try {
      return await groupPrisma.equipe.findMany({
        where: {
          tournamentId,
          ...(search
            ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  members: {
                    some: {
                      player: {
                        OR: [
                          { firstName: { contains: search, mode: 'insensitive' } },
                          { lastName: { contains: search, mode: 'insensitive' } },
                          { surname: { contains: search, mode: 'insensitive' } },
                          { teamName: { contains: search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
            : {}),
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as EquipeWithMembers[];
    } catch (error) {
      logModelError('listEquipes', error);
      throw new AppError('Failed to fetch equipes', 500, 'EQUIPE_FETCH_FAILED');
    }
  },

  getEquipeById: async (tournamentId: string, equipeId: string) => {
    try {
      return await groupPrisma.equipe.findFirst({
        where: {
          id: equipeId,
          tournamentId,
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as EquipeWithMembers | null;
    } catch (error) {
      logModelError('getEquipeById', error);
      throw new AppError('Failed to fetch equipe', 500, 'EQUIPE_FETCH_FAILED');
    }
  },

  createEquipe: async (data: {
    tournamentId: string;
    captainPlayerId?: string;
    name: string;
    skillLevel?: string | null;
    passwordHash: string;
  }) => {
    try {
      return await groupPrisma.equipe.create({
        data: {
          tournamentId: data.tournamentId,
          captainPlayerId: data.captainPlayerId || null,
          name: data.name,
          ...(data.skillLevel === undefined ? {} : { skillLevel: data.skillLevel }),
          passwordHash: data.passwordHash,
          ...(data.captainPlayerId
            ? {
              members: {
                create: {
                  playerId: data.captainPlayerId,
                },
              },
            }
            : {}),
        },
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as EquipeWithMembers;
    } catch (error) {
      logModelError('createEquipe', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError(
          'Equipe name is already used in this tournament',
          400,
          'EQUIPE_NAME_ALREADY_USED'
        );
      }
      throw new AppError('Failed to create equipe', 500, 'EQUIPE_CREATE_FAILED');
    }
  },

  updateEquipePassword: async (equipeId: string, passwordHash: string) => {
    try {
      return await groupPrisma.equipe.update({
        where: { id: equipeId },
        data: { passwordHash },
      });
    } catch (error) {
      logModelError('updateEquipePassword', error);
      throw new AppError('Failed to update equipe password', 500, 'EQUIPE_PASSWORD_UPDATE_FAILED');
    }
  },

  updateEquipe: async (equipeId: string, data: { name?: string; skillLevel?: string | null }) => {
    try {
      return await groupPrisma.equipe.update({
        where: { id: equipeId },
        data,
        include: {
          captain: true,
          members: {
            include: {
              player: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }) as EquipeWithMembers;
    } catch (error) {
      logModelError('updateEquipe', error);
      throw new AppError('Failed to update equipe', 500, 'EQUIPE_UPDATE_FAILED');
    }
  },

  addEquipeMember: async (equipeId: string, playerId: string) => {
    try {
      return await groupPrisma.equipeMember.create({
        data: {
          equipeId,
          playerId,
        },
      });
    } catch (error) {
      logModelError('addEquipeMember', error);
      if (getPrismaErrorCode(error) === 'P2002') {
        throw new AppError('Player is already in this equipe', 400, 'EQUIPE_MEMBER_ALREADY_EXISTS');
      }
      throw new AppError('Failed to join equipe', 500, 'EQUIPE_JOIN_FAILED');
    }
  },

  removeEquipeMember: async (equipeId: string, playerId: string) => {
    try {
      await groupPrisma.equipeMember.deleteMany({
        where: {
          equipeId,
          playerId,
        },
      });
    } catch (error) {
      logModelError('removeEquipeMember', error);
      throw new AppError('Failed to leave equipe', 500, 'EQUIPE_LEAVE_FAILED');
    }
  },

  updateEquipeCaptain: async (equipeId: string, captainPlayerId: string) => {
    try {
      return await groupPrisma.equipe.update({
        where: { id: equipeId },
        data: { captainPlayerId },
      });
    } catch (error) {
      logModelError('updateEquipeCaptain', error);
      throw new AppError('Failed to update equipe captain', 500, 'EQUIPE_CAPTAIN_UPDATE_FAILED');
    }
  },

  markEquipeRegistered: async (equipeId: string) => {
    try {
      return await groupPrisma.equipe.update({
        where: { id: equipeId },
        data: {
          isRegistered: true,
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      logModelError('markEquipeRegistered', error);
      throw new AppError('Failed to register equipe', 500, 'EQUIPE_REGISTER_FAILED');
    }
  },

  markEquipeUnregistered: async (equipeId: string) => {
    try {
      return await groupPrisma.equipe.update({
        where: { id: equipeId },
        data: {
          isRegistered: false,
          registeredAt: null,
        },
      });
    } catch (error) {
      logModelError('markEquipeUnregistered', error);
      throw new AppError('Failed to unregister equipe', 500, 'EQUIPE_UNREGISTER_FAILED');
    }
  },

  deleteEquipe: async (equipeId: string) => {
    try {
      await groupPrisma.equipe.delete({
        where: {
          id: equipeId,
        },
      });
    } catch (error) {
      logModelError('deleteEquipe', error);
      throw new AppError('Failed to delete equipe', 500, 'EQUIPE_DELETE_FAILED');
    }
  },

  findEquipeMembershipByPlayer: async (tournamentId: string, playerId: string) => {
    try {
      return await groupPrisma.equipeMember.findFirst({
        where: {
          playerId,
          equipe: {
            tournamentId,
          },
        },
      }) as EquipeMembership | null;
    } catch (error) {
      logModelError('findEquipeMembershipByPlayer', error);
      throw new AppError('Failed to fetch player equipe membership', 500, 'EQUIPE_MEMBERSHIP_FETCH_FAILED');
    }
  },

  searchPlayersForGroups: async (tournamentId: string, query: string) => {
    try {
      return await groupPrisma.player.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { surname: { contains: query, mode: 'insensitive' } },
                { teamName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                {
                  doubletteMemberships: {
                    some: {
                      doublette: {
                        name: { contains: query, mode: 'insensitive' },
                      },
                    },
                  },
                },
                {
                  equipeMemberships: {
                    some: {
                      equipe: {
                        name: { contains: query, mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            },
            {
              OR: [
                { tournamentId: null },
                { tournamentId: { not: tournamentId } },
              ],
            },
            {
              NOT: {
                person: {
                  players: {
                    some: {
                      tournamentId,
                    },
                  },
                },
              },
            },
            {
              doubletteMemberships: {
                none: {
                  doublette: {
                    tournamentId,
                  },
                },
              },
            },
            {
              equipeMemberships: {
                none: {
                  equipe: {
                    tournamentId,
                  },
                },
              },
            },
          ],
        },
        include: {
          doubletteMemberships: {
            where: {
              doublette: {
                tournamentId,
              },
            },
            include: {
              doublette: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          equipeMemberships: {
            where: {
              equipe: {
                tournamentId,
              },
            },
            include: {
              equipe: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
        take: 30,
      }) as GroupSearchPlayer[];
    } catch (error) {
      logModelError('searchPlayersForGroups', error);
      throw new AppError('Failed to search players', 500, 'GROUP_PLAYER_SEARCH_FAILED');
    }
  },
  };
};

export type TournamentModelGroupHandlers = ReturnType<typeof createTournamentModelGroups>;
