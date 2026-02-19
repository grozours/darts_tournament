import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { TournamentFormat, DurationType } from '@shared/types';
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
};

type ErrorState = Partial<Record<keyof FormState | 'submit' | 'logo', string | undefined>>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const padNumber = (value: number) => String(value).padStart(2, '0');

const toLocalInput = (value: Date) =>
  `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(
    value.getDate()
  )}T${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;

const validateName = (value: string): string | undefined => {
  if (!value) return undefined;
  if (value.length < 3) return 'Name must be at least 3 characters';
  if (value.length > 100) return 'Name cannot exceed 100 characters';
  return undefined;
};

const validateParticipants = (value: string): string | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 'Minimum 2 participants';
  if (parsed < 2) return 'Minimum 2 participants';
  if (parsed > 512) return 'Maximum 512 participants';
  return undefined;
};

const validateTargets = (value: string): string | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 'Minimum 1 target';
  if (parsed < 1) return 'Minimum 1 target';
  if (parsed > 20) return 'Maximum 20 targets';
  return undefined;
};

const validateStartTime = (value: string): string | undefined => {
  if (!value) return undefined;
  const start = new Date(value);
  const now = new Date();
  if (start.getTime() < now.getTime()) {
    return 'Start time cannot be in the past';
  }
  return undefined;
};

const validateEndTime = (startValue: string, endValue: string): string | undefined => {
  if (!endValue || !startValue) return undefined;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (end.getTime() <= start.getTime()) {
    return 'End time must be after start time';
  }
  return undefined;
};

export default function TournamentForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: TournamentFormProperties) {
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
  });
  const [errors, setErrors] = useState<ErrorState>({});
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: 'Single' },
      { value: TournamentFormat.DOUBLE, label: 'Double' },
      { value: 'KNOCKOUT', label: 'Knockout' },
      { value: 'POOL', label: 'Pool' },
    ],
    []
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.FULL_DAY, label: 'Full day' },
      { value: DurationType.HALF_DAY_MORNING, label: 'Half day' },
      { value: DurationType.HALF_DAY_NIGHT, label: 'Evening' },
    ],
    []
  );

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
      nextErrors.name = 'Tournament name is required';
    }
    if (!state.format) {
      nextErrors.format = 'Format is required';
    }
    if (!state.startTime) {
      nextErrors.startTime = 'Start time is required';
    }
    if (!state.endTime) {
      nextErrors.endTime = 'End time is required';
    }

    const nameValidation = validateName(state.name);
    if (nameValidation) nextErrors.name = nameValidation;

    const participantsValidation = validateParticipants(
      state.totalParticipants
    );
    if (participantsValidation) nextErrors.totalParticipants = participantsValidation;

    const targetsValidation = validateTargets(state.targetCount);
    if (targetsValidation) nextErrors.targetCount = targetsValidation;

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

    const now = new Date();
    const startFallback = new Date(now.getTime() + 60 * 60 * 1000);
    const endFallback = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    return {
      ...formState,
      format: formState.format || TournamentFormat.SINGLE,
      durationType: formState.durationType || DurationType.FULL_DAY,
      startTime: formState.startTime || toLocalInput(startFallback),
      endTime: formState.endTime || toLocalInput(endFallback),
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
        logo: 'Only JPEG and PNG files are allowed',
      }));
      setLogoFile(undefined);
      setLogoPreview(undefined);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((previous) => ({
        ...previous,
        logo: 'File size cannot exceed 5MB',
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
    });
    setLogoFile(undefined);
    setLogoPreview(undefined);
    setErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authEnabled && !isAuthenticated) {
      setErrors((previous) => ({ ...previous, submit: 'Please sign in to create tournaments.' }));
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
        startTime: submissionState.startTime,
        endTime: submissionState.endTime,
        totalParticipants: Number(submissionState.totalParticipants || 0),
        targetCount: Number(submissionState.targetCount || 0),
      }, token);

      if (logoFile) {
        await uploadTournamentLogo(result.id, logoFile, token);
      }

      resetForm();
      onSubmit(result);
    } catch (error) {
      console.error('Failed to create tournament', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tournament';
      setErrors((previous) => ({ ...previous, submit: errorMessage }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label="Create Tournament"
      noValidate
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label htmlFor="tournament-name" className="text-sm text-slate-300">Tournament Name</label>
          <input
            id="tournament-name"
            type="text"
            required
            value={formState.name}
            onChange={(event) => setField('name', event.target.value)}
            onBlur={() => handleBlur('name')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            placeholder="Open Championship"
          />
          {errors.name && <p role="alert" className="text-xs text-rose-300">{errors.name}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="tournament-format" className="text-sm text-slate-300">Format</label>
          <select
            id="tournament-format"
            required
            value={formState.format}
            onChange={(event) => setField('format', event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="" disabled>
              Select format
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
          <label htmlFor="duration-type" className="text-sm text-slate-300">Duration Type</label>
          <select
            id="duration-type"
            value={formState.durationType}
            onChange={(event) => setField('durationType', event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="" disabled>
              Select duration
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
          <label htmlFor="total-participants" className="text-sm text-slate-300">Total Participants</label>
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
          <label htmlFor="start-time" className="text-sm text-slate-300">Start Time</label>
          <input
            id="start-time"
            type="datetime-local"
            value={formState.startTime}
            onChange={(event) => setField('startTime', event.target.value)}
            onBlur={() => handleBlur('startTime')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          {errors.startTime && <p role="alert" className="text-xs text-rose-300">{errors.startTime}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="end-time" className="text-sm text-slate-300">End Time</label>
          <input
            id="end-time"
            type="datetime-local"
            value={formState.endTime}
            onChange={(event) => setField('endTime', event.target.value)}
            onBlur={() => handleBlur('endTime')}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          {errors.endTime && <p role="alert" className="text-xs text-rose-300">{errors.endTime}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="target-count" className="text-sm text-slate-300">Target Count</label>
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
          <label htmlFor="tournament-logo" className="text-sm text-slate-300">Tournament Logo</label>
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
              alt="Logo preview"
              aria-label="Logo preview"
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
          {isBusy ? 'Creating...' : 'Create Tournament'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
