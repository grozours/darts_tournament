import { useCallback } from 'react';
import type { TournamentPlayer, CreateTournamentPayload } from '../../services/tournament-service';
import { updateTournament, updateTournamentStatus } from '../../services/tournament-service';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import type { EditFormState, Tournament, Translator } from './types';

type UseTournamentEditActionsProperties = {
  t: Translator;
  isEditPage: boolean;
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  players: TournamentPlayer[];
  getSafeAccessToken: () => Promise<string | undefined>;
  closeEdit: () => void;
  fetchTournaments: () => void;
  setEditError: (value: string | undefined) => void;
  setIsSaving: (value: boolean) => void;
};

type TournamentEditActionsResult = {
  saveEdit: () => Promise<void>;
  openRegistration: () => Promise<void>;
  moveToSignature: () => Promise<void>;
  moveToLive: () => Promise<void>;
};

type TournamentEditActionShared = {
  t: Translator;
  isEditPage: boolean;
  editingTournament: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  closeEdit: () => void;
  fetchTournaments: () => void;
  setEditError: (value: string | undefined) => void;
  setIsSaving: (value: boolean) => void;
};

const useSaveEditAction = ({
  t,
  editingTournament,
  editForm,
  getSafeAccessToken,
  closeEdit,
  fetchTournaments,
  setEditError,
  setIsSaving,
}: Omit<TournamentEditActionShared, 'isEditPage'> & {
  editForm: EditFormState | undefined;
}) => useCallback(async () => {
  if (!editingTournament || !editForm) return;
  if (!editForm.name.trim()) {
    setEditError(t('edit.error.nameRequired'));
    return;
  }

  setIsSaving(true);
  setEditError(undefined);
  try {
    const token = await getSafeAccessToken();
    const payload: Partial<CreateTournamentPayload> = {
      name: editForm.name.trim(),
      format: editForm.format,
      durationType: editForm.durationType,
      totalParticipants: Number(editForm.totalParticipants || 0),
      targetCount: Number(editForm.targetCount || 0),
    };
    if (editForm.startTime) {
      payload.startTime = new Date(editForm.startTime).toISOString();
    }
    if (editForm.endTime) {
      payload.endTime = new Date(editForm.endTime).toISOString();
    }

    await updateTournament(editingTournament.id, payload, token);
    closeEdit();
    fetchTournaments();
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdateTournament'));
  } finally {
    setIsSaving(false);
  }
}, [closeEdit, editForm, editingTournament, fetchTournaments, getSafeAccessToken, setEditError, setIsSaving, t]);

const useOpenRegistrationAction = ({
  t,
  isEditPage,
  editingTournament,
  getSafeAccessToken,
  closeEdit,
  fetchTournaments,
  setEditError,
  setIsSaving,
}: TournamentEditActionShared) => useCallback(async () => {
  if (!editingTournament) return;
  if (normalizeTournamentStatus(editingTournament.status) === 'OPEN') {
    setEditError(t('edit.error.registrationAlreadyOpen'));
    return;
  }
  setIsSaving(true);
  setEditError(undefined);
  try {
    const token = await getSafeAccessToken();
    await updateTournamentStatus(editingTournament.id, 'OPEN', token);
    if (isEditPage) {
      globalThis.window?.location.assign('/?status=OPEN');
      return;
    }
    closeEdit();
    fetchTournaments();
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedOpenRegistration'));
  } finally {
    setIsSaving(false);
  }
}, [closeEdit, editingTournament, fetchTournaments, getSafeAccessToken, isEditPage, setEditError, setIsSaving, t]);

const useMoveToSignatureAction = ({
  t,
  isEditPage,
  editingTournament,
  getSafeAccessToken,
  closeEdit,
  fetchTournaments,
  setEditError,
  setIsSaving,
}: TournamentEditActionShared) => useCallback(async () => {
  if (!editingTournament) return;
  if (normalizeTournamentStatus(editingTournament.status) !== 'OPEN') {
    setEditError(t('edit.error.mustBeOpenToSignature'));
    return;
  }
  setIsSaving(true);
  setEditError(undefined);
  try {
    const token = await getSafeAccessToken();
    await updateTournamentStatus(editingTournament.id, 'SIGNATURE', token);
    if (isEditPage) {
      globalThis.window?.location.assign('/?status=SIGNATURE');
      return;
    }
    closeEdit();
    fetchTournaments();
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedMoveToSignature'));
  } finally {
    setIsSaving(false);
  }
}, [closeEdit, editingTournament, fetchTournaments, getSafeAccessToken, isEditPage, setEditError, setIsSaving, t]);

const useMoveToLiveAction = ({
  t,
  isEditPage,
  editingTournament,
  players,
  getSafeAccessToken,
  closeEdit,
  fetchTournaments,
  setEditError,
  setIsSaving,
}: TournamentEditActionShared & {
  players: TournamentPlayer[];
}) => useCallback(async () => {
  if (!editingTournament) return;
  if (normalizeTournamentStatus(editingTournament.status) !== 'SIGNATURE') {
    setEditError(t('edit.error.mustBeSignatureToLive'));
    return;
  }
  if (players.length === 0 || !players.every((player) => player.checkedIn)) {
    setEditError(t('edit.error.allPlayersMustBeConfirmed'));
    return;
  }

  setIsSaving(true);
  setEditError(undefined);
  try {
    const token = await getSafeAccessToken();
    await updateTournamentStatus(editingTournament.id, 'LIVE', token);
    if (isEditPage) {
      globalThis.window?.location.assign('/?status=live');
      return;
    }
    closeEdit();
    fetchTournaments();
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedStartLive'));
  } finally {
    setIsSaving(false);
  }
}, [closeEdit, editingTournament, fetchTournaments, getSafeAccessToken, isEditPage, players, setEditError, setIsSaving, t]);

const useTournamentEditActions = ({
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
}: UseTournamentEditActionsProperties): TournamentEditActionsResult => {
  const saveEdit = useSaveEditAction({
    t,
    editingTournament,
    editForm,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  const openRegistration = useOpenRegistrationAction({
    t,
    isEditPage,
    editingTournament,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  const moveToSignature = useMoveToSignatureAction({
    t,
    isEditPage,
    editingTournament,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  const moveToLive = useMoveToLiveAction({
    t,
    isEditPage,
    editingTournament,
    players,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  return {
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  };
};

export default useTournamentEditActions;
