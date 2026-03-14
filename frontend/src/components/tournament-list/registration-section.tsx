import { useState } from 'react';
import { SkillLevel, TournamentFormat } from '@shared/types';
import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';
import type { UnregisteredAccountOption } from './tournament-players-types';
import { RegistrationPlayersList } from './player-lists';

type RegistrationSectionProperties = {
  t: Translator;
  editingTournament: {
    format: string;
    totalParticipants: number;
  };
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  autoFillProgress: { current: number; total: number } | undefined;
  skillLevelOptions: Array<{ value: string; label: string }>;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
  onSearchUnregisteredAccounts: (searchTerm: string) => Promise<UnregisteredAccountOption[]>;
  onRegisterPlayerFromAccount: (account: UnregisteredAccountOption) => void;
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
  editingPlayerId: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  autoFillProgress: { current: number; total: number } | undefined;
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

type AccountQuickAddProperties = {
  t: Translator;
  isRegisteringPlayer: boolean;
  onSearchUnregisteredAccounts: (searchTerm: string) => Promise<UnregisteredAccountOption[]>;
  onRegisterPlayerFromAccount: (account: UnregisteredAccountOption) => void;
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

const formatAccountLabel = (account: UnregisteredAccountOption): string => {
  const surname = account.surname?.trim();
  const base = [account.lastName, account.firstName]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' / ');

  return surname ? `${base} / ${surname}` : base;
};

const hasValidEmail = (account: UnregisteredAccountOption): boolean => {
  const email = account.email?.trim();
  return Boolean(email && email.includes('@'));
};

const AccountQuickAdd = ({
  t,
  isRegisteringPlayer,
  onSearchUnregisteredAccounts,
  onRegisterPlayerFromAccount,
}: AccountQuickAddProperties) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [accounts, setAccounts] = useState<UnregisteredAccountOption[]>([]);

  const runSearch = async () => {
    const term = search.trim();
    if (!term) {
      setAccounts([]);
      setError(undefined);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const results = await onSearchUnregisteredAccounts(term);
      setAccounts(results);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to search accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4">
      <h5 className="text-sm font-semibold text-slate-200">Ajouter depuis un compte existant</h5>
      <p className="mt-1 text-xs text-slate-400">
        Rechercher parmi les comptes non inscrits puis ajouter directement au tournoi.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(event_) => setSearch(event_.target.value)}
          onKeyDown={(event_) => {
            if (event_.key === 'Enter') {
              event_.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Nom, prenom, surnom, email"
          aria-label="Rechercher un compte non inscrit"
          className="min-w-[240px] flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => {
            void runSearch();
          }}
          disabled={loading || isRegisteringPlayer}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-60"
        >
          {loading ? t('common.loading') : t('common.search')}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
        {accounts.length === 0 && !loading && search.trim().length > 0 && (
          <p className="text-xs text-slate-400">Aucun compte non inscrit trouve</p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-xs font-medium text-slate-100">{formatAccountLabel(account)}</p>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  Non inscrit
                </span>
                {!hasValidEmail(account) && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                    Sans email
                  </span>
                )}
              </div>
              {account.email && (
                <p className="truncate text-[11px] text-slate-400">{account.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRegisterPlayerFromAccount(account)}
              disabled={isRegisteringPlayer}
              className="rounded-full border border-cyan-500/60 px-3 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
            >
              Ajouter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  onSearchUnregisteredAccounts,
  onRegisterPlayerFromAccount,
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

    <AccountQuickAdd
      t={t}
      isRegisteringPlayer={isRegisteringPlayer}
      onSearchUnregisteredAccounts={onSearchUnregisteredAccounts}
      onRegisterPlayerFromAccount={onRegisterPlayerFromAccount}
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
