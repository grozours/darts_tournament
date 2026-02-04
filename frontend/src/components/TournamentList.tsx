import { useState, useEffect, useMemo } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { TournamentFormat, DurationType, SkillLevel } from '@shared/types';
import {
  updateTournament,
  updateTournamentStatus,
  fetchTournamentPlayers,
  registerTournamentPlayer,
  updateTournamentPlayer,
  removeTournamentPlayer,
  type CreatePlayerPayload,
  type TournamentPlayer,
} from '../services/tournamentService';

interface Tournament {
  id: string;
  name: string;
  format: string;
  totalParticipants: number;
  status: string;
  durationType?: string;
  startTime?: string;
  endTime?: string;
  targetCount?: number;
}

type EditFormState = {
  name: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: string;
  targetCount: string;
};

function TournamentList() {
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [isRegisteringPlayer, setIsRegisteringPlayer] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] = useState<CreatePlayerPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    skillLevel: undefined,
  });

  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: 'Single' },
      { value: TournamentFormat.DOUBLE, label: 'Double' },
      { value: TournamentFormat.TEAM_4_PLAYER, label: 'Team (4 players)' },
    ],
    []
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.HALF_DAY_MORNING, label: 'Half day morning' },
      { value: DurationType.HALF_DAY_AFTERNOON, label: 'Half day afternoon' },
      { value: DurationType.HALF_DAY_NIGHT, label: 'Half day night' },
      { value: DurationType.FULL_DAY, label: 'Full day' },
      { value: DurationType.TWO_DAY, label: 'Two day' },
    ],
    []
  );

  const skillLevelOptions = useMemo(
    () => [
      { value: SkillLevel.BEGINNER, label: 'Beginner' },
      { value: SkillLevel.INTERMEDIATE, label: 'Intermediate' },
      { value: SkillLevel.ADVANCED, label: 'Advanced' },
      { value: SkillLevel.EXPERT, label: 'Expert' },
    ],
    []
  );

  const statusFilter = useMemo(() => {
    if (typeof window === 'undefined') return 'ALL';
    const params = new URLSearchParams(window.location.search);
    return params.get('status')?.toUpperCase() || 'ALL';
  }, []);

  const toLocalInput = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const data = await response.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      fetchTournaments();
    }
  }, [authEnabled, isAuthenticated]);

  const createTournament = async () => {
    const name = prompt('Tournament name:');
    if (!name) return;

    try {
      const startTime = new Date(Date.now() + 60 * 60 * 1000);
      const endTime = new Date(Date.now() + 5 * 60 * 60 * 1000);
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          format: 'SINGLE',
          durationType: 'HALF_DAY_MORNING',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          totalParticipants: 8,
          targetCount: 4,
        }),
      });

      if (response.ok) {
        fetchTournaments();
      } else {
        const message = await response.text();
        alert(message || 'Failed to create tournament');
      }
    } catch (err) {
      console.error('Error creating tournament:', err);
      alert('Failed to create tournament');
    }
  };

  const deleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.ok) {
        fetchTournaments();
      } else {
        alert('Failed to delete tournament');
      }
    } catch (err) {
      console.error('Error deleting tournament:', err);
      alert('Failed to delete tournament');
    }
  };

  const openEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setEditForm({
      name: tournament.name || '',
      format: tournament.format || TournamentFormat.SINGLE,
      durationType: tournament.durationType || DurationType.FULL_DAY,
      startTime: toLocalInput(tournament.startTime),
      endTime: toLocalInput(tournament.endTime),
      totalParticipants: String(tournament.totalParticipants ?? 0),
      targetCount: String(tournament.targetCount ?? 0),
    });
    setEditError(null);
    setPlayersError(null);
    if (tournament.status === 'REGISTRATION_OPEN') {
      void fetchPlayers(tournament.id);
    } else {
      setPlayers([]);
    }
  };

  const closeEdit = () => {
    setEditingTournament(null);
    setEditForm(null);
    setEditError(null);
    setPlayers([]);
    setPlayersError(null);
    setEditingPlayerId(null);
    setPlayerForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      skillLevel: undefined,
    });
  };

  const fetchPlayers = async (tournamentId: string) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchTournamentPlayers(tournamentId, token);
      setPlayers(data);
    } catch (err) {
      console.error('Error fetching players:', err);
      setPlayersError('Failed to load players');
    } finally {
      setPlayersLoading(false);
    }
  };

  const registerPlayer = async () => {
    if (!editingTournament) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await registerTournamentPlayer(
        editingTournament.id,
        {
          firstName: playerForm.firstName.trim(),
          lastName: playerForm.lastName.trim(),
          email: playerForm.email?.trim() || undefined,
          phone: playerForm.phone?.trim() || undefined,
          skillLevel: playerForm.skillLevel,
        },
        token
      );
      setPlayerForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        skillLevel: undefined,
      });
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error registering player:', err);
      setPlayersError(err instanceof Error ? err.message : 'Failed to register player');
    } finally {
      setIsRegisteringPlayer(false);
    }
  };

  const startEditPlayer = (player: TournamentPlayer) => {
    setEditingPlayerId(player.playerId);
    setPlayerForm({
      firstName: player.firstName || player.name.split(' ')[0] || '',
      lastName: player.lastName || player.name.split(' ').slice(1).join(' ') || '',
      email: player.email || '',
      phone: player.phone || '',
      skillLevel: player.skillLevel,
    });
    setPlayersError(null);
  };

  const cancelEditPlayer = () => {
    setEditingPlayerId(null);
    setPlayerForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      skillLevel: undefined,
    });
  };

  const savePlayerEdit = async () => {
    if (!editingTournament || !editingPlayerId) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentPlayer(
        editingTournament.id,
        editingPlayerId,
        {
          firstName: playerForm.firstName.trim(),
          lastName: playerForm.lastName.trim(),
          email: playerForm.email?.trim() || undefined,
          phone: playerForm.phone?.trim() || undefined,
          skillLevel: playerForm.skillLevel,
        },
        token
      );
      await fetchPlayers(editingTournament.id);
      cancelEditPlayer();
    } catch (err) {
      console.error('Error updating player:', err);
      setPlayersError(err instanceof Error ? err.message : 'Failed to update player');
    } finally {
      setIsRegisteringPlayer(false);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!editingTournament) return;
    if (!confirm('Remove this player from the tournament?')) return;
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await removeTournamentPlayer(editingTournament.id, playerId, token);
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error removing player:', err);
      setPlayersError(err instanceof Error ? err.message : 'Failed to remove player');
    }
  };

  const saveEdit = async () => {
    if (!editingTournament || !editForm) return;
    if (!editForm.name.trim()) {
      setEditError('Name is required');
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournament(
        editingTournament.id,
        {
          name: editForm.name.trim(),
          format: editForm.format,
          durationType: editForm.durationType,
          startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
          endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : undefined,
          totalParticipants: Number(editForm.totalParticipants || 0),
          targetCount: Number(editForm.targetCount || 0),
        },
        token
      );
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError('Failed to update tournament');
    } finally {
      setIsSaving(false);
    }
  };

  const openRegistration = async () => {
    if (!editingTournament) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentStatus(editingTournament.id, 'REGISTRATION_OPEN', token);
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError('Failed to open registration');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCard = (tournament: Tournament) => (
    <div
      key={tournament.id}
      className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] transition hover:border-cyan-400/50 hover:shadow-[0_20px_60px_-40px_rgba(34,211,238,0.8)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {tournament.name}
          </h3>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tournament.format}</p>
        </div>
        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
          {tournament.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Players</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.totalParticipants}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.status}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => openEdit(tournament)}
          className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Edit
        </button>
        <button
          onClick={() => deleteTournament(tournament.id)}
          className="rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">Checking session...</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <h3 className="text-xl font-semibold text-white">Sign in to view tournaments</h3>
        <p className="mt-2 text-sm text-slate-300">
          Your tournaments are protected. Please sign in to continue.
        </p>
        <button
          onClick={() => loginWithRedirect()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">Loading tournaments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={fetchTournaments}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Tournament hub</p>
          <h2 className="text-2xl font-semibold text-white mt-2">
            Tournaments <span className="text-slate-400">({tournaments.length})</span>
          </h2>
        </div>
        <button
          onClick={createTournament}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          + Create Tournament
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">No tournaments yet</p>
          <p className="mt-2">Create your first tournament to start tracking matches and standings.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {statusFilter === 'ALL' ? (
            ([
              { title: 'Draft tournaments', status: 'DRAFT' },
              { title: 'Registration open', status: 'REGISTRATION_OPEN' },
            ] as const).map((group) => {
              const groupItems = tournaments.filter(
                (tournament) => tournament.status === group.status
              );

              return (
                <div key={group.status} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{group.title}</h3>
                    <span className="text-sm text-slate-400">{groupItems.length}</span>
                  </div>
                  {groupItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                      No tournaments in this category yet.
                    </div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {groupItems.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            (() => {
              const filteredTournaments = tournaments.filter(
                (tournament) => tournament.status === statusFilter
              );

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {statusFilter === 'DRAFT' ? 'Draft tournaments' : 'Registration open'}
                    </h3>
                    <span className="text-sm text-slate-400">{filteredTournaments.length}</span>
                  </div>
                  {filteredTournaments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                      No tournaments in this category yet.
                    </div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {filteredTournaments.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {editingTournament && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800/70 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit tournament</h3>
              <button
                onClick={closeEdit}
                className="text-sm text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Name
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Format
                <select
                  value={editForm.format}
                  onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
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
                Duration type
                <select
                  value={editForm.durationType}
                  onChange={(e) => setEditForm({ ...editForm, durationType: e.target.value })}
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
                Participants
                <input
                  type="number"
                  value={editForm.totalParticipants}
                  onChange={(e) => setEditForm({ ...editForm, totalParticipants: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Start time
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                End time
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Target count
                <input
                  type="number"
                  value={editForm.targetCount}
                  onChange={(e) => setEditForm({ ...editForm, targetCount: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            {editingTournament.status === 'REGISTRATION_OPEN' && (
              <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">Player registration</h4>
                    <p className="text-sm text-slate-400">
                      {players.length} of {editingTournament.totalParticipants} spots filled
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPlayers(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    First name
                    <input
                      type="text"
                      value={playerForm.firstName}
                      onChange={(e) => setPlayerForm({ ...playerForm, firstName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Last name
                    <input
                      type="text"
                      value={playerForm.lastName}
                      onChange={(e) => setPlayerForm({ ...playerForm, lastName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Email
                    <input
                      type="email"
                      value={playerForm.email || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Phone
                    <input
                      type="text"
                      value={playerForm.phone || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300 md:col-span-2">
                    Skill level
                    <select
                      value={playerForm.skillLevel || ''}
                      onChange={(e) =>
                        setPlayerForm({
                          ...playerForm,
                          skillLevel: (e.target.value as SkillLevel) || undefined,
                        })
                      }
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select level (optional)</option>
                      {skillLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  {editingPlayerId && (
                    <button
                      onClick={cancelEditPlayer}
                      className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                      Cancel edit
                    </button>
                  )}
                  <button
                    onClick={editingPlayerId ? savePlayerEdit : registerPlayer}
                    disabled={isRegisteringPlayer}
                    className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {isRegisteringPlayer
                      ? 'Saving...'
                      : editingPlayerId
                      ? 'Save changes'
                      : 'Add player'}
                  </button>
                </div>

                <div className="mt-6 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-200">Registered players</h5>
                  {playersLoading ? (
                    <p className="text-sm text-slate-400">Loading players...</p>
                  ) : players.length === 0 ? (
                    <p className="text-sm text-slate-400">No players registered yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {players.map((player) => (
                        <div
                          key={player.playerId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
                        >
                          <div>
                            <p className="text-slate-100">{player.name}</p>
                            <p className="text-xs text-slate-500">
                              {player.email || 'No email'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {player.skillLevel && (
                              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                                {player.skillLevel}
                              </span>
                            )}
                            <button
                              onClick={() => startEditPlayer(player)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removePlayer(player.playerId)}
                              className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {editError && (
              <p className="mt-4 text-sm text-rose-300">{editError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEdit}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={openRegistration}
                disabled={isSaving}
                className="rounded-full border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
              >
                Open registration
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentList;