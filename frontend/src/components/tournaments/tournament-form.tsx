import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useI18n } from '../../i18n';
import { TournamentFormat, DurationType } from '@shared/types';
import { localInputToIso } from '../tournament-list/tournament-date-helpers';
import {
  createTournament,
  uploadTournamentLogo,
} from '../../services/tournament-service';

interface TournamentFormProperties {
  readonly onSubmit: (data?: unknown) => void;
  readonly onCancel: () => void;
  readonly isLoading?: boolean;
}

type FormState = {
  name: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: string;
  targetCount: string;
  targetStartNumber: string;
  shareTargets: boolean;
  doubleStageEnabled: boolean;
};

type ErrorState = Partial<Record<keyof FormState | 'submit' | 'logo', string | undefined>>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const padNumber = (value: number) => String(value).padStart(2, '0');

const toLocalInput = (value: Date) =>
  `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(
    value.getDate()
  )}T${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;

export default function TournamentForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: TournamentFormProperties) {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const [formState, setFormState] = useState<FormState>({
    name: '',
    format: '',
    durationType: '',
    startTime: '',
    endTime: '',
    totalParticipants: '',
    targetCount: '',
    targetStartNumber: '',
    shareTargets: true,
    doubleStageEnabled: false,
  });
  const [errors, setErrors] = useState<ErrorState>({});
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: t('format.single') },
      { value: TournamentFormat.DOUBLE, label: t('format.double') },
      { value: TournamentFormat.TEAM_4_PLAYER, label: t('format.team4') },
    ],
    [t]
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.FULL_DAY, label: t('duration.fullDay') },
      { value: DurationType.HALF_DAY_MORNING, label: t('duration.halfDayMorning') },
      { value: DurationType.HALF_DAY_NIGHT, label: t('duration.halfDayNight') },
    ],
    [t]
  );

  const validateName = (value: string): string | undefined => {
    if (!value) return undefined;
    if (value.length < 3) return t('tournamentForm.errors.nameMin');
    if (value.length > 100) return t('tournamentForm.errors.nameMax');
    return undefined;
  };

  const validateParticipants = (value: string): string | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return t('tournamentForm.errors.participantsMin');
    if (parsed < 2) return t('tournamentForm.errors.participantsMin');
    if (parsed > 512) return t('tournamentForm.errors.participantsMax');
    return undefined;
  };

  const validateTargets = (value: string): string | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return t('tournamentForm.errors.targetsMin');
    if (parsed < 1) return t('tournamentForm.errors.targetsMin');
    if (parsed > 20) return t('tournamentForm.errors.targetsMax');
    return undefined;
  };

  const validateTargetStartNumber = (value: string): string | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return t('tournamentForm.errors.targetStartMin');
    if (parsed < 1) return t('tournamentForm.errors.targetStartMin');
    return undefined;
  };

  const validateStartTime = (value: string): string | undefined => {
    if (!value) return undefined;
    const start = new Date(value);
    const now = new Date();
    if (start.getTime() < now.getTime()) {
      return t('tournamentForm.errors.startPast');
    }
    return undefined;
  };

  const validateEndTime = (startValue: string, endValue: string): string | undefined => {
    if (!endValue || !startValue) return undefined;
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (end.getTime() <= start.getTime()) {
      return t('tournamentForm.errors.endBeforeStart');
    }
    return undefined;
  };

  const setField = (field: keyof FormState, value: string) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined, submit: undefined }));
  };

  const handleBlur = (field: keyof FormState) => {
    let error: string | undefined;

    if (field === 'name') error = validateName(formState.name);
    if (field === 'totalParticipants') {
      error = validateParticipants(formState.totalParticipants);
    }
    if (field === 'targetCount') error = validateTargets(formState.targetCount);
    if (field === 'targetStartNumber') {
      error = validateTargetStartNumber(formState.targetStartNumber);
    }
    if (field === 'startTime') error = validateStartTime(formState.startTime);
    if (field === 'endTime') {
      error = validateEndTime(formState.startTime, formState.endTime);
    }

    if (error) {
      setErrors((previous) => ({ ...previous, [field]: error }));
    }
  };

  const validateRequired = (state: FormState) => {
    const nextErrors: ErrorState = {};

    if (!state.name.trim()) {
      nextErrors.name = t('tournamentForm.errors.nameRequired');
    }
    if (!state.format) {
      nextErrors.format = t('tournamentForm.errors.formatRequired');
    }
    if (!state.startTime) {
      nextErrors.startTime = t('tournamentForm.errors.startRequired');
    }
    if (!state.endTime) {
      nextErrors.endTime = t('tournamentForm.errors.endRequired');
    }

    const nameValidation = validateName(state.name);
    if (nameValidation) nextErrors.name = nameValidation;

    const participantsValidation = validateParticipants(
      state.totalParticipants
    );
    if (participantsValidation) nextErrors.totalParticipants = participantsValidation;

    const targetsValidation = validateTargets(state.targetCount);
    if (targetsValidation) nextErrors.targetCount = targetsValidation;

    const targetStartValidation = validateTargetStartNumber(state.targetStartNumber);
    if (targetStartValidation) nextErrors.targetStartNumber = targetStartValidation;

    const startTimeValidation = validateStartTime(state.startTime);
    if (startTimeValidation) nextErrors.startTime = startTimeValidation;

    const endTimeValidation = validateEndTime(
      state.startTime,
      state.endTime
    );
    if (endTimeValidation) nextErrors.endTime = endTimeValidation;

    return nextErrors;
  };

  const getSubmissionState = () => {
    const hasName = formState.name.trim().length > 0;
    if (!hasName) return formState;

    return {
      ...formState,
      format: formState.format || TournamentFormat.SINGLE,
      durationType: formState.durationType || DurationType.FULL_DAY,
      targetStartNumber: formState.targetStartNumber || '1',
      shareTargets: formState.shareTargets ?? true,
    };
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const hasValidExtension = /\.(png|jpe?g)$/i.test(file.name);
    const hasValidMime = ['image/png', 'image/jpeg'].includes(file.type);

    if (!hasValidMime && !hasValidExtension) {
      setErrors((previous) => ({
        ...previous,
        logo: t('tournamentForm.errors.fileType'),
      }));
      setLogoFile(undefined);
      setLogoPreview(undefined);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((previous) => ({
        ...previous,
        logo: t('tournamentForm.errors.fileSize'),
      }));
      setLogoFile(undefined);
      setLogoPreview(undefined);
      return;
    }

    setErrors((previous) => ({ ...previous, logo: undefined }));
    setLogoFile(file);
    const previewUrl =
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : 'blob:logo-preview';
    setLogoPreview(previewUrl);
  };

  const resetForm = () => {
    setFormState({
      name: '',
      format: '',
      durationType: '',
      startTime: '',
      endTime: '',
      totalParticipants: '',
      targetCount: '',
      targetStartNumber: '',
      shareTargets: true,
      doubleStageEnabled: false,
    });
    setLogoFile(undefined);
    setLogoPreview(undefined);
    setErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authEnabled && !isAuthenticated) {
      setErrors((previous) => ({ ...previous, submit: t('tournamentForm.errors.signInRequired') }));
      await loginWithRedirect();
      return;
    }

    const submissionState = getSubmissionState();
    const nextErrors = validateRequired(submissionState);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors((previous) => ({ ...previous, submit: undefined }));

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const result = await createTournament({
        name: submissionState.name.trim(),
        format: submissionState.format,
        durationType: submissionState.durationType,
        startTime: localInputToIso(submissionState.startTime),
        endTime: localInputToIso(submissionState.endTime),
        totalParticipants: Number(submissionState.totalParticipants || 0),
        targetCount: Number(submissionState.targetCount || 0),
        targetStartNumber: Number(submissionState.targetStartNumber || 1),
        shareTargets: submissionState.shareTargets,
        doubleStageEnabled: submissionState.doubleStageEnabled,
      }, token);

      if (logoFile) {
        await uploadTournamentLogo(result.id, logoFile, token);
      }

      resetForm();
      onSubmit(result);
    } catch (error) {
      console.error('Failed to create tournament', error);
      const errorMessage = error instanceof Error ? error.message : t('tournamentForm.errors.failedCreate');
      setErrors((previous) => ({ ...previous, submit: errorMessage }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label={t('tournaments.create')}
      noValidate
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label htmlFor="tournament-name" className="text-sm text-slate-300">
            {t('tournamentForm.nameLabel')}
          </label>
          <input
            id="tournament-name"
            type="text"
            required
            value={formState.name}
            onChange={(event) => setField('name', event.target.value)}
            onBlur={() => handleBlur('name')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            placeholder={t('tournamentForm.namePlaceholder')}
          />
          {errors.name && <p role="alert" className="text-xs text-rose-300">{errors.name}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="tournament-format" className="text-sm text-slate-300">
            {t('tournamentForm.formatLabel')}
          </label>
          <select
            id="tournament-format"
            required
            value={formState.format}
            onChange={(event) => setField('format', event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="" disabled>
              {t('tournamentForm.formatPlaceholder')}
            </option>
            {formatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.format && <p role="alert" className="text-xs text-rose-300">{errors.format}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="duration-type" className="text-sm text-slate-300">
            {t('tournamentForm.durationLabel')}
          </label>
          <select
            id="duration-type"
            value={formState.durationType}
            onChange={(event) => setField('durationType', event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="" disabled>
              {t('tournamentForm.durationPlaceholder')}
            </option>
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.durationType && <p role="alert" className="text-xs text-rose-300">{errors.durationType}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="total-participants" className="text-sm text-slate-300">
            {t('tournamentForm.participantsLabel')}
          </label>
          <input
            id="total-participants"
            type="number"
            value={formState.totalParticipants}
            onChange={(event) => setField('totalParticipants', event.target.value)}
            onBlur={() => handleBlur('totalParticipants')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            min={2}
          />
          {errors.totalParticipants && (
            <p role="alert" className="text-xs text-rose-300">{errors.totalParticipants}</p>
          )}
        </div>

        <div className="space-y-3">
          <label htmlFor="start-time" className="text-sm text-slate-300">
            {t('tournamentForm.startLabel')}
          </label>
          <input
            id="start-time"
            type="datetime-local"
            required
            value={formState.startTime}
            onChange={(event) => setField('startTime', event.target.value)}
            onBlur={() => handleBlur('startTime')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          {errors.startTime && <p role="alert" className="text-xs text-rose-300">{errors.startTime}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="end-time" className="text-sm text-slate-300">
            {t('tournamentForm.endLabel')}
          </label>
          <input
            id="end-time"
            type="datetime-local"
            required
            value={formState.endTime}
            onChange={(event) => setField('endTime', event.target.value)}
            onBlur={() => handleBlur('endTime')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          {errors.endTime && <p role="alert" className="text-xs text-rose-300">{errors.endTime}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="target-count" className="text-sm text-slate-300">
            {t('tournamentForm.targetLabel')}
          </label>
          <input
            id="target-count"
            type="number"
            value={formState.targetCount}
            onChange={(event) => setField('targetCount', event.target.value)}
            onBlur={() => handleBlur('targetCount')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            min={1}
          />
          {errors.targetCount && <p role="alert" className="text-xs text-rose-300">{errors.targetCount}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="target-start" className="text-sm text-slate-300">
            {t('tournamentForm.targetStartLabel')}
          </label>
          <input
            id="target-start"
            type="number"
            value={formState.targetStartNumber}
            onChange={(event) => setField('targetStartNumber', event.target.value)}
            onBlur={() => handleBlur('targetStartNumber')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            min={1}
          />
          {errors.targetStartNumber && (
            <p role="alert" className="text-xs text-rose-300">{errors.targetStartNumber}</p>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formState.shareTargets}
              onChange={(event) => setFormState((previous) => ({
                ...previous,
                shareTargets: event.target.checked,
              }))}
              className="h-4 w-4 rounded border border-slate-800 bg-slate-950/60 text-cyan-400"
            />
            {t('tournamentForm.shareTargets')}
          </label>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formState.doubleStageEnabled}
              onChange={(event) => setFormState((previous) => ({
                ...previous,
                doubleStageEnabled: event.target.checked,
              }))}
              className="h-4 w-4 rounded border border-slate-800 bg-slate-950/60 text-cyan-400"
            />
            {t('tournamentForm.doubleStageEnabled')}
          </label>
        </div>

        <div className="space-y-3">
          <label htmlFor="tournament-logo" className="text-sm text-slate-300">
            {t('tournamentForm.logoLabel')}
          </label>
          <input
            id="tournament-logo"
            type="file"
            onChange={handleLogoChange}
            className="block w-full rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-100"
          />
          {errors.logo && <p role="alert" className="text-xs text-rose-300">{errors.logo}</p>}
          {logoPreview && (
            <img
              src={logoPreview}
              alt={t('tournamentForm.logoPreview')}
              aria-label={t('tournamentForm.logoPreview')}
              className="mt-3 h-16 w-16 rounded-full border border-slate-800 object-cover"
            />
          )}
        </div>
      </div>

      {errors.submit && <p role="alert" className="text-sm text-rose-300">{errors.submit}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {isBusy ? t('tournamentForm.submitting') : t('tournamentForm.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
