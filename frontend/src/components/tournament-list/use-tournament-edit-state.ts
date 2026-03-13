import { useState, type Dispatch, type SetStateAction } from 'react';
import type { EditFormState, Tournament } from './types';

type TournamentEditState = {
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  editError: string | undefined;
  editLoading: boolean;
  editLoadError: string | undefined;
  isSaving: boolean;
  logoFiles: File[];
  isUploadingLogo: boolean;
};

type TournamentEditStateSetters = {
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
  setEditForm: Dispatch<SetStateAction<EditFormState | undefined>>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  setEditLoading: Dispatch<SetStateAction<boolean>>;
  setEditLoadError: Dispatch<SetStateAction<string | undefined>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setLogoFiles: Dispatch<SetStateAction<File[]>>;
  setIsUploadingLogo: Dispatch<SetStateAction<boolean>>;
};

type TournamentEditStateResult = TournamentEditState & TournamentEditStateSetters;

const useTournamentEditState = (): TournamentEditStateResult => {
  const [editingTournament, setEditingTournament] = useState<Tournament | undefined>();
  const [editForm, setEditForm] = useState<EditFormState | undefined>();
  const [editError, setEditError] = useState<string | undefined>();
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  return {
    editingTournament,
    editForm,
    editError,
    editLoading,
    editLoadError,
    isSaving,
    logoFiles,
    isUploadingLogo,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
    setIsSaving,
    setLogoFiles,
    setIsUploadingLogo,
  };
};

export default useTournamentEditState;
