import type { TournamentModel } from '../../models/tournament-model';
import type TournamentLogger from '../../utils/tournament-logger';
import type { CreatePlayerRequest, SkillLevel, Tournament } from '../../../../shared/src/types';
import { TournamentFormat, TournamentStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';

export type PlayerHelperContext = {
  tournamentModel: TournamentModel;
  logger: TournamentLogger;
};

export const isSafeEmailFormat = (email: string): boolean => {
  if (!email || email.includes(' ') || email.length > 254) {
    return false;
  }
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    return false;
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!local || !domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }
  return true;
};

export const validatePlayerData = (data: CreatePlayerRequest): void => {
  if (!data.firstName || data.firstName.trim().length < 2) {
    throw new AppError('First name must be at least 2 characters long', 400, 'INVALID_FIRST_NAME');
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    throw new AppError('Last name must be at least 2 characters long', 400, 'INVALID_LAST_NAME');
  }

  if (data.surname && data.surname.trim().length > 50) {
    throw new AppError('Surname must be less than 50 characters', 400, 'INVALID_SURNAME');
  }

  if (data.teamName && data.teamName.trim().length > 100) {
    throw new AppError('Team name must be less than 100 characters', 400, 'INVALID_TEAM_NAME');
  }

  if (data.email && !isSafeEmailFormat(data.email)) {
    throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
  }
};

export const ensureUniqueSurname = async (
  context: PlayerHelperContext,
  tournamentId: string,
  surname: string,
  excludePlayerId?: string
): Promise<void> => {
  const trimmed = surname.trim();
  if (!trimmed) return;
  const existing = await context.tournamentModel.findPlayerBySurname(
    tournamentId,
    trimmed,
    excludePlayerId
  );
  if (existing) {
    throw new AppError('Surname is already used by another player in this tournament', 400, 'DUPLICATE_SURNAME');
  }
};

export const ensureUniqueTeamName = async (
  context: PlayerHelperContext,
  tournamentId: string,
  teamName: string,
  excludePlayerId?: string
): Promise<void> => {
  const trimmed = teamName.trim();
  if (!trimmed) return;
  const existing = await context.tournamentModel.findPlayerByTeamName(
    tournamentId,
    trimmed,
    excludePlayerId
  );
  if (existing) {
    throw new AppError('Team name is already used by another player in this tournament', 400, 'DUPLICATE_TEAM_NAME');
  }
};

export const buildPlayerPayload = async (
  context: PlayerHelperContext,
  playerData: CreatePlayerRequest,
  personIdOverride?: string
) => {
  const payload: {
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    email?: string;
    skillLevel?: SkillLevel;
  } = {
    firstName: playerData.firstName.trim(),
    lastName: playerData.lastName.trim(),
  };

  payload.personId = personIdOverride
    ? personIdOverride
    : await resolvePersonId(
      context,
      payload.firstName,
      payload.lastName,
      playerData.surname,
      playerData.email,
      playerData.skillLevel
    );

  if (playerData.surname?.trim()) {
    payload.surname = playerData.surname.trim();
  }

  if (playerData.teamName?.trim()) {
    payload.teamName = playerData.teamName.trim();
  }

  if (playerData.email?.trim()) {
    payload.email = playerData.email.trim();
  }

  if (playerData.skillLevel) {
    payload.skillLevel = playerData.skillLevel;
  }

  return payload;
};

export const resolvePersonId = async (
  context: PlayerHelperContext,
  firstName: string,
  lastName: string,
  surname?: string,
  email?: string,
  skillLevel?: SkillLevel
): Promise<string> => {
  const normalizedEmail = email?.trim();
  if (normalizedEmail) {
    const existingPerson = await context.tournamentModel.findPersonByEmailAndPhone(
      normalizedEmail,
      ''
    );
    if (existingPerson) {
      if (skillLevel) {
        await context.tournamentModel.updatePerson(existingPerson.id, { skillLevel });
      }
      return existingPerson.id;
    }
  }

  const createdPerson = await context.tournamentModel.createPerson({
    firstName,
    lastName,
    ...(surname?.trim() ? { surname: surname.trim() } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(skillLevel ? { skillLevel } : {}),
  });
  return createdPerson.id;
};

export const ensureTournamentAllowsPlayerUpdate = (tournament: Tournament): void => {
  const editableStatuses = [
    TournamentStatus.DRAFT,
    TournamentStatus.OPEN,
    TournamentStatus.SIGNATURE,
    TournamentStatus.LIVE,
  ];
  if (!editableStatuses.includes(tournament.status)) {
    throw new AppError('Cannot update player details for this tournament status', 400, 'PLAYER_UPDATE_NOT_ALLOWED');
  }
};

export const updateLinkedPerson = async (
  context: PlayerHelperContext,
  personId: string,
  updateData: CreatePlayerRequest
): Promise<void> => {
  const personUpdate = {
    firstName: updateData.firstName.trim(),
    lastName: updateData.lastName.trim(),
    ...(updateData.surname?.trim() ? { surname: updateData.surname.trim() } : {}),
    ...(updateData.email?.trim() ? { email: updateData.email.trim() } : {}),
    ...(updateData.skillLevel ? { skillLevel: updateData.skillLevel } : {}),
  };
  await context.tournamentModel.updatePerson(personId, personUpdate);
};

export const ensureUniquePlayerAttributes = async (
  context: PlayerHelperContext,
  tournament: Tournament,
  tournamentId: string,
  updateData: CreatePlayerRequest,
  playerId: string
): Promise<void> => {
  if (updateData.surname?.trim()) {
    await ensureUniqueSurname(context, tournamentId, updateData.surname, playerId);
  }

  const needsUniqueTeam =
    tournament.format === TournamentFormat.DOUBLE ||
    tournament.format === TournamentFormat.TEAM_4_PLAYER;
  if (updateData.teamName?.trim() && needsUniqueTeam) {
    await ensureUniqueTeamName(context, tournamentId, updateData.teamName, playerId);
  }
};

export const buildPlayerUpdate = (updateData: CreatePlayerRequest, personId?: string | null) => ({
  ...(personId ? { personId } : {}),
  firstName: updateData.firstName.trim(),
  lastName: updateData.lastName.trim(),
  ...(updateData.surname?.trim() ? { surname: updateData.surname.trim() } : {}),
  ...(updateData.teamName?.trim() ? { teamName: updateData.teamName.trim() } : {}),
  ...(updateData.email?.trim() ? { email: updateData.email.trim() } : {}),
  ...(updateData.skillLevel ? { skillLevel: updateData.skillLevel } : {}),
});
