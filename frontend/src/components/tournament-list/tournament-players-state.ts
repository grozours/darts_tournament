import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import { fetchTournamentPlayers } from '../../services/tournament-service';
import type { TournamentPlayersContext } from './tournament-players-types';

type PlayersState = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId: string | undefined;
  checkingInPlayerId: string | undefined;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  isConfirmingAll: boolean;
  autoFillProgress: { current: number; total: number } | undefined;
  confirmAllProgress: { current: number; total: number } | undefined;
};

type PlayersStateSetters = {
  setPlayers: Dispatch<SetStateAction<TournamentPlayer[]>>;
  setPlayersLoading: Dispatch<SetStateAction<boolean>>;
  setPlayersError: Dispatch<SetStateAction<string | undefined>>;
  setPlayerForm: Dispatch<SetStateAction<CreatePlayerPayload>>;
  setEditingPlayerId: Dispatch<SetStateAction<string | undefined>>;
  setCheckingInPlayerId: Dispatch<SetStateAction<string | undefined>>;
  setIsRegisteringPlayer: Dispatch<SetStateAction<boolean>>;
  setIsAutoFillingPlayers: Dispatch<SetStateAction<boolean>>;
  setIsConfirmingAll: Dispatch<SetStateAction<boolean>>;
  setAutoFillProgress: Dispatch<SetStateAction<{ current: number; total: number } | undefined>>;
  setConfirmAllProgress: Dispatch<SetStateAction<{ current: number; total: number } | undefined>>;
};

const emptyPlayerForm: CreatePlayerPayload = {
  firstName: '',
  lastName: '',
  surname: '',
  teamName: '',
  email: '',
  phone: '',
};

const usePlayersState = (): PlayersState & PlayersStateSetters & {
  clearPlayers: () => void;
  clearPlayersError: () => void;
  resetPlayersState: () => void;
} => {
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | undefined>();
  const [playerForm, setPlayerForm] = useState<CreatePlayerPayload>(emptyPlayerForm);
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [checkingInPlayerId, setCheckingInPlayerId] = useState<string | undefined>();
  const [isRegisteringPlayer, setIsRegisteringPlayer] = useState(false);
  const [isAutoFillingPlayers, setIsAutoFillingPlayers] = useState(false);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [autoFillProgress, setAutoFillProgress] = useState<{ current: number; total: number } | undefined>();
  const [confirmAllProgress, setConfirmAllProgress] = useState<{ current: number; total: number } | undefined>();

  const clearPlayers = useCallback(() => {
    setPlayers([]);
  }, []);

  const clearPlayersError = useCallback(() => {
    setPlayersError(undefined);
  }, []);

  const resetPlayersState = useCallback(() => {
    setPlayers([]);
    setPlayersError(undefined);
    setPlayersLoading(false);
    setEditingPlayerId(undefined);
    setCheckingInPlayerId(undefined);
    setIsRegisteringPlayer(false);
    setIsAutoFillingPlayers(false);
    setIsConfirmingAll(false);
    setAutoFillProgress(undefined);
    setConfirmAllProgress(undefined);
    setPlayerForm(emptyPlayerForm);
  }, []);

  return {
    players,
    playersLoading,
    playersError,
    playerForm,
    editingPlayerId,
    checkingInPlayerId,
    isRegisteringPlayer,
    isAutoFillingPlayers,
    isConfirmingAll,
    autoFillProgress,
    confirmAllProgress,
    setPlayers,
    setPlayersLoading,
    setPlayersError,
    setPlayerForm,
    setEditingPlayerId,
    setCheckingInPlayerId,
    setIsRegisteringPlayer,
    setIsAutoFillingPlayers,
    setIsConfirmingAll,
    setAutoFillProgress,
    setConfirmAllProgress,
    clearPlayers,
    clearPlayersError,
    resetPlayersState,
  };
};

const usePlayersFetch = ({
  t,
  getSafeAccessToken,
  setPlayers,
  setPlayersError,
  setPlayersLoading,
}: {
  t: TournamentPlayersContext['t'];
  getSafeAccessToken: TournamentPlayersContext['getSafeAccessToken'];
  setPlayers: PlayersStateSetters['setPlayers'];
  setPlayersError: PlayersStateSetters['setPlayersError'];
  setPlayersLoading: PlayersStateSetters['setPlayersLoading'];
}) => useCallback(async (tournamentId: string) => {
  setPlayersLoading(true);
  setPlayersError(undefined);
  try {
    const token = await getSafeAccessToken();
    const data = await fetchTournamentPlayers(tournamentId, token);
    setPlayers(data);
  } catch (error_) {
    const message = error_ instanceof Error && error_.message.trim().length > 0
      ? error_.message
      : t('edit.error.failedLoadPlayers');
    setPlayersError(message);
  } finally {
    setPlayersLoading(false);
  }
}, [getSafeAccessToken, setPlayers, setPlayersError, setPlayersLoading, t]);

const usePlayersEditHandlers = ({
  setEditingPlayerId,
  setPlayerForm,
  setPlayersError,
}: {
  setEditingPlayerId: PlayersStateSetters['setEditingPlayerId'];
  setPlayerForm: PlayersStateSetters['setPlayerForm'];
  setPlayersError: PlayersStateSetters['setPlayersError'];
}) => {
  const startEditPlayer = useCallback((player: TournamentPlayer) => {
    setEditingPlayerId(player.playerId);
    const nextForm: CreatePlayerPayload = {
      firstName: player.firstName || player.name.split(' ')[0] || '',
      lastName: player.lastName || player.name.split(' ').slice(1).join(' ') || '',
      surname: player.surname || '',
      teamName: player.teamName || '',
      email: player.email || '',
      phone: player.phone || '',
    };
    if (player.skillLevel !== undefined) {
      nextForm.skillLevel = player.skillLevel;
    }
    setPlayerForm(nextForm);
    setPlayersError(undefined);
  }, [setEditingPlayerId, setPlayerForm, setPlayersError]);

  const cancelEditPlayer = useCallback(() => {
    setEditingPlayerId(undefined);
    setPlayerForm(emptyPlayerForm);
  }, [setEditingPlayerId, setPlayerForm]);

  return { startEditPlayer, cancelEditPlayer };
};

export type { PlayersState, PlayersStateSetters };
export { emptyPlayerForm, usePlayersState, usePlayersFetch, usePlayersEditHandlers };
