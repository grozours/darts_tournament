import { useCallback } from 'react';
import { TournamentFormat } from '@shared/types';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import {
  createDoublette,
  createEquipe,
  fetchDoublettes,
  fetchEquipes,
  fetchTournamentPlayers,
  registerDoublette,
  registerEquipe,
  registerTournamentPlayer,
  removeTournamentPlayer,
  updateTournamentPlayer,
  updateTournamentPlayerCheckIn,
} from '../../services/tournament-service';
import { buildAutoFillRegistrations } from './auto-fill-utilities';
import {
  lastNameModifiers,
  sampleFirstNames,
  sampleLastNames,
  sampleSurnames,
  sampleTeams,
  teamModifiers,
} from './auto-fill-constants';
import type { TournamentPlayersContext } from './tournament-players-types';
import type { Tournament } from './types';
import type { PlayersStateSetters } from './tournament-players-state';
import { emptyPlayerForm } from './tournament-players-state';

const getGroupFormatConfig = (format: string) => {
  if (format === TournamentFormat.DOUBLE) {
    return {
      requiredMembers: 2,
    };
  }

  if (format === TournamentFormat.TEAM_4_PLAYER) {
    return {
      requiredMembers: 4,
    };
  }

  return undefined;
};

const buildAutoGroupName = (format: string, index: number, suffix: string) => {
  if (format === TournamentFormat.DOUBLE) {
    return `Auto Doublette ${index + 1} ${suffix}`;
  }
  return `Auto Equipe ${index + 1} ${suffix}`;
};

const createAndRegisterGroup = async (parameters: {
  tournament: Tournament;
  token: string | undefined;
  groupName: string;
  memberIds: string[];
}) => {
  const { tournament, token, groupName, memberIds } = parameters;
  const captainPlayerId = memberIds[0];
  if (!captainPlayerId || memberIds.length === 0) {
    throw new Error('Invalid group composition for auto-fill');
  }

  const password = `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (tournament.format === TournamentFormat.DOUBLE) {
    const created = await createDoublette(
      tournament.id,
      {
        name: groupName,
        password,
        captainPlayerId,
        memberPlayerIds: memberIds,
      },
      token
    );
    await registerDoublette(tournament.id, created.id, token);
    return;
  }

  const created = await createEquipe(
    tournament.id,
    {
      name: groupName,
      password,
      captainPlayerId,
      memberPlayerIds: memberIds,
    },
    token
  );
  await registerEquipe(tournament.id, created.id, token);
};

const registerAutoPlayers = async (parameters: {
  tournamentId: string;
  token: string | undefined;
  players: TournamentPlayer[];
  missingPlayersCount: number;
}) => {
  const { tournamentId, token, players, missingPlayersCount } = parameters;
  if (missingPlayersCount <= 0) {
    return;
  }

  const { registrations: autoRegistrations, error } = buildAutoFillRegistrations({
    remainingSlots: missingPlayersCount,
    players,
    isTeamFormat: true,
    sampleFirstNames,
    sampleLastNames,
    lastNameModifiers,
    sampleSurnames,
    sampleTeams,
    teamModifiers,
  });

  if (error) {
    throw new Error(error);
  }

  for (const registration of autoRegistrations) {
    await registerTournamentPlayer(tournamentId, registration, token);
  }
};

const autoFillGroupTournament = async (parameters: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
  groupConfig: NonNullable<ReturnType<typeof getGroupFormatConfig>>;
}) => {
  const { tournament, players, token, groupConfig } = parameters;

  const existingGroups = tournament.format === TournamentFormat.DOUBLE
    ? await fetchDoublettes(tournament.id, token)
    : await fetchEquipes(tournament.id, token);

  const groupedPlayerIds = new Set(
    existingGroups.flatMap((group) => group.members.map((member) => member.playerId))
  );
  const freePlayers = players.filter((player) => !groupedPlayerIds.has(player.playerId));

  const totalGroupSlots = tournament.totalParticipants || 0;
  const registeredGroups = existingGroups.filter((group) => group.isRegistered).length;
  const remainingGroupSlots = Math.max(totalGroupSlots - registeredGroups, 0);

  const totalPlayerCapacity = totalGroupSlots * groupConfig.requiredMembers;
  const remainingPlayerCapacity = Math.max(totalPlayerCapacity - players.length, 0);

  const maxGroupsByPlayers = Math.floor(
    (freePlayers.length + remainingPlayerCapacity) / groupConfig.requiredMembers
  );
  const maxCreatableGroups = Math.min(remainingGroupSlots, maxGroupsByPlayers);

  if (maxCreatableGroups <= 0) {
    if (remainingGroupSlots === 0) {
      throw new Error('All spots are already filled.');
    }
    throw new Error('Not enough available slots to create a complete group automatically.');
  }

  const playersNeeded = maxCreatableGroups * groupConfig.requiredMembers;
  const missingPlayersCount = Math.max(playersNeeded - freePlayers.length, 0);

  await registerAutoPlayers({
    tournamentId: tournament.id,
    token,
    players,
    missingPlayersCount,
  });

  const refreshedPlayers = await fetchTournamentPlayers(tournament.id, token);
  const availablePlayers = refreshedPlayers.filter((player) => !groupedPlayerIds.has(player.playerId));

  if (availablePlayers.length < playersNeeded) {
    throw new Error('Not enough available players to create groups automatically.');
  }

  const autoNameSuffix = Date.now().toString(36).toUpperCase();
  for (let index = 0; index < maxCreatableGroups; index += 1) {
    const start = index * groupConfig.requiredMembers;
    const members = availablePlayers.slice(start, start + groupConfig.requiredMembers);
    const memberIds = members.map((member) => member.playerId).filter((playerId): playerId is string => Boolean(playerId));
    if (memberIds.length !== groupConfig.requiredMembers) {
      throw new Error('Failed to build complete groups for auto-fill.');
    }

    await createAndRegisterGroup({
      tournament,
      token,
      groupName: buildAutoGroupName(tournament.format, index, autoNameSuffix),
      memberIds,
    });
  }
};

const autoFillSingleTournament = async (parameters: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
}) => {
  const { tournament, players, token } = parameters;
  const totalSlots = tournament.totalParticipants || 0;
  const remainingSlots = Math.max(totalSlots - players.length, 0);
  if (remainingSlots === 0) {
    throw new Error('All spots are already filled.');
  }

  const { registrations: uniqueRegistrations, error } = buildAutoFillRegistrations({
    remainingSlots,
    players,
    isTeamFormat: false,
    sampleFirstNames,
    sampleLastNames,
    lastNameModifiers,
    sampleSurnames,
    sampleTeams,
    teamModifiers,
  });

  if (error) {
    throw new Error(error);
  }

  for (const registration of uniqueRegistrations) {
    await registerTournamentPlayer(tournament.id, registration, token);
  }
};

const autoFillTournamentPlayers = async ({
  tournament,
  players,
  token,
}: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
}): Promise<void> => {
  const groupConfig = getGroupFormatConfig(tournament.format);
  if (groupConfig) {
    await autoFillGroupTournament({ tournament, players, token, groupConfig });

    return;
  }

  await autoFillSingleTournament({ tournament, players, token });
};

const confirmAllTournamentPlayers = async ({
  tournament,
  players,
  token,
}: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
}): Promise<void> => {
  const pendingPlayers = players.filter((player) => !player.checkedIn);

  for (const player of pendingPlayers) {
    await updateTournamentPlayerCheckIn(tournament.id, player.playerId, true, token);
  }
};

const buildPlayerPayload = (playerForm: CreatePlayerPayload): CreatePlayerPayload => {
  const payload: CreatePlayerPayload = {
    firstName: playerForm.firstName.trim(),
    lastName: playerForm.lastName.trim(),
  };
  const surname = playerForm.surname?.trim();
  const teamName = playerForm.teamName?.trim();
  const email = playerForm.email?.trim();
  const phone = playerForm.phone?.trim();
  if (surname) payload.surname = surname;
  if (teamName) payload.teamName = teamName;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (playerForm.skillLevel) payload.skillLevel = playerForm.skillLevel;
  return payload;
};

const usePlayerRegistrationMutations = ({
  t,
  editingTournament,
  getSafeAccessToken,
  playerForm,
  editingPlayerId,
  fetchPlayers,
  cancelEditPlayer,
  setPlayersError,
  setPlayerForm,
  setIsRegisteringPlayer,
}: {
  t: TournamentPlayersContext['t'];
  editingTournament: Tournament | undefined;
  getSafeAccessToken: TournamentPlayersContext['getSafeAccessToken'];
  playerForm: CreatePlayerPayload;
  editingPlayerId: string | undefined;
  fetchPlayers: (tournamentId: string) => Promise<void>;
  cancelEditPlayer: () => void;
  setPlayersError: PlayersStateSetters['setPlayersError'];
  setPlayerForm: PlayersStateSetters['setPlayerForm'];
  setIsRegisteringPlayer: PlayersStateSetters['setIsRegisteringPlayer'];
}) => {
  const registerPlayer = useCallback(async () => {
    if (!editingTournament) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      const payload = buildPlayerPayload(playerForm);
      await registerTournamentPlayer(editingTournament.id, payload, token);
      setPlayerForm(emptyPlayerForm);
      await fetchPlayers(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedRegisterPlayer'));
    } finally {
      setIsRegisteringPlayer(false);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, playerForm, setIsRegisteringPlayer, setPlayerForm, setPlayersError, t]);

  const savePlayerEdit = useCallback(async () => {
    if (!editingTournament || !editingPlayerId) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      const payload = buildPlayerPayload(playerForm);
      await updateTournamentPlayer(editingTournament.id, editingPlayerId, payload, token);
      await fetchPlayers(editingTournament.id);
      cancelEditPlayer();
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdatePlayer'));
    } finally {
      setIsRegisteringPlayer(false);
    }
  }, [cancelEditPlayer, editingPlayerId, editingTournament, fetchPlayers, getSafeAccessToken, playerForm, setIsRegisteringPlayer, setPlayersError, t]);

  const removePlayer = useCallback(async (playerId: string) => {
    if (!editingTournament) return;
    if (!confirm('Remove this player from the tournament?')) return;
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      await removeTournamentPlayer(editingTournament.id, playerId, token);
      await fetchPlayers(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedRemovePlayer'));
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, setPlayersError, t]);

  return {
    registerPlayer,
    savePlayerEdit,
    removePlayer,
  };
};

const usePlayerCheckInMutations = ({
  t,
  editingTournament,
  getSafeAccessToken,
  players,
  fetchPlayers,
  refreshTournamentDetails,
  setPlayersError,
  setCheckingInPlayerId,
  setIsConfirmingAll,
}: {
  t: TournamentPlayersContext['t'];
  editingTournament: Tournament | undefined;
  getSafeAccessToken: TournamentPlayersContext['getSafeAccessToken'];
  players: TournamentPlayer[];
  fetchPlayers: (tournamentId: string) => Promise<void>;
  refreshTournamentDetails: TournamentPlayersContext['refreshTournamentDetails'];
  setPlayersError: PlayersStateSetters['setPlayersError'];
  setCheckingInPlayerId: PlayersStateSetters['setCheckingInPlayerId'];
  setIsConfirmingAll: PlayersStateSetters['setIsConfirmingAll'];
}) => {
  const togglePlayerCheckIn = useCallback(async (player: TournamentPlayer) => {
    if (!editingTournament) return;
    setCheckingInPlayerId(player.playerId);
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updateTournamentPlayerCheckIn(
        editingTournament.id,
        player.playerId,
        !player.checkedIn,
        token
      );
      await fetchPlayers(editingTournament.id);
      await refreshTournamentDetails?.(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdateCheckIn'));
    } finally {
      setCheckingInPlayerId(undefined);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, refreshTournamentDetails, setCheckingInPlayerId, setPlayersError, t]);

  const confirmAllPlayers = useCallback(async () => {
    if (!editingTournament || players.length === 0) return;
    setIsConfirmingAll(true);
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      await confirmAllTournamentPlayers({
        tournament: editingTournament,
        players,
        token,
      });
      await fetchPlayers(editingTournament.id);
      await refreshTournamentDetails?.(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedConfirmAllPlayers'));
    } finally {
      setIsConfirmingAll(false);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, players, refreshTournamentDetails, setIsConfirmingAll, setPlayersError, t]);

  return { togglePlayerCheckIn, confirmAllPlayers };
};

const usePlayerAutoFillMutation = ({
  t,
  editingTournament,
  getSafeAccessToken,
  players,
  fetchPlayers,
  setPlayersError,
  setIsAutoFillingPlayers,
}: {
  t: TournamentPlayersContext['t'];
  editingTournament: Tournament | undefined;
  getSafeAccessToken: TournamentPlayersContext['getSafeAccessToken'];
  players: TournamentPlayer[];
  fetchPlayers: (tournamentId: string) => Promise<void>;
  setPlayersError: PlayersStateSetters['setPlayersError'];
  setIsAutoFillingPlayers: PlayersStateSetters['setIsAutoFillingPlayers'];
}) => {
  const autoFillPlayers = useCallback(async () => {
    if (!editingTournament) return;
    setIsAutoFillingPlayers(true);
    setPlayersError(undefined);

    try {
      const token = await getSafeAccessToken();
      await autoFillTournamentPlayers({
        tournament: editingTournament,
        players,
        token,
      });
      await fetchPlayers(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedAutoFillPlayers'));
    } finally {
      setIsAutoFillingPlayers(false);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, players, setIsAutoFillingPlayers, setPlayersError, t]);

  return { autoFillPlayers };
};

export {
  autoFillTournamentPlayers,
  confirmAllTournamentPlayers,
  usePlayerRegistrationMutations,
  usePlayerCheckInMutations,
  usePlayerAutoFillMutation,
};
