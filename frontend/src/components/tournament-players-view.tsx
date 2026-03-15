import { useCallback, useEffect, useMemo, useState } from 'react';
import { TournamentFormat } from '@shared/types';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import {
  fetchDoublettes,
  fetchEquipes,
  fetchTournamentPlayers,
  type TournamentGroupEntity,
  updateTournamentPlayerCheckIn,
  updateTournamentPlayer,
  removeTournamentPlayer,
  type TournamentPlayer,
} from '../services/tournament-service';

type TournamentPlayerEditForm = {
  personId: string;
  firstName: string;
  lastName: string;
  surname: string;
  teamName: string;
  email: string;
};

type UserAccountOption = {
  id: string;
  firstName: string;
  lastName: string;
  surname?: string | null;
};

const formatUserAccountOptionLabel = (user: UserAccountOption): string => {
  const surname = user.surname?.trim();
  return [user.lastName, user.firstName, surname]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(' / ');
};

const resolvePlayerNames = ({
  isAdmin,
  editingPlayerForm,
  player,
}: {
  isAdmin: boolean;
  editingPlayerForm: TournamentPlayerEditForm;
  player: TournamentPlayer;
}): { firstName: string; lastName: string } => {
  if (isAdmin) {
    return {
      firstName: editingPlayerForm.firstName.trim(),
      lastName: editingPlayerForm.lastName.trim(),
    };
  }

  return {
    firstName: (player.firstName ?? '').trim(),
    lastName: (player.lastName ?? '').trim(),
  };
};

const buildPlayerUpdatePayload = ({
  isAdmin,
  personId,
  firstName,
  lastName,
  surname,
  teamName,
  email,
}: {
  isAdmin: boolean;
  personId: string;
  firstName: string;
  lastName: string;
  surname: string;
  teamName: string;
  email: string;
}) => (
  isAdmin
    ? {
        ...(personId ? { personId } : {}),
        firstName,
        lastName,
        ...(surname ? { surname } : {}),
        ...(teamName ? { teamName } : {}),
        ...(email ? { email } : {}),
      }
    : {
        firstName,
        lastName,
        ...(surname ? { surname } : {}),
      }
);

const mergeUpdatedPlayerEntry = ({
  entry,
  isAdmin,
  targetPlayerId,
  personId,
  firstName,
  lastName,
  surname,
  teamName,
  email,
}: {
  entry: TournamentPlayer;
  isAdmin: boolean;
  targetPlayerId: string;
  personId: string;
  firstName: string;
  lastName: string;
  surname: string;
  teamName: string;
  email: string;
}): TournamentPlayer => {
  if (entry.playerId !== targetPlayerId) {
    return entry;
  }

  return {
    ...entry,
    ...(isAdmin && personId ? { personId } : {}),
    ...(isAdmin ? { firstName, lastName } : {}),
    ...(surname ? { surname } : {}),
    ...(isAdmin && teamName ? { teamName } : {}),
    ...(isAdmin && email ? { email } : {}),
  };
};

function TournamentPlayersView() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    getAccessTokenSilently,
    user,
  } = useOptionalAuth();

  const { isAdmin } = useAdminStatus();
  const [tournament, setTournament] = useState<{
    id: string;
    name: string;
    status?: string;
    format?: string;
    totalParticipants?: number;
  } | undefined>();
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [groups, setGroups] = useState<TournamentGroupEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [checkingInId, setCheckingInId] = useState<string | undefined>();
  const [removingPlayerId, setRemovingPlayerId] = useState<string | undefined>();
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [savingPlayerId, setSavingPlayerId] = useState<string | undefined>();
  const [editingPlayerForm, setEditingPlayerForm] = useState({
    personId: '',
    firstName: '',
    lastName: '',
    surname: '',
    teamName: '',
    email: '',
  });
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [userAccountOptions, setUserAccountOptions] = useState<UserAccountOption[]>([]);
  const [userAccountSearch, setUserAccountSearch] = useState('');
  const [search, setSearch] = useState('');
  const [confirmationFilter, setConfirmationFilter] = useState<'ALL' | 'CONFIRMED' | 'UNCONFIRMED'>('ALL');

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const tournamentId = parameters.get('tournamentId');
  const normalizedTournamentStatus = (tournament?.status ?? '').trim().toUpperCase();
  const canDeletePlayers = isAdmin
    && normalizedTournamentStatus !== 'LIVE'
    && normalizedTournamentStatus !== 'FINISHED';
  const canSelfEditPlayers = normalizedTournamentStatus !== 'LIVE'
    && normalizedTournamentStatus !== 'FINISHED';
  const normalizedUserEmail = user?.email?.trim().toLowerCase() ?? '';

  // Helper to safely get access token
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch {
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const fetchTournamentDetails = useCallback(async (id: string) => {
    try {
      const token = await getSafeAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(`/api/tournaments/${id}`, { headers });

      if (response.ok) {
        const data = await response.json();
        setTournament({
          id: data.id,
          name: data.name,
          status: data.status,
          format: data.format,
          totalParticipants: data.totalParticipants,
        });
      }
    } catch {
      void 0;
    }
  }, [getSafeAccessToken]);

  const fetchPlayers = useCallback(async (id: string) => {
    setLoading(true);
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      const playerList = await fetchTournamentPlayers(id, token);
      setPlayers(playerList);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [getSafeAccessToken]);

  const fetchUserAccountOptions = useCallback(async (searchTerm?: string) => {
    if (!isAdmin) {
      setUserAccountOptions([]);
      return;
    }

    try {
      const token = await getSafeAccessToken();
      const parameters = new URLSearchParams({ limit: '200' });
      const normalizedSearchTerm = searchTerm?.trim();
      if (normalizedSearchTerm) {
        parameters.set('q', normalizedSearchTerm);
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/auth/users?${parameters.toString()}`, Object.keys(headers).length > 0
        ? { headers }
        : undefined);

      if (!response.ok) {
        return;
      }

      const payload = await response.json() as { users?: UserAccountOption[] };
      setUserAccountOptions(Array.isArray(payload.users) ? payload.users : []);
    } catch {
      // Keep player editing usable even if account list cannot be loaded.
    }
  }, [getSafeAccessToken, isAdmin]);

  const fetchGroups = useCallback(async (id: string, format: string) => {
    setLoading(true);
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      if (format === TournamentFormat.DOUBLE) {
        const result = await fetchDoublettes(id, token);
        setGroups(result.filter((group) => group.isRegistered));
      } else if (format === TournamentFormat.TEAM_4_PLAYER) {
        const result = await fetchEquipes(id, token);
        setGroups(result.filter((group) => group.isRegistered));
      } else {
        setGroups([]);
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [getSafeAccessToken]);

  const confirmPresence = useCallback(async (player: TournamentPlayer) => {
    if (!tournamentId || !player.playerId || player.checkedIn) {
      return;
    }
    if (!isAdmin || tournament?.status !== 'SIGNATURE') {
      return;
    }

    setCheckingInId(player.playerId);
    try {
      const token = await getSafeAccessToken();
      if (!token) {
        throw new Error(t('auth.signInRequired'));
      }
      await updateTournamentPlayerCheckIn(tournamentId, player.playerId, true, token);
      setPlayers((current) => current.map((entry) => (
        entry.playerId === player.playerId
          ? { ...entry, checkedIn: true }
          : entry
      )));
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('players.confirmPresenceFailed'));
    } finally {
      setCheckingInId(undefined);
    }
  }, [getSafeAccessToken, isAdmin, t, tournament?.status, tournamentId]);

  const removePlayer = useCallback(async (player: TournamentPlayer) => {
    if (!tournamentId || !player.playerId) {
      return;
    }
    if (!isAdmin) {
      return;
    }
    if (normalizedTournamentStatus === 'LIVE' || normalizedTournamentStatus === 'FINISHED') {
      return;
    }
    if (!globalThis.confirm(t('players.deleteConfirm'))) {
      return;
    }

    setRemovingPlayerId(player.playerId);
    try {
      const token = await getSafeAccessToken();
      if (!token) {
        throw new Error(t('auth.signInRequired'));
      }
      await removeTournamentPlayer(tournamentId, player.playerId, token);
      setPlayers((current) => current.filter((entry) => entry.playerId !== player.playerId));
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('players.deleteFailed'));
    } finally {
      setRemovingPlayerId(undefined);
    }
  }, [getSafeAccessToken, isAdmin, normalizedTournamentStatus, t, tournamentId]);

  const canEditOwnPlayer = useCallback((player: TournamentPlayer): boolean => {
    if (!canSelfEditPlayers || !normalizedUserEmail) {
      return false;
    }

    const playerEmail = player.email?.trim().toLowerCase();
    if (!playerEmail) {
      return false;
    }

    return playerEmail === normalizedUserEmail;
  }, [canSelfEditPlayers, normalizedUserEmail]);

  const startEditPlayer = useCallback((player: TournamentPlayer) => {
    const canEditPlayer = isAdmin || canEditOwnPlayer(player);
    if (!canEditPlayer) {
      return;
    }

    setEditingPlayerId(player.playerId);

    const linkedAccount = (player.personId
      ? userAccountOptions.find((account) => account.id === player.personId)
      : undefined);

    setEditingPlayerForm({
      personId: player.personId ?? '',
      firstName: player.firstName ?? '',
      lastName: player.lastName ?? '',
      surname: player.surname ?? '',
      teamName: player.teamName ?? '',
      email: player.email ?? '',
    });
    setUserAccountSearch(linkedAccount ? formatUserAccountOptionLabel(linkedAccount) : '');
  }, [canEditOwnPlayer, isAdmin, userAccountOptions]);

  const cancelEditPlayer = useCallback(() => {
    setEditingPlayerId(undefined);
    setEditingPlayerForm({
      personId: '',
      firstName: '',
      lastName: '',
      surname: '',
      teamName: '',
      email: '',
    });
    setUserAccountSearch('');
  }, []);

  const savePlayerEdit = useCallback(async (player: TournamentPlayer) => {
    const canEditPlayer = isAdmin || canEditOwnPlayer(player);
    if (!canEditPlayer || !tournamentId || !player.playerId) {
      return;
    }

    const { firstName, lastName } = resolvePlayerNames({
      isAdmin,
      editingPlayerForm,
      player,
    });
    if (!firstName || !lastName) {
      alert('First and last name are required');
      return;
    }

    setSavingPlayerId(player.playerId);
    try {
      const token = await getSafeAccessToken();
      if (!token) {
        throw new Error(t('auth.signInRequired'));
      }

      const personId = editingPlayerForm.personId.trim();
      const surname = editingPlayerForm.surname.trim();
      const teamName = editingPlayerForm.teamName.trim();
      const email = editingPlayerForm.email.trim();

      const payload = buildPlayerUpdatePayload({
        isAdmin,
        personId,
        firstName,
        lastName,
        surname,
        teamName,
        email,
      });

      await updateTournamentPlayer(
        tournamentId,
        player.playerId,
        payload,
        token
      );

      const targetPlayerId = player.playerId;
      setPlayers((current) => current.map((entry) => mergeUpdatedPlayerEntry({
        entry,
        isAdmin,
        targetPlayerId,
        personId,
        firstName,
        lastName,
        surname,
        teamName,
        email,
      })));
      cancelEditPlayer();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedUpdatePlayer'));
    } finally {
      setSavingPlayerId(undefined);
    }
  }, [canEditOwnPlayer, cancelEditPlayer, editingPlayerForm, getSafeAccessToken, isAdmin, t, tournamentId]);

  const toggleContactDetails = useCallback((playerId?: string) => {
    if (!playerId) {
      return;
    }
    setExpandedContacts((current) => ({
      ...current,
      [playerId]: !current[playerId],
    }));
  }, []);

  useEffect(() => {
    if (!tournamentId) {
      return;
    }

    const loadData = async () => {
      await fetchTournamentDetails(tournamentId);
    };

    void loadData();
  }, [tournamentId, fetchTournamentDetails]);

  useEffect(() => {
    if (!tournamentId) {
      return;
    }

    void fetchUserAccountOptions();
  }, [fetchUserAccountOptions, tournamentId]);

  useEffect(() => {
    if (!isAdmin || !editingPlayerId) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      void fetchUserAccountOptions(userAccountSearch);
    }, 250);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [editingPlayerId, fetchUserAccountOptions, isAdmin, userAccountSearch]);

  useEffect(() => {
    if (!tournamentId || !tournament) {
      return;
    }

    const normalizedFormat = tournament.format ?? TournamentFormat.SINGLE;

    if (normalizedFormat === TournamentFormat.DOUBLE || normalizedFormat === TournamentFormat.TEAM_4_PLAYER) {
      void fetchGroups(tournamentId, normalizedFormat);
      setPlayers([]);
      return;
    }

    setGroups([]);
    void fetchPlayers(tournamentId);
  }, [fetchGroups, fetchPlayers, tournament, tournamentId]);

  const isGroupTournament = tournament?.format === TournamentFormat.DOUBLE
    || tournament?.format === TournamentFormat.TEAM_4_PLAYER;
  const isSingleTournament = !isGroupTournament;
  const slotCapacity = useMemo(() => {
    if (!tournament?.totalParticipants) {
      return 0;
    }

    if (tournament.format === TournamentFormat.TEAM_4_PLAYER) {
      return Math.max(1, Math.floor(tournament.totalParticipants / 2));
    }

    return tournament.totalParticipants;
  }, [tournament?.format, tournament?.totalParticipants]);

  const playerCountLabel = players.length === 1 ? t('common.player') : t('common.players');
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) => {
      if (confirmationFilter === 'CONFIRMED' && !player.checkedIn) {
        return false;
      }
      if (confirmationFilter === 'UNCONFIRMED' && player.checkedIn) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        player.firstName,
        player.lastName,
        player.surname,
        player.teamName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [players, search, confirmationFilter]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) {
      return groups;
    }

    const term = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (group.name.toLowerCase().includes(term)) {
        return true;
      }

      return group.members.some((member) => (`${member.firstName} ${member.lastName}`).toLowerCase().includes(term));
    });
  }, [groups, search]);

  const resolvePresenceLabel = (player: TournamentPlayer) => {
    if (player.checkedIn) {
      return t('players.confirmed');
    }
    if (checkingInId === player.playerId) {
      return t('common.loading');
    }
    return t('players.confirmPresence');
  };

  const filteredUserAccountOptions = useMemo(() => {
    const term = userAccountSearch.trim().toLowerCase();
    if (!term) {
      return userAccountOptions;
    }

    return userAccountOptions.filter((account) => {
      const label = formatUserAccountOptionLabel(account).toLowerCase();
      return label.includes(term);
    });
  }, [userAccountOptions, userAccountSearch]);

  const renderSingleTournamentPlayerCard = (player: TournamentPlayer) => {
    const isEditing = editingPlayerId === player.playerId;
    const canEditThisPlayer = isAdmin || canEditOwnPlayer(player);
    const presenceLabel = resolvePresenceLabel(player);
    const isContactExpanded = Boolean(expandedContacts[player.playerId]);

    return (
      <div
        key={player.playerId}
        className="flex h-full flex-col rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                {isAdmin && (
                  <>
                    <input
                      value={userAccountSearch}
                      onChange={(event) => setUserAccountSearch(event.target.value)}
                      aria-label="Compte associe"
                      placeholder="Rechercher un compte (nom / prenom / surnom)"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlayerForm((current) => ({
                            ...current,
                            personId: '',
                          }));
                          setUserAccountSearch('');
                        }}
                        className={`mb-1 w-full rounded-md px-2 py-1 text-left text-xs transition ${
                          editingPlayerForm.personId === ''
                            ? 'bg-cyan-500/20 text-cyan-200'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {t('common.none')}
                      </button>
                      {filteredUserAccountOptions.map((userAccount) => {
                        const label = formatUserAccountOptionLabel(userAccount);
                        const selected = editingPlayerForm.personId === userAccount.id;

                        return (
                          <button
                            type="button"
                            key={userAccount.id}
                            onClick={() => {
                              setEditingPlayerForm((current) => ({
                                ...current,
                                personId: userAccount.id,
                              }));
                              setUserAccountSearch(label);
                            }}
                            className={`mb-1 w-full rounded-md px-2 py-1 text-left text-xs transition ${
                              selected
                                ? 'bg-cyan-500/20 text-cyan-200'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={editingPlayerForm.firstName}
                      onChange={(event) => setEditingPlayerForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))}
                      placeholder={t('edit.firstName')}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={editingPlayerForm.lastName}
                      onChange={(event) => setEditingPlayerForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))}
                      placeholder={t('edit.lastName')}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                  </>
                )}
                <input
                  value={editingPlayerForm.surname}
                  onChange={(event) => setEditingPlayerForm((current) => ({
                    ...current,
                    surname: event.target.value,
                  }))}
                  placeholder={t('edit.surname')}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                />
                {isAdmin && (
                  <>
                    <input
                      value={editingPlayerForm.teamName}
                      onChange={(event) => setEditingPlayerForm((current) => ({
                        ...current,
                        teamName: event.target.value,
                      }))}
                      placeholder={t('edit.teamName')}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={editingPlayerForm.email}
                      onChange={(event) => setEditingPlayerForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))}
                      placeholder={t('edit.email')}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                  </>
                )}
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-white">
                  {player.firstName} {player.lastName}
                </h3>
                {player.surname && (
                  <p className="text-xs text-slate-500 italic">"{player.surname}"</p>
                )}
                {player.teamName && (
                  <p className="text-xs text-cyan-400 mt-1">{player.teamName}</p>
                )}
              </>
            )}
          </div>
          {player.checkedIn && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              ✓
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          {isAdmin && player.email && (
            <button
              type="button"
              onClick={() => toggleContactDetails(player.playerId)}
              className="text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
            >
              {isContactExpanded ? t('players.hideContact') : t('players.showContact')}
            </button>
          )}
          {isAdmin && isContactExpanded && player.email && (
            <p className="truncate">📧 {player.email}</p>
          )}
          {isAdmin && player.skillLevel && (
            <p className="mt-2">
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {player.skillLevel}
              </span>
            </p>
          )}
        </div>
        {canEditThisPlayer && (
          <div className="mt-auto pt-4 space-y-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => savePlayerEdit(player)}
                  disabled={savingPlayerId === player.playerId}
                  className="w-full rounded-full border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPlayerId === player.playerId ? t('common.loading') : t('common.save')}
                </button>
                <button
                  onClick={cancelEditPlayer}
                  className="w-full rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEditPlayer(player)}
                  className="w-full rounded-full border border-cyan-500/60 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  {t('common.edit')}
                </button>
                {isAdmin && tournament?.status === 'SIGNATURE' && (
                  <button
                    onClick={() => confirmPresence(player)}
                    disabled={player.checkedIn || checkingInId === player.playerId}
                    className="w-full rounded-full border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {presenceLabel}
                  </button>
                )}
                {isAdmin && canDeletePlayers && (
                  <button
                    onClick={() => removePlayer(player)}
                    disabled={removingPlayerId === player.playerId}
                    className="w-full rounded-full border border-rose-500/60 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removingPlayerId === player.playerId ? t('players.deleting') : t('common.delete')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!tournamentId) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">{t('common.noSelection')}</p>
        <a
          href="/?status=OPEN"
          className="mt-4 inline-block rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
        >
          {t('common.back')}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('tournaments.registered')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">
            {tournament?.name || t('tournaments.loading')}
          </h2>
        </div>
        <a
          href="/?status=OPEN"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
        >
          {t('common.back')}
        </a>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <div className="text-rose-200 mb-4">{error}</div>
          <button
            onClick={() => tournamentId && fetchPlayers(tournamentId)}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
          </div>
          <span className="ml-3 text-slate-300">{t('players.loading')}</span>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
          <div className="mb-6">
            {isGroupTournament ? (
              <p className="text-slate-400 text-sm">
                {filteredGroups.length} / {slotCapacity} {t('registration.slotsCount')}
              </p>
            ) : (
              <p className="text-slate-400 text-sm">
                {filteredPlayers.length} {playerCountLabel}
              </p>
            )}
            <div className="mt-3 space-y-3">
              <label className="sr-only" htmlFor="tournament-players-search">
                {t('players.searchRegistered')}
              </label>
              <input
                id="tournament-players-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('players.searchRegistered')}
                className="w-full rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-100"
              />
              {!isGroupTournament && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'ALL', label: t('players.filterAll') },
                    { value: 'CONFIRMED', label: t('players.filterConfirmed') },
                    { value: 'UNCONFIRMED', label: t('players.filterUnconfirmed') },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setConfirmationFilter(option.value as typeof confirmationFilter)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        confirmationFilter === option.value
                          ? 'border-cyan-400/70 text-cyan-200'
                          : 'border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isSingleTournament && filteredPlayers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
              {t('edit.noPlayersRegistered')}
            </div>
          )}

          {isSingleTournament && filteredPlayers.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlayers.map((player) => renderSingleTournamentPlayerCard(player))}
            </div>
          )}

          {isGroupTournament && filteredGroups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
              {t('registration.noneRegisteredGroups')}
            </div>
          )}

          {isGroupTournament && filteredGroups.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-white">{group.name}</h3>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300">
                      {group.memberCount}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    {group.members.map((member) => (
                      <li key={member.playerId} className="flex items-center gap-2">
                        <span>{member.firstName} {member.lastName}</span>
                        {member.playerId === group.captainPlayerId && (
                          <span className="rounded-full border border-violet-500/60 px-2 py-0.5 text-[10px] text-violet-200">
                            {t('groups.captain')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TournamentPlayersView;
