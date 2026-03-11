import type { ChangeEvent } from 'react';
import type { EditFormState, Translator } from './types';

type TournamentDetails = {
  status: string;
  logoUrl?: string;
  createdAt?: string;
  completedAt?: string;
  historicalFlag?: boolean;
};

type TournamentEditFormProperties = {
  t: Translator;
  editForm: EditFormState;
  editingTournament: TournamentDetails;
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  logoFile?: File;
  isUploadingLogo: boolean;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
};

type EditFormFieldsProperties = {
  t: Translator;
  editForm: EditFormState;
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  onEditFormChange: (next: EditFormState) => void;
};

type DetailsCardProperties = {
  t: Translator;
  editingTournament: TournamentDetails;
  logoFile?: File;
  isUploadingLogo: boolean;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
};

type LogoSectionProperties = {
  t: Translator;
  logoUrl?: string;
  logoFile?: File;
  isUploadingLogo: boolean;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
};

const EditFormFields = ({
  t,
  editForm,
  formatOptions,
  durationOptions,
  onEditFormChange,
}: EditFormFieldsProperties) => (
  <div className="grid gap-4 md:grid-cols-2">
    <label className="text-sm text-slate-300">
      {t('edit.name')}
      <input
        type="text"
        value={editForm.name}
        onChange={(event_) => onEditFormChange({ ...editForm, name: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.location')}
      <input
        type="text"
        value={editForm.location}
        onChange={(event_) => onEditFormChange({ ...editForm, location: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.format')}
      <select
        value={editForm.format}
        onChange={(event_) => onEditFormChange({ ...editForm, format: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      >
        {formatOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.durationType')}
      <select
        value={editForm.durationType}
        onChange={(event_) => onEditFormChange({ ...editForm, durationType: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      >
        {durationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.participants')}
      <input
        type="number"
        value={editForm.totalParticipants}
        onChange={(event_) => onEditFormChange({ ...editForm, totalParticipants: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.startTime')}
      <input
        type="datetime-local"
        value={editForm.startTime}
        onChange={(event_) => onEditFormChange({ ...editForm, startTime: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.endTime')}
      <input
        type="datetime-local"
        value={editForm.endTime}
        onChange={(event_) => onEditFormChange({ ...editForm, endTime: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.targetCount')}
      <input
        type="number"
        value={editForm.targetCount}
        onChange={(event_) => onEditFormChange({ ...editForm, targetCount: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.targetStartNumber')}
      <input
        type="number"
        value={editForm.targetStartNumber}
        onChange={(event_) => onEditFormChange({ ...editForm, targetStartNumber: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
        min={1}
      />
    </label>
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={editForm.shareTargets}
        onChange={(event_) => onEditFormChange({ ...editForm, shareTargets: event_.target.checked })}
        className="h-4 w-4 rounded border border-slate-700 bg-slate-950/60"
      />
      {t('edit.shareTargets')}
    </label>
  </div>
);

const LogoSection = ({
  t,
  logoUrl,
  logoFile,
  isUploadingLogo,
  onLogoFileChange,
  onUploadLogo,
}: LogoSectionProperties) => {
  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    onLogoFileChange(event.target.files?.[0]);
  };

  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.logo')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={t('edit.logoAlt')}
            className="h-16 w-16 rounded-xl border border-slate-700 object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
            {t('edit.noLogo')}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleLogoChange}
            className="text-xs text-slate-300"
          />
          <button
            onClick={onUploadLogo}
            disabled={!logoFile || isUploadingLogo}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
          >
            {isUploadingLogo ? t('edit.uploading') : t('edit.uploadLogo')}
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailsCard = ({
  t,
  editingTournament,
  logoFile,
  isUploadingLogo,
  onLogoFileChange,
  onUploadLogo,
}: DetailsCardProperties) => (
  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
    <h4 className="text-base font-semibold text-white">{t('edit.details')}</h4>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</p>
        <p className="mt-2 text-sm text-slate-200">{editingTournament.status}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.historicalFlag')}</p>
        <p className="mt-2 text-sm text-slate-200">
          {editingTournament.historicalFlag ? t('common.yes') : t('common.no')}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.created')}</p>
        <p className="mt-2 text-sm text-slate-200">
          {editingTournament.createdAt
            ? new Date(editingTournament.createdAt).toLocaleString()
            : '-'}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.completed')}</p>
        <p className="mt-2 text-sm text-slate-200">
          {editingTournament.completedAt
            ? new Date(editingTournament.completedAt).toLocaleString()
            : '-'}
        </p>
      </div>
    </div>

    <LogoSection
      t={t}
      logoUrl={editingTournament.logoUrl}
      logoFile={logoFile}
      isUploadingLogo={isUploadingLogo}
      onLogoFileChange={onLogoFileChange}
      onUploadLogo={onUploadLogo}
    />
  </div>
);

const TournamentEditForm = ({
  t,
  editForm,
  editingTournament,
  formatOptions,
  durationOptions,
  logoFile,
  isUploadingLogo,
  onEditFormChange,
  onLogoFileChange,
  onUploadLogo,
}: TournamentEditFormProperties) => {
  return (
    <>
      <EditFormFields
        t={t}
        editForm={editForm}
        formatOptions={formatOptions}
        durationOptions={durationOptions}
        onEditFormChange={onEditFormChange}
      />
      <DetailsCard
        t={t}
        editingTournament={editingTournament}
        logoFile={logoFile}
        isUploadingLogo={isUploadingLogo}
        onLogoFileChange={onLogoFileChange}
        onUploadLogo={onUploadLogo}
      />
    </>
  );
};

export default TournamentEditForm;
