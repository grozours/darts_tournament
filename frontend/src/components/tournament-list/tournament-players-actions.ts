import { useCallback } from 'react';
import { SkillLevel, TournamentFormat } from '@shared/types';
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

type ActionProgress = {
  current: number;
  total: number;
};

type ProgressCallback = (progress: ActionProgress) => void;

const SKILL_LEVELS_FOR_AUTOFILL: SkillLevel[] = [
  SkillLevel.BEGINNER,
  SkillLevel.INTERMEDIATE,
  SkillLevel.EXPERT,
];

const SKILL_STARS: Record<SkillLevel, string> = {
  [SkillLevel.BEGINNER]: '★',
  [SkillLevel.INTERMEDIATE]: '★★',
  [SkillLevel.ADVANCED]: '★★',
  [SkillLevel.EXPERT]: '★★★',
};

const pickRandomAutoFillSkillLevel = (): SkillLevel => {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  const index = random % SKILL_LEVELS_FOR_AUTOFILL.length;
  return SKILL_LEVELS_FOR_AUTOFILL[index] ?? SkillLevel.BEGINNER;
};

const withAutoFillSkillAndSurnameStars = (
  registration: CreatePlayerPayload
): CreatePlayerPayload => {
  const skillLevel = pickRandomAutoFillSkillLevel();
  const stars = SKILL_STARS[skillLevel];
  const baseSurname = registration.surname?.trim();

  return {
    ...registration,
    skillLevel,
    surname: baseSurname ? `${baseSurname} ${stars}` : stars,
  };
};

const decorateAutoFillRegistrations = (registrations: CreatePlayerPayload[]): CreatePlayerPayload[] => (
  registrations.map(withAutoFillSkillAndSurnameStars)
);

const createTemporaryPassword = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(8));
  let token = '';

  for (const value of values) {
    token += alphabet[value % alphabet.length];
  }

  return token;
};

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

const runWithConcurrency = async <TItem>(parameters: {
  items: TItem[];
  concurrency: number;
  worker: (item: TItem, index: number) => Promise<void>;
}): Promise<void> => {
  const { items, concurrency, worker } = parameters;
  if (items.length === 0) {
    return;
  }

  const effectiveConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: effectiveConcurrency }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index];
      if (item === undefined) {
        return;
      }
      await worker(item, index);
    }
  });

  await Promise.all(runners);
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

  const password = `auto-${Date.now().toString(36)}-${createTemporaryPassword()}`;

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
  onStepCompleted?: () => void;
}) => {
  const { tournamentId, token, players, missingPlayersCount, onStepCompleted } = parameters;
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

  const decoratedRegistrations = decorateAutoFillRegistrations(autoRegistrations);

  await runWithConcurrency({
    items: decoratedRegistrations,
    concurrency: 6,
    worker: async (registration) => {
      await registerTournamentPlayer(tournamentId, registration, token);
      onStepCompleted?.();
    },
  });
};

const autoFillGroupTournament = async (parameters: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
  groupConfig: NonNullable<ReturnType<typeof getGroupFormatConfig>>;
  onProgress?: ProgressCallback;
}) => {
  const { tournament, players, token, groupConfig, onProgress } = parameters;

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
  const totalSteps = missingPlayersCount + maxCreatableGroups;
  let completedSteps = 0;
  const reportStepCompleted = () => {
    completedSteps += 1;
    onProgress?.({ current: completedSteps, total: totalSteps });
  };

  if (totalSteps > 0) {
    onProgress?.({ current: 0, total: totalSteps });
  }

  await registerAutoPlayers({
    tournamentId: tournament.id,
    token,
    players,
    missingPlayersCount,
    onStepCompleted: reportStepCompleted,
  });

  const refreshedPlayers = await fetchTournamentPlayers(tournament.id, token);
  const availablePlayers = refreshedPlayers.filter((player) => !groupedPlayerIds.has(player.playerId));

  if (availablePlayers.length < playersNeeded) {
    throw new Error('Not enough available players to create groups automatically.');
  }

  const autoNameSuffix = Date.now().toString(36).toUpperCase();
  const groupPlans: Array<{ memberIds: string[]; index: number }> = [];
  for (let index = 0; index < maxCreatableGroups; index += 1) {
    const start = index * groupConfig.requiredMembers;
    const members = availablePlayers.slice(start, start + groupConfig.requiredMembers);
    const memberIds = members.map((member) => member.playerId).filter((playerId): playerId is string => Boolean(playerId));
    if (memberIds.length !== groupConfig.requiredMembers) {
      throw new Error('Failed to build complete groups for auto-fill.');
    }
    groupPlans.push({ memberIds, index });
  }

  await runWithConcurrency({
    items: groupPlans,
    concurrency: 3,
    worker: async (plan) => {
      await createAndRegisterGroup({
        tournament,
        token,
        groupName: buildAutoGroupName(tournament.format, plan.index, autoNameSuffix),
        memberIds: plan.memberIds,
      });
      reportStepCompleted();
    },
  });
};

const autoFillSingleTournament = async (parameters: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
  onProgress?: ProgressCallback;
}) => {
  const { tournament, players, token, onProgress } = parameters;
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

  const decoratedRegistrations = decorateAutoFillRegistrations(uniqueRegistrations);

  if (decoratedRegistrations.length > 0) {
    onProgress?.({ current: 0, total: decoratedRegistrations.length });
  }

  let completed = 0;

  await runWithConcurrency({
    items: decoratedRegistrations,
    concurrency: 6,
    worker: async (registration) => {
      await registerTournamentPlayer(tournament.id, registration, token);
      completed += 1;
      onProgress?.({ current: completed, total: decoratedRegistrations.length });
    },
  });
};

const autoFillTournamentPlayers = async ({
  tournament,
  players,
  token,
  onProgress,
}: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
  onProgress?: ProgressCallback;
}): Promise<void> => {
  const groupConfig = getGroupFormatConfig(tournament.format);
  if (groupConfig) {
    await autoFillGroupTournament({
      tournament,
      players,
      token,
      groupConfig,
      ...(onProgress ? { onProgress } : {}),
    });

    return;
  }

  await autoFillSingleTournament({
    tournament,
    players,
    token,
    ...(onProgress ? { onProgress } : {}),
  });
};

const confirmAllTournamentPlayers = async ({
  tournament,
  players,
  token,
  onProgress,
}: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
  onProgress?: ProgressCallback;
}): Promise<void> => {
  const pendingPlayers = players.filter((player) => !player.checkedIn);

  if (pendingPlayers.length > 0) {
    onProgress?.({ current: 0, total: pendingPlayers.length });
  }

  let completed = 0;

  await runWithConcurrency({
    items: pendingPlayers,
    concurrency: 8,
    worker: async (player) => {
      await updateTournamentPlayerCheckIn(tournament.id, player.playerId, true, token);
      completed += 1;
      onProgress?.({ current: completed, total: pendingPlayers.length });
    },
  });
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
  setConfirmAllProgress,
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
  setConfirmAllProgress: PlayersStateSetters['setConfirmAllProgress'];
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
    setConfirmAllProgress(undefined);
    setPlayersError(undefined);
    try {
      const token = await getSafeAccessToken();
      await confirmAllTournamentPlayers({
        tournament: editingTournament,
        players,
        token,
        onProgress: setConfirmAllProgress,
      });
      await fetchPlayers(editingTournament.id);
      await refreshTournamentDetails?.(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedConfirmAllPlayers'));
    } finally {
      setIsConfirmingAll(false);
      setConfirmAllProgress(undefined);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, players, refreshTournamentDetails, setConfirmAllProgress, setIsConfirmingAll, setPlayersError, t]);

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
  setAutoFillProgress,
}: {
  t: TournamentPlayersContext['t'];
  editingTournament: Tournament | undefined;
  getSafeAccessToken: TournamentPlayersContext['getSafeAccessToken'];
  players: TournamentPlayer[];
  fetchPlayers: (tournamentId: string) => Promise<void>;
  setPlayersError: PlayersStateSetters['setPlayersError'];
  setIsAutoFillingPlayers: PlayersStateSetters['setIsAutoFillingPlayers'];
  setAutoFillProgress: PlayersStateSetters['setAutoFillProgress'];
}) => {
  const autoFillPlayers = useCallback(async () => {
    if (!editingTournament) return;
    setIsAutoFillingPlayers(true);
    setAutoFillProgress(undefined);
    setPlayersError(undefined);

    try {
      const token = await getSafeAccessToken();
      await autoFillTournamentPlayers({
        tournament: editingTournament,
        players,
        token,
        onProgress: setAutoFillProgress,
      });
      await fetchPlayers(editingTournament.id);
    } catch (error_) {
      setPlayersError(error_ instanceof Error ? error_.message : t('edit.error.failedAutoFillPlayers'));
    } finally {
      setIsAutoFillingPlayers(false);
      setAutoFillProgress(undefined);
    }
  }, [editingTournament, fetchPlayers, getSafeAccessToken, players, setAutoFillProgress, setIsAutoFillingPlayers, setPlayersError, t]);

  return { autoFillPlayers };
};

export {
  autoFillTournamentPlayers,
  confirmAllTournamentPlayers,
  usePlayerRegistrationMutations,
  usePlayerCheckInMutations,
  usePlayerAutoFillMutation,
};
