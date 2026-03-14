import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import { TournamentFormat, SkillLevel } from '@shared/types';
import {
  fetchTournamentPlayers,
  fetchOrphanPlayers,
  deleteOrphanPlayers,
  updateTournamentPlayer,
  removeTournamentPlayer,
  type TournamentPlayer,
} from '../services/tournament-service';

interface TournamentSummary {
  id: string;
  name: string;
  format: TournamentFormat | string;
  status?: string;
}

interface PlayerRecord extends TournamentPlayer {
  tournamentId?: string;
  tournamentName: string;
  tournamentFormat?: TournamentFormat | string;
}

const buildPlayerLabel = (player: PlayerRecord) => {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim();
  if (player.surname) {
    return `${name || player.name} (${player.surname})`;
  }
  return name || player.name || player.playerId;
};

function PlayersView() {
  const { t } = useI18n();
  const { enabled: authEnabled, getAccessTokenSilently } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('ALL');
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    surname: '',
    teamName: '',
    email: '',
    skillLevel: '' as SkillLevel | '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingOrphans, setDeletingOrphans] = useState(false);

  // Helper to safely get access token, falling back to undefined if it fails
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      console.warn('Failed to retrieve access token in PlayersView', error);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const fetchTournaments = useCallback(async (token?: string): Promise<TournamentSummary[]> => {
    const response = await fetch(
      '/api/tournaments',
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    if (!response.ok) {
      throw new Error('Failed to fetch tournaments');
    }
    const data = await response.json();
    return Array.isArray(data.tournaments) ? data.tournaments : [];
  }, []);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      const tournaments = await fetchTournaments(token);
      const playerLists = await Promise.all(
        tournaments.map(async (tournament) => {
          const list = await fetchTournamentPlayers(tournament.id, token);
          return list.map((player) => ({
            ...player,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentFormat: tournament.format,
          }));
        })
      );
      const orphanPlayers = await fetchOrphanPlayers(token);
      const orphanMapped = orphanPlayers.map((player) => ({
        ...player,
        tournamentName: t('players.orphanTournament'),
        tournamentFormat: '—',
      }));
      setPlayers([...playerLists.flat(), ...orphanMapped]);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('players.error'));
    } finally {
      setLoading(false);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const filteredPlayers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    let byTournament = players;
    if (selectedTournamentId === 'ORPHAN') {
      byTournament = players.filter((player) => player.tournamentId === undefined);
    } else if (selectedTournamentId !== 'ALL') {
      byTournament = players.filter((player) => player.tournamentId === selectedTournamentId);
    }
    if (!searchTerm) return byTournament;
    return byTournament.filter((player) => {
      const haystack = [
        player.firstName,
        player.lastName,
        player.surname,
        player.teamName,
        player.email,
        player.tournamentName,
        player.tournamentFormat,
        player.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [players, search, selectedTournamentId]);

  const tournamentOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const player of players) {
      if (player.tournamentId && player.tournamentName) {
        unique.set(player.tournamentId, player.tournamentName);
      }
    }
    const options = [...unique.entries()].map(([id, name]) => ({ id, name }));
    if (players.some((player) => player.tournamentId === undefined)) {
      options.push({ id: 'ORPHAN', name: t('players.orphanTournament') });
    }
    return options;
  }, [players, t]);

  const orphanPlayersCount = useMemo(
    () => players.filter((player) => player.tournamentId === undefined).length,
    [players]
  );

  const startEdit = (player: PlayerRecord) => {
    setEditingPlayerId(player.playerId);
    setForm({
      firstName: player.firstName || '',
      lastName: player.lastName || '',
      surname: player.surname || '',
      teamName: player.teamName || '',
      email: player.email || '',
      skillLevel: player.skillLevel || '',
    });
  };

  const cancelEdit = () => {
    setEditingPlayerId(undefined);
    setForm({
      firstName: '',
      lastName: '',
      surname: '',
      teamName: '',
      email: '',
      skillLevel: '',
    });
  };

  const saveEdit = async (player: PlayerRecord) => {
    if (!player.tournamentId) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      } as {
        firstName: string;
        lastName: string;
        surname?: string;
        teamName?: string;
        email?: string;
        skillLevel?: SkillLevel;
      };

      if (form.surname.trim()) payload.surname = form.surname.trim();
      if (form.teamName.trim()) payload.teamName = form.teamName.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.skillLevel) payload.skillLevel = form.skillLevel;

      await updateTournamentPlayer(player.tournamentId, player.playerId, payload, token);
      await loadPlayers();
      cancelEdit();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('players.error'));
    } finally {
      setSaving(false);
    }
  };

  const deleteAllPlayers = async () => {
    const deletablePlayers = filteredPlayers.filter(
      (player): player is PlayerRecord & { tournamentId: string } => Boolean(player.tournamentId)
    );
    if (deletablePlayers.length === 0) return;
    if (!confirm(t('players.deleteAllConfirm'))) return;
    setDeletingAll(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      const deletions = deletablePlayers.map((player) =>
        removeTournamentPlayer(player.tournamentId, player.playerId, token)
      );
      for (const task of deletions) {
        await task;
      }
      await loadPlayers();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('players.error'));
    } finally {
      setDeletingAll(false);
    }
  };

  const deleteAllOrphanPlayers = async () => {
    if (orphanPlayersCount === 0) return;
    if (!confirm(t('players.deleteOrphansConfirm'))) return;
    setDeletingOrphans(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await deleteOrphanPlayers(token);
      await loadPlayers();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('players.error'));
    } finally {
      setDeletingOrphans(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('players.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={loadPlayers}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('players.title')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{t('players.subtitle')}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={deleteAllOrphanPlayers}
              disabled={orphanPlayersCount === 0 || deletingOrphans}
              className="rounded-full border border-amber-500/60 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
            >
              {deletingOrphans ? t('players.deletingOrphans') : t('players.deleteOrphans')}
            </button>
          )}
          <button
            onClick={deleteAllPlayers}
            disabled={filteredPlayers.length === 0 || deletingAll}
            className="rounded-full border border-rose-500/60 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
          >
            {deletingAll ? t('players.deletingAll') : t('players.deleteAll')}
          </button>
          <button
            onClick={loadPlayers}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(event_) => setSearch(event_.target.value)}
          placeholder={t('players.search')}
          className="w-full max-w-md rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-white"
        />
        <select
          value={selectedTournamentId}
          onChange={(event_) => setSelectedTournamentId(event_.target.value)}
          className="w-full max-w-xs rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-white"
        >
          <option value="ALL">{t('players.allTournaments')}</option>
          {tournamentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filteredPlayers.length} {t('common.players')}</span>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('players.none')}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlayers.map((player) => {
            const isEditing = editingPlayerId === player.playerId;
            const showTeamName =
              player.tournamentFormat === TournamentFormat.DOUBLE
              || player.tournamentFormat === TournamentFormat.TEAM_4_PLAYER;
            const canEdit = Boolean(player.tournamentId);
            return (
              <div key={player.playerId} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{buildPlayerLabel(player)}</h3>
                    <p className="text-xs text-slate-400">
                      {t('players.tournament')}: {player.tournamentName} · {t('players.format')}: {player.tournamentFormat}
                    </p>
                    {player.surname && (
                      <p className="text-xs text-slate-400">{t('players.surname')}: {player.surname}</p>
                    )}
                    {player.teamName && (
                      <p className="text-xs text-emerald-200">{t('players.teamName')}: {player.teamName}</p>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(player)}
                      disabled={!canEdit}
                      className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-60"
                    >
                      {t('edit.edit')}
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-400">
                      {t('edit.firstName')}
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(event_) => setForm({ ...form, firstName: event_.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      {t('edit.lastName')}
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(event_) => setForm({ ...form, lastName: event_.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      {t('edit.surname')}
                      <input
                        type="text"
                        value={form.surname}
                        onChange={(event_) => setForm({ ...form, surname: event_.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    {showTeamName && (
                      <label className="text-xs text-slate-400">
                        {t('edit.teamName')}
                        <input
                          type="text"
                          value={form.teamName}
                          onChange={(event_) => setForm({ ...form, teamName: event_.target.value })}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                        />
                      </label>
                    )}
                    <label className="text-xs text-slate-400">
                      {t('edit.email')}
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event_) => setForm({ ...form, email: event_.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400 md:col-span-2">
                      {t('edit.skillLevel')}
                      <select
                        value={form.skillLevel}
                        onChange={(event_) => setForm({ ...form, skillLevel: event_.target.value as SkillLevel })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      >
                        <option value="">{t('edit.selectSkillLevelOptional')}</option>
                        <option value={SkillLevel.BEGINNER}>{t('skill.beginner')}</option>
                        <option value={SkillLevel.INTERMEDIATE}>{t('skill.intermediate')}</option>
                        <option value={SkillLevel.EXPERT}>{t('skill.expert')}</option>
                      </select>
                    </label>
                    <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
                      <button
                        onClick={cancelEdit}
                        className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
                      >
                        {t('edit.cancelEdit')}
                      </button>
                      <button
                        onClick={() => saveEdit(player)}
                        disabled={saving}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {saving ? t('edit.saving') : t('edit.saveChanges')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlayersView;
