import { useMemo } from 'react';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import { getPlayerActionLabel } from './player-list-utilities';
import type { TournamentPlayersContext, UnregisteredAccountOption } from './tournament-players-types';
import {
  usePlayersState,
  usePlayersFetch,
  usePlayersEditHandlers,
} from './tournament-players-state';
import {
  usePlayerRegistrationMutations,
  usePlayerCheckInMutations,
  usePlayerAutoFillMutation,
} from './tournament-players-actions';

type UseTournamentPlayersResult = {
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
  playerActionLabel: string;
  setPlayerForm: (next: CreatePlayerPayload) => void;
  clearPlayers: () => void;
  clearPlayersError: () => void;
  resetPlayersState: () => void;
  fetchPlayers: (tournamentId: string) => Promise<void>;
  startEditPlayer: (player: TournamentPlayer) => void;
  cancelEditPlayer: () => void;
  registerPlayer: () => Promise<void>;
  savePlayerEdit: () => Promise<void>;
  removePlayer: (playerId: string) => Promise<void>;
  togglePlayerCheckIn: (player: TournamentPlayer) => Promise<void>;
  confirmAllPlayers: () => Promise<void>;
  autoFillPlayers: () => Promise<void>;
  searchUnregisteredAccounts: (searchTerm: string) => Promise<UnregisteredAccountOption[]>;
  registerPlayerFromAccount: (account: UnregisteredAccountOption) => Promise<void>;
};

const useTournamentPlayers = ({
  t,
  editingTournament,
  getSafeAccessToken,
  refreshTournamentDetails,
}: TournamentPlayersContext): UseTournamentPlayersResult => {
  const {
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
  } = usePlayersState();

  const fetchPlayers = usePlayersFetch({
    t,
    getSafeAccessToken,
    setPlayers,
    setPlayersError,
    setPlayersLoading,
  });

  const { startEditPlayer, cancelEditPlayer } = usePlayersEditHandlers({
    setEditingPlayerId,
    setPlayerForm,
    setPlayersError,
  });

  const {
    registerPlayer,
    savePlayerEdit,
    removePlayer,
    searchUnregisteredAccounts,
    registerPlayerFromAccount,
  } = usePlayerRegistrationMutations({
    t,
    editingTournament,
    getSafeAccessToken,
    playerForm,
    editingPlayerId,
    players,
    fetchPlayers,
    cancelEditPlayer,
    setPlayersError,
    setPlayerForm,
    setIsRegisteringPlayer,
  });

  const { togglePlayerCheckIn, confirmAllPlayers } = usePlayerCheckInMutations({
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
  });

  const { autoFillPlayers } = usePlayerAutoFillMutation({
    t,
    editingTournament,
    getSafeAccessToken,
    players,
    fetchPlayers,
    setPlayersError,
    setIsAutoFillingPlayers,
    setAutoFillProgress,
  });

  const playerActionLabel = useMemo(
    () =>
      getPlayerActionLabel({
        isRegistering: isRegisteringPlayer,
        isAutoFilling: isAutoFillingPlayers,
        isEditing: Boolean(editingPlayerId),
        t,
      }),
    [editingPlayerId, isAutoFillingPlayers, isRegisteringPlayer, t]
  );

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
    playerActionLabel,
    setPlayerForm,
    clearPlayers,
    clearPlayersError,
    resetPlayersState,
    fetchPlayers,
    startEditPlayer,
    cancelEditPlayer,
    registerPlayer,
    savePlayerEdit,
    removePlayer,
    togglePlayerCheckIn,
    confirmAllPlayers,
    autoFillPlayers,
    searchUnregisteredAccounts,
    registerPlayerFromAccount,
  };
};

export default useTournamentPlayers;
