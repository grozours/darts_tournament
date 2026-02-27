import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { TournamentModel } from '../../models/tournament-model';
import type TournamentLogger from '../../utils/tournament-logger';
import { config } from '../../config/environment';
import { AppError } from '../../middleware/error-handler';
import { TournamentFormat, TournamentStatus } from '../../../../shared/src/types';
import { getPlayerCapacityFromSlots } from './slot-capacity';

type GroupHandlerContext = {
  tournamentModel: TournamentModel;
  logger: TournamentLogger;
  validateUUID: (id: string) => void;
  getActorEmail: () => string | undefined;
  isAdminAction: () => boolean;
};

const encodePasswordHash = (password: string) => {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPasswordHash = (password: string, encoded: string) => {
  const [salt, originalHash] = encoded.split(':');
  if (!salt || !originalHash) {
    return false;
  }
  const candidateHash = scryptSync(password, salt, 64).toString('hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  if (originalBuffer.length !== candidateBuffer.length) {
    return false;
  }
  return timingSafeEqual(originalBuffer, candidateBuffer);
};

const splitNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0] ?? 'player';
  const parts = localPart
    .replaceAll(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = parts[0] ?? 'Player';
  const lastName = parts.slice(1).join(' ') || 'Member';
  return { firstName, lastName };
};

const assertTournamentOpenAndCapacity = async (
  context: GroupHandlerContext,
  tournamentId: string
) => {
  const tournament = await context.tournamentModel.findById(tournamentId);
  if (!tournament) {
    throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  }
  if (tournament.status !== TournamentStatus.OPEN) {
    throw new AppError('Tournament registration is not open', 400, 'REGISTRATION_NOT_OPEN');
  }

  if (config.auth.enabled) {
    const now = new Date();
    const registrationDeadline = new Date(tournament.startTime);
    registrationDeadline.setHours(registrationDeadline.getHours() - 1);

    if (now > registrationDeadline) {
      throw new AppError('Registration deadline has passed', 400, 'REGISTRATION_DEADLINE_PASSED');
    }
  }

  return tournament;
};

const ensureFormat = (format: TournamentFormat, expected: TournamentFormat, code: string, message: string) => {
  if (format !== expected) {
    throw new AppError(message, 400, code);
  }
};

const getRegisteredGroupCount = async (
  context: GroupHandlerContext,
  tournamentId: string,
  format: TournamentFormat
) => {
  if (format === TournamentFormat.DOUBLE) {
    return await context.tournamentModel.countRegisteredDoublettes(tournamentId);
  }

  if (format === TournamentFormat.TEAM_4_PLAYER) {
    return await context.tournamentModel.countRegisteredEquipes(tournamentId);
  }

  return await context.tournamentModel.getParticipantCount(tournamentId);
};

const getActorPlayer = async (context: GroupHandlerContext, tournamentId: string) => {
  const actorEmail = context.getActorEmail();
  if (!actorEmail) {
    throw new AppError('Cannot resolve authenticated user email', 403, 'FORBIDDEN');
  }

  const existing = await context.tournamentModel.findPlayerByEmail(tournamentId, actorEmail);
  if (existing) {
    return existing;
  }

  const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
  const currentParticipants = await context.tournamentModel.getParticipantCount(tournamentId);
  const playerCapacity = getPlayerCapacityFromSlots(tournament.totalParticipants, tournament.format);
  if (currentParticipants >= playerCapacity) {
    throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
  }

  const { firstName, lastName } = splitNameFromEmail(actorEmail);
  return await context.tournamentModel.createPlayer(tournamentId, {
    firstName,
    lastName,
    email: actorEmail,
  });
};

const mapGroupResponse = <TGroup extends {
  id: string;
  name: string;
  captainPlayerId?: string | null;
  isRegistered: boolean;
  registeredAt: Date | null;
  createdAt: Date;
  members: Array<{
    joinedAt: Date;
    player: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
  }>;
}>(group: TGroup) => ({
  id: group.id,
  name: group.name,
  captainPlayerId: group.captainPlayerId,
  isRegistered: group.isRegistered,
  registeredAt: group.registeredAt,
  createdAt: group.createdAt,
  memberCount: group.members.length,
  members: group.members.map((member) => ({
    playerId: member.player.id,
    firstName: member.player.firstName,
    lastName: member.player.lastName,
    email: member.player.email,
    joinedAt: member.joinedAt,
  })),
});

const requireCaptain = (
  captainPlayerId: string | null | undefined,
  actorPlayerId: string,
  code: string,
  message: string
) => {
  if (!captainPlayerId) {
    throw new AppError(message, 403, code);
  }
  if (captainPlayerId !== actorPlayerId) {
    throw new AppError(message, 403, code);
  }
};

const requireCaptainOrAdmin = (
  context: GroupHandlerContext,
  captainPlayerId: string | null | undefined,
  actorPlayerId: string,
  code: string,
  message: string
) => {
  if (context.isAdminAction()) {
    return;
  }
  requireCaptain(captainPlayerId, actorPlayerId, code, message);
};

const resolveCaptainPlayerId = (
  isAdmin: boolean,
  actorPlayerId: string | undefined,
  payloadCaptainPlayerId: string | undefined,
  memberPlayerIds: string[] | undefined
) => {
  if (isAdmin) {
    return payloadCaptainPlayerId ?? memberPlayerIds?.[0];
  }
  return actorPlayerId;
};

const addAdminMembersToDoublette = async (
  context: GroupHandlerContext,
  parameters: {
    isAdmin: boolean;
    captainPlayerId: string | undefined;
    tournamentId: string;
    doubletteId: string;
    initialMemberCount: number;
    memberPlayerIds?: string[];
  }
) => {
  const {
    isAdmin,
    captainPlayerId,
    tournamentId,
    doubletteId,
    initialMemberCount,
    memberPlayerIds,
  } = parameters;

  if (!isAdmin || !captainPlayerId) {
    return undefined;
  }

  const memberIds = (memberPlayerIds ?? []).filter((playerId) => playerId !== captainPlayerId);
  let currentCount = initialMemberCount;

  for (const playerId of memberIds) {
    if (currentCount >= 2) {
      break;
    }

    const existingMembership = await context.tournamentModel.findDoubletteMembershipByPlayer(
      tournamentId,
      playerId
    );
    if (existingMembership) {
      continue;
    }

    await context.tournamentModel.addDoubletteMember(doubletteId, playerId);
    currentCount += 1;
  }

  return await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
};

const addAdminMembersToEquipe = async (
  context: GroupHandlerContext,
  parameters: {
    isAdmin: boolean;
    captainPlayerId: string | undefined;
    tournamentId: string;
    equipeId: string;
    initialMemberCount: number;
    memberPlayerIds?: string[];
  }
) => {
  const {
    isAdmin,
    captainPlayerId,
    tournamentId,
    equipeId,
    initialMemberCount,
    memberPlayerIds,
  } = parameters;

  if (!isAdmin || !captainPlayerId) {
    return undefined;
  }

  const memberIds = (memberPlayerIds ?? []).filter((playerId) => playerId !== captainPlayerId);
  let currentCount = initialMemberCount;

  for (const playerId of memberIds) {
    if (currentCount >= 4) {
      break;
    }

    const existingMembership = await context.tournamentModel.findEquipeMembershipByPlayer(
      tournamentId,
      playerId
    );
    if (existingMembership) {
      continue;
    }

    await context.tournamentModel.addEquipeMember(equipeId, playerId);
    currentCount += 1;
  }

  return await context.tournamentModel.getEquipeById(tournamentId, equipeId);
};

export const createGroupHandlers = (context: GroupHandlerContext) => ({
  listDoublettes: async (tournamentId: string, search?: string) => {
    context.validateUUID(tournamentId);
    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    ensureFormat(
      tournament.format,
      TournamentFormat.DOUBLE,
      'TOURNAMENT_FORMAT_NOT_DOUBLETTE',
      'Doublettes are only available for DOUBLE tournaments'
    );

    const doublettes = await context.tournamentModel.listDoublettes(tournamentId, search);
    return doublettes.map(mapGroupResponse);
  },

  createDoublette: async (
    tournamentId: string,
    payload: { name: string; password: string; captainPlayerId?: string; memberPlayerIds?: string[] }
  ) => {
    context.validateUUID(tournamentId);
    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.DOUBLE,
      'TOURNAMENT_FORMAT_NOT_DOUBLETTE',
      'Doublettes are only available for DOUBLE tournaments'
    );

    const isAdmin = context.isAdminAction();
    const actorPlayer = isAdmin ? undefined : await getActorPlayer(context, tournamentId);
    const captainPlayerId = resolveCaptainPlayerId(
      isAdmin,
      actorPlayer?.id,
      payload.captainPlayerId,
      payload.memberPlayerIds
    );

    if (captainPlayerId) {
      const existingCaptainMembership = await context.tournamentModel.findDoubletteMembershipByPlayer(
        tournamentId,
        captainPlayerId
      );
      if (existingCaptainMembership) {
        throw new AppError('Captain is already part of a doublette for this tournament', 400, 'PLAYER_ALREADY_IN_DOUBLETTE');
      }
    }

    const doublette = await context.tournamentModel.createDoublette({
      tournamentId,
      ...(captainPlayerId ? { captainPlayerId } : {}),
      name: payload.name.trim(),
      passwordHash: encodePasswordHash(payload.password),
    });

    const updatedDoublette = await addAdminMembersToDoublette(context, {
      isAdmin,
      captainPlayerId,
      tournamentId,
      doubletteId: doublette.id,
      initialMemberCount: doublette.members.length,
      ...(payload.memberPlayerIds ? { memberPlayerIds: payload.memberPlayerIds } : {}),
    });

    if (updatedDoublette) {
      return mapGroupResponse(updatedDoublette);
    }

    return mapGroupResponse(doublette);
  },

  updateDoublette: async (tournamentId: string, doubletteId: string, payload: { name?: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    const isMember = doublette.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify a doublette you belong to', 403, 'DOUBLETTE_FORBIDDEN');
    }

    requireCaptainOrAdmin(
      context,
      doublette.captainPlayerId,
      actorPlayer.id,
      'DOUBLETTE_CAPTAIN_REQUIRED',
      'Only the captain can modify this doublette'
    );

    const updated = await context.tournamentModel.updateDoublette(doubletteId, {
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
    });
    return mapGroupResponse(updated);
  },

  joinDoublette: async (tournamentId: string, doubletteId: string, payload: { password: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.DOUBLE,
      'TOURNAMENT_FORMAT_NOT_DOUBLETTE',
      'Doublettes are only available for DOUBLE tournaments'
    );

    const actorPlayer = await getActorPlayer(context, tournamentId);

    const membership = await context.tournamentModel.findDoubletteMembershipByPlayer(tournamentId, actorPlayer.id);
    if (membership) {
      throw new AppError('Player is already in a doublette', 400, 'PLAYER_ALREADY_IN_DOUBLETTE');
    }

    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }
    if (doublette.isRegistered) {
      throw new AppError('Cannot join a registered doublette', 400, 'DOUBLETTE_ALREADY_REGISTERED');
    }
    if (doublette.members.length >= 2) {
      throw new AppError('Doublette is already full', 400, 'DOUBLETTE_FULL');
    }
    if (!verifyPasswordHash(payload.password, doublette.passwordHash)) {
      throw new AppError('Invalid doublette password', 400, 'DOUBLETTE_INVALID_PASSWORD');
    }

    await context.tournamentModel.addDoubletteMember(doubletteId, actorPlayer.id);

    if (!doublette.captainPlayerId && doublette.members.length === 0) {
      await context.tournamentModel.updateDoubletteCaptain(doubletteId, actorPlayer.id);
    }

    const updated = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!updated) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  leaveDoublette: async (tournamentId: string, doubletteId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }
    if (doublette.isRegistered) {
      throw new AppError('Registered doublette cannot be modified', 400, 'DOUBLETTE_LOCKED');
    }

    const isMember = doublette.members.some((member) => member.player.id === actorPlayer.id);
    if (!isMember) {
      throw new AppError('Player is not in this doublette', 403, 'DOUBLETTE_FORBIDDEN');
    }

    if (doublette.captainPlayerId === actorPlayer.id) {
      if (doublette.members.length <= 1) {
        await context.tournamentModel.deleteDoublette(doubletteId);
        return { deleted: true };
      }
      const nextCaptain = doublette.members.find((member) => member.player.id !== actorPlayer.id);
      if (!nextCaptain) {
        throw new AppError('Cannot determine next captain', 500, 'DOUBLETTE_CAPTAIN_UPDATE_FAILED');
      }
      await context.tournamentModel.updateDoubletteCaptain(doubletteId, nextCaptain.player.id);
    }

    await context.tournamentModel.removeDoubletteMember(doubletteId, actorPlayer.id);
    const updated = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!updated) {
      return { deleted: true };
    }
    return { deleted: false, doublette: mapGroupResponse(updated) };
  },

  registerDoublette: async (tournamentId: string, doubletteId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.DOUBLE,
      'TOURNAMENT_FORMAT_NOT_DOUBLETTE',
      'Doublettes are only available for DOUBLE tournaments'
    );

    const isAdmin = context.isAdminAction();
    const actorPlayer = isAdmin ? undefined : await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    if (!doublette.captainPlayerId) {
      throw new AppError('Doublette must have a captain before registration', 400, 'DOUBLETTE_CAPTAIN_REQUIRED');
    }

    if (!isAdmin) {
      requireCaptainOrAdmin(
        context,
        doublette.captainPlayerId,
        actorPlayer!.id,
        'DOUBLETTE_CAPTAIN_REQUIRED',
        'Only the captain can register this doublette'
      );
    }

    if (doublette.members.length !== 2) {
      throw new AppError('Doublette must have exactly 2 members', 400, 'DOUBLETTE_INCOMPLETE');
    }

    const registeredDoublettes = await getRegisteredGroupCount(
      context,
      tournamentId,
      tournament.format
    );
    if (!doublette.isRegistered && registeredDoublettes >= tournament.totalParticipants) {
      throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
    }

    if (!doublette.isRegistered) {
      await context.tournamentModel.markDoubletteRegistered(doubletteId);
    }

    const updated = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!updated) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    return mapGroupResponse(updated);
  },

  deleteDoublette: async (tournamentId: string, doubletteId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    requireCaptainOrAdmin(
      context,
      doublette.captainPlayerId,
      actorPlayer.id,
      'DOUBLETTE_CAPTAIN_REQUIRED',
      'Only the captain can delete this doublette'
    );

    if (doublette.isRegistered && !context.isAdminAction()) {
      throw new AppError('Registered doublette cannot be deleted', 400, 'DOUBLETTE_LOCKED');
    }

    await context.tournamentModel.deleteDoublette(doubletteId);
  },

  updateDoublettePassword: async (
    tournamentId: string,
    doubletteId: string,
    payload: { password: string }
  ) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    requireCaptainOrAdmin(
      context,
      doublette.captainPlayerId,
      actorPlayer.id,
      'DOUBLETTE_CAPTAIN_REQUIRED',
      'Only the captain can update this doublette password'
    );

    await context.tournamentModel.updateDoublettePassword(doubletteId, encodePasswordHash(payload.password));
  },

  addDoubletteMember: async (tournamentId: string, doubletteId: string, payload: { playerId: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);
    context.validateUUID(payload.playerId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    const isMember = doublette.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify a doublette you belong to', 403, 'DOUBLETTE_FORBIDDEN');
    }
    requireCaptainOrAdmin(
      context,
      doublette.captainPlayerId,
      actorPlayer.id,
      'DOUBLETTE_CAPTAIN_REQUIRED',
      'Only the captain can add a member'
    );

    if (doublette.members.length >= 2) {
      throw new AppError('Doublette is already full', 400, 'DOUBLETTE_FULL');
    }

    const existingMembership = await context.tournamentModel.findDoubletteMembershipByPlayer(
      tournamentId,
      payload.playerId
    );
    if (existingMembership) {
      throw new AppError('Player is already part of a doublette for this tournament', 400, 'PLAYER_ALREADY_IN_DOUBLETTE');
    }

    await context.tournamentModel.addDoubletteMember(doubletteId, payload.playerId);
    const updated = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!updated) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  removeDoubletteMember: async (tournamentId: string, doubletteId: string, playerId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(doubletteId);
    context.validateUUID(playerId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const doublette = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!doublette) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }

    const isMember = doublette.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify a doublette you belong to', 403, 'DOUBLETTE_FORBIDDEN');
    }
    requireCaptainOrAdmin(
      context,
      doublette.captainPlayerId,
      actorPlayer.id,
      'DOUBLETTE_CAPTAIN_REQUIRED',
      'Only the captain can remove a member'
    );

    if (playerId === doublette.captainPlayerId) {
      throw new AppError('Captain cannot be removed directly', 400, 'DOUBLETTE_CAPTAIN_REMOVE_FORBIDDEN');
    }

    await context.tournamentModel.removeDoubletteMember(doubletteId, playerId);
    const updated = await context.tournamentModel.getDoubletteById(tournamentId, doubletteId);
    if (!updated) {
      throw new AppError('Doublette not found', 404, 'DOUBLETTE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  listEquipes: async (tournamentId: string, search?: string) => {
    context.validateUUID(tournamentId);
    const tournament = await context.tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    ensureFormat(
      tournament.format,
      TournamentFormat.TEAM_4_PLAYER,
      'TOURNAMENT_FORMAT_NOT_EQUIPE',
      'Equipes are only available for TEAM_4_PLAYER tournaments'
    );

    const equipes = await context.tournamentModel.listEquipes(tournamentId, search);
    return equipes.map(mapGroupResponse);
  },

  createEquipe: async (
    tournamentId: string,
    payload: { name: string; password: string; captainPlayerId?: string; memberPlayerIds?: string[] }
  ) => {
    context.validateUUID(tournamentId);
    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.TEAM_4_PLAYER,
      'TOURNAMENT_FORMAT_NOT_EQUIPE',
      'Equipes are only available for TEAM_4_PLAYER tournaments'
    );

    const isAdmin = context.isAdminAction();
    const actorPlayer = isAdmin ? undefined : await getActorPlayer(context, tournamentId);
    const captainPlayerId = resolveCaptainPlayerId(
      isAdmin,
      actorPlayer?.id,
      payload.captainPlayerId,
      payload.memberPlayerIds
    );

    if (captainPlayerId) {
      const existingCaptainMembership = await context.tournamentModel.findEquipeMembershipByPlayer(
        tournamentId,
        captainPlayerId
      );
      if (existingCaptainMembership) {
        throw new AppError('Captain is already part of an equipe for this tournament', 400, 'PLAYER_ALREADY_IN_EQUIPE');
      }
    }

    const equipe = await context.tournamentModel.createEquipe({
      tournamentId,
      ...(captainPlayerId ? { captainPlayerId } : {}),
      name: payload.name.trim(),
      passwordHash: encodePasswordHash(payload.password),
    });

    const updatedEquipe = await addAdminMembersToEquipe(context, {
      isAdmin,
      captainPlayerId,
      tournamentId,
      equipeId: equipe.id,
      initialMemberCount: equipe.members.length,
      ...(payload.memberPlayerIds ? { memberPlayerIds: payload.memberPlayerIds } : {}),
    });

    if (updatedEquipe) {
      return mapGroupResponse(updatedEquipe);
    }

    return mapGroupResponse(equipe);
  },

  updateEquipe: async (tournamentId: string, equipeId: string, payload: { name?: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    const isMember = equipe.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify an equipe you belong to', 403, 'EQUIPE_FORBIDDEN');
    }
    requireCaptainOrAdmin(
      context,
      equipe.captainPlayerId,
      actorPlayer.id,
      'EQUIPE_CAPTAIN_REQUIRED',
      'Only the captain can modify this equipe'
    );

    const updated = await context.tournamentModel.updateEquipe(equipeId, {
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
    });
    return mapGroupResponse(updated);
  },

  joinEquipe: async (tournamentId: string, equipeId: string, payload: { password: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.TEAM_4_PLAYER,
      'TOURNAMENT_FORMAT_NOT_EQUIPE',
      'Equipes are only available for TEAM_4_PLAYER tournaments'
    );

    const actorPlayer = await getActorPlayer(context, tournamentId);

    const membership = await context.tournamentModel.findEquipeMembershipByPlayer(tournamentId, actorPlayer.id);
    if (membership) {
      throw new AppError('Player is already in an equipe', 400, 'PLAYER_ALREADY_IN_EQUIPE');
    }

    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }
    if (equipe.isRegistered) {
      throw new AppError('Cannot join a registered equipe', 400, 'EQUIPE_ALREADY_REGISTERED');
    }
    if (equipe.members.length >= 4) {
      throw new AppError('Equipe is already full', 400, 'EQUIPE_FULL');
    }
    if (!verifyPasswordHash(payload.password, equipe.passwordHash)) {
      throw new AppError('Invalid equipe password', 400, 'EQUIPE_INVALID_PASSWORD');
    }

    await context.tournamentModel.addEquipeMember(equipeId, actorPlayer.id);

    if (!equipe.captainPlayerId && equipe.members.length === 0) {
      await context.tournamentModel.updateEquipeCaptain(equipeId, actorPlayer.id);
    }

    const updated = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!updated) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  leaveEquipe: async (tournamentId: string, equipeId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }
    if (equipe.isRegistered) {
      throw new AppError('Registered equipe cannot be modified', 400, 'EQUIPE_LOCKED');
    }

    const isMember = equipe.members.some((member) => member.player.id === actorPlayer.id);
    if (!isMember) {
      throw new AppError('Player is not in this equipe', 403, 'EQUIPE_FORBIDDEN');
    }

    if (equipe.captainPlayerId === actorPlayer.id) {
      if (equipe.members.length <= 1) {
        await context.tournamentModel.deleteEquipe(equipeId);
        return { deleted: true };
      }
      const nextCaptain = equipe.members.find((member) => member.player.id !== actorPlayer.id);
      if (!nextCaptain) {
        throw new AppError('Cannot determine next captain', 500, 'EQUIPE_CAPTAIN_UPDATE_FAILED');
      }
      await context.tournamentModel.updateEquipeCaptain(equipeId, nextCaptain.player.id);
    }

    await context.tournamentModel.removeEquipeMember(equipeId, actorPlayer.id);
    const updated = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!updated) {
      return { deleted: true };
    }
    return { deleted: false, equipe: mapGroupResponse(updated) };
  },

  registerEquipe: async (tournamentId: string, equipeId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const tournament = await assertTournamentOpenAndCapacity(context, tournamentId);
    ensureFormat(
      tournament.format,
      TournamentFormat.TEAM_4_PLAYER,
      'TOURNAMENT_FORMAT_NOT_EQUIPE',
      'Equipes are only available for TEAM_4_PLAYER tournaments'
    );

    const isAdmin = context.isAdminAction();
    const actorPlayer = isAdmin ? undefined : await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    if (!equipe.captainPlayerId) {
      throw new AppError('Equipe must have a captain before registration', 400, 'EQUIPE_CAPTAIN_REQUIRED');
    }

    if (!isAdmin) {
      requireCaptainOrAdmin(
        context,
        equipe.captainPlayerId,
        actorPlayer!.id,
        'EQUIPE_CAPTAIN_REQUIRED',
        'Only the captain can register this equipe'
      );
    }

    if (equipe.members.length !== 4) {
      throw new AppError('Equipe must have exactly 4 members', 400, 'EQUIPE_INCOMPLETE');
    }

    const registeredEquipes = await getRegisteredGroupCount(
      context,
      tournamentId,
      tournament.format
    );
    if (!equipe.isRegistered && registeredEquipes >= tournament.totalParticipants) {
      throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
    }

    if (!equipe.isRegistered) {
      await context.tournamentModel.markEquipeRegistered(equipeId);
    }

    const updated = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!updated) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    return mapGroupResponse(updated);
  },

  deleteEquipe: async (tournamentId: string, equipeId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    requireCaptainOrAdmin(
      context,
      equipe.captainPlayerId,
      actorPlayer.id,
      'EQUIPE_CAPTAIN_REQUIRED',
      'Only the captain can delete this equipe'
    );

    if (equipe.isRegistered && !context.isAdminAction()) {
      throw new AppError('Registered equipe cannot be deleted', 400, 'EQUIPE_LOCKED');
    }

    await context.tournamentModel.deleteEquipe(equipeId);
  },

  updateEquipePassword: async (
    tournamentId: string,
    equipeId: string,
    payload: { password: string }
  ) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    requireCaptainOrAdmin(
      context,
      equipe.captainPlayerId,
      actorPlayer.id,
      'EQUIPE_CAPTAIN_REQUIRED',
      'Only the captain can update this equipe password'
    );

    await context.tournamentModel.updateEquipePassword(equipeId, encodePasswordHash(payload.password));
  },

  addEquipeMember: async (tournamentId: string, equipeId: string, payload: { playerId: string }) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);
    context.validateUUID(payload.playerId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    const isMember = equipe.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify an equipe you belong to', 403, 'EQUIPE_FORBIDDEN');
    }
    requireCaptainOrAdmin(
      context,
      equipe.captainPlayerId,
      actorPlayer.id,
      'EQUIPE_CAPTAIN_REQUIRED',
      'Only the captain can add a member'
    );

    if (equipe.members.length >= 4) {
      throw new AppError('Equipe is already full', 400, 'EQUIPE_FULL');
    }

    const existingMembership = await context.tournamentModel.findEquipeMembershipByPlayer(
      tournamentId,
      payload.playerId
    );
    if (existingMembership) {
      throw new AppError('Player is already part of an equipe for this tournament', 400, 'PLAYER_ALREADY_IN_EQUIPE');
    }

    await context.tournamentModel.addEquipeMember(equipeId, payload.playerId);
    const updated = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!updated) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  removeEquipeMember: async (tournamentId: string, equipeId: string, playerId: string) => {
    context.validateUUID(tournamentId);
    context.validateUUID(equipeId);
    context.validateUUID(playerId);

    const actorPlayer = await getActorPlayer(context, tournamentId);
    const equipe = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!equipe) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }

    const isMember = equipe.members.some((member) => member.player.id === actorPlayer.id);
    if (!context.isAdminAction() && !isMember) {
      throw new AppError('You can only modify an equipe you belong to', 403, 'EQUIPE_FORBIDDEN');
    }
    requireCaptainOrAdmin(
      context,
      equipe.captainPlayerId,
      actorPlayer.id,
      'EQUIPE_CAPTAIN_REQUIRED',
      'Only the captain can remove a member'
    );

    if (playerId === equipe.captainPlayerId) {
      throw new AppError('Captain cannot be removed directly', 400, 'EQUIPE_CAPTAIN_REMOVE_FORBIDDEN');
    }

    await context.tournamentModel.removeEquipeMember(equipeId, playerId);
    const updated = await context.tournamentModel.getEquipeById(tournamentId, equipeId);
    if (!updated) {
      throw new AppError('Equipe not found', 404, 'EQUIPE_NOT_FOUND');
    }
    return mapGroupResponse(updated);
  },

  searchGroupPlayers: async (tournamentId: string, query: string) => {
    context.validateUUID(tournamentId);
    const players = await context.tournamentModel.searchPlayersForGroups(tournamentId, query);
    return players.map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      teamName: player.teamName,
      surname: player.surname,
      doublettes: player.doubletteMemberships.map((membership) => ({
        id: membership.doublette.id,
        name: membership.doublette.name,
      })),
      equipes: player.equipeMemberships.map((membership) => ({
        id: membership.equipe.id,
        name: membership.equipe.name,
      })),
    }));
  },
});
