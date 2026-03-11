import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { TournamentFormat } from '@shared/types';
import {
  createBracket,
  createPoolStage,
  deleteBracket,
  deletePoolStage,
  fetchTournamentPresets,
  updatePoolStage,
  type BracketConfig,
  type PoolStageConfig,
  type TournamentPreset,
} from '../../services/tournament-service';
import { buildPresetRoutingUpdates, buildTournamentPresetTemplate } from '../../utils/tournament-presets';
import type { EditFormState, Tournament, Translator } from './types';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import { navigateWithinApp } from './navigation-helpers';

type UseTournamentListPresetActionsProperties = {
  t: Translator;
  isAdmin: boolean;
  isEditPage: boolean;
  editTournamentId: string | null;
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  setEditForm: Dispatch<SetStateAction<EditFormState | undefined>>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  poolStages: PoolStageConfig[];
  brackets: BracketConfig[];
  loadPoolStages: (tournamentId: string) => Promise<void>;
  loadBrackets: (tournamentId: string) => Promise<void>;
  getSafeAccessToken: () => Promise<string | undefined>;
};

const useTournamentListPresetActions = ({
  t,
  isAdmin,
  isEditPage,
  editTournamentId,
  editingTournament,
  editForm,
  setEditForm,
  setEditError,
  poolStages,
  brackets,
  loadPoolStages,
  loadBrackets,
  getSafeAccessToken,
}: UseTournamentListPresetActionsProperties) => {
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [quickStructurePresets, setQuickStructurePresets] = useState<TournamentPreset[]>([]);
  const [quickStructurePresetsLoading, setQuickStructurePresetsLoading] = useState(false);

  const handleApplyStructurePreset = useCallback(async (preset: Pick<TournamentPreset, 'name' | 'presetType' | 'templateConfig'>) => {
    if (!editingTournament) return;
    if (normalizeTournamentStatus(editingTournament.status) === 'LIVE') {
      setEditError(t('edit.quickStructureDisabledLive'));
      return;
    }
    const totalParticipants = Number(editForm?.totalParticipants ?? editingTournament.totalParticipants ?? 0);
    const template = buildTournamentPresetTemplate(preset, totalParticipants);
    const confirmLabel = template.format === 'DOUBLE'
      ? t('edit.quickStructureConfirmDouble')
      : t('edit.quickStructureConfirmSingle');
    if (!confirm(confirmLabel)) return;

    setIsApplyingPreset(true);
    setEditError(undefined);
    try {
      const token = await getSafeAccessToken();
      for (const bracket of brackets) {
        await deleteBracket(editingTournament.id, bracket.id, token);
      }
      for (const stage of poolStages) {
        await deletePoolStage(editingTournament.id, stage.id, token);
      }
      const createdStages = [];
      for (const stage of template.stages) {
        const createdStage = await createPoolStage(editingTournament.id, stage, token);
        createdStages.push(createdStage);
      }
      const createdBrackets = [];
      for (const bracket of template.brackets) {
        const createdBracket = await createBracket(editingTournament.id, bracket, token);
        createdBrackets.push(createdBracket);
      }

      const routingUpdates = buildPresetRoutingUpdates(
        preset.templateConfig,
        createdStages,
        createdBrackets
      );
      for (const update of routingUpdates) {
        await updatePoolStage(editingTournament.id, update.stageId, {
          rankingDestinations: update.rankingDestinations,
        }, token);
      }
      if (editForm) {
        setEditForm({
          ...editForm,
          format: template.format,
          doubleStageEnabled: template.format === TournamentFormat.DOUBLE,
        });
      }
      await loadPoolStages(editingTournament.id);
      await loadBrackets(editingTournament.id);
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedApplyPreset'));
    } finally {
      setIsApplyingPreset(false);
    }
  }, [brackets, editForm, editingTournament, getSafeAccessToken, loadBrackets, loadPoolStages, poolStages, setEditError, setEditForm, t]);

  const loadQuickStructurePresets = useCallback(async () => {
    if (!isAdmin) {
      setQuickStructurePresets([]);
      return;
    }
    setQuickStructurePresetsLoading(true);
    try {
      const token = await getSafeAccessToken();
      const presets = await fetchTournamentPresets(token);

      if (isEditPage && presets.length === 0 && globalThis.window) {
        const redirectUrl = new URL(globalThis.window.location.href);
        redirectUrl.searchParams.set('view', 'tournament-presets');
        redirectUrl.searchParams.set('from', 'edit-tournament');
        if (editTournamentId) {
          redirectUrl.searchParams.set('tournamentId', editTournamentId);
        }
        navigateWithinApp(`${redirectUrl.pathname}${redirectUrl.search}`);
        return;
      }

      setQuickStructurePresets(presets);
    } catch {
      setQuickStructurePresets([]);
    } finally {
      setQuickStructurePresetsLoading(false);
    }
  }, [editTournamentId, getSafeAccessToken, isAdmin, isEditPage]);

  useEffect(() => {
    void loadQuickStructurePresets();
  }, [loadQuickStructurePresets]);

  return {
    isApplyingPreset,
    quickStructurePresets,
    quickStructurePresetsLoading,
    handleApplyStructurePreset,
  };
};

export default useTournamentListPresetActions;
