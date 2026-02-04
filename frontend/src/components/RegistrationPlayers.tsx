import { useEffect, useMemo, useState } from 'react';
import { TournamentFormat } from '@shared/types';
import { useOptionalAuth } from '../auth/optionalAuth';
import { fetchTournamentPlayers, type TournamentPlayer } from '../services/tournamentService';

interface TournamentSummary {
  id: string;
  name: string;
  format: TournamentFormat | string;
  status: string;
  totalParticipants: number;
}

const formatSections = [
  {
    title: 'Double tournaments',
    format: TournamentFormat.DOUBLE,
  },
  {
    title: 'Team tournaments',
    format: TournamentFormat.TEAM_4_PLAYER,
  },
] as const;

function RegistrationPlayers() {
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [playersByTournament, setPlayersByTournament] = useState<Record<string, TournamentPlayer[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleTournaments = useMemo(() => {
    return tournaments.filter((tournament) =>
      formatSections.some((section) => section.format === tournament.format)
    );
  }, [tournaments]);

  const fetchRegistrationPlayers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments?status=REGISTRATION_OPEN&limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch registration tournaments');
      }

      const data = await response.json();
      const registrationTournaments = (data.tournaments || []) as TournamentSummary[];

      const filtered = registrationTournaments.filter((tournament) =>
        formatSections.some((section) => section.format === tournament.format)
      );

      setTournaments(filtered);

      const playersEntries = await Promise.all(
        filtered.map(async (tournament) => {
          const players = await fetchTournamentPlayers(tournament.id, token);
          return [tournament.id, players] as const;
        })
      );

      setPlayersByTournament(Object.fromEntries(playersEntries));
    } catch (err) {
      console.error('Error fetching registration players:', err);
      setError(err instanceof Error ? err.message : 'Failed to load registration players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      fetchRegistrationPlayers();
    }
  }, [authEnabled, isAuthenticated]);

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
        <h3 className="text-xl font-semibold text-white">Sign in to view registration players</h3>
        <p className="mt-2 text-sm text-slate-300">
          Player registration lists are protected. Please sign in to continue.
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
        <span className="ml-3 text-slate-300">Loading registration players...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={fetchRegistrationPlayers}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Registration players</p>
          <h2 className="text-2xl font-semibold text-white mt-2">Double & team signups</h2>
        </div>
        <button
          onClick={fetchRegistrationPlayers}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          Refresh
        </button>
      </div>

      {visibleTournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">No registration players yet</p>
          <p className="mt-2">Open registration for double or team tournaments to see players here.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {formatSections.map((section) => {
            const sectionTournaments = visibleTournaments.filter(
              (tournament) => tournament.format === section.format
            );

            return (
              <div key={section.format} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <span className="text-sm text-slate-400">{sectionTournaments.length}</span>
                </div>
                {sectionTournaments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                    No tournaments in this category yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sectionTournaments.map((tournament) => {
                      const players = playersByTournament[tournament.id] || [];

                      return (
                        <div
                          key={tournament.id}
                          className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-semibold text-white">{tournament.name}</h4>
                              <p className="text-sm text-slate-400">
                                {players.length} of {tournament.totalParticipants} players
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {tournament.format}
                            </span>
                          </div>

                          {players.length === 0 ? (
                            <p className="mt-4 text-sm text-slate-400">No players registered yet.</p>
                          ) : (
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                              {players.map((player) => (
                                <div
                                  key={player.playerId}
                                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-2 text-sm"
                                >
                                  <div>
                                    <p className="text-slate-100">{player.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {player.email || 'No email'}
                                    </p>
                                  </div>
                                  {player.skillLevel && (
                                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                                      {player.skillLevel}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

export default RegistrationPlayers;
