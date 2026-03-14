import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
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
};

const mapUserToForm = (user: UserAccount): UserEditForm => ({
  firstName: user.firstName,
  lastName: user.lastName,
  surname: user.surname ?? '',
  email: user.email ?? '',
});

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

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [users]
  );

  const fetchAccounts = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const parameters = new URLSearchParams();
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        parameters.set('q', trimmedSearch);
      }
      if (selectedTournamentId) {
        parameters.set('tournamentId', selectedTournamentId);
      }
      parameters.set('limit', '200');

      const response = await fetch(`/api/auth/users?${parameters.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('userAccounts.loadFailed');
      }

      const payload = await response.json() as { users?: UserAccount[] };
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'userAccounts.loadFailed');
    } finally {
      setLoading(false);
    }
  }, [authEnabled, getAccessTokenSilently, isAdmin, search, selectedTournamentId]);

  const fetchTournaments = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments?limit=200', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const renderAccountsContent = (): JSX.Element => {
    if (loading) {
      return <p className="text-sm text-slate-300">{t('common.loading')}</p>;
    }

    if (sortedUsers.length === 0) {
      return <p className="text-sm text-slate-300">{t('userAccounts.empty')}</p>;
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-800/70">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">{t('edit.firstName')}</th>
              <th className="px-3 py-2 text-left">{t('edit.lastName')}</th>
              <th className="px-3 py-2 text-left">{t('edit.surname')}</th>
              <th className="px-3 py-2 text-left">{t('edit.email')}</th>
              <th className="px-3 py-2 text-left">{t('userAccounts.tournamentCount')}</th>
              <th className="px-3 py-2 text-left">{t('account.lastUpdated')}</th>
              <th className="px-3 py-2 text-left">{t('edit.edit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-100">
            {sortedUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2">{user.firstName}</td>
                <td className="px-3 py-2">{user.lastName}</td>
                <td className="px-3 py-2">{user.surname ?? '-'}</td>
                <td className="px-3 py-2">{user.email ?? '-'}</td>
                <td className="px-3 py-2">{user.tournamentCount ?? 0}</td>
                <td className="px-3 py-2">{new Date(user.updatedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => startEditing(user)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                  >
                    {t('edit.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
        <h2 className="text-2xl font-semibold text-white">{t('userAccounts.title')}</h2>
        <p className="mt-1 text-sm text-slate-400">{t('userAccounts.subtitle')}</p>
      </div>

      <form onSubmit={onSubmitSearch} className="flex gap-2">
        <select
          value={selectedTournamentId}
          onChange={(event_) => setSelectedTournamentId(event_.target.value)}
          aria-label={t('userAccounts.tournamentFilter')}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
        >
          <option value="">{t('userAccounts.allTournaments')}</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name ?? tournament.id}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event_) => setSearch(event_.target.value)}
          placeholder={t('userAccounts.searchPlaceholder')}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
        >
          {t('common.search')}
        </button>
        <button
          type="button"
          onClick={() => {
            void deleteAccountsWithoutTournament();
          }}
          disabled={deletingOrphans}
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-70"
        >
          {deletingOrphans ? t('common.loading') : t('userAccounts.deleteOrphansButton')}
        </button>
      </form>

      {displayedError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{displayedError}</div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div>
      )}

      {renderAccountsContent()}

      {editingUserId && editForm && (
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">{t('userAccounts.editTitle')}</h3>
          <p className="mb-3 text-xs text-slate-400">
            {t('userAccounts.currentTournamentCount')}: {users.find((user) => user.id === editingUserId)?.tournamentCount ?? 0}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={editForm.firstName}
              onChange={(event_) => setEditForm((current) => (current ? { ...current, firstName: event_.target.value } : current))}
              placeholder={t('edit.firstName')}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
            <input
              value={editForm.lastName}
              onChange={(event_) => setEditForm((current) => (current ? { ...current, lastName: event_.target.value } : current))}
              placeholder={t('edit.lastName')}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
            <input
              value={editForm.surname}
              onChange={(event_) => setEditForm((current) => (current ? { ...current, surname: event_.target.value } : current))}
              placeholder={t('edit.surname')}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
            <input
              value={editForm.email}
              onChange={(event_) => setEditForm((current) => (current ? { ...current, email: event_.target.value } : current))}
              placeholder={t('edit.email')}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void saveEdit();
              }}
              disabled={saving}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-70"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserAccountsView;
