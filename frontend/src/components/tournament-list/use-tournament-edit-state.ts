import { useState, type Dispatch, type SetStateAction } from 'react';
import type { EditFormState, Tournament } from './types';

type TournamentEditState = {
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  editError: string | undefined;
  editLoading: boolean;
  editLoadError: string | undefined;
  isSaving: boolean;
  logoFile: File | undefined;
  isUploadingLogo: boolean;
};

type TournamentEditStateSetters = {
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
  setEditForm: Dispatch<SetStateAction<EditFormState | undefined>>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  setEditLoading: Dispatch<SetStateAction<boolean>>;
  setEditLoadError: Dispatch<SetStateAction<string | undefined>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setLogoFile: Dispatch<SetStateAction<File | undefined>>;
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
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  return {
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
  };
};

export default useTournamentEditState;
