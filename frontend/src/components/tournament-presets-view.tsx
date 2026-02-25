import { BracketType, TournamentFormat } from '@shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useI18n } from '../i18n';
import {
  createTournamentPreset,
  deleteTournamentPreset,
  fetchTournamentPresets,
  type BracketConfig,
  type PoolStageConfig,
  type PoolStageDestinationType,
  type PoolStageRankingDestination,
  type TournamentPreset,
  type TournamentPresetType,
  updateTournamentPreset,
} from '../services/tournament-service';
import BracketsEditor from './tournament-list/brackets-editor';
import PoolStagesEditor from './tournament-list/pool-stages-editor';
import { getStatusLabel, normalizeStageStatus } from './tournament-list/tournament-status-helpers';
import {
  getDefaultPresetTemplateConfig,
  type TournamentPresetTemplateConfig,
} from '../utils/tournament-presets';

type TournamentPresetsViewProperties = Readonly<{
  mode?: 'list' | 'editor';
}>;

type ManagedPreset = TournamentPreset;

type PresetFormState = {
  name: string;
  presetType: TournamentPresetType;
  totalParticipants: string;
  targetCount: string;
  format: TournamentFormat;
};

type NewPoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  matchFormatKey?: string;
  inParallelWith?: string[];
  losersAdvanceToBracket: boolean;
  rankingDestinations?: PoolStageRankingDestination[];
};

type NewBracketDraft = {
  name: string;
  bracketType: string;
  totalRounds: number;
  roundMatchFormats?: Record<string, string>;
  inParallelWith?: string[];
};

const toggleParallelReference = (values: string[] | undefined, reference: string): string[] | undefined => {
  const currentValues = values ?? [];
  if (currentValues.includes(reference)) {
    const filtered = currentValues.filter((value) => value !== reference);
    return filtered.length > 0 ? filtered : undefined;
  }
  return [...currentValues, reference];
};

const defaultPresetType: TournamentPresetType = 'single-pool-stage';

const defaultFormState: PresetFormState = {
  name: '',
  presetType: defaultPresetType,
  totalParticipants: '16',
  targetCount: '4',
  format: TournamentFormat.SINGLE,
};

const PRESET_TOURNAMENT_ID = 'preset-template';

const makeId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

const getPresetTypeLabel = (presetType: TournamentPresetType, t: (key: string) => string) => {
  if (presetType === 'three-pool-stages') {
    return t('presetManager.typeThreeStages');
  }
  if (presetType === 'custom') {
    return t('presetManager.typeCustom');
  }
  return t('presetManager.typeSingle');
};

const normalizeStageRankingDestinations = (
  stage: PoolStageConfig,
  brackets: BracketConfig[]
): PoolStageRankingDestination[] => {
  const destinations = stage.rankingDestinations ?? [];
  if (destinations.length > 0) {
    return destinations;
  }
  const defaultBracketId = brackets[0]?.id;
  const normalized: PoolStageRankingDestination[] = [];
  for (let position = 1; position <= stage.playersPerPool; position += 1) {
    if (position <= stage.advanceCount && defaultBracketId) {
      normalized.push({ position, destinationType: 'BRACKET', bracketId: defaultBracketId });
    } else {
      normalized.push({ position, destinationType: 'ELIMINATED' });
    }
  }
  return normalized;
};

const buildEditorStateFromTemplate = (config: TournamentPresetTemplateConfig): {
  poolStages: PoolStageConfig[];
  brackets: BracketConfig[];
} => {
  const brackets: BracketConfig[] = config.brackets.map((bracket, index) => ({
    id: makeId('bracket', index),
    tournamentId: PRESET_TOURNAMENT_ID,
    name: bracket.name,
    bracketType: BracketType.SINGLE_ELIMINATION,
    totalRounds: bracket.totalRounds,
    ...(bracket.roundMatchFormats ? { roundMatchFormats: bracket.roundMatchFormats } : {}),
    ...(bracket.inParallelWith ? { inParallelWith: bracket.inParallelWith } : {}),
    status: 'NOT_STARTED',
    targetIds: [],
  }));

  const bracketIdByName = new Map(brackets.map((bracket) => [bracket.name, bracket.id]));

  const stagesWithoutDestinations: PoolStageConfig[] = config.stages.map((stage, index) => ({
    id: makeId('stage', index),
    tournamentId: PRESET_TOURNAMENT_ID,
    stageNumber: index + 1,
    name: stage.name,
    poolCount: stage.poolCount,
    playersPerPool: stage.playersPerPool,
    advanceCount: stage.advanceCount,
    ...(stage.matchFormatKey ? { matchFormatKey: stage.matchFormatKey } : {}),
    ...(stage.inParallelWith ? { inParallelWith: stage.inParallelWith } : {}),
    losersAdvanceToBracket: false,
    status: 'EDITION',
    rankingDestinations: [],
  }));

  const stageIdByNumber = new Map(stagesWithoutDestinations.map((stage) => [stage.stageNumber, stage.id]));

  const poolStages = stagesWithoutDestinations.map((stage) => {
    const routingRules = config.routingRules.filter((rule) => rule.stageNumber === stage.stageNumber);
    const rankingDestinations: PoolStageRankingDestination[] = routingRules
      .toSorted((first, second) => first.position - second.position)
      .map((rule) => {
        if (rule.destinationType === 'BRACKET') {
          const bracketId = rule.destinationBracketName
            ? bracketIdByName.get(rule.destinationBracketName)
            : undefined;
          if (!bracketId) {
            return { position: rule.position, destinationType: 'ELIMINATED' as const };
          }
          return { position: rule.position, destinationType: 'BRACKET' as const, bracketId };
        }
        if (rule.destinationType === 'POOL_STAGE') {
          const poolStageId = rule.destinationStageNumber
            ? stageIdByNumber.get(rule.destinationStageNumber)
            : undefined;
          if (!poolStageId) {
            return { position: rule.position, destinationType: 'ELIMINATED' as const };
          }
          return { position: rule.position, destinationType: 'POOL_STAGE' as const, poolStageId };
        }
        return { position: rule.position, destinationType: 'ELIMINATED' as const };
      });

    return {
      ...stage,
      rankingDestinations,
      losersAdvanceToBracket: rankingDestinations.some((destination) => destination.destinationType === 'BRACKET'),
    };
  });

  return {
    poolStages,
    brackets,
  };
};

const buildTemplateFromEditorState = (
  format: TournamentFormat,
  poolStages: PoolStageConfig[],
  brackets: BracketConfig[]
): TournamentPresetTemplateConfig => {
  const sortedStages = [...poolStages].toSorted((first, second) => first.stageNumber - second.stageNumber);
  const stageNumberById = new Map(sortedStages.map((stage) => [stage.id, stage.stageNumber]));
  const bracketNameById = new Map(brackets.map((bracket) => [bracket.id, bracket.name]));

  const routingRules: TournamentPresetTemplateConfig['routingRules'] = [];

  const resolveRoutingRule = (
    stageNumber: number,
    destination: PoolStageRankingDestination
  ): TournamentPresetTemplateConfig['routingRules'][number] => {
    if (destination.destinationType === 'POOL_STAGE') {
      const destinationStageNumber = destination.poolStageId
        ? stageNumberById.get(destination.poolStageId)
        : undefined;
      if (destinationStageNumber) {
        return {
          stageNumber,
          position: destination.position,
          destinationType: 'POOL_STAGE',
          destinationStageNumber,
        };
      }
    }

    if (destination.destinationType === 'BRACKET') {
      const destinationBracketName = destination.bracketId
        ? bracketNameById.get(destination.bracketId)
        : undefined;
      if (destinationBracketName) {
        return {
          stageNumber,
          position: destination.position,
          destinationType: 'BRACKET',
          destinationBracketName,
        };
      }
    }

    return {
      stageNumber,
      position: destination.position,
      destinationType: 'ELIMINATED',
    };
  };

  for (const stage of sortedStages) {
    const normalizedDestinations = normalizeStageRankingDestinations(stage, brackets);
    routingRules.push(...normalizedDestinations.map((destination) => resolveRoutingRule(stage.stageNumber, destination)));
  }

  return {
    format,
    stages: sortedStages.map((stage) => ({
      name: stage.name,
      poolCount: stage.poolCount,
      playersPerPool: stage.playersPerPool,
      advanceCount: stage.advanceCount,
      ...(stage.matchFormatKey ? { matchFormatKey: stage.matchFormatKey } : {}),
      ...((stage as PoolStageConfig & { inParallelWith?: string[] }).inParallelWith
        ? { inParallelWith: (stage as PoolStageConfig & { inParallelWith?: string[] }).inParallelWith }
        : {}),
    })),
    brackets: brackets.map((bracket) => ({
      name: bracket.name,
      totalRounds: bracket.totalRounds,
      ...(bracket.roundMatchFormats ? { roundMatchFormats: bracket.roundMatchFormats } : {}),
      ...((bracket as BracketConfig & { inParallelWith?: string[] }).inParallelWith
        ? { inParallelWith: (bracket as BracketConfig & { inParallelWith?: string[] }).inParallelWith }
        : {}),
    })),
    routingRules,
  };
};

function TournamentPresetsView({ mode = 'list' }: TournamentPresetsViewProperties) {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const [presets, setPresets] = useState<ManagedPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPresetId, setEditingPresetId] = useState<string | undefined>();
  const [formState, setFormState] = useState<PresetFormState>(defaultFormState);
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const editorSectionReference = useRef<HTMLElement | null>(null);

  const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
  const [brackets, setBrackets] = useState<BracketConfig[]>([]);
  const [isAddingPoolStage, setIsAddingPoolStage] = useState(false);
  const [isAddingBracket, setIsAddingBracket] = useState(false);
  const [newPoolStage, setNewPoolStage] = useState<NewPoolStageDraft>({
    stageNumber: 1,
    name: 'Stage 1',
    poolCount: 2,
    playersPerPool: 4,
    advanceCount: 2,
    matchFormatKey: 'BO3',
    losersAdvanceToBracket: false,
    rankingDestinations: [],
  });
  const [newBracket, setNewBracket] = useState<NewBracketDraft>({
    name: 'Bracket 1',
    bracketType: BracketType.SINGLE_ELIMINATION,
    totalRounds: 3,
    roundMatchFormats: { '1': 'BO3', '2': 'BO5', '3': 'BO5_F' },
  });
  const modeParameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const presetIdToEdit = modeParameters.get('presetId');
  const isListMode = mode === 'list';
  const isEditorMode = mode === 'editor';

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) {
      return undefined;
    }
    try {
      return await getAccessTokenSilently();
    } catch {
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);

  const applyTemplateConfigToEditor = useCallback((config: TournamentPresetTemplateConfig) => {
    const editorState = buildEditorStateFromTemplate(config);
    setPoolStages(editorState.poolStages);
    setBrackets(editorState.brackets);
    setNewPoolStage({
      stageNumber: editorState.poolStages.length + 1,
      name: `Stage ${editorState.poolStages.length + 1}`,
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      matchFormatKey: 'BO3',
      inParallelWith: [],
      losersAdvanceToBracket: false,
      rankingDestinations: [],
    });
    setNewBracket({
      name: `Bracket ${editorState.brackets.length + 1}`,
      bracketType: BracketType.SINGLE_ELIMINATION,
      totalRounds: 3,
      roundMatchFormats: { '1': 'BO3', '2': 'BO5', '3': 'BO5_F' },
      inParallelWith: [],
    });
  }, []);

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSafeAccessToken();
      const data = await fetchTournamentPresets(token);
      setPresets(data);
      setFormError(undefined);
    } catch (error_) {
      setFormError(error_ instanceof Error ? error_.message : t('presetManager.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [getSafeAccessToken, t]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    const defaultConfig = getDefaultPresetTemplateConfig(defaultPresetType, 16);
    applyTemplateConfigToEditor(defaultConfig);
  }, [applyTemplateConfigToEditor]);

  const sortedPresets = useMemo(
    () => [...presets].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    [presets]
  );

  const returnToEditUrl = useMemo(() => {
    if (!globalThis.window) {
      return undefined;
    }
    const url = new URL(globalThis.window.location.href);
    const from = url.searchParams.get('from');
    const tournamentId = url.searchParams.get('tournamentId');
    if (from !== 'edit-tournament' || !tournamentId) {
      return undefined;
    }
    const targetUrl = new URL(globalThis.window.location.href);
    targetUrl.searchParams.set('view', 'edit-tournament');
    targetUrl.searchParams.set('tournamentId', tournamentId);
    targetUrl.searchParams.delete('from');
    return `${targetUrl.pathname}${targetUrl.search}`;
  }, []);

  const resetForm = () => {
    setEditingPresetId(undefined);
    setFormState(defaultFormState);
    applyTemplateConfigToEditor(getDefaultPresetTemplateConfig(defaultPresetType, 16));
    setIsAddingPoolStage(false);
    setIsAddingBracket(false);
    setFormError(undefined);
  };

  const validateForm = (): { participants: number; targets: number } | undefined => {
    const participants = Number(formState.totalParticipants);
    const targets = Number(formState.targetCount);

    if (!formState.name.trim()) {
      setFormError(t('presetManager.errors.nameRequired'));
      return undefined;
    }
    if (!Number.isFinite(participants) || participants < 4) {
      setFormError(t('presetManager.errors.participantsMin'));
      return undefined;
    }
    if (!Number.isFinite(targets) || targets < 1) {
      setFormError(t('presetManager.errors.targetsMin'));
      return undefined;
    }
    if (poolStages.length === 0) {
      setFormError(t('presetManager.errors.stagesRequired'));
      return undefined;
    }
    if (brackets.length === 0) {
      setFormError(t('presetManager.errors.bracketsRequired'));
      return undefined;
    }

    setFormError(undefined);
    return { participants, targets };
  };

  const handleSavePreset = async () => {
    const validated = validateForm();
    if (!validated) {
      return;
    }

    setSubmitting(true);
    try {
      const token = await getSafeAccessToken();
      const templateConfig = buildTemplateFromEditorState(formState.format, poolStages, brackets);

      if (editingPresetId) {
        await updateTournamentPreset(
          editingPresetId,
          {
            name: formState.name.trim(),
            presetType: formState.presetType,
            totalParticipants: validated.participants,
            targetCount: validated.targets,
            templateConfig,
          },
          token
        );
      } else {
        await createTournamentPreset(
          {
            name: formState.name.trim(),
            presetType: formState.presetType,
            totalParticipants: validated.participants,
            targetCount: validated.targets,
            templateConfig,
          },
          token
        );

        if (returnToEditUrl && globalThis.window) {
          globalThis.window.location.assign(returnToEditUrl);
          return;
        }
      }

      await loadPresets();
      resetForm();
    } catch (error_) {
      setFormError(error_ instanceof Error ? error_.message : t('presetManager.errors.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPreset = (preset: ManagedPreset) => {
    const config = preset.templateConfig ?? getDefaultPresetTemplateConfig(preset.presetType, preset.totalParticipants);

    setEditingPresetId(preset.id);
    setFormState({
      name: preset.name,
      presetType: preset.presetType,
      totalParticipants: String(preset.totalParticipants),
      targetCount: String(preset.targetCount),
      format: config.format,
    });
    applyTemplateConfigToEditor(config);
    setIsAddingPoolStage(false);
    setIsAddingBracket(false);
    setFormError(undefined);
    globalThis.window?.requestAnimationFrame(() => {
      editorSectionReference.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!isEditorMode || !presetIdToEdit || presets.length === 0) {
      return;
    }
    const matchingPreset = presets.find((preset) => preset.id === presetIdToEdit);
    if (matchingPreset) {
      handleEditPreset(matchingPreset);
    }
  }, [isEditorMode, presetIdToEdit, presets]);

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm(t('presetManager.confirmDelete'))) {
      return;
    }
    try {
      setSubmitting(true);
      const token = await getSafeAccessToken();
      await deleteTournamentPreset(presetId, token);
      await loadPresets();
      if (editingPresetId === presetId) {
        resetForm();
      }
    } catch (error_) {
      setFormError(error_ instanceof Error ? error_.message : t('presetManager.errors.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const updatePoolStage = (stageId: string, updater: (stage: PoolStageConfig) => PoolStageConfig) => {
    setPoolStages((current) => current.map((stage) => (stage.id === stageId ? updater(stage) : stage)));
  };

  const handlePoolStageDestinationChange = (
    stageId: string,
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => {
    updatePoolStage(stageId, (stage) => {
      const base = normalizeStageRankingDestinations(stage, brackets).filter((item) => item.position !== position);
      return {
        ...stage,
        rankingDestinations: [...base, { position, ...destination }].toSorted((a, b) => a.position - b.position),
      };
    });
  };

  const handlePoolStageStatusChange = (stage: PoolStageConfig, status: string) => {
    updatePoolStage(stage.id, (current) => ({ ...current, status }));
  };

  const applyParallelValuesToStage = (stage: PoolStageConfig, reference: string): PoolStageConfig => {
    const nextValues = toggleParallelReference(
      (stage as PoolStageConfig & { inParallelWith?: string[] }).inParallelWith,
      reference
    );
    const nextStage = { ...stage } as PoolStageConfig & { inParallelWith?: string[] };
    if (nextValues) {
      nextStage.inParallelWith = nextValues;
    } else {
      delete nextStage.inParallelWith;
    }
    return nextStage;
  };

  const applyParallelValuesToBracket = (bracket: BracketConfig, reference: string): BracketConfig => {
    const nextValues = toggleParallelReference(
      (bracket as BracketConfig & { inParallelWith?: string[] }).inParallelWith,
      reference
    );
    const nextBracket = { ...bracket } as BracketConfig & { inParallelWith?: string[] };
    if (nextValues) {
      nextBracket.inParallelWith = nextValues;
    } else {
      delete nextBracket.inParallelWith;
    }
    return nextBracket;
  };

  const handleToggleStageParallel = (stageId: string, reference: string) => {
    updatePoolStage(stageId, (current) => applyParallelValuesToStage(current, reference));
  };

  const handleToggleBracketParallel = (bracketId: string, reference: string) => {
    setBrackets((current) => current.map((item) => (
      item.id === bracketId ? applyParallelValuesToBracket(item, reference) : item
    )));
  };

  const handleAddPoolStage = async () => {
    const stageId = makeId('stage', poolStages.length);
    setPoolStages((current) => [...current, {
      id: stageId,
      tournamentId: PRESET_TOURNAMENT_ID,
      stageNumber: newPoolStage.stageNumber,
      name: newPoolStage.name,
      poolCount: newPoolStage.poolCount,
      playersPerPool: newPoolStage.playersPerPool,
      advanceCount: newPoolStage.advanceCount,
      ...(newPoolStage.matchFormatKey ? { matchFormatKey: newPoolStage.matchFormatKey } : {}),
      ...(newPoolStage.inParallelWith && newPoolStage.inParallelWith.length > 0
        ? { inParallelWith: newPoolStage.inParallelWith }
        : {}),
      losersAdvanceToBracket: newPoolStage.losersAdvanceToBracket,
      rankingDestinations: newPoolStage.rankingDestinations ?? [],
      status: 'EDITION',
    }]);
    setIsAddingPoolStage(false);
    setNewPoolStage({
      stageNumber: poolStages.length + 2,
      name: `Stage ${poolStages.length + 2}`,
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      matchFormatKey: 'BO3',
      inParallelWith: [],
      losersAdvanceToBracket: false,
      rankingDestinations: [],
    });
    return true;
  };

  const handleAddBracket = () => {
    const bracketId = makeId('bracket', brackets.length);
    setBrackets((current) => [...current, {
      id: bracketId,
      tournamentId: PRESET_TOURNAMENT_ID,
      name: newBracket.name,
      bracketType: newBracket.bracketType,
      totalRounds: newBracket.totalRounds,
      ...(newBracket.roundMatchFormats ? { roundMatchFormats: newBracket.roundMatchFormats } : {}),
      ...(newBracket.inParallelWith && newBracket.inParallelWith.length > 0
        ? { inParallelWith: newBracket.inParallelWith }
        : {}),
      status: 'NOT_STARTED',
      targetIds: [],
    }]);
    setIsAddingBracket(false);
    setNewBracket({
      name: `Bracket ${brackets.length + 2}`,
      bracketType: BracketType.SINGLE_ELIMINATION,
      totalRounds: 3,
      roundMatchFormats: { '1': 'BO3', '2': 'BO5', '3': 'BO5_F' },
      inParallelWith: [],
    });
  };

  const presetsSectionContent = (() => {
    if (loading) {
      return <p className="mt-4 text-sm text-slate-400">{t('presetManager.loading')}</p>;
    }
    if (sortedPresets.length === 0) {
      return <p className="mt-4 text-sm text-slate-400">{t('presetManager.empty')}</p>;
    }
    return (
      <div className="mt-4 space-y-3">
        {sortedPresets.map((preset) => (
          <div
            key={preset.id}
            className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] transition hover:border-cyan-400/50 hover:shadow-[0_20px_60px_-40px_rgba(34,211,238,0.8)]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-white">{preset.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {t('presetManager.type')} • {getPresetTypeLabel(preset.presetType, t)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('presetManager.participants')}</p>
                  <p className="mt-1 text-base font-semibold text-white">{preset.totalParticipants}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('presetManager.targets')}</p>
                  <p className="mt-1 text-base font-semibold text-white">{preset.targetCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('presetManager.stageCount')}</p>
                  <p className="mt-1 text-base font-semibold text-white">{preset.templateConfig?.stages.length ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('presetManager.bracketCount')}</p>
                  <p className="mt-1 text-base font-semibold text-white">{preset.templateConfig?.brackets.length ?? 0}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {getPresetTypeLabel(preset.presetType, t)}
                {' • ID: '}
                {preset.id}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
              <button
                onClick={() => {
                  if (!globalThis.window) {
                    return;
                  }
                  const url = new URL(globalThis.window.location.href);
                  url.searchParams.set('view', 'tournament-preset-editor');
                  url.searchParams.set('presetId', preset.id);
                  globalThis.window.location.assign(`${url.pathname}${url.search}`);
                }}
                disabled={submitting}
                className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
              >
                {t('common.edit')}
              </button>
              <button
                onClick={() => {
                  void handleDeletePreset(preset.id);
                }}
                disabled={submitting}
                className="w-full rounded-full border border-rose-500/60 px-4 py-1.5 text-center text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 sm:w-auto"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  })();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('presetManager.title')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">{t('presetManager.heading')}</h2>
        <p className="text-sm text-slate-400 mt-2">{t('presetManager.subtitle')}</p>
      </div>

      {isListMode && (
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">{t('presetManager.savedPresets')}</h3>
            <a
              href="/?view=tournament-preset-editor"
              className="rounded-full border border-emerald-500/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300"
            >
              {t('presetManager.createPreset')}
            </a>
          </div>
          {presetsSectionContent}
        </section>
      )}

      {isEditorMode && (
      <section
        ref={editorSectionReference}
        className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <a
            href="/?view=tournament-presets"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('common.back')}
          </a>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{t('edit.quickStructureTitle')}</h3>
          <p className="mt-1 text-xs text-slate-400">{t('edit.quickStructureHint')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            {t('presetManager.name')}
            <input
              type="text"
              value={formState.name}
              onChange={(event_) => setFormState((current) => ({ ...current, name: event_.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t('presetManager.type')}
            <select
              value={formState.presetType}
              onChange={(event_) => {
                const nextPresetType = event_.target.value as TournamentPresetType;
                const participantCount = Number.parseInt(formState.totalParticipants, 10) || 16;
                const config = getDefaultPresetTemplateConfig(nextPresetType, participantCount);
                setFormState((current) => ({
                  ...current,
                  presetType: nextPresetType,
                  format: config.format,
                }));
                applyTemplateConfigToEditor(config);
              }}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            >
              <option value="single-pool-stage">{t('presetManager.typeSingle')}</option>
              <option value="three-pool-stages">{t('presetManager.typeThreeStages')}</option>
              <option value="custom">{t('presetManager.typeCustom')}</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t('presetManager.participants')}
            <input
              type="number"
              min={4}
              value={formState.totalParticipants}
              onChange={(event_) => setFormState((current) => ({ ...current, totalParticipants: event_.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t('presetManager.targets')}
            <input
              type="number"
              min={1}
              value={formState.targetCount}
              onChange={(event_) => setFormState((current) => ({ ...current, targetCount: event_.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t('presetManager.format')}
            <select
              value={formState.format}
              onChange={(event_) => setFormState((current) => ({ ...current, format: event_.target.value as TournamentFormat }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            >
              <option value={TournamentFormat.SINGLE}>{t('presetManager.formatSingle')}</option>
              <option value={TournamentFormat.DOUBLE}>{t('presetManager.formatDouble')}</option>
            </select>
          </label>
        </div>

        <PoolStagesEditor
          t={t}
          poolStages={poolStages}
          brackets={brackets}
          isTournamentLive={false}
          showStageStatusControl={false}
          showEditPlayersButton={false}
          poolStagesError={undefined}
          isAddingPoolStage={isAddingPoolStage}
          newPoolStage={newPoolStage}
          onLoadPoolStages={() => undefined}
          onPoolStageNumberChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, stageNumber: value }))}
          onPoolStageNameChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, name: value }))}
          onPoolStagePoolCountChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, poolCount: value }))}
          onPoolStagePlayersPerPoolChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, playersPerPool: value }))}
          onPoolStageAdvanceCountChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, advanceCount: value }))}
          onPoolStageMatchFormatChange={(id, value) => updatePoolStage(id, (stage) => {
            if (value === undefined) {
              const rest = { ...stage };
              delete rest.matchFormatKey;
              return rest;
            }
            return { ...stage, matchFormatKey: value };
          })}
          onPoolStageLosersAdvanceChange={(id, value) => updatePoolStage(id, (stage) => ({ ...stage, losersAdvanceToBracket: value }))}
          onPoolStageRankingDestinationChange={handlePoolStageDestinationChange}
          onPoolStageStatusChange={handlePoolStageStatusChange}
          onOpenPoolStageAssignments={() => undefined}
          onSavePoolStage={(stage) => updatePoolStage(stage.id, () => stage)}
          onRemovePoolStage={(id) => setPoolStages((current) => current.filter((stage) => stage.id !== id))}
          onStartAddPoolStage={() => setIsAddingPoolStage(true)}
          onCancelAddPoolStage={() => setIsAddingPoolStage(false)}
          onNewPoolStageStageNumberChange={(value) => setNewPoolStage((current) => ({ ...current, stageNumber: value }))}
          onNewPoolStageNameChange={(value) => setNewPoolStage((current) => ({ ...current, name: value }))}
          onNewPoolStagePoolCountChange={(value) => setNewPoolStage((current) => ({ ...current, poolCount: value }))}
          onNewPoolStagePlayersPerPoolChange={(value) => setNewPoolStage((current) => ({ ...current, playersPerPool: value }))}
          onNewPoolStageAdvanceCountChange={(value) => setNewPoolStage((current) => ({ ...current, advanceCount: value }))}
          onNewPoolStageMatchFormatChange={(value) => setNewPoolStage((current) => {
            if (value === undefined) {
              const rest = { ...current };
              delete rest.matchFormatKey;
              return rest;
            }
            return { ...current, matchFormatKey: value };
          })}
          onNewPoolStageLosersAdvanceChange={(value) => setNewPoolStage((current) => ({ ...current, losersAdvanceToBracket: value }))}
          onNewPoolStageRankingDestinationChange={(position, destination) => {
            setNewPoolStage((current) => {
              const nextDestinations = (current.rankingDestinations ?? []).filter((item) => item.position !== position);
              return {
                ...current,
                rankingDestinations: [...nextDestinations, { position, ...destination }],
              };
            });
          }}
          onAddPoolStage={handleAddPoolStage}
          getStatusLabel={(kind, status) => getStatusLabel(t, kind, status)}
          normalizeStageStatus={normalizeStageStatus}
        />

        <BracketsEditor
          t={t}
          canEditBrackets
          canAddBrackets
          showBracketStatusControl={false}
          showSaveTargetsButton={false}
          brackets={brackets}
          bracketsError={undefined}
          targets={[]}
          targetsError={undefined}
          isAddingBracket={isAddingBracket}
          newBracket={newBracket}
          onLoadBrackets={() => undefined}
          onBracketNameChange={(id, value) => setBrackets((current) => current.map((bracket) => (
            bracket.id === id ? { ...bracket, name: value } : bracket
          )))}
          onBracketTypeChange={() => undefined}
          onBracketRoundsChange={(id, value) => setBrackets((current) => current.map((bracket) => (
            bracket.id === id ? { ...bracket, totalRounds: value } : bracket
          )))}
          onBracketRoundMatchFormatChange={(id, roundNumber, value) => setBrackets((current) => current.map((bracket) => {
            if (bracket.id !== id) {
              return bracket;
            }
            const nextRoundMatchFormats: Record<string, string> = {
              ...bracket.roundMatchFormats,
            };
            if (value === undefined) {
              delete nextRoundMatchFormats[String(roundNumber)];
            } else {
              nextRoundMatchFormats[String(roundNumber)] = value;
            }
            return {
              ...bracket,
              roundMatchFormats: nextRoundMatchFormats,
            };
          }))}
          onBracketStatusChange={(id, value) => setBrackets((current) => current.map((bracket) => (
            bracket.id === id ? { ...bracket, status: value } : bracket
          )))}
          onBracketTargetToggle={() => undefined}
          onSaveBracket={(bracket) => setBrackets((current) => current.map((item) => (
            item.id === bracket.id ? bracket : item
          )))}
          onSaveBracketTargets={() => undefined}
          onRemoveBracket={(id) => setBrackets((current) => current.filter((bracket) => bracket.id !== id))}
          onStartAddBracket={() => setIsAddingBracket(true)}
          onCancelAddBracket={() => setIsAddingBracket(false)}
          onNewBracketNameChange={(value) => setNewBracket((current) => ({ ...current, name: value }))}
          onNewBracketTypeChange={(value) => setNewBracket((current) => ({ ...current, bracketType: value }))}
          onNewBracketRoundsChange={(value) => setNewBracket((current) => ({ ...current, totalRounds: value }))}
          onNewBracketRoundMatchFormatChange={(roundNumber, value) => setNewBracket((current) => {
            const nextRoundMatchFormats: Record<string, string> = {
              ...current.roundMatchFormats,
            };
            if (value === undefined) {
              delete nextRoundMatchFormats[String(roundNumber)];
            } else {
              nextRoundMatchFormats[String(roundNumber)] = value;
            }
            return {
              ...current,
              roundMatchFormats: nextRoundMatchFormats,
            };
          })}
          onAddBracket={handleAddBracket}
          getStatusLabel={(kind, status) => getStatusLabel(t, kind, status)}
        />

        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-white">in_parallel_with</h4>
          <p className="text-xs text-slate-400">
            Sélectionne les phases/arbres qui tournent en parallèle pour chaque élément.
          </p>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pool stages</p>
            {poolStages
              .toSorted((first, second) => first.stageNumber - second.stageNumber)
              .map((stage) => {
                const parallelValues = (stage as PoolStageConfig & { inParallelWith?: string[] }).inParallelWith;
                const stageOptions = poolStages
                  .filter((candidate) => candidate.id !== stage.id)
                  .toSorted((first, second) => first.stageNumber - second.stageNumber)
                  .map((candidate) => ({
                    value: `stage:${candidate.stageNumber}`,
                    label: `Stage ${candidate.stageNumber} · ${candidate.name}`,
                  }));
                const bracketOptions = brackets.map((bracket) => ({
                  value: `bracket:${bracket.name}`,
                  label: `Bracket · ${bracket.name}`,
                }));
                const options = [...stageOptions, ...bracketOptions];
                return (
                  <div key={`parallel-stage-${stage.id}`} className="block text-xs text-slate-400 space-y-2">
                    <span>Stage {stage.stageNumber} · {stage.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const selected = (parallelValues ?? []).includes(option.value);
                        return (
                          <button
                            key={`${stage.id}-${option.value}`}
                            type="button"
                            onClick={() => handleToggleStageParallel(stage.id, option.value)}
                            className={`rounded-full border px-3 py-1 text-[11px] transition ${selected
                              ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-100'
                              : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Brackets</p>
            {brackets.map((bracket) => {
              const parallelValues = (bracket as BracketConfig & { inParallelWith?: string[] }).inParallelWith;
              const stageOptions = poolStages
                .toSorted((first, second) => first.stageNumber - second.stageNumber)
                .map((stage) => ({
                  value: `stage:${stage.stageNumber}`,
                  label: `Stage ${stage.stageNumber} · ${stage.name}`,
                }));
              const bracketOptions = brackets
                .filter((candidate) => candidate.id !== bracket.id)
                .map((candidate) => ({
                  value: `bracket:${candidate.name}`,
                  label: `Bracket · ${candidate.name}`,
                }));
              const options = [...stageOptions, ...bracketOptions];
              return (
                <div key={`parallel-bracket-${bracket.id}`} className="block text-xs text-slate-400 space-y-2">
                  <span>{bracket.name}</span>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => {
                      const selected = (parallelValues ?? []).includes(option.value);
                      return (
                        <button
                          key={`${bracket.id}-${option.value}`}
                          type="button"
                          onClick={() => handleToggleBracketParallel(bracket.id, option.value)}
                          className={`rounded-full border px-3 py-1 text-[11px] transition ${selected
                            ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                            : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {formError && <p className="text-sm text-rose-300">{formError}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={resetForm}
            disabled={submitting}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => {
              void handleSavePreset();
            }}
            disabled={submitting}
            className="rounded-full border border-emerald-500/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300"
          >
            {t('common.save')}
          </button>
        </div>
      </section>
      )}
    </div>
  );
}

export default TournamentPresetsView;
