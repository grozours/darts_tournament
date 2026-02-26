import { useCallback } from 'react';
import { TournamentFormat } from '@shared/types';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import {
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

const autoFillTournamentPlayers = async ({
  tournament,
  players,
  token,
}: {
  tournament: Tournament;
  players: TournamentPlayer[];
  token: string | undefined;
}): Promise<void> => {
  const totalSlots = tournament.totalParticipants || 0;
  const remainingSlots = Math.max(totalSlots - players.length, 0);
  if (remainingSlots === 0) {
    throw new Error('All spots are already filled.');
  }

  const isTeamFormat = tournament.format === TournamentFormat.DOUBLE
    || tournament.format === TournamentFormat.TEAM_4_PLAYER;
  const { registrations: uniqueRegistrations, error } = buildAutoFillRegistrations({
    remainingSlots,
    players,
    isTeamFormat,
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
      console.error('Error registering player:', error_);
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
      console.error('Error updating player:', error_);
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
      console.error('Error removing player:', error_);
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
      console.error('Error updating check-in:', error_);
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
      console.error('Error confirming all players:', error_);
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
      console.error('Error auto-filling players:', error_);
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
