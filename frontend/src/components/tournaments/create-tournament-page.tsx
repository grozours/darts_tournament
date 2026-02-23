import { useMemo, useState } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useI18n } from '../../i18n';
import { TournamentFormat, DurationType, BracketType } from '@shared/types';
import TournamentForm from './tournament-form';
import {
  createTournament,
  createPoolStage,
  createBracket,
  updatePoolStage,
} from '../../services/tournament-service';

type PresetErrors = {
  name?: string;
  totalParticipants?: string;
  targetCount?: string;
  submit?: string;
};

type PresetType = 'single' | 'double';

type PresetTemplate = {
  format: TournamentFormat;
  stages: Array<{
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket: boolean;
  }>;
  brackets: Array<{ name: string; bracketType: BracketType; totalRounds: number }>;
};

type PresetTemplateBuilder = (
  poolCount: number,
  stage2PoolCount: number,
  stage3PoolCount: number,
  losersAdvanceToBracket: boolean
) => PresetTemplate;

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
  const [presetParticipants, setPresetParticipants] = useState('16');
  const [presetTargets, setPresetTargets] = useState('4');
  const [presetErrors, setPresetErrors] = useState<PresetErrors>({});
  const [presetSubmitting, setPresetSubmitting] = useState(false);

  const presetTemplates = useMemo<Record<PresetType, PresetTemplateBuilder>>(
    () => ({
      single: (poolCount, _stage2PoolCount, _stage3PoolCount, losersAdvanceToBracket) => ({
        format: TournamentFormat.SINGLE,
        stages: [
          { stageNumber: 1, name: 'Stage 1', poolCount, playersPerPool: 5, advanceCount: 2, losersAdvanceToBracket },
        ],
        brackets: [
          { name: 'Loser Bracket', bracketType: BracketType.SINGLE_ELIMINATION, totalRounds: 3 },
          { name: 'Winner Bracket', bracketType: BracketType.SINGLE_ELIMINATION, totalRounds: 3 },
        ],
      }),
      double: (poolCount, stage2PoolCount, stage3PoolCount, losersAdvanceToBracket) => ({
        format: TournamentFormat.DOUBLE,
        stages: [
          { stageNumber: 1, name: 'Brassage', poolCount, playersPerPool: 5, advanceCount: 5, losersAdvanceToBracket },
          { stageNumber: 2, name: 'Niveau A', poolCount: stage2PoolCount, playersPerPool: 4, advanceCount: 2, losersAdvanceToBracket: false },
          { stageNumber: 3, name: 'Niveau B', poolCount: stage3PoolCount, playersPerPool: 4, advanceCount: 2, losersAdvanceToBracket: false },
        ],
        brackets: [
          { name: 'Niveau A', bracketType: BracketType.SINGLE_ELIMINATION, totalRounds: 3 },
          { name: 'Niveau B', bracketType: BracketType.SINGLE_ELIMINATION, totalRounds: 3 },
          { name: 'Niveau C', bracketType: BracketType.SINGLE_ELIMINATION, totalRounds: 3 },
        ],
      }),
    }),
    []
  );

  const validatePreset = () => {
    const nextErrors: PresetErrors = {};
    const totalParticipants = Number(presetParticipants);
    const targetCount = Number(presetTargets);

    if (!presetName.trim()) {
      nextErrors.name = t('createTournament.errors.nameRequired');
    }

    if (!Number.isFinite(totalParticipants) || totalParticipants < 4) {
      nextErrors.totalParticipants = t('createTournament.errors.participantsMin');
    }

    if (!Number.isFinite(targetCount) || targetCount < 1) {
      nextErrors.targetCount = t('createTournament.errors.targetsMin');
    }

    return { nextErrors, totalParticipants, targetCount };
  };

  const handlePresetCreate = async (preset: PresetType) => {
    if (authEnabled && !isAuthenticated) {
      setPresetErrors({ submit: t('createTournament.errors.signInRequired') });
      await loginWithRedirect();
      return;
    }

    const { nextErrors, totalParticipants, targetCount } = validatePreset();
    if (Object.keys(nextErrors).length > 0) {
      setPresetErrors(nextErrors);
      return;
    }

    setPresetSubmitting(true);
    setPresetErrors({});

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const poolCount = Math.max(1, Math.floor(totalParticipants / 5));
      const stage2PoolCount = Math.max(1, Math.ceil(poolCount / 2));
      const stage3PoolCount = Math.max(1, Math.ceil(poolCount / 2));
      const templateBuilder = presetTemplates[preset];
      const template = templateBuilder(poolCount, stage2PoolCount, stage3PoolCount, true);
      const { startTime, endTime } = getDateOffsets();

      const created = await createTournament({
        name: presetName.trim(),
        format: template.format,
        durationType: DurationType.HALF_DAY_MORNING,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalParticipants,
        targetCount,
        doubleStageEnabled: preset === 'double',
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

      if (preset === 'double') {
        const stageBrassage = createdStages.find((stage) => stage.stageNumber === 1);
        const stageA = createdStages.find((stage) => stage.stageNumber === 2);
        const stageB = createdStages.find((stage) => stage.stageNumber === 3);
        const bracketA = createdBrackets.find((bracket) => bracket.name === 'Niveau A');
        const bracketB = createdBrackets.find((bracket) => bracket.name === 'Niveau B');
        const bracketC = createdBrackets.find((bracket) => bracket.name === 'Niveau C');

        if (stageBrassage && stageA && stageB && bracketA && bracketB && bracketC) {
          await updatePoolStage(created.id, stageBrassage.id, {
            rankingDestinations: [
              { position: 1, destinationType: 'POOL_STAGE', poolStageId: stageA.id },
              { position: 2, destinationType: 'POOL_STAGE', poolStageId: stageA.id },
              { position: 3, destinationType: 'POOL_STAGE', poolStageId: stageB.id },
              { position: 4, destinationType: 'POOL_STAGE', poolStageId: stageB.id },
              { position: 5, destinationType: 'BRACKET', bracketId: bracketC.id },
            ],
          }, token);
          await updatePoolStage(created.id, stageA.id, {
            rankingDestinations: [
              { position: 1, destinationType: 'BRACKET', bracketId: bracketA.id },
              { position: 2, destinationType: 'BRACKET', bracketId: bracketA.id },
              { position: 3, destinationType: 'ELIMINATED' },
              { position: 4, destinationType: 'ELIMINATED' },
            ],
          }, token);
          await updatePoolStage(created.id, stageB.id, {
            rankingDestinations: [
              { position: 1, destinationType: 'BRACKET', bracketId: bracketB.id },
              { position: 2, destinationType: 'BRACKET', bracketId: bracketB.id },
              { position: 3, destinationType: 'ELIMINATED' },
              { position: 4, destinationType: 'ELIMINATED' },
            ],
          }, token);
        }
      }

      if (globalThis.window) {
        globalThis.window.location.href = '/?status=DRAFT';
      }
    } catch (error) {
      console.error('Error creating tournament preset:', error);
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

          <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <label htmlFor="preset-participants" className="text-sm text-slate-300">
              {t('createTournament.presets.participantsLabel')}
            </label>
            <input
              id="preset-participants"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              type="number"
              value={presetParticipants}
              onChange={(event) => setPresetParticipants(event.target.value)}
              min={4}
            />
            {presetErrors.totalParticipants && (
              <p className="text-xs text-rose-300">{presetErrors.totalParticipants}</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <label htmlFor="preset-targets" className="text-sm text-slate-300">
              {t('createTournament.presets.targetsLabel')}
            </label>
            <input
              id="preset-targets"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              type="number"
              value={presetTargets}
              onChange={(event) => setPresetTargets(event.target.value)}
              min={1}
            />
            {presetErrors.targetCount && (
              <p className="text-xs text-rose-300">{presetErrors.targetCount}</p>
            )}
          </div>

        </div>

        {presetErrors.submit && (
          <p className="mt-4 text-sm text-rose-300">{presetErrors.submit}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={presetSubmitting}
            onClick={() => handlePresetCreate('single')}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {t('createTournament.presets.single')}
          </button>
          <button
            type="button"
            disabled={presetSubmitting}
            onClick={() => handlePresetCreate('double')}
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:opacity-60"
          >
            {t('createTournament.presets.double')}
          </button>
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
