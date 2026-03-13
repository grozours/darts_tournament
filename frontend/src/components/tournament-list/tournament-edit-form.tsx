import type { ChangeEvent } from 'react';
import type { EditFormState, Translator } from './types';

type TournamentDetails = {
  status: string;
  logoUrl?: string;
  logoUrls?: string[];
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
  logoFiles: File[];
  isUploadingLogo: boolean;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFilesChange: (files: File[]) => void;
  onUploadLogo: () => void;
  onDeleteLogo: (logoUrl: string) => void;
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
  logoFiles: File[];
  isUploadingLogo: boolean;
  onLogoFilesChange: (files: File[]) => void;
  onUploadLogo: () => void;
  onDeleteLogo: (logoUrl: string) => void;
};

type LogoSectionProperties = {
  t: Translator;
  logoUrl: string | undefined;
  logoUrls: string[];
  logoFiles: File[];
  isUploadingLogo: boolean;
  onLogoFilesChange: (files: File[]) => void;
  onUploadLogo: () => void;
  onDeleteLogo: (logoUrl: string) => void;
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
  logoUrls,
  logoFiles,
  isUploadingLogo,
  onLogoFilesChange,
  onUploadLogo,
  onDeleteLogo,
}: LogoSectionProperties) => {
  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    onLogoFilesChange(selectedFiles);
    // Reset native input so selecting the same file again still triggers onChange.
    event.target.value = '';
  };
  const selectedLogoFiles = logoFiles ?? [];

  let displayLogoUrls: string[] = [];
  if (logoUrls.length > 0) {
    displayLogoUrls = logoUrls;
  } else if (logoUrl) {
    displayLogoUrls = [logoUrl];
  }

  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.logo')}</p>
      <div className="mt-3 space-y-4">
        {displayLogoUrls.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {displayLogoUrls.map((currentLogo) => (
              <div key={currentLogo} className="relative">
                <img
                  src={currentLogo}
                  alt={t('edit.logoAlt')}
                  className="h-16 w-16 rounded-xl border border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() => onDeleteLogo(currentLogo)}
                  disabled={isUploadingLogo}
                  className="absolute -right-2 -top-2 rounded-full border border-rose-500/40 bg-slate-950 px-2 py-0.5 text-[10px] text-rose-200 hover:border-rose-400 disabled:opacity-60"
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
            {t('edit.noLogo')}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={handleLogoChange}
            className="text-xs text-slate-300"
          />
          <button
            type="button"
            onClick={onUploadLogo}
            disabled={selectedLogoFiles.length === 0 || isUploadingLogo}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
          >
            {isUploadingLogo ? t('edit.uploading') : t('edit.uploadLogo')}
          </button>
          {selectedLogoFiles.length > 0 && (
            <span className="text-xs text-slate-400">{`${selectedLogoFiles.length} file(s)`}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailsCard = ({
  t,
  editingTournament,
  logoFiles,
  isUploadingLogo,
  onLogoFilesChange,
  onUploadLogo,
  onDeleteLogo,
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
      logoUrls={editingTournament.logoUrls ?? []}
      logoFiles={logoFiles}
      isUploadingLogo={isUploadingLogo}
      onLogoFilesChange={onLogoFilesChange}
      onUploadLogo={onUploadLogo}
      onDeleteLogo={onDeleteLogo}
    />
  </div>
);

const TournamentEditForm = ({
  t,
  editForm,
  editingTournament,
  formatOptions,
  durationOptions,
  logoFiles,
  isUploadingLogo,
  onEditFormChange,
  onLogoFilesChange,
  onUploadLogo,
  onDeleteLogo,
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
        logoFiles={logoFiles}
        isUploadingLogo={isUploadingLogo}
        onLogoFilesChange={onLogoFilesChange}
        onUploadLogo={onUploadLogo}
        onDeleteLogo={onDeleteLogo}
      />
    </>
  );
};

export default TournamentEditForm;
