import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useI18n } from '../../i18n';
import { DurationType } from '@shared/types';
import TournamentForm from './tournament-form';
import {
  createTournament,
  fetchTournamentPresets,
  createPoolStage,
  createBracket,
  type TournamentPreset,
  updatePoolStage,
} from '../../services/tournament-service';
import {
  buildPresetRoutingUpdates,
  buildTournamentPresetTemplate,
} from '../../utils/tournament-presets';

type PresetErrors = {
  name?: string;
  presets?: string;
  submit?: string;
};

type PresetDefinition = Pick<TournamentPreset, 'name' | 'presetType' | 'totalParticipants' | 'targetCount' | 'templateConfig'>;

const fallbackPresets: PresetDefinition[] = [
  {
    name: 'Single pool stage',
    presetType: 'single-pool-stage',
    totalParticipants: 16,
    targetCount: 4,
  },
  {
    name: 'Three pool stages',
    presetType: 'three-pool-stages',
    totalParticipants: 16,
    targetCount: 4,
  },
];

const getDateOffsets = () => {
  const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const endTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return { startTime, endTime };
};

export default function CreateTournamentPage() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const [presetName, setPresetName] = useState('');
  const [presetErrors, setPresetErrors] = useState<PresetErrors>({});
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [presetLoading, setPresetLoading] = useState(true);
  const [loadedPresets, setLoadedPresets] = useState<TournamentPreset[]>([]);

  const availablePresets = useMemo<PresetDefinition[]>(
    () => (loadedPresets.length > 0 ? loadedPresets : fallbackPresets),
    [loadedPresets]
  );

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

  useEffect(() => {
    const loadPresets = async () => {
      setPresetLoading(true);
      try {
        const token = await getSafeAccessToken();
        const presets = await fetchTournamentPresets(token);
        setLoadedPresets(presets);
        setPresetErrors((current) => {
          const next = { ...current };
          delete next.presets;
          return next;
        });
      } catch {
        setLoadedPresets([]);
        setPresetErrors((current) => ({ ...current, presets: t('createTournament.errors.failedLoadPresets') }));
      } finally {
        setPresetLoading(false);
      }
    };

    void loadPresets();
  }, [getSafeAccessToken, t]);

  const validatePreset = () => {
    const nextErrors: PresetErrors = {};

    if (!presetName.trim()) {
      nextErrors.name = t('createTournament.errors.nameRequired');
    }

    return { nextErrors };
  };

  const handlePresetCreate = async (preset: PresetDefinition) => {
    if (authEnabled && !isAuthenticated) {
      setPresetErrors({ submit: t('createTournament.errors.signInRequired') });
      await loginWithRedirect();
      return;
    }

    const { nextErrors } = validatePreset();
    if (Object.keys(nextErrors).length > 0) {
      setPresetErrors(nextErrors);
      return;
    }

    setPresetSubmitting(true);
    setPresetErrors({});

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const totalParticipants = preset.totalParticipants;
      const targetCount = preset.targetCount;
      const template = buildTournamentPresetTemplate(preset, totalParticipants);
      const { startTime, endTime } = getDateOffsets();

      const created = await createTournament({
        name: presetName.trim(),
        format: template.format,
        durationType: DurationType.HALF_DAY_MORNING,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalParticipants,
        targetCount,
        doubleStageEnabled: template.format === 'DOUBLE',
      }, token);

      const createdStages = [];
      for (const stage of template.stages) {
        const createdStage = await createPoolStage(created.id, stage, token);
        createdStages.push(createdStage);
      }
      const createdBrackets = [];
      for (const bracket of template.brackets) {
        const createdBracket = await createBracket(created.id, bracket, token);
        createdBrackets.push(createdBracket);
      }

      const routingUpdates = buildPresetRoutingUpdates(preset.templateConfig, createdStages, createdBrackets);
      for (const update of routingUpdates) {
        await updatePoolStage(created.id, update.stageId, {
          rankingDestinations: update.rankingDestinations,
        }, token);
      }

      if (globalThis.window) {
        globalThis.window.location.href = '/?status=DRAFT';
      }
    } catch {
      setPresetErrors({ submit: t('createTournament.errors.failed') });
    } finally {
      setPresetSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('tournaments.create')}</p>
        <h2 className="text-2xl font-semibold text-white">{t('tournaments.create')}</h2>
        <p className="text-sm text-slate-400">
          {t('createTournament.subtitle')}
        </p>
      </div>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('createTournament.presets.title')}</h3>
            <p className="text-sm text-slate-400">
              {t('createTournament.presets.subtitle')}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <label htmlFor="preset-name" className="text-sm text-slate-300">
              {t('createTournament.presets.nameLabel')}
            </label>
            <input
              id="preset-name"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder={t('createTournament.presets.namePlaceholder')}
            />
            {presetErrors.name && <p className="text-xs text-rose-300">{presetErrors.name}</p>}
          </div>

        </div>

        {presetErrors.presets && (
          <p className="mt-4 text-sm text-amber-300">{presetErrors.presets}</p>
        )}

        {presetErrors.submit && (
          <p className="mt-4 text-sm text-rose-300">{presetErrors.submit}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {presetLoading && (
            <span className="text-sm text-slate-400">{t('createTournament.presets.loading')}</span>
          )}
          {!presetLoading && availablePresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={presetSubmitting}
              onClick={() => {
                void handlePresetCreate(preset);
              }}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {preset.name} ({preset.totalParticipants}/{preset.targetCount})
            </button>
          ))}
          <a
            href="/"
            className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            {t('createTournament.backToTournaments')}
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white">{t('createTournament.custom.title')}</h3>
        <p className="text-sm text-slate-400">
          {t('createTournament.custom.subtitle')}
        </p>
        <div className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <TournamentForm
            onSubmit={() => {
              if (globalThis.window) {
                globalThis.window.location.href = '/?status=DRAFT';
              }
            }}
            onCancel={() => {
              if (globalThis.window) {
                globalThis.window.location.href = '/';
              }
            }}
          />
        </div>
      </section>
    </div>
  );
}
