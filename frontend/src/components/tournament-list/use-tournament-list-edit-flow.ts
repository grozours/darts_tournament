import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { TournamentPlayer } from '../../services/tournament-service';
import useTournamentEditActions from './use-tournament-edit-actions';
import useTournamentEditDetails from './use-tournament-edit-details';
import useTournamentEditLoader from './use-tournament-edit-loader';
import useTournamentLogoUpload from './use-tournament-logo-upload';
import { formatToLocalInput } from './tournament-date-helpers';
import type { EditFormState, Tournament, Translator } from './types';

type UseTournamentListEditFlowProperties = {
  t: Translator;
  isEditPage: boolean;
  editTournamentId: string | null | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  players: TournamentPlayer[];
  fetchPlayers: (tournamentId: string) => Promise<void>;
  clearPlayers: () => void;
  clearPlayersError: () => void;
  resetPlayersState: () => void;
  resetStructureState: () => void;
  loadPoolStages: (tournamentId: string) => Promise<void>;
  loadBrackets: (tournamentId: string) => Promise<void>;
  loadTargets: (tournamentId: string) => Promise<void>;
  fetchTournaments: () => void;
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  logoFiles: File[];
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
  setEditForm: Dispatch<SetStateAction<EditFormState | undefined>>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  setEditLoading: Dispatch<SetStateAction<boolean>>;
  setEditLoadError: Dispatch<SetStateAction<string | undefined>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setLogoFiles: Dispatch<SetStateAction<File[]>>;
  setIsUploadingLogo: Dispatch<SetStateAction<boolean>>;
};

type TournamentListEditFlowResult = {
  openEdit: (tournament: Tournament, options?: { skipNavigation?: boolean }) => void;
  closeEdit: () => void;
  uploadLogo: () => Promise<void>;
  deleteLogo: (logoUrl: string) => Promise<void>;
  saveEdit: () => Promise<void>;
  openRegistration: () => Promise<void>;
  moveToSignature: () => Promise<void>;
  moveToLive: () => Promise<void>;
};

const useTournamentListEditFlow = ({
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
    loadTargets,
  fetchTournaments,
  editingTournament,
  editForm,
  logoFiles,
  setEditingTournament,
  setEditForm,
  setEditError,
  setEditLoading,
  setEditLoadError,
  setIsSaving,
  setLogoFiles,
  setIsUploadingLogo,
}: UseTournamentListEditFlowProperties): TournamentListEditFlowResult => {
  const closeEdit = useCallback(() => {
    setEditingTournament(undefined);
    setEditForm(undefined);
    setEditError(undefined);
    resetPlayersState();
    resetStructureState();
    setLogoFiles([]);
    if (isEditPage) {
      globalThis.window?.location.assign('/');
    }
  }, [
    isEditPage,
    resetPlayersState,
    resetStructureState,
    setEditError,
    setEditForm,
    setEditingTournament,
    setLogoFiles,
  ]);

  const { fetchTournamentDetails } = useTournamentEditDetails({
    editingTournament,
    getSafeAccessToken,
    fetchPlayers,
    setEditingTournament,
  });

  const { openEdit } = useTournamentEditLoader({
    isEditPage,
    editTournamentId,
    editingTournamentId: editingTournament?.id,
    toLocalInput: formatToLocalInput,
    getSafeAccessToken,
    clearPlayers,
    clearPlayersError,
    fetchPlayers,
    fetchTournamentDetails,
    loadPoolStages,
    loadBrackets,
      loadTargets,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
  });

  const { uploadLogo, deleteLogo } = useTournamentLogoUpload({
    t,
    editingTournament,
    logoFiles,
    getSafeAccessToken,
    setEditError,
    setIsUploadingLogo,
    setEditingTournament,
    setLogoFiles,
    fetchTournaments,
  });

  const {
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  } = useTournamentEditActions({
    t,
    isEditPage,
    editingTournament,
    editForm,
    players,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  return {
    openEdit,
    closeEdit,
    uploadLogo,
    deleteLogo,
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  };
};

export default useTournamentListEditFlow;
