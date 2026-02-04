import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { TournamentFormat, DurationType } from '@shared/types';
import {
  createTournament,
  uploadTournamentLogo,
} from '../../services/tournamentService';

interface TournamentFormProps {
  onSubmit: (data?: unknown) => void;
  onCancel: () => void;
  isLoading?: boolean;
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

type ErrorState = Partial<Record<keyof FormState | 'submit' | 'logo', string>>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function TournamentForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: TournamentFormProps) {
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const validateName = (value: string) => {
    if (!value) return undefined;
    if (value.length < 3) return 'Name must be at least 3 characters';
    if (value.length > 100) return 'Name cannot exceed 100 characters';
    return undefined;
  };

  const validateParticipants = (value: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 'Minimum 2 participants';
    if (parsed < 2) return 'Minimum 2 participants';
    if (parsed > 512) return 'Maximum 512 participants';
    return undefined;
  };

  const validateTargets = (value: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 'Minimum 1 target';
    if (parsed < 1) return 'Minimum 1 target';
    if (parsed > 20) return 'Maximum 20 targets';
    return undefined;
  };

  const validateStartTime = (value: string) => {
    if (!value) return undefined;
    const start = new Date(value);
    const now = new Date();
    if (start.getTime() < now.getTime()) {
      return 'Start time cannot be in the past';
    }
    return undefined;
  };

  const validateEndTime = (startValue: string, endValue: string) => {
    if (!endValue || !startValue) return undefined;
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (end.getTime() <= start.getTime()) {
      return 'End time must be after start time';
    }
    return undefined;
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
      setErrors((prev) => ({ ...prev, [field]: error }));
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

    const pad = (value: number) => String(value).padStart(2, '0');
    const toLocalInput = (value: Date) =>
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
        value.getDate()
      )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;

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
      setErrors((prev) => ({
        ...prev,
        logo: 'Only JPEG and PNG files are allowed',
      }));
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        logo: 'File size cannot exceed 5MB',
      }));
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    setErrors((prev) => ({ ...prev, logo: undefined }));
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
    setLogoFile(null);
    setLogoPreview(null);
    setErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setErrors((prev) => ({ ...prev, submit: 'Please sign in to create tournaments.' }));
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
    setErrors((prev) => ({ ...prev, submit: undefined }));

    try {
      const token = await getAccessTokenSilently();
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
      setErrors((prev) => ({ ...prev, submit: 'Failed to create tournament' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label="Create Tournament"
      noValidate
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div>
        <label htmlFor="tournament-name">Tournament Name</label>
        <input
          id="tournament-name"
          type="text"
          required
          value={formState.name}
          onChange={(event) => setField('name', event.target.value)}
          onBlur={() => handleBlur('name')}
        />
        {errors.name && <p role="alert">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="tournament-format">Format</label>
        <select
          id="tournament-format"
          required
          value={formState.format}
          onChange={(event) => setField('format', event.target.value)}
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
        {errors.format && <p role="alert">{errors.format}</p>}
      </div>

      <div>
        <label htmlFor="duration-type">Duration Type</label>
        <select
          id="duration-type"
          value={formState.durationType}
          onChange={(event) => setField('durationType', event.target.value)}
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
        {errors.durationType && <p role="alert">{errors.durationType}</p>}
      </div>

      <div>
        <label htmlFor="start-time">Start Time</label>
        <input
          id="start-time"
          type="datetime-local"
          value={formState.startTime}
          onChange={(event) => setField('startTime', event.target.value)}
          onBlur={() => handleBlur('startTime')}
        />
        {errors.startTime && <p role="alert">{errors.startTime}</p>}
      </div>

      <div>
        <label htmlFor="end-time">End Time</label>
        <input
          id="end-time"
          type="datetime-local"
          value={formState.endTime}
          onChange={(event) => setField('endTime', event.target.value)}
          onBlur={() => handleBlur('endTime')}
        />
        {errors.endTime && <p role="alert">{errors.endTime}</p>}
      </div>

      <div>
        <label htmlFor="total-participants">Total Participants</label>
        <input
          id="total-participants"
          type="number"
          value={formState.totalParticipants}
          onChange={(event) => setField('totalParticipants', event.target.value)}
          onBlur={() => handleBlur('totalParticipants')}
        />
        {errors.totalParticipants && (
          <p role="alert">{errors.totalParticipants}</p>
        )}
      </div>

      <div>
        <label htmlFor="target-count">Target Count</label>
        <input
          id="target-count"
          type="number"
          value={formState.targetCount}
          onChange={(event) => setField('targetCount', event.target.value)}
          onBlur={() => handleBlur('targetCount')}
        />
        {errors.targetCount && <p role="alert">{errors.targetCount}</p>}
      </div>

      <div>
        <label htmlFor="tournament-logo">Tournament Logo</label>
        <input id="tournament-logo" type="file" onChange={handleLogoChange} />
        {errors.logo && <p role="alert">{errors.logo}</p>}
        {logoPreview && (
          <img src={logoPreview} alt="Logo preview" aria-label="Logo preview" />
        )}
      </div>

      {errors.submit && <p role="alert">{errors.submit}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isBusy}>
          {isBusy ? 'Creating...' : 'Create Tournament'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
