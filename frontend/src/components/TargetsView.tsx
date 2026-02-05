import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { useI18n } from '../i18n';
import { fetchTournamentLiveView, updateMatchStatus } from '../services/tournamentService';

interface LiveViewTarget {
  id: string;
  targetNumber: number;
  targetCode?: string;
  name?: string | null;
  status?: string;
  currentMatchId?: string | null;
}

interface LiveViewMatch {
  id: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  playerMatches?: Array<{
    player?: {
      id?: string;
      firstName: string;
      lastName: string;
      surname?: string | null;
      teamName?: string | null;
    };
  }>;
  targetId?: string | null;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string | null;
  } | null;
}

interface LiveViewPool {
  id: string;
  poolNumber: number;
  name: string;
  matches?: LiveViewMatch[];
}

interface LiveViewPoolStage {
  id: string;
  stageNumber: number;
  name: string;
  pools?: LiveViewPool[];
}

interface LiveViewBracket {
  id: string;
  name: string;
  matches?: LiveViewMatch[];
}

interface LiveViewData {
  id: string;
  name: string;
  status: string;
  targets?: LiveViewTarget[];
  poolStages?: LiveViewPoolStage[];
  brackets?: LiveViewBracket[];
}

type TargetMatchInfo = {
  matchId: string;
  status: string;
  label: string;
  players: string[];
};

const getTargetLabel = (target: LiveViewTarget) =>
  target.targetCode || target.name || `#${target.targetNumber}`;

const getPlayerLabel = (player?: { firstName: string; lastName: string; surname?: string | null; teamName?: string | null }) => {
  if (!player) return '';
  if (player.teamName) return player.teamName;
  if (player.surname) return player.surname;
  return `${player.firstName} ${player.lastName}`.trim();
};

type MatchQueueItem = {
  matchId: string;
  stageNumber: number;
  stageName: string;
  poolNumber: number;
  poolName: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
};

const buildMatchQueue = (view: LiveViewData): MatchQueueItem[] => {
  const items: MatchQueueItem[] = [];
  const activePlayerKeys = new Set<string>();

  const getPlayerIdentity = (player?: { id?: string; firstName: string; lastName: string; teamName?: string | null }) => {
    if (!player) return null;
    if (player.id) return `id:${player.id}`;
    if (player.teamName) return `team:${player.teamName}`;
    return `name:${player.firstName} ${player.lastName}`.trim();
  };

  const collectActivePlayers = (match: LiveViewMatch) => {
    for (const pm of match.playerMatches ?? []) {
      const key = getPlayerIdentity(pm.player);
      if (key) {
        activePlayerKeys.add(key);
      }
    }
  };

  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match.status === 'IN_PROGRESS') {
          collectActivePlayers(match);
        }
      }
    }
  }

  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match.status === 'IN_PROGRESS') {
        collectActivePlayers(match);
      }
    }
  }

  const isMatchBlocked = (match: LiveViewMatch) => {
    for (const pm of match.playerMatches ?? []) {
      const key = getPlayerIdentity(pm.player);
      if (key && activePlayerKeys.has(key)) {
        return true;
      }
    }
    return false;
  };
  for (const stage of view.poolStages ?? []) {
    if (stage.pools == null) continue;
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match.status === 'COMPLETED' || match.status === 'CANCELLED' || match.status === 'IN_PROGRESS') {
          continue;
        }
        if (isMatchBlocked(match)) {
          continue;
        }
        const players = (match.playerMatches ?? [])
          .map((pm) => getPlayerLabel(pm.player))
          .filter(Boolean);

        items.push({
          matchId: match.id,
          stageNumber: stage.stageNumber,
          stageName: stage.name,
          poolNumber: pool.poolNumber,
          poolName: pool.name,
          matchNumber: match.matchNumber,
          roundNumber: match.roundNumber,
          status: match.status,
          targetCode: match.target?.targetCode,
          targetNumber: match.target?.targetNumber,
          players,
        });
      }
    }
  }

  const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);

  return items.sort((a, b) => {
    if (a.stageNumber !== b.stageNumber) return a.stageNumber - b.stageNumber;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (statusWeight(a.status) !== statusWeight(b.status)) {
      return statusWeight(a.status) - statusWeight(b.status);
    }
    if (a.poolNumber !== b.poolNumber) return a.poolNumber - b.poolNumber;
    return a.matchNumber - b.matchNumber;
  });
};

const getSurnameList = (players: string[]) =>
  players
    .map((name) => {
      const parts = name.trim().split(/\s+/);
      return parts.at(-1) ?? name;
    })
    .filter(Boolean)
    .join(' · ');

const addMatchInfo = (
  byTargetId: Map<string, TargetMatchInfo>,
  byId: Map<string, TargetMatchInfo>,
  match: LiveViewMatch,
  label: string
) => {
  const players = (match.playerMatches ?? [])
    .map((pm) => getPlayerLabel(pm.player))
    .filter(Boolean);
  const info = {
    matchId: match.id,
    status: match.status,
    label,
    players,
  };
  const targetId = match.target?.id ?? match.targetId ?? undefined;
  if (targetId) {
    const existingStatus = byTargetId.get(targetId)?.status;
    if (!existingStatus || existingStatus !== 'IN_PROGRESS' || match.status === 'IN_PROGRESS') {
      byTargetId.set(targetId, info);
    }
  }
  byId.set(match.id, info);
};

const buildMatchMaps = (liveView: LiveViewData | null, t: ReturnType<typeof useI18n>['t']) => {
  const byTargetId = new Map<string, TargetMatchInfo>();
  const byId = new Map<string, TargetMatchInfo>();
  const stageLabel = t('targets.stageLabel');
  const poolLabel = t('targets.poolLabel');
  const matchLabel = t('targets.matchLabel');
  const bracketLabel = t('targets.bracketLabel');

  for (const stage of liveView?.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        addMatchInfo(
          byTargetId,
          byId,
          match,
          `${stageLabel} ${stage.stageNumber} · ${poolLabel} ${pool.poolNumber} · ${matchLabel} ${match.matchNumber}`
        );
      }
    }
  }

  for (const bracket of liveView?.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      addMatchInfo(
        byTargetId,
        byId,
        match,
        `${bracketLabel} ${bracket.name} · ${matchLabel} ${match.matchNumber}`
      );
    }
  }

  return { matchByTargetId: byTargetId, matchById: byId };
};

function TargetsView() {
  const { t } = useI18n();
  const { enabled: authEnabled, getAccessTokenSilently } = useOptionalAuth();

  const tournamentId = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('tournamentId');
  }, []);

  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchSelectionByTarget, setMatchSelectionByTarget] = useState<Record<string, string>>({});
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);

  const fetchLiveViews = useCallback(async (token?: string): Promise<LiveViewData[]> => {
    if (tournamentId) {
      const data = (await fetchTournamentLiveView(tournamentId, token)) as LiveViewData;
      return [data];
    }

    const response = await fetch('/api/tournaments?status=LIVE', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error('Failed to fetch live tournaments');
    }
    const data = await response.json();
    const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
    const liveTournaments = tournaments.filter((item: { status?: string }) =>
      (item.status ?? '').toUpperCase() === 'LIVE'
    );
    const views = await Promise.all(
      liveTournaments.map((item: { id: string }) => fetchTournamentLiveView(item.id, token))
    );
    return views as LiveViewData[];
  }, [tournamentId]);

  const loadTargets = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent ?? false;
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const views = await fetchLiveViews(token);
      setLiveViews(views);
    } catch (err) {
      console.error('Error fetching targets view:', err);
      if (!isSilent) {
        setError(err instanceof Error ? err.message : t('targets.error'));
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [authEnabled, fetchLiveViews, getAccessTokenSilently, t]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void loadTargets({ silent: true });
    }, 10000);
    return () => globalThis.clearInterval(intervalId);
  }, [loadTargets]);

  useEffect(() => {
    if (tournamentId) {
      setSelectedTournamentId(tournamentId);
      return;
    }
    if (!selectedTournamentId && liveViews.length > 0) {
      setSelectedTournamentId(liveViews[0].id);
    }
  }, [liveViews, selectedTournamentId, tournamentId]);

  const activeViews = liveViews.filter((view) => (view.status ?? '').toUpperCase() === 'LIVE');
  const selectedView = activeViews.find((view) => view.id === selectedTournamentId) ?? null;

  const handleQueueSelectionChange = (targetId: string, matchId: string) => {
    setMatchSelectionByTarget((current) => ({
      ...current,
      [targetId]: matchId,
    }));
  };

  const handleStartMatch = async (matchId: string, targetId: string) => {
    if (!selectedView) return;
    setStartingMatchId(matchId);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const freshView = (await fetchTournamentLiveView(selectedView.id, token)) as LiveViewData;
      setLiveViews([freshView]);
      const freshTarget = freshView.targets?.find((target) => target.id === targetId);
      const normalizedStatus = (freshTarget?.status ?? '').toUpperCase();
      if (normalizedStatus === 'IN_USE' && freshTarget?.currentMatchId) {
        throw new Error('Target is not available');
      }

      await updateMatchStatus(selectedView.id, matchId, 'IN_PROGRESS', targetId, token);
      await loadTargets();
      setMatchSelectionByTarget((current) => {
        const next = { ...current };
        delete next[targetId];
        return next;
      });
    } catch (err) {
      console.error('Error starting match from queue:', err);
      setError(err instanceof Error ? err.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setStartingMatchId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('targets.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={loadTargets}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (activeViews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        {t('targets.none')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('targets.title')}</p>
        {selectedView && (
          <>
            <h2 className="text-2xl font-semibold text-white mt-2">{selectedView.name}</h2>
            <p className="mt-1 text-xs text-slate-500">ID: {selectedView.id}</p>
          </>
        )}
      </div>
      {!tournamentId && (
        <div className="max-w-xs">
          <label className="text-xs uppercase tracking-widest text-slate-500" htmlFor="targets-tournament">
            {t('targets.selectTournament')}
          </label>
          <select
            id="targets-tournament"
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="mt-2 w-full rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          >
            {activeViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedView && (() => {
        const queue = buildMatchQueue(selectedView).slice(0, 5);
        const targets = (selectedView.targets ?? []).slice().sort((a, b) => a.targetNumber - b.targetNumber);
        const { matchByTargetId, matchById } = buildMatchMaps(selectedView, t);
        if (targets.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              {t('targets.none')}
            </div>
          );
        }
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {targets.map((target) => {
                const matchInfo = matchByTargetId.get(target.id)
                  ?? (target.currentMatchId ? matchById.get(target.currentMatchId) : undefined);
                const matchStatus = matchInfo?.status;
                const isCompletedOrCancelled = matchStatus === 'COMPLETED' || matchStatus === 'CANCELLED';
                const activeMatchInfo = matchStatus === 'IN_PROGRESS' ? matchInfo : undefined;
                const isTargetMarkedInUse = (target.status ?? '').toUpperCase() === 'IN_USE';
                const hasCurrentMatch = Boolean(target.currentMatchId);
                const isInUse = Boolean(activeMatchInfo)
                  || (hasCurrentMatch && !isCompletedOrCancelled)
                  || (isTargetMarkedInUse && !isCompletedOrCancelled);
                const selectedMatchId = matchSelectionByTarget[target.id] || '';
                const canStart = !isInUse && selectedMatchId.length > 0 && startingMatchId !== selectedMatchId;
                return (
                  <div key={target.id} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">{getTargetLabel(target)}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        isInUse ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
                      }`}>
                        {isInUse ? t('targets.inUse') : t('targets.free')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t('targets.number')}: {target.targetNumber}</p>
                    {isInUse ? (
                      <div className="mt-3 text-sm text-slate-200">
                        <p className="text-xs uppercase tracking-widest text-slate-500">{t('targets.matchRunning')}</p>
                        {activeMatchInfo ? (
                          <>
                            <p className="mt-1">{activeMatchInfo.label}</p>
                            {activeMatchInfo.players.length > 0 && (
                              <div className="mt-1 text-sm font-semibold text-blue-200 space-y-1">
                                {activeMatchInfo.players.map((player) => (
                                  <p key={player}>{player}</p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">
                            {target.currentMatchId ?? t('targets.unknownPlayers')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-slate-400">{t('targets.noMatch')}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={selectedMatchId}
                            onChange={(e) => handleQueueSelectionChange(target.id, e.target.value)}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                          >
                            <option value="">{t('targets.selectMatch')}</option>
                            {queue.map((item) => (
                              <option key={item.matchId} value={item.matchId}>
                                {t('live.queue.stageLabel')} {item.stageNumber} · {getSurnameList(item.players) || t('targets.unknownPlayers')}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleStartMatch(selectedMatchId, target.id)}
                            disabled={!canStart}
                            className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                          >
                            {startingMatchId === selectedMatchId ? t('live.startingMatch') : t('live.startMatch')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{t('live.queue.title')}</h3>
                <span className="text-xs text-slate-400">{queue.length}</span>
              </div>
              {queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  {t('live.queue.empty')}
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item) => (
                    <div key={`${item.stageNumber}-${item.poolNumber}-${item.matchNumber}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                        <span>
                          {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                        </span>
                        <span className="text-xs text-slate-400">{item.status}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{t('live.queue.matchLabel')} {item.matchNumber}</span>
                        <span>·</span>
                        <span>{t('live.queue.roundLabel')} {item.roundNumber}</span>
                        {(item.targetCode || item.targetNumber) && (
                          <>
                            <span>·</span>
                            <span>{t('live.queue.targetLabel')} {item.targetCode ?? `#${item.targetNumber}`}</span>
                          </>
                        )}
                      </div>
                      {item.players.length > 0 && (
                        <div className="mt-2 text-xs text-slate-300">{item.players.join(' · ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default TargetsView;
