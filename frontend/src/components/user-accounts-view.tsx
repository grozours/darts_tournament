import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { SkillLevel } from '@shared/types';
import SignInPanel from '../auth/sign-in-panel';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';

type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  surname?: string | null;
  email?: string | null;
  skillLevel?: SkillLevel | null;
  createdAt: string;
  updatedAt: string;
  tournamentCount?: number;
};

type TournamentOption = {
  id: string;
  name?: string;
};

type UserEditForm = {
  firstName: string;
  lastName: string;
  surname: string;
  email: string;
  skillLevel: SkillLevel | '';
};

const mapUserToForm = (user: UserAccount): UserEditForm => ({
  firstName: user.firstName,
  lastName: user.lastName,
  surname: user.surname ?? '',
  email: user.email ?? '',
  skillLevel: user.skillLevel ?? '',
});

const buildAuthorizationHeaders = (token: string | undefined): HeadersInit => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

const buildUserAccountsQuery = (search: string, tournamentId: string): string => {
  const parameters = new URLSearchParams();
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    parameters.set('q', trimmedSearch);
  }
  if (tournamentId) {
    parameters.set('tournamentId', tournamentId);
  }
  parameters.set('limit', '200');
  return parameters.toString();
};


type UserAccountEditPanelProperties = {
  user: UserAccount;
  editForm: UserEditForm;
  saving: boolean;
  t: (key: string) => string;
  onFieldChange: (field: keyof UserEditForm, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

const UserAccountEditPanel = ({
  user,
  editForm,
  saving,
  t,
  onFieldChange,
  onSave,
  onCancel,
}: UserAccountEditPanelProperties): JSX.Element => (
  <div className="mt-4 space-y-2">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('userAccounts.editTitle')}</p>
    <p className="text-xs text-slate-400">{t('userAccounts.currentTournamentCount')}: {user.tournamentCount ?? 0}</p>
    <p className="text-xs text-slate-400">{t('edit.surname')}: {user.surname ?? '-'}</p>
    <p className="text-xs text-slate-400">{t('edit.email')}: {user.email ?? '-'}</p>
    <p className="text-xs text-slate-400">{t('edit.skillLevel')}: {user.skillLevel ? t(`skill.${user.skillLevel.toLowerCase()}`) : '-'}</p>
    <p className="text-xs text-slate-500">{t('account.lastUpdated')}: {new Date(user.updatedAt).toLocaleDateString()}</p>
    <div className="grid gap-2 md:grid-cols-2">
      <input
        value={editForm.firstName}
        onChange={(event_) => onFieldChange('firstName', event_.target.value)}
        placeholder={t('edit.firstName')}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
      />
      <input
        value={editForm.lastName}
        onChange={(event_) => onFieldChange('lastName', event_.target.value)}
        placeholder={t('edit.lastName')}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
      />
      <input
        value={editForm.surname}
        onChange={(event_) => onFieldChange('surname', event_.target.value)}
        placeholder={t('edit.surname')}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
      />
      <input
        value={editForm.email}
        onChange={(event_) => onFieldChange('email', event_.target.value)}
        placeholder={t('edit.email')}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
      />
      <select
        value={editForm.skillLevel}
        onChange={(event_) => onFieldChange('skillLevel', event_.target.value)}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 md:col-span-2"
      >
        <option value="">{t('edit.selectSkillLevelOptional')}</option>
        <option value={SkillLevel.BEGINNER}>{t('skill.beginner')}</option>
        <option value={SkillLevel.INTERMEDIATE}>{t('skill.intermediate')}</option>
        <option value={SkillLevel.EXPERT}>{t('skill.expert')}</option>
      </select>
    </div>
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full rounded-full border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-70"
      >
        {saving ? t('common.loading') : t('common.save')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
      >
        {t('common.cancel')}
      </button>
    </div>
  </div>
);

function UserAccountsView() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | undefined>();
  const [editForm, setEditForm] = useState<UserEditForm | undefined>();
  const [saving, setSaving] = useState(false);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const accountsRequestSequence = useRef(0);

  const normalizedTournamentOptions = useMemo(() => {
    const uniqueById = new Map<string, TournamentOption>();
    for (const tournament of tournaments) {
      if (!tournament.id) {
        continue;
      }
      if (!uniqueById.has(tournament.id)) {
        uniqueById.set(tournament.id, tournament);
      }
    }

    return [...uniqueById.values()].sort((left, right) => {
      const leftLabel = left.name?.trim() || left.id;
      const rightLabel = right.name?.trim() || right.id;
      return leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' });
    });
  }, [tournaments]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [users]
  );

  const fetchAccounts = useCallback(async (nextFilters?: { search?: string; tournamentId?: string }) => {
    if (!isAdmin) {
      return;
    }

    const requestSequence = accountsRequestSequence.current + 1;
    accountsRequestSequence.current = requestSequence;

    setLoading(true);
    setError(undefined);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const effectiveSearch = nextFilters?.search ?? search;
      const effectiveTournamentId = nextFilters?.tournamentId ?? selectedTournamentId;
      const queryString = buildUserAccountsQuery(effectiveSearch, effectiveTournamentId);

      const response = await fetch(`/api/auth/users?${queryString}`, {
        headers: buildAuthorizationHeaders(token),
      });

      if (!response.ok) {
        throw new Error('userAccounts.loadFailed');
      }

      const payload = await response.json() as { users?: UserAccount[] };
      if (requestSequence !== accountsRequestSequence.current) {
        return;
      }

      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (error_) {
      if (requestSequence !== accountsRequestSequence.current) {
        return;
      }

      setError(error_ instanceof Error ? error_.message : 'userAccounts.loadFailed');
    } finally {
      if (requestSequence === accountsRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [authEnabled, getAccessTokenSilently, isAdmin, search, selectedTournamentId]);

  const fetchTournaments = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments?limit=100', {
        headers: buildAuthorizationHeaders(token),
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json() as { tournaments?: TournamentOption[] };
      setTournaments(Array.isArray(payload.tournaments) ? payload.tournaments : []);
    } catch {
      // Keep accounts usable even if tournament lookup fails.
    }
  }, [authEnabled, getAccessTokenSilently, isAdmin]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  const onSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void fetchAccounts();
  };

  const deleteAccountsWithoutTournament = async () => {
    if (!isAdmin || deletingOrphans) {
      return;
    }

    if (!globalThis.confirm(t('userAccounts.deleteOrphansConfirm'))) {
      return;
    }

    setDeletingOrphans(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/auth/users?scope=without-tournament', {
        method: 'DELETE',
        headers: buildAuthorizationHeaders(token),
      });

      const payload = await response.json().catch(() => undefined) as { message?: string; deletedCount?: number } | undefined;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'userAccounts.deleteOrphansFailed');
      }

      const deletedCount = typeof payload?.deletedCount === 'number' ? payload.deletedCount : 0;
      setNotice(`${t('userAccounts.deleteOrphansSuccess')} ${deletedCount}`);
      await fetchAccounts();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'userAccounts.deleteOrphansFailed');
    } finally {
      setDeletingOrphans(false);
    }
  };

  const renderUserCard = (user: UserAccount): JSX.Element => {
    const isEditingThisUser = editingUserId === user.id && Boolean(editForm);

    return (
      <div key={user.id} className="flex h-full flex-col rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div />
          <div className="text-center">
            <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
          </div>
          {!isEditingThisUser ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => startEditing(user)}
                className="rounded-full border border-cyan-500/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                {t('edit.edit')}
              </button>
            </div>
          ) : (
            <div />
          )}
        </div>

        {isEditingThisUser && editForm && (
          <UserAccountEditPanel
            user={user}
            editForm={editForm}
            saving={saving}
            t={t}
            onFieldChange={updateEditField}
            onSave={() => {
              void saveEdit();
            }}
            onCancel={cancelEditing}
          />
        )}
      </div>
    );
  };

  const renderAccountsContent = (): JSX.Element => {
    if (loading) {
      return <p className="text-sm text-slate-300">{t('common.loading')}</p>;
    }

    if (sortedUsers.length === 0) {
      return <p className="text-sm text-slate-300">{t('userAccounts.empty')}</p>;
    }

    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sortedUsers.map(renderUserCard)}</div>;
  };

  const startEditing = (user: UserAccount) => {
    setEditingUserId(user.id);
    setEditForm(mapUserToForm(user));
    setError(undefined);
  };

  const cancelEditing = () => {
    setEditingUserId(undefined);
    setEditForm(undefined);
  };

  const updateEditField = (field: keyof UserEditForm, value: string) => {
    setEditForm((current) => {
      if (!current) {
        return current;
      }
      if (field === 'skillLevel') {
        return { ...current, skillLevel: value as SkillLevel | '' };
      }
      return { ...current, [field]: value };
    });
  };

  const saveEdit = async () => {
    if (!editingUserId || !editForm) {
      return;
    }

    setSaving(true);
    setError(undefined);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch(`/api/auth/users/${editingUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          surname: editForm.surname,
          email: editForm.email,
          skillLevel: editForm.skillLevel || null,
        }),
      });

      const payload = await response.json().catch(() => undefined) as { message?: string; user?: UserAccount } | undefined;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'userAccounts.updateFailed');
      }

      const updatedUser = payload?.user;
      if (updatedUser) {
        setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      }

      cancelEditing();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'userAccounts.updateFailed');
    } finally {
      setSaving(false);
    }
  };

  const displayedError = error?.startsWith('userAccounts.') ? t(error) : error;

  if (isLoading) {
    return <p className="text-slate-300">{t('account.loading')}</p>;
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <SignInPanel
        title={t('auth.signInRequired')}
        description={t('auth.protectedContinue')}
      />
    );
  }

  if (!isAdmin) {
    return <p className="text-slate-300">{t('auth.adminOnly')}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('userAccounts.title')}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{t('userAccounts.subtitle')}</h2>
      </div>

      <form
        onSubmit={onSubmitSearch}
        className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/65 to-slate-950/65 p-4 shadow-[0_8px_30px_rgba(2,6,23,0.35)]"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t('common.search')}
            </p>
            <input
              value={search}
              onChange={(event_) => setSearch(event_.target.value)}
              placeholder={t('userAccounts.searchPlaceholder')}
              className="w-full rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-white"
            />
          </div>

          <div className="w-full max-w-xs">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t('userAccounts.tournamentFilter')}
            </p>
            <select
              value={selectedTournamentId}
              onChange={(event_) => {
                const nextTournamentId = event_.target.value;
                setSelectedTournamentId(nextTournamentId);
                void fetchAccounts({ tournamentId: nextTournamentId });
              }}
              onFocus={() => {
                void fetchTournaments();
              }}
              aria-label={t('userAccounts.tournamentFilter')}
              className="w-full rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-white"
            >
              <option value="">{t('userAccounts.allTournaments')}</option>
              {normalizedTournamentOptions.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name ?? tournament.id}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-400"
          >
            {t('common.search')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 font-medium text-slate-200">
              {sortedUsers.length}
            </span>
            <span className="text-slate-400">{t('userAccounts.title')}</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void deleteAccountsWithoutTournament();
              }}
              disabled={deletingOrphans}
              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-70"
            >
              {deletingOrphans ? t('common.loading') : t('userAccounts.deleteOrphansButton')}
            </button>
          </div>
        </div>

      </form>

      {displayedError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{displayedError}</div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div>
      )}

      {renderAccountsContent()}
    </div>
  );
}

export default UserAccountsView;
