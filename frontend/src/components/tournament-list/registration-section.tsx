import { SkillLevel, TournamentFormat } from '@shared/types';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';
import { RegistrationPlayersList } from './player-lists';

type RegistrationSectionProperties = {
  t: Translator;
  editingTournament: {
    format: string;
    totalParticipants: number;
  };
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError?: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId?: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  autoFillProgress?: { current: number; total: number } | undefined;
  skillLevelOptions: Array<{ value: string; label: string }>;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
};

type RegistrationHeaderProperties = {
  t: Translator;
  tournamentFormat: string;
  playersCount: number;
  totalParticipants: number;
  onFetchPlayers: () => void;
};

type RegistrationFormFieldsProperties = {
  t: Translator;
  editingTournamentFormat: string;
  playerForm: CreatePlayerPayload;
  skillLevelOptions: Array<{ value: string; label: string }>;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
};

type RegistrationActionsProperties = {
  t: Translator;
  editingPlayerId?: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  autoFillProgress?: { current: number; total: number } | undefined;
  onCancelEditPlayer: () => void;
  onAutoFillPlayers: () => void;
  onSubmitPlayer: () => void;
};

type RegistrationListProperties = {
  t: Translator;
  players: TournamentPlayer[];
  playersLoading: boolean;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onRemovePlayer: (playerId: string) => void;
};

const RegistrationHeader = ({
  t,
  tournamentFormat,
  playersCount,
  totalParticipants,
  onFetchPlayers,
}: RegistrationHeaderProperties) => {
  let unitLabel = t('common.players');
  if (tournamentFormat === TournamentFormat.DOUBLE) {
    unitLabel = t('groups.doublettes');
  } else if (tournamentFormat === TournamentFormat.TEAM_4_PLAYER) {
    unitLabel = t('groups.equipes');
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="text-base font-semibold text-white">{t('edit.playerRegistration')}</h4>
        <p className="text-sm text-slate-400">
          {playersCount} {t('edit.spotsFilled.of')} {totalParticipants} {unitLabel.toLowerCase()}
        </p>
      </div>
      <button
        onClick={onFetchPlayers}
        className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
      >
        {t('common.refresh')}
      </button>
    </div>
  );
};

const RegistrationFormFields = ({
  t,
  editingTournamentFormat,
  playerForm,
  skillLevelOptions,
  onPlayerFormChange,
}: RegistrationFormFieldsProperties) => (
  <div className="mt-4 grid gap-3 md:grid-cols-2">
    <label className="text-sm text-slate-300">
      {t('edit.firstName')}
      <input
        type="text"
        value={playerForm.firstName}
        onChange={(event_) => onPlayerFormChange({ ...playerForm, firstName: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.lastName')}
      <input
        type="text"
        value={playerForm.lastName}
        onChange={(event_) => onPlayerFormChange({ ...playerForm, lastName: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.surname')}
      <input
        type="text"
        value={playerForm.surname || ''}
        onChange={(event_) => onPlayerFormChange({ ...playerForm, surname: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    {(editingTournamentFormat === TournamentFormat.DOUBLE
      || editingTournamentFormat === TournamentFormat.TEAM_4_PLAYER) && (
      <label className="text-sm text-slate-300">
        {t('edit.teamName')}
        <input
          type="text"
          value={playerForm.teamName || ''}
          onChange={(event_) => onPlayerFormChange({ ...playerForm, teamName: event_.target.value })}
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
        />
      </label>
    )}
    <label className="text-sm text-slate-300">
      {t('edit.email')}
      <input
        type="email"
        value={playerForm.email || ''}
        onChange={(event_) => onPlayerFormChange({ ...playerForm, email: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300">
      {t('edit.phone')}
      <input
        type="text"
        value={playerForm.phone || ''}
        onChange={(event_) => onPlayerFormChange({ ...playerForm, phone: event_.target.value })}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      />
    </label>
    <label className="text-sm text-slate-300 md:col-span-2">
      {t('edit.skillLevel')}
      <select
        value={playerForm.skillLevel || ''}
        onChange={(event_) =>
          onPlayerFormChange({
            ...playerForm,
            skillLevel: (event_.target.value as SkillLevel) || undefined,
          })
        }
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
      >
        <option value="">{t('edit.selectSkillLevelOptional')}</option>
        {skillLevelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  </div>
);

const RegistrationActions = ({
  t,
  editingPlayerId,
  playerActionLabel,
  isRegisteringPlayer,
  isAutoFillingPlayers,
  autoFillProgress,
  onCancelEditPlayer,
  onAutoFillPlayers,
  onSubmitPlayer,
}: RegistrationActionsProperties) => {
  let autoFillLabel = t('edit.autoFillPlayers');
  if (isAutoFillingPlayers) {
    const progressLabel = autoFillProgress
      ? ` (${autoFillProgress.current}/${autoFillProgress.total})`
      : '';
    autoFillLabel = `${t('edit.filling')}${progressLabel}`;
  }

  return (
    <div className="mt-4 flex flex-wrap justify-end gap-3">
      {editingPlayerId && (
        <button
          onClick={onCancelEditPlayer}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          {t('edit.cancelEdit')}
        </button>
      )}
      <button
        onClick={onAutoFillPlayers}
        disabled={isRegisteringPlayer || isAutoFillingPlayers}
        className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
      >
        {autoFillLabel}
      </button>
      <button
        onClick={onSubmitPlayer}
        disabled={isRegisteringPlayer || isAutoFillingPlayers}
        className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {playerActionLabel}
      </button>
    </div>
  );
};

const RegistrationList = ({
  t,
  players,
  playersLoading,
  onStartEditPlayer,
  onRemovePlayer,
}: RegistrationListProperties) => (
  <div className="mt-6 space-y-2">
    <h5 className="text-sm font-semibold text-slate-200">{t('edit.registeredPlayers')}</h5>
    <RegistrationPlayersList
      players={players}
      playersLoading={playersLoading}
      t={t}
      onEdit={onStartEditPlayer}
      onRemove={onRemovePlayer}
    />
  </div>
);

const RegistrationSection = ({
  t,
  editingTournament,
  players,
  playersLoading,
  playersError,
  playerForm,
  editingPlayerId,
  playerActionLabel,
  isRegisteringPlayer,
  isAutoFillingPlayers,
  autoFillProgress,
  skillLevelOptions,
  onPlayerFormChange,
  onStartEditPlayer,
  onCancelEditPlayer,
  onSubmitPlayer,
  onAutoFillPlayers,
  onRemovePlayer,
  onFetchPlayers,
}: RegistrationSectionProperties) => (
  <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
    <RegistrationHeader
      t={t}
        tournamentFormat={editingTournament.format}
      playersCount={players.length}
      totalParticipants={editingTournament.totalParticipants}
      onFetchPlayers={onFetchPlayers}
    />

    <RegistrationFormFields
      t={t}
      editingTournamentFormat={editingTournament.format}
      playerForm={playerForm}
      skillLevelOptions={skillLevelOptions}
      onPlayerFormChange={onPlayerFormChange}
    />

    {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

    <RegistrationActions
      t={t}
      editingPlayerId={editingPlayerId}
      playerActionLabel={playerActionLabel}
      isRegisteringPlayer={isRegisteringPlayer}
      isAutoFillingPlayers={isAutoFillingPlayers}
      autoFillProgress={autoFillProgress}
      onCancelEditPlayer={onCancelEditPlayer}
      onAutoFillPlayers={onAutoFillPlayers}
      onSubmitPlayer={onSubmitPlayer}
    />

    <RegistrationList
      t={t}
      players={players}
      playersLoading={playersLoading}
      onStartEditPlayer={onStartEditPlayer}
      onRemovePlayer={onRemovePlayer}
    />
  </div>
);

export default RegistrationSection;
