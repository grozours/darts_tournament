import { useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { fetchTournamentLiveView, updateMatchStatus, completeMatch, updateCompletedMatchScores } from '../services/tournamentService';

interface LiveViewMatchPlayer {
  player?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  playerPosition: number;
  scoreTotal?: number;
  legsWon?: number;
  setsWon?: number;
}

interface LiveViewMatch {
  id: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  playerMatches?: LiveViewMatchPlayer[];
  winner?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  target?: {
    targetNumber: number;
    name?: string | null;
  } | null;
}

interface LiveViewPool {
  id: string;
  poolNumber: number;
  name: string;
  status: string;
  assignments?: Array<{
    id: string;
    player: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  matches?: LiveViewMatch[];
}

interface PoolLeaderboardRow {
  playerId: string;
  name: string;
  legsWon: number;
  legsLost: number;
}

interface LiveViewPoolStage {
  id: string;
  stageNumber: number;
  name: string;
  status: string;
  playersPerPool?: number;
  advanceCount?: number;
  pools?: LiveViewPool[];
}

interface LiveViewBracket {
  id: string;
  name: string;
  bracketType: string;
  status: string;
  entries?: Array<{
    id: string;
    seedNumber: number;
    player: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  matches?: LiveViewMatch[];
}

interface LiveViewData {
  id: string;
  name: string;
  status: string;
  poolStages?: LiveViewPoolStage[];
  brackets?: LiveViewBracket[];
}

function LiveTournament() {
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const tournamentId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('tournamentId');
  }, []);

  const [liveView, setLiveView] = useState<LiveViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const loadLiveView = async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchTournamentLiveView(tournamentId, token);
      setLiveView(data);
    } catch (err) {
      console.error('Error fetching live view:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live view');
    } finally {
      setLoading(false);
    }
  };

  const handleMatchStatusUpdate = async (matchId: string, status: string) => {
    if (!tournamentId) return;
    setUpdatingMatchId(matchId);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateMatchStatus(tournamentId, matchId, status, token);
      await loadLiveView();
    } catch (err) {
      console.error('Error updating match status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update match status');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleScoreChange = (matchId: string, playerId: string, value: string) => {
    setMatchScores((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || {}),
        [playerId]: value,
      },
    }));
  };

  const handleCompleteMatch = async (match: LiveViewMatch) => {
    if (!tournamentId) return;
    if (!match.playerMatches || match.playerMatches.length < 2) {
      setError('Match does not have enough players to complete.');
      return;
    }

    const scoresForMatch = matchScores[match.id] || {};
    const scores = match.playerMatches.map((pm) => ({
      playerId: pm.player?.id || '',
      scoreTotal: Number(scoresForMatch[pm.player?.id || ''] ?? ''),
    }));

    if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
      setError('Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(match.id);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await completeMatch(tournamentId, match.id, scores, token);
      await loadLiveView();
    } catch (err) {
      console.error('Error completing match:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete match');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleEditMatch = (match: LiveViewMatch) => {
    const initialScores: Record<string, string> = {};
    (match.playerMatches || []).forEach((pm) => {
      if (pm.player?.id) {
        initialScores[pm.player.id] = String(pm.scoreTotal ?? pm.legsWon ?? 0);
      }
    });
    setMatchScores((current) => ({
      ...current,
      [match.id]: initialScores,
    }));
    setEditingMatchId(match.id);
  };

  const handleUpdateCompletedMatch = async (match: LiveViewMatch) => {
    if (!tournamentId) return;
    if (!match.playerMatches || match.playerMatches.length < 2) {
      setError('Match does not have enough players to update.');
      return;
    }

    const scoresForMatch = matchScores[match.id] || {};
    const scores = match.playerMatches.map((pm) => ({
      playerId: pm.player?.id || '',
      scoreTotal: Number(scoresForMatch[pm.player?.id || ''] ?? ''),
    }));

    if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
      setError('Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(match.id);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateCompletedMatchScores(tournamentId, match.id, scores, token);
      await loadLiveView();
      setEditingMatchId(null);
    } catch (err) {
      console.error('Error updating match scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to update match scores');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const buildPoolLeaderboard = (pool: LiveViewPool): PoolLeaderboardRow[] => {
    const rows = new Map<string, PoolLeaderboardRow>();

    (pool.assignments || []).forEach((assignment) => {
      const player = assignment.player;
      rows.set(player.id, {
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        legsWon: 0,
        legsLost: 0,
      });
    });

    (pool.matches || []).forEach((match) => {
      if (match.status !== 'COMPLETED') return;
      const playerMatches = match.playerMatches || [];
      playerMatches.forEach((pm) => {
        const player = pm.player;
        if (!player) return;
        if (!rows.has(player.id)) {
          rows.set(player.id, {
            playerId: player.id,
            name: `${player.firstName} ${player.lastName}`,
            legsWon: 0,
            legsLost: 0,
          });
        }

        const row = rows.get(player.id);
        if (!row) return;
        row.legsWon += pm.legsWon ?? 0;

        const opponentLegs = playerMatches
          .filter((other) => other.player?.id && other.player.id !== player.id)
          .reduce((sum, other) => sum + (other.legsWon ?? 0), 0);
        row.legsLost += opponentLegs;
      });
    });

    return Array.from(rows.values()).sort((a, b) => {
      if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
      if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
      return a.name.localeCompare(b.name);
    });
  };

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      loadLiveView();
    }
  }, [authEnabled, isAuthenticated, tournamentId]);

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
        <h3 className="text-xl font-semibold text-white">Sign in to view live tournaments</h3>
        <p className="mt-2 text-sm text-slate-300">
          Live tournament details are protected. Please sign in to continue.
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

  if (!tournamentId) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">Select a live tournament to view its matches.</p>
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
        <span className="ml-3 text-slate-300">Loading live view...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={loadLiveView}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!liveView) {
    return null;
  }

  const hasLoserBracket =
    liveView.brackets?.some(
      (bracket) =>
        bracket.bracketType === 'DOUBLE_ELIMINATION' ||
        bracket.name.toLowerCase().includes('loser')
    ) || false;

  const poolStageCount = liveView.poolStages?.length || 0;
  const totalPools = liveView.poolStages?.reduce(
    (sum, stage) => sum + (stage.pools?.length || 0),
    0
  ) || 0;
  const poolsPerStage = liveView.poolStages?.map((stage) => stage.pools?.length || 0) || [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Live tournament</p>
          <h2 className="text-2xl font-semibold text-white mt-2">{liveView.name}</h2>
          <p className="mt-1 text-sm text-slate-400">Status: {liveView.status}</p>
        </div>
        <button
          onClick={loadLiveView}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Pool stages</p>
          <p className="mt-2 text-lg font-semibold text-white">{poolStageCount}</p>
          {poolsPerStage.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Pools per stage: {poolsPerStage.join(' · ')}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Total pools</p>
          <p className="mt-2 text-lg font-semibold text-white">{totalPools}</p>
          <p className="mt-1 text-xs text-slate-400">Players per pool shown in each stage</p>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Loser bracket</p>
          <p className="mt-2 text-lg font-semibold text-white">{hasLoserBracket ? 'Yes' : 'No'}</p>
          <p className="mt-1 text-xs text-slate-400">After pool stages</p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Pool stages</h3>
        {!liveView.poolStages || liveView.poolStages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No pool stages available yet.
          </div>
        ) : (
          <div className="space-y-6">
            {liveView.poolStages.map((stage) => (
              <div key={stage.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Stage {stage.stageNumber}: {stage.name}</h4>
                    <p className="text-sm text-slate-400">Status: {stage.status}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {stage.pools?.length || 0} pools · {stage.playersPerPool ?? 'n/a'} per pool
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {stage.pools?.length || 0} pools
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {stage.pools?.map((pool) => (
                    <div key={pool.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-base font-semibold text-slate-100">
                          Pool {pool.poolNumber} of {stage.pools?.length || 0}: {pool.name}
                        </h5>
                        <span className="text-xs text-slate-400">{pool.status}</span>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Participants</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pool.assignments && pool.assignments.length > 0 ? (
                            pool.assignments.map((assignment) => (
                              <span
                                key={assignment.id}
                                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                              >
                                {assignment.player.firstName} {assignment.player.lastName}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No assignments yet.</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Leaderboard</p>
                        {buildPoolLeaderboard(pool).length > 0 ? (
                          <div className="mt-2 overflow-hidden rounded-xl border border-slate-800/60">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-900/60 text-slate-400">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold">Player</th>
                                  <th className="px-3 py-2 text-right font-semibold">Legs won</th>
                                  <th className="px-3 py-2 text-right font-semibold">Legs lost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {buildPoolLeaderboard(pool).map((row) => (
                                  <tr key={row.playerId} className="text-slate-200">
                                    <td className="px-3 py-2">{row.name}</td>
                                    <td className="px-3 py-2 text-right">{row.legsWon}</td>
                                    <td className="px-3 py-2 text-right">{row.legsLost}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">No standings yet.</p>
                        )}
                      </div>

                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Matches</p>
                        {pool.matches && pool.matches.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {pool.matches.map((match) => (
                              <div key={match.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-slate-200">Match {match.matchNumber} · Round {match.roundNumber}</span>
                                  <span className="text-xs text-slate-400">{match.status}</span>
                                </div>
                                {match.status === 'SCHEDULED' && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleMatchStatusUpdate(match.id, 'IN_PROGRESS')}
                                      disabled={updatingMatchId === match.id}
                                      className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                                    >
                                      {updatingMatchId === match.id ? 'Starting...' : 'Start match'}
                                    </button>
                                  </div>
                                )}
                                {match.status === 'IN_PROGRESS' && (
                                  <div className="mt-3 space-y-2">
                                    <p className="text-xs uppercase tracking-widest text-slate-500">Final score</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {(match.playerMatches || []).map((pm) => (
                                        <label key={`${match.id}-${pm.playerPosition}-score`} className="text-xs text-slate-300">
                                          <span className="block text-slate-400">
                                            {pm.player?.firstName} {pm.player?.lastName}
                                          </span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={matchScores[match.id]?.[pm.player?.id || ''] || ''}
                                            onChange={(e) => handleScoreChange(match.id, pm.player?.id || '', e.target.value)}
                                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => handleCompleteMatch(match)}
                                        disabled={updatingMatchId === match.id}
                                        className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
                                      >
                                        {updatingMatchId === match.id ? 'Saving...' : 'Complete match'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {match.status === 'COMPLETED' && (
                                  <div className="mt-3 space-y-2">
                                    {editingMatchId === match.id ? (
                                      <>
                                        <p className="text-xs uppercase tracking-widest text-slate-500">Edit score</p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {(match.playerMatches || []).map((pm) => (
                                            <label key={`${match.id}-${pm.playerPosition}-edit`} className="text-xs text-slate-300">
                                              <span className="block text-slate-400">
                                                {pm.player?.firstName} {pm.player?.lastName}
                                              </span>
                                              <input
                                                type="number"
                                                min={0}
                                                value={matchScores[match.id]?.[pm.player?.id || ''] || ''}
                                                onChange={(e) => handleScoreChange(match.id, pm.player?.id || '', e.target.value)}
                                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                                              />
                                            </label>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            onClick={() => handleUpdateCompletedMatch(match)}
                                            disabled={updatingMatchId === match.id}
                                            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                                          >
                                            {updatingMatchId === match.id ? 'Saving...' : 'Save scores'}
                                          </button>
                                          <button
                                            onClick={() => setEditingMatchId(null)}
                                            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => handleEditMatch(match)}
                                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                                      >
                                        Edit score
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                                  {match.playerMatches && match.playerMatches.length > 0 ? (
                                    match.playerMatches.map((pm) => (
                                      <span key={`${match.id}-${pm.playerPosition}`}>
                                        {pm.player?.firstName} {pm.player?.lastName}
                                      </span>
                                    ))
                                  ) : (
                                    <span>No players assigned yet.</span>
                                  )}
                                </div>
                                {match.winner && (
                                  <p className="mt-2 text-xs text-emerald-300">
                                    Winner: {match.winner.firstName} {match.winner.lastName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">No matches scheduled yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Bracket stages</h3>
        <p className="text-xs text-slate-500">
          Loser bracket after pools: {hasLoserBracket ? 'Yes' : 'No'}
        </p>
        {!liveView.brackets || liveView.brackets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No brackets available yet.
          </div>
        ) : (
          <div className="space-y-6">
            {liveView.brackets.map((bracket) => (
              <div key={bracket.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{bracket.name}</h4>
                    <p className="text-sm text-slate-400">{bracket.bracketType} · {bracket.status}</p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {bracket.entries?.length || 0} entries
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Matches</p>
                  {bracket.matches && bracket.matches.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {bracket.matches.map((match) => (
                        <div key={match.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-200">Match {match.matchNumber} · Round {match.roundNumber}</span>
                            <span className="text-xs text-slate-400">{match.status}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                            {match.playerMatches && match.playerMatches.length > 0 ? (
                              match.playerMatches.map((pm) => (
                                <span key={`${match.id}-${pm.playerPosition}`}>
                                  {pm.player?.firstName} {pm.player?.lastName}
                                </span>
                              ))
                            ) : (
                              <span>No players assigned yet.</span>
                            )}
                          </div>
                          {match.winner && (
                            <p className="mt-2 text-xs text-emerald-300">
                              Winner: {match.winner.firstName} {match.winner.lastName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No matches scheduled yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveTournament;
