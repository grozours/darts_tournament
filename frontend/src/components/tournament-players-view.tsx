import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useI18n } from '../i18n';
import { fetchTournamentPlayers, type TournamentPlayer } from '../services/tournament-service';

function TournamentPlayersView() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const [tournament, setTournament] = useState<{ id: string; name: string } | undefined>();
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const tournamentId = parameters.get('tournamentId');

  // Helper to safely get access token
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (error_) {
      console.warn('[TournamentPlayersView] Failed to get access token:', error_);
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
        setTournament({ id: data.id, name: data.name });
      }
    } catch (error_) {
      console.error('[TournamentPlayersView] Error fetching tournament:', error_);
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
      console.error('[TournamentPlayersView] Error fetching players:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [getSafeAccessToken]);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
      fetchPlayers(tournamentId);
    }
  }, [tournamentId, fetchTournamentDetails, fetchPlayers]);

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
            <p className="text-slate-400 text-sm">
              {players.length} {players.length === 1 ? t('common.player') : t('common.players')}
            </p>
          </div>

          {players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
              {t('edit.noPlayersRegistered')}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <div
                  key={player.playerId}
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {player.firstName} {player.lastName}
                      </h3>
                      {player.surname && (
                        <p className="text-xs text-slate-500 italic">"{player.surname}"</p>
                      )}
                      {player.teamName && (
                        <p className="text-xs text-cyan-400 mt-1">{player.teamName}</p>
                      )}
                    </div>
                    {player.checkedIn && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {player.email && (
                      <p className="truncate">📧 {player.email}</p>
                    )}
                    {player.phone && (
                      <p>📱 {player.phone}</p>
                    )}
                    {player.skillLevel && (
                      <p className="mt-2">
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                          {player.skillLevel}
                        </span>
                      </p>
                    )}
                  </div>
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
