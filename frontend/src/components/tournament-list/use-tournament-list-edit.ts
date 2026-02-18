import { useCallback } from 'react';
import type { TournamentPlayer } from '../../services/tournament-service';
import useTournamentEditState from './use-tournament-edit-state';
import useTournamentListEditFlow from '@/components/tournament-list/use-tournament-list-edit-flow';
import type { Tournament, Translator } from './types';

type UseTournamentListEditProperties = {
  t: Translator;
  isEditPage: boolean;
  editTournamentId?: string | null;
  getSafeAccessToken: () => Promise<string | undefined>;
  players: TournamentPlayer[];
  fetchPlayers: (tournamentId: string) => Promise<void>;
  clearPlayers: () => void;
  clearPlayersError: () => void;
  resetPlayersState: () => void;
  resetStructureState: () => void;
  loadPoolStages: (tournamentId: string) => Promise<void>;
  loadBrackets: (tournamentId: string) => Promise<void>;
  fetchTournaments: () => void;
};

export type TournamentEditForm = {
  name: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: string;
  targetCount: string;
};

type TournamentListEditResult = {
  editingTournament: Tournament | undefined;
  editForm: TournamentEditForm | undefined;
  editError: string | undefined;
  editLoading: boolean;
  editLoadError: string | undefined;
  isSaving: boolean;
  logoFile: File | undefined;
  isUploadingLogo: boolean;
  openEdit: (tournament: Tournament, options?: { skipNavigation?: boolean }) => void;
  closeEdit: () => void;
  uploadLogo: () => Promise<void>;
  saveEdit: () => Promise<void>;
  openRegistration: () => Promise<void>;
  moveToSignature: () => Promise<void>;
  moveToLive: () => Promise<void>;
  setEditForm: (value: TournamentEditForm | undefined) => void;
  setLogoFile: (value: File | undefined) => void;
  setEditError: (value: string | undefined) => void;
};

const useTournamentListEdit = ({
  t,
  isEditPage,
  editTournamentId,
  getSafeAccessToken,
  players,
  fetchPlayers,
  clearPlayers,
  clearPlayersError,
  resetPlayersState,
  resetStructureState,
  loadPoolStages,
  loadBrackets,
  fetchTournaments,
}: UseTournamentListEditProperties): TournamentListEditResult => {
  const {
    editingTournament,
    editForm,
    editError,
    editLoading,
    editLoadError,
    isSaving,
    logoFile,
    isUploadingLogo,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
    setIsSaving,
    setLogoFile,
    setIsUploadingLogo,
  } = useTournamentEditState();
  const refreshTournaments = useCallback(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const {
    openEdit,
    closeEdit,
    uploadLogo,
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  } = useTournamentListEditFlow({
    t,
    isEditPage,
    editTournamentId,
    getSafeAccessToken,
    players,
    fetchPlayers,
    clearPlayers,
    clearPlayersError,
    resetPlayersState,
    resetStructureState,
    loadPoolStages,
    loadBrackets,
    fetchTournaments: refreshTournaments,
    editingTournament,
    editForm,
    logoFile,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
    setIsSaving,
    setLogoFile,
    setIsUploadingLogo,
  });

  return {
    editingTournament,
    editForm,
    editError,
    editLoading,
    editLoadError,
    isSaving,
    logoFile,
    isUploadingLogo,
    openEdit,
    closeEdit,
    uploadLogo,
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
    setEditForm,
    setLogoFile,
    setEditError,
  };
};

export default useTournamentListEdit;
