import { useCallback } from 'react';
import type { TournamentPlayer, CreateTournamentPayload } from '../../services/tournament-service';
import { updateTournament, updateTournamentStatus } from '../../services/tournament-service';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import { localInputToIso } from './tournament-date-helpers';
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

type TransitionConfig = {
  targetStatus: 'OPEN' | 'SIGNATURE' | 'LIVE';
  redirectStatus: string;
  keepEditPageOnSuccess?: boolean;
  validate?: () => string | undefined;
  fallbackError: string;
};

const applyOptionalIsoTime = (
  payload: Partial<CreateTournamentPayload>,
  key: 'startTime' | 'endTime',
  value: string
) => {
  const isoValue = localInputToIso(value);
  if (isoValue) {
    payload[key] = isoValue;
  }
};

const buildTournamentEditPayload = (editForm: EditFormState): Partial<CreateTournamentPayload> => {
  const payload: Partial<CreateTournamentPayload> = {
    name: editForm.name.trim(),
    ...(editForm.location.trim()
      ? { location: editForm.location.trim() }
      : {}),
    format: editForm.format,
    durationType: editForm.durationType,
    totalParticipants: Number(editForm.totalParticipants || 0),
    targetCount: Number(editForm.targetCount || 0),
    targetStartNumber: Number(editForm.targetStartNumber || 1),
    shareTargets: editForm.shareTargets,
    doubleStageEnabled: editForm.doubleStageEnabled,
  };

  if (editForm.startTime) {
    applyOptionalIsoTime(payload, 'startTime', editForm.startTime);
  }
  if (editForm.endTime) {
    applyOptionalIsoTime(payload, 'endTime', editForm.endTime);
  }

  return payload;
};

const finalizeEditSave = (
  isEditPage: boolean,
  closeEdit: () => void,
  fetchTournaments: () => void
) => {
  if (!isEditPage) {
    closeEdit();
  }
  fetchTournaments();
};

const useSaveEditAction = ({
  t,
  isEditPage,
  editingTournament,
  editForm,
  getSafeAccessToken,
  closeEdit,
  fetchTournaments,
  setEditError,
  setIsSaving,
}: TournamentEditActionShared & {
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
    const payload = buildTournamentEditPayload(editForm);

    await updateTournament(editingTournament.id, payload, token);
    finalizeEditSave(isEditPage, closeEdit, fetchTournaments);
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdateTournament'));
  } finally {
    setIsSaving(false);
  }
}, [closeEdit, editForm, editingTournament, fetchTournaments, getSafeAccessToken, isEditPage, setEditError, setIsSaving, t]);

const useStatusTransitionAction = (
  shared: TournamentEditActionShared,
  config: TransitionConfig
) => useCallback(async () => {
  const { editingTournament, getSafeAccessToken, isEditPage, closeEdit, fetchTournaments, setEditError, setIsSaving } = shared;

  if (!editingTournament) return;

  const validationError = config.validate?.();
  if (validationError) {
    setEditError(validationError);
    return;
  }

  setIsSaving(true);
  setEditError(undefined);
  try {
    const token = await getSafeAccessToken();
    await updateTournamentStatus(editingTournament.id, config.targetStatus, token);
    if (isEditPage) {
      if (config.keepEditPageOnSuccess) {
        globalThis.window?.location.assign(`/?view=edit-tournament&tournamentId=${editingTournament.id}`);
        return;
      }
      globalThis.window?.location.assign(`/?status=${config.redirectStatus}`);
      return;
    }
    closeEdit();
    fetchTournaments();
  } catch (error_) {
    setEditError(error_ instanceof Error ? error_.message : config.fallbackError);
  } finally {
    setIsSaving(false);
  }
}, [config, shared]);

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
    isEditPage,
    editingTournament,
    editForm,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  });

  const shared = {
    t,
    isEditPage,
    editingTournament,
    getSafeAccessToken,
    closeEdit,
    fetchTournaments,
    setEditError,
    setIsSaving,
  };

  const openRegistration = useStatusTransitionAction(shared, {
    targetStatus: 'OPEN',
    redirectStatus: 'OPEN',
    keepEditPageOnSuccess: true,
    validate: () => (
      editingTournament && normalizeTournamentStatus(editingTournament.status) === 'OPEN'
        ? t('edit.error.registrationAlreadyOpen')
        : undefined
    ),
    fallbackError: t('edit.error.failedOpenRegistration'),
  });

  const moveToSignature = useStatusTransitionAction(shared, {
    targetStatus: 'SIGNATURE',
    redirectStatus: 'SIGNATURE',
    keepEditPageOnSuccess: true,
    validate: () => (
      editingTournament && normalizeTournamentStatus(editingTournament.status) !== 'OPEN'
        ? t('edit.error.mustBeOpenToSignature')
        : undefined
    ),
    fallbackError: t('edit.error.failedMoveToSignature'),
  });

  const moveToLive = useStatusTransitionAction(shared, {
    targetStatus: 'LIVE',
    redirectStatus: 'live',
    validate: (): string | undefined => {
      if (!editingTournament) return undefined;
      if (normalizeTournamentStatus(editingTournament.status) !== 'SIGNATURE') {
        return t('edit.error.mustBeSignatureToLive');
      }
      if (players.length === 0 || !players.every((player) => player.checkedIn)) {
        return t('edit.error.allPlayersMustBeConfirmed');
      }
      return undefined;
    },
    fallbackError: t('edit.error.failedStartLive'),
  });

  return {
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  };
};

export default useTournamentEditActions;
