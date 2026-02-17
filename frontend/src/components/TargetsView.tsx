import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { useAdminStatus } from '../auth/useAdminStatus';
import { useI18n } from '../i18n';
import { completeMatch, fetchTournamentLiveView, updateMatchStatus } from '../services/tournamentService';

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
    playerPosition?: number;
    scoreTotal?: number;
    legsWon?: number;
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
  tournamentId: string;
  tournamentName: string;
};

const formatTargetLabel = (value: string, t: ReturnType<typeof useI18n>['t']) => {
  const match = /^target\s*(\d+)$/i.exec(value.trim());
  if (match) {
    return `${t('targets.target')} ${match[1]}`;
  }
  return value;
};

const getTargetLabel = (target: LiveViewTarget, t: ReturnType<typeof useI18n>['t']) => {
  const base = target.targetCode || target.name || `#${target.targetNumber}`;
  return formatTargetLabel(base, t);
};

const getPlayerLabel = (player?: { firstName: string; lastName: string; surname?: string | null; teamName?: string | null }) => {
  if (!player) return '';
  if (player.teamName) return player.teamName;
  if (player.surname) return player.surname;
  return `${player.firstName} ${player.lastName}`.trim();
};

type MatchQueueItem = {
  tournamentId: string;
  tournamentName: string;
  source: 'pool' | 'bracket';
  matchId: string;
  poolId: string;
  stageNumber: number;
  stageName: string;
  poolNumber: number;
  poolName: string;
  bracketName?: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
  blocked: boolean;
};

type PoolQueue = {
  poolId: string;
  stageNumber: number;
  poolNumber: number;
  progress: number;
  matches: MatchQueueItem[];
};

type ActiveMatchScorePanelProps = {
  match: LiveViewMatch;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | null;
  t: ReturnType<typeof useI18n>['t'];
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
};

const ActiveMatchScorePanel = ({
  match,
  matchScores,
  updatingMatchId,
  t,
  onScoreChange,
  onCompleteMatch,
}: ActiveMatchScorePanelProps) => (
  <div className="mt-3 space-y-2">
    <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.finalScore')}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {(match.playerMatches ?? []).map((pm) => (
        <label key={`${match.id}-${pm.playerPosition ?? pm.player?.id}`} className="text-xs text-slate-300">
          <span className="block text-slate-400">
            {pm.player?.firstName} {pm.player?.lastName}
          </span>
          <input
            type="number"
            min={0}
            value={matchScores[match.id]?.[pm.player?.id || ''] || ''}
            onChange={(e) => onScoreChange(match.id, pm.player?.id || '', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
      ))}
    </div>
    <button
      onClick={() => onCompleteMatch(match)}
      disabled={updatingMatchId === match.id}
      className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
    >
      {updatingMatchId === match.id ? t('live.savingMatch') : t('live.completeMatch')}
    </button>
  </div>
);

const sortPoolMatches = (queue: PoolQueue) => {
  const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);
  queue.matches.sort((a, b) => {
    if (a.blocked !== b.blocked) {
      return a.blocked ? 1 : -1;
    }
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (statusWeight(a.status) !== statusWeight(b.status)) {
      return statusWeight(a.status) - statusWeight(b.status);
    }
    return a.matchNumber - b.matchNumber;
  });
};

const interleavePools = (queues: PoolQueue[]) => {
  const ordered: MatchQueueItem[] = [];
  const comparePools = (a: PoolQueue, b: PoolQueue) => {
    if (a.progress !== b.progress) return a.progress - b.progress;
    if (a.stageNumber !== b.stageNumber) return a.stageNumber - b.stageNumber;
    return a.poolNumber - b.poolNumber;
  };

  while (queues.some((queue) => queue.matches.length > 0)) {
    const nextPool = [...queues]
      .filter((queue) => queue.matches.length > 0)
      .sort(comparePools)[0];
    if (!nextPool) break;
    const nextMatch = nextPool.matches.shift();
    if (!nextMatch) break;
    ordered.push(nextMatch);
    nextPool.progress += 1;
  }

  return ordered;
};

const buildPoolQueues = (
  poolStages: LiveViewPoolStage[],
  collectActivePlayers: (match: LiveViewMatch) => void
): PoolQueue[] => {
  const poolQueues: PoolQueue[] = [];
  for (const stage of poolStages) {
    for (const pool of stage.pools ?? []) {
      const completedOrInProgress = (pool.matches ?? []).filter(
        (match) => match.status === 'COMPLETED' || match.status === 'IN_PROGRESS'
      ).length;
      poolQueues.push({
        poolId: pool.id,
        stageNumber: stage.stageNumber,
        poolNumber: pool.poolNumber,
        progress: completedOrInProgress,
        matches: [],
      });
      for (const match of pool.matches ?? []) {
        if (match.status === 'IN_PROGRESS') {
          collectActivePlayers(match);
        }
      }
    }
  }
  return poolQueues;
};

const buildQueueItems = (
  view: LiveViewData,
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean,
  getPlayerLabelFn: (player?: { firstName: string; lastName: string; surname?: string | null; teamName?: string | null }) => string,
  options?: { ignoreBlocking?: boolean }
) => {
  const shouldQueueMatch = (match: LiveViewMatch) => {
    if (match.status === 'COMPLETED' || match.status === 'CANCELLED' || match.status === 'IN_PROGRESS') {
      return false;
    }
    if (options?.ignoreBlocking) {
      return true;
    }
    return !isMatchBlocked(match);
  };

  const createQueueItem = (stage: LiveViewPoolStage, pool: LiveViewPool, match: LiveViewMatch) => {
    const blocked = isMatchBlocked(match);
    const players = (match.playerMatches ?? [])
      .map((pm) => getPlayerLabelFn(pm.player))
      .filter(Boolean);

    return {
      tournamentId: view.id,
      tournamentName: view.name,
      source: 'pool',
      matchId: match.id,
      poolId: pool.id,
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
      blocked,
    };
  };

  const buildPoolItems = (stage: LiveViewPoolStage, pool: LiveViewPool, poolQueue?: PoolQueue) => {
    const poolItems: MatchQueueItem[] = [];
    for (const match of pool.matches ?? []) {
      if (!shouldQueueMatch(match)) {
        continue;
      }
      const nextItem = createQueueItem(stage, pool, match);
      poolItems.push(nextItem);
      if (poolQueue) {
        poolQueue.matches.push(nextItem);
      }
    }
    return poolItems;
  };

  const items: MatchQueueItem[] = [];
  for (const stage of view.poolStages ?? []) {
    if (stage.pools == null) continue;
    for (const pool of stage.pools ?? []) {
      const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
      items.push(...buildPoolItems(stage, pool, poolQueue));
    }
  }
  return items;
};

const buildMatchQueue = (view: LiveViewData): MatchQueueItem[] => {
  const getPlayerIdentity = (player?: { id?: string; firstName: string; lastName: string; teamName?: string | null }) => {
    if (!player) return null;
    if (player.id) return `id:${player.id}`;
    if (player.teamName) return `team:${player.teamName}`;
    return `name:${player.firstName} ${player.lastName}`.trim();
  };

  const buildQueue = (options?: { ignoreBlocking?: boolean }) => {
    const items: MatchQueueItem[] = [];
    const activePlayerKeys = new Set<string>();
    const poolQueues: PoolQueue[] = [];

    const collectActivePlayers = (match: LiveViewMatch) => {
      for (const pm of match.playerMatches ?? []) {
        const key = getPlayerIdentity(pm.player);
        if (key) {
          activePlayerKeys.add(key);
        }
      }
    };

    poolQueues.push(...buildPoolQueues(view.poolStages ?? [], collectActivePlayers));

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

    items.push(...buildQueueItems(view, poolQueues, isMatchBlocked, getPlayerLabel, options));
    for (const queue of poolQueues) {
      sortPoolMatches(queue);
    }
    const ordered = interleavePools(poolQueues);
    const poolItems = ordered.length > 0 ? ordered : items;

    const bracketItems: MatchQueueItem[] = [];
    for (const bracket of view.brackets ?? []) {
      for (const match of bracket.matches ?? []) {
        if (match.status === 'COMPLETED' || match.status === 'CANCELLED' || match.status === 'IN_PROGRESS') {
          continue;
        }
        const players = (match.playerMatches ?? [])
          .map((pm) => getPlayerLabel(pm.player))
          .filter(Boolean);
        bracketItems.push({
          tournamentId: view.id,
          tournamentName: view.name,
          source: 'bracket',
          matchId: match.id,
          poolId: '',
          stageNumber: 0,
          stageName: '',
          poolNumber: 0,
          poolName: '',
          bracketName: bracket.name,
          matchNumber: match.matchNumber,
          roundNumber: match.roundNumber,
          status: match.status,
          targetCode: match.target?.targetCode,
          targetNumber: match.target?.targetNumber,
          players,
          blocked: false,
        });
      }
    }

    return [...poolItems, ...bracketItems];
  };

  return buildQueue({ ignoreBlocking: true });
};

const buildGlobalMatchQueue = (views: LiveViewData[]) => {
  const perTournament = views.map((view) => buildMatchQueue(view));
  const ordered: MatchQueueItem[] = [];
  const maxLength = Math.max(0, ...perTournament.map((items) => items.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const items of perTournament) {
      const item = items[index];
      if (item) {
        ordered.push(item);
      }
    }
  }

  return ordered;
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
  label: string,
  tournamentId: string,
  tournamentName: string
) => {
  const players = (match.playerMatches ?? [])
    .map((pm) => getPlayerLabel(pm.player))
    .filter(Boolean);
  const info = {
    matchId: match.id,
    status: match.status,
    label,
    players,
    tournamentId,
    tournamentName,
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

const buildMatchMaps = (views: LiveViewData[], t: ReturnType<typeof useI18n>['t']) => {
  const byTargetId = new Map<string, TargetMatchInfo>();
  const byId = new Map<string, TargetMatchInfo>();
  const matchDetailsById = new Map<string, LiveViewMatch>();
  const matchTournamentById = new Map<string, { tournamentId: string; tournamentName: string }>();
  const stageLabel = t('targets.stageLabel');
  const poolLabel = t('targets.poolLabel');
  const matchLabel = t('targets.matchLabel');
  const bracketLabel = t('targets.bracketLabel');

  for (const view of views) {
    for (const stage of view.poolStages ?? []) {
      for (const pool of stage.pools ?? []) {
        for (const match of pool.matches ?? []) {
          matchDetailsById.set(match.id, match);
          matchTournamentById.set(match.id, { tournamentId: view.id, tournamentName: view.name });
          addMatchInfo(
            byTargetId,
            byId,
            match,
            `${stageLabel} ${stage.stageNumber} · ${poolLabel} ${pool.poolNumber} · ${matchLabel} ${match.matchNumber}`,
            view.id,
            view.name
          );
        }
      }
    }

    for (const bracket of view.brackets ?? []) {
      for (const match of bracket.matches ?? []) {
        matchDetailsById.set(match.id, match);
        matchTournamentById.set(match.id, { tournamentId: view.id, tournamentName: view.name });
        addMatchInfo(
          byTargetId,
          byId,
          match,
          `${bracketLabel} ${bracket.name} · ${matchLabel} ${match.matchNumber}`,
          view.id,
          view.name
        );
      }
    }
  }

  return { matchByTargetId: byTargetId, matchById: byId, matchDetailsById, matchTournamentById };
};

const addMatchStatusesFromPools = (view: LiveViewData, statusById: Map<string, string>) => {
  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match?.id) {
          statusById.set(match.id, match.status);
        }
      }
    }
  }
};

const addMatchStatusesFromBrackets = (view: LiveViewData, statusById: Map<string, string>) => {
  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match?.id) {
        statusById.set(match.id, match.status);
      }
    }
  }
};

const buildMatchStatusMap = (view: LiveViewData) => {
  const statusById = new Map<string, string>();
  addMatchStatusesFromPools(view, statusById);
  addMatchStatusesFromBrackets(view, statusById);
  return statusById;
};

const isTargetInUse = (target: LiveViewTarget, matchStatusById: Map<string, string>) => {
  const normalizedStatus = (target.status ?? '').toUpperCase();
  if (normalizedStatus !== 'IN_USE') {
    return false;
  }
  if (!target.currentMatchId) {
    return true;
  }
  const matchStatus = matchStatusById.get(target.currentMatchId);
  return matchStatus !== 'COMPLETED' && matchStatus !== 'CANCELLED';
};

type SharedTarget = {
  targetNumber: number;
  label: string;
  isInUse: boolean;
  activeMatchInfo?: TargetMatchInfo;
  targetIdsByTournament: Map<string, string>;
};

const getOrCreateSharedTarget = (
  sharedByNumber: Map<number, SharedTarget>,
  target: LiveViewTarget,
  t: ReturnType<typeof useI18n>['t']
) => {
  const targetNumber = target.targetNumber;
  const existing = sharedByNumber.get(targetNumber);
  if (existing) {
    return existing;
  }
  const entry: SharedTarget = {
    targetNumber,
    label: getTargetLabel(target, t),
    isInUse: false,
    targetIdsByTournament: new Map<string, string>(),
  };
  sharedByNumber.set(targetNumber, entry);
  return entry;
};

const updateSharedTargetUsage = (
  entry: SharedTarget,
  target: LiveViewTarget,
  matchStatusById: Map<string, string>,
  matchInfo?: TargetMatchInfo
) => {
  if (!entry.isInUse && isTargetInUse(target, matchStatusById)) {
    entry.isInUse = true;
  }
  if (matchInfo && (!entry.activeMatchInfo || matchInfo.status === 'IN_PROGRESS')) {
    entry.activeMatchInfo = matchInfo;
  }
};

const buildSharedTargets = (
  views: LiveViewData[],
  matchByTargetId: Map<string, TargetMatchInfo>,
  matchById: Map<string, TargetMatchInfo>,
  t: ReturnType<typeof useI18n>['t']
) => {
  const sharedByNumber = new Map<number, SharedTarget>();

  for (const view of views) {
    const matchStatusById = buildMatchStatusMap(view);
    for (const target of view.targets ?? []) {
      const entry = getOrCreateSharedTarget(sharedByNumber, target, t);
      entry.targetIdsByTournament.set(view.id, target.id);
      const matchInfo = matchByTargetId.get(target.id)
        ?? (target.currentMatchId ? matchById.get(target.currentMatchId) : undefined);
      updateSharedTargetUsage(entry, target, matchStatusById, matchInfo);
    }
  }

  return Array.from(sharedByNumber.values()).sort((a, b) => a.targetNumber - b.targetNumber);
};

function TargetsView() {
  const { t } = useI18n();
  const { enabled: authEnabled, getAccessTokenSilently } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const tournamentId = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('tournamentId');
  }, []);

  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchSelectionByTarget, setMatchSelectionByTarget] = useState<Record<string, string>>({});
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});

  // Helper to safely get access token, falling back to undefined if it fails
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (err) {
      console.warn('Failed to get access token, proceeding without auth:', err);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

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
      const token = await getSafeAccessToken();
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
  }, [fetchLiveViews, getSafeAccessToken, t]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void loadTargets({ silent: true });
    }, 10000);
    return () => globalThis.clearInterval(intervalId);
  }, [loadTargets]);

  const activeViews = liveViews.filter((view) => (view.status ?? '').toUpperCase() === 'LIVE');
  const scopedViews = tournamentId
    ? activeViews.filter((view) => view.id === tournamentId)
    : activeViews;

  const { matchByTargetId, matchById, matchDetailsById, matchTournamentById } = useMemo(
    () => buildMatchMaps(scopedViews, t),
    [scopedViews, t]
  );

  const sharedTargets = useMemo(
    () => buildSharedTargets(scopedViews, matchByTargetId, matchById, t),
    [scopedViews, matchByTargetId, matchById, t]
  );

  const queueItems = useMemo(
    () => buildGlobalMatchQueue(scopedViews),
    [scopedViews]
  );
  const queuePreview = queueItems.slice(0, 5);

  const handleQueueSelectionChange = (targetKey: string, matchId: string) => {
    setMatchSelectionByTarget((current) => ({
      ...current,
      [targetKey]: matchId,
    }));
  };

  const handleStartMatch = async (matchId: string, targetNumber: number) => {
    setStartingMatchId(matchId);
    setError(null);
    try {
      const token = await getSafeAccessToken();
      const freshViews = await fetchLiveViews(token);
      setLiveViews(freshViews);

      const matchTournament = matchTournamentById.get(matchId);
      if (!matchTournament) {
        throw new Error('Match tournament not found');
      }

      const freshMatchMaps = buildMatchMaps(freshViews, t);
      const freshSharedTargets = buildSharedTargets(freshViews, freshMatchMaps.matchByTargetId, freshMatchMaps.matchById, t);
      const freshTarget = freshSharedTargets.find((item) => item.targetNumber === targetNumber);
      const targetId = freshTarget?.targetIdsByTournament.get(matchTournament.tournamentId);
      if (!targetId) {
        throw new Error('Target is not available');
      }
      if (freshTarget?.isInUse) {
        throw new Error('Target is not available');
      }

      await updateMatchStatus(matchTournament.tournamentId, matchId, 'IN_PROGRESS', targetId, token);
      await loadTargets();
      setMatchSelectionByTarget((current) => {
        const next = { ...current };
        delete next[String(targetNumber)];
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

  const handleScoreChange = (matchId: string, playerId: string, value: string) => {
    setMatchScores((current) => ({
      ...current,
      [matchId]: current[matchId]
        ? { ...current[matchId], [playerId]: value }
        : { [playerId]: value },
    }));
  };

  const handleCompleteMatch = async (match: LiveViewMatch) => {
    const matchTournament = matchTournamentById.get(match.id);
    if (!matchTournament) {
      setError('Match tournament not found.');
      return;
    }
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
      const token = await getSafeAccessToken();
      await completeMatch(matchTournament.tournamentId, match.id, scores, token);
      await loadTargets();
    } catch (err) {
      console.error('Error completing match:', err);
      setError(err instanceof Error ? err.message : t('targets.error'));
      await loadTargets({ silent: true });
    } finally {
      setUpdatingMatchId(null);
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

  if (scopedViews.length === 0) {
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
        {tournamentId && scopedViews[0] && (
          <>
            <h2 className="text-2xl font-semibold text-white mt-2">{scopedViews[0].name}</h2>
            <p className="mt-1 text-xs text-slate-500">ID: {scopedViews[0].id}</p>
          </>
        )}
      </div>
      {(() => {
        const targets = sharedTargets;
        const queue = queuePreview;
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
                const targetKey = String(target.targetNumber);
                const matchInfo = target.activeMatchInfo;
                const isInUse = target.isInUse;
                const activeMatchId = matchInfo?.matchId;
                const activeMatch = activeMatchId ? matchDetailsById.get(activeMatchId) : undefined;
                const selectedMatchId = matchSelectionByTarget[targetKey] || '';
                const canStart =
                  !isInUse &&
                  selectedMatchId.length > 0 &&
                  startingMatchId !== selectedMatchId;
                return (
                  <div key={targetKey} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">{target.label}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        isInUse ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
                      }`}>
                        {isInUse ? t('targets.inUse') : t('targets.free')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t('targets.number')}: {target.targetNumber}</p>
                    {matchInfo?.tournamentName && (
                      <p className="mt-1 text-xs text-slate-500">{matchInfo.tournamentName}</p>
                    )}
                    {isInUse ? (
                      <div className="mt-3 text-sm text-slate-200">
                        <p className="text-xs uppercase tracking-widest text-slate-500">{t('targets.matchRunning')}</p>
                        {matchInfo ? (
                          <>
                            <p className="mt-1">{matchInfo.label}</p>
                            {matchInfo.players.length > 0 && (
                              <div className="mt-1 text-sm font-semibold text-blue-200 space-y-1">
                                {matchInfo.players.map((player) => (
                                  <p key={player}>{player}</p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">
                            {t('targets.unknownPlayers')}
                          </p>
                        )}
                        {activeMatch?.status === 'IN_PROGRESS' && isAdmin && (
                          <ActiveMatchScorePanel
                            match={activeMatch}
                            matchScores={matchScores}
                            updatingMatchId={updatingMatchId}
                            t={t}
                            onScoreChange={handleScoreChange}
                            onCompleteMatch={handleCompleteMatch}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-slate-400">{t('targets.noMatch')}</p>
                        {isAdmin && (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selectedMatchId}
                              onChange={(e) => handleQueueSelectionChange(targetKey, e.target.value)}
                              className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                            >
                              <option value="">{t('targets.selectMatch')}</option>
                              {queueItems.map((item) => (
                                <option key={item.matchId} value={item.matchId}>
                                  {item.tournamentName} · {item.source === 'pool'
                                    ? `${t('live.queue.stageLabel')} ${item.stageNumber} · ${t('live.queue.poolLabel')} ${item.poolNumber}`
                                    : `${t('targets.bracketLabel')} ${item.bracketName ?? ''}`}
                                  {` · ${getSurnameList(item.players) || t('targets.unknownPlayers')}`}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStartMatch(selectedMatchId, target.targetNumber)}
                              disabled={!canStart}
                              className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                            >
                              {startingMatchId === selectedMatchId ? t('live.startingMatch') : t('live.startMatch')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{t('live.queue.title')}</h3>
                <span className="text-xs text-slate-400">{queueItems.length}</span>
              </div>
              {queueItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  {t('live.queue.empty')}
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item) => (
                    <div key={`${item.source}-${item.tournamentId}-${item.matchId}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                        {item.source === 'pool' ? (
                          <span>
                            {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                          </span>
                        ) : (
                          <span>
                            {t('targets.bracketLabel')} {item.bracketName ?? ''}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{item.status}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{item.tournamentName}</div>
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
