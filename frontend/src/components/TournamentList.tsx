import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

interface Tournament {
  id: string;
  name: string;
  format: string;
  totalParticipants: number;
  status: string;
}

function TournamentList() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/tournaments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    if (isAuthenticated) {
      fetchTournaments();
    }
  }, [isAuthenticated]);

  const createTournament = async () => {
    const name = prompt('Tournament name:');
    if (!name) return;

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          format: 'SINGLE',
          durationType: 'HALF_DAY_MORNING',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          totalParticipants: 8,
          targetCount: 4,
        }),
      });

      if (response.ok) {
        fetchTournaments();
      } else {
        alert('Failed to create tournament');
      }
    } catch (err) {
      console.error('Error creating tournament:', err);
      alert('Failed to create tournament');
    }
  };

  const deleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  if (!isAuthenticated) {
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
        <div className="grid gap-6 lg:grid-cols-2">
          {tournaments.map((tournament) => (
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
          ))}
        </div>
      )}
    </div>
  );
}

export default TournamentList;