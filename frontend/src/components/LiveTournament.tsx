import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { fetchTournamentLiveView, updateMatchStatus, completeMatch, updateCompletedMatchScores, updatePoolStage, deletePoolStage } from '../services/tournamentService';
import { useI18n } from '../i18n';
import {
  getVisibleLiveViews,
  resolveEmptyLiveCopy,
  isBracketsView,
  isPoolStagesView,
} from '../utils/liveViewHelpers';

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
    targetCode?: string;
    name?: string | null;
  } | null;
}

interface LiveViewTarget {
  id: string;
  targetNumber: number;
  targetCode?: string;
  name?: string | null;
  status?: string;
  currentMatchId?: string | null;
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
  targets?: LiveViewTarget[];
}

type MatchQueueItem = {
  tournamentId: string;
  tournamentName: string;
  stageId: string;
  stageName: string;
  stageNumber: number;
  poolId: string;
  poolName: string;
  poolNumber: number;
  matchId: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
};

type LiveViewMode = string | null;

const filterPoolStagesForView = (viewMode: LiveViewMode, poolStages?: LiveViewPoolStage[]) => {
  const stages = poolStages || [];
  if (!isPoolStagesView(viewMode)) {
    return stages;
  }
  return stages.filter((stage) => stage.status === 'IN_PROGRESS' && (stage.pools?.length || 0) > 0);
};

const filterBracketsForView = (viewMode: LiveViewMode, brackets?: LiveViewBracket[]) => {
  const bracketList = brackets || [];
  if (!isBracketsView(viewMode)) {
    return bracketList;
  }
  return bracketList.filter(
    (bracket) => bracket.status === 'IN_PROGRESS' && (bracket.matches?.length || 0) > 0
  );
};

const buildMatchQueue = (view: LiveViewData, poolStages: LiveViewPoolStage[]): MatchQueueItem[] => {
  const items: MatchQueueItem[] = [];
  for (const stage of poolStages) {
    if (stage.status !== 'IN_PROGRESS') {
      continue;
    }
    for (const pool of stage.pools ?? []) {
      const matches = pool.matches ?? [];
      for (const match of matches) {
        if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
          continue;
        }
        const players = (match.playerMatches ?? [])
          .map((pm) => (pm.player ? `${pm.player.firstName} ${pm.player.lastName}` : ''))
          .filter(Boolean);

        items.push({
          tournamentId: view.id,
          tournamentName: view.name,
          stageId: stage.id,
          stageName: stage.name,
          stageNumber: stage.stageNumber,
          poolId: pool.id,
          poolName: pool.name,
          poolNumber: pool.poolNumber,
          matchId: match.id,
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

const getHasLoserBracket = (brackets?: LiveViewBracket[]) =>
  (brackets || []).some(
    (bracket) =>
      bracket.bracketType === 'DOUBLE_ELIMINATION' ||
      bracket.name.toLowerCase().includes('loser')
  );

const getPoolStageStats = (stages: LiveViewPoolStage[]) => {
  const poolStageCount = stages.length;
  const totalPools = stages.reduce((sum, stage) => sum + (stage.pools?.length || 0), 0);
  const poolsPerStage = stages.map((stage) => stage.pools?.length || 0);
  return {
    poolStageCount,
    totalPools,
    poolsPerStage,
  };
};

const ensureLeaderboardRow = (
  rows: Map<string, PoolLeaderboardRow>,
  player: LiveViewMatchPlayer['player']
) => {
  if (!player) return undefined;
  if (!rows.has(player.id)) {
    rows.set(player.id, {
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      legsWon: 0,
      legsLost: 0,
    });
  }
  return rows.get(player.id);
};

const sumOpponentLegs = (playerMatches: LiveViewMatchPlayer[], playerId: string) => {
  let total = 0;
  for (const other of playerMatches) {
    if (other.player?.id && other.player.id !== playerId) {
      total += other.scoreTotal ?? other.legsWon ?? 0;
    }
  }
  return total;
};

const applyMatchResults = (
  rows: Map<string, PoolLeaderboardRow>,
  match: LiveViewMatch
) => {
  if (match.status !== 'COMPLETED') {
    return;
  }

  const playerMatches = match.playerMatches ?? [];
  for (const pm of playerMatches) {
    if (!pm.player || !rows.has(pm.player.id)) {
      continue;
    }
    const row = rows.get(pm.player.id);
    if (!row) continue;

    row.legsWon += pm.scoreTotal ?? pm.legsWon ?? 0;
    row.legsLost += sumOpponentLegs(playerMatches, row.playerId);
  }
};

const sortLeaderboardRows = (rows: Map<string, PoolLeaderboardRow>) =>
  Array.from(rows.values()).sort((a, b) => {
    if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
    if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
    return a.name.localeCompare(b.name);
  });

const getTargetLabel = (target: LiveViewTarget) =>
  target.targetCode || target.name || `#${target.targetNumber}`;

const addMatchStatusFromPools = (view: LiveViewData, matchStatusById: Map<string, string>) => {
  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match?.id) {
          matchStatusById.set(match.id, match.status);
        }
      }
    }
  }
};

const addMatchStatusFromBrackets = (view: LiveViewData, matchStatusById: Map<string, string>) => {
  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match?.id) {
        matchStatusById.set(match.id, match.status);
      }
    }
  }
};

const buildMatchStatusMap = (view: LiveViewData) => {
  const matchStatusById = new Map<string, string>();
  addMatchStatusFromPools(view, matchStatusById);
  addMatchStatusFromBrackets(view, matchStatusById);
  return matchStatusById;
};

const getAvailableTargets = (view: LiveViewData) => {
  const matchStatusById = buildMatchStatusMap(view);
  return (view.targets || []).filter((target) => {
    const normalizedStatus = (target.status ?? '').toUpperCase();
    if (normalizedStatus === 'MAINTENANCE') {
      return false;
    }
    if (normalizedStatus !== 'IN_USE') {
      return true;
    }
    if (!target.currentMatchId) {
      return true;
    }
    const matchStatus = matchStatusById.get(target.currentMatchId);
    return matchStatus === 'COMPLETED' || matchStatus === 'CANCELLED';
  });
};

const renderLiveTournamentGate = (params: {
  authLoading: boolean;
  authEnabled: boolean;
  isAuthenticated: boolean;
  tournamentId: string | null;
  requireTournamentId: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSignIn: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) => {
  const { authLoading, authEnabled, isAuthenticated, tournamentId, requireTournamentId, loading, error, onRetry, onSignIn, t } = params;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('auth.checkingSession')}</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <h3 className="text-xl font-semibold text-white">{t('auth.signInToViewLive')}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {t('auth.protectedContinue')}
        </p>
        <button
          onClick={onSignIn}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          {t('auth.signIn')}
        </button>
      </div>
    );
  }

  if (requireTournamentId && !tournamentId) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">{t('live.select')}</p>
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
        <span className="ml-3 text-slate-300">{t('live.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
};

function LiveTournament() {
  const { t } = useI18n();
  const statusLabels = useMemo(
    () => ({
      stage: {
        NOT_STARTED: t('status.stage.not_started'),
        EDITION: t('status.stage.edition'),
        IN_PROGRESS: t('status.stage.in_progress'),
        COMPLETED: t('status.stage.completed'),
      },
      pool: {
        NOT_STARTED: t('status.pool.not_started'),
        IN_PROGRESS: t('status.pool.in_progress'),
        COMPLETED: t('status.pool.completed'),
      },
      match: {
        SCHEDULED: t('status.match.scheduled'),
        IN_PROGRESS: t('status.match.in_progress'),
        COMPLETED: t('status.match.completed'),
        CANCELLED: t('status.match.cancelled'),
      },
      bracket: {
        NOT_STARTED: t('status.bracket.not_started'),
        IN_PROGRESS: t('status.bracket.in_progress'),
        COMPLETED: t('status.bracket.completed'),
      },
    }),
    [t]
  );

  const getStatusLabel = (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => {
    if (!status) return '';
    return statusLabels[scope]?.[status] ?? status;
  };
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const viewMode = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('view');
  }, []);

  const isAggregateView = viewMode === 'pool-stages' || viewMode === 'brackets';

  const tournamentId = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('tournamentId');
  }, []);

  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageStatusDrafts, setStageStatusDrafts] = useState<Record<string, string>>({});
  const [stagePoolCountDrafts, setStagePoolCountDrafts] = useState<Record<string, string>>({});
  const [stagePlayersPerPoolDrafts, setStagePlayersPerPoolDrafts] = useState<Record<string, string>>({});
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [matchTargetSelections, setMatchTargetSelections] = useState<Record<string, string>>({});

  const availableTargetsByTournament = useMemo(() => {
    const map = new Map<string, LiveViewTarget[]>();
    liveViews.forEach((view) => {
      map.set(view.id, getAvailableTargets(view));
    });
    return map;
  }, [liveViews]);

  const handleTargetSelectionChange = (matchKey: string, targetId: string) => {
    setMatchTargetSelections((current) => ({
      ...current,
      [matchKey]: targetId,
    }));
  };

  const loadSingleLiveView = useCallback(async (options?: { showLoader?: boolean }) => {
    if (!tournamentId) return;
    const showLoader = options?.showLoader ?? true;
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = (await fetchTournamentLiveView(tournamentId, token)) as LiveViewData;
      setLiveViews([data]);
    } catch (err) {
      console.error('Error fetching live view:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live view');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [authEnabled, getAccessTokenSilently, tournamentId]);

  const loadAggregateLiveViews = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments?status=LIVE', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch live tournaments');
      }
      const data = await response.json();
      const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
      const liveTournaments = tournaments.filter((t: { status?: string }) =>
        (t.status ?? '').toUpperCase() === 'LIVE'
      );
      const views = await Promise.all(
        liveTournaments.map((t: { id: string }) => fetchTournamentLiveView(t.id, token))
      );
      setLiveViews(views as LiveViewData[]);
    } catch (err) {
      console.error('Error fetching live view:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live view');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [authEnabled, getAccessTokenSilently]);

  const reloadLiveViews = useCallback((options?: { showLoader?: boolean }) => {
    if (isAggregateView) {
      return loadAggregateLiveViews(options);
    }
    return loadSingleLiveView(options);
  }, [isAggregateView, loadAggregateLiveViews, loadSingleLiveView]);

  const getMatchKey = (matchTournamentId: string, matchId: string) => `${matchTournamentId}:${matchId}`;

  const handleMatchStatusUpdate = async (
    matchTournamentId: string,
    matchId: string,
    status: string,
    targetId?: string
  ) => {
    const matchKey = getMatchKey(matchTournamentId, matchId);
    setUpdatingMatchId(matchKey);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateMatchStatus(matchTournamentId, matchId, status, targetId, token);
      await reloadLiveViews({ showLoader: false });
      if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELLED') {
        setMatchTargetSelections((current) => {
          if (!current[matchKey]) {
            return current;
          }
          const next = { ...current };
          delete next[matchKey];
          return next;
        });
      }
    } catch (err) {
      console.error('Error updating match status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update match status');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleScoreChange = (matchKey: string, playerId: string, value: string) => {
    setMatchScores((current) => ({
      ...current,
      [matchKey]: current[matchKey]
        ? { ...current[matchKey], [playerId]: value }
        : { [playerId]: value },
    }));
  };

  const handleCompleteMatch = async (matchTournamentId: string, match: LiveViewMatch) => {
    if (!match.playerMatches || match.playerMatches.length < 2) {
      setError('Match does not have enough players to complete.');
      return;
    }

    const matchKey = getMatchKey(matchTournamentId, match.id);
    const scoresForMatch = matchScores[matchKey] || {};
    const scores = match.playerMatches.map((pm) => ({
      playerId: pm.player?.id || '',
      scoreTotal: Number(scoresForMatch[pm.player?.id || ''] ?? ''),
    }));

    if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
      setError('Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(matchKey);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await completeMatch(matchTournamentId, match.id, scores, token);
      await reloadLiveViews({ showLoader: false });
    } catch (err) {
      console.error('Error completing match:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete match');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleEditMatch = (matchTournamentId: string, match: LiveViewMatch) => {
    const matchKey = getMatchKey(matchTournamentId, match.id);
    const initialScores: Record<string, string> = {};
    (match.playerMatches || []).forEach((pm) => {
      if (pm.player?.id) {
        initialScores[pm.player.id] = String(pm.scoreTotal ?? pm.legsWon ?? 0);
      }
    });
    setMatchScores((current) => ({
      ...current,
      [matchKey]: initialScores,
    }));
    setEditingMatchId(matchKey);
  };

  const handleUpdateCompletedMatch = async (matchTournamentId: string, match: LiveViewMatch) => {
    if (!match.playerMatches || match.playerMatches.length < 2) {
      setError('Match does not have enough players to update.');
      return;
    }

    const matchKey = getMatchKey(matchTournamentId, match.id);
    const scoresForMatch = matchScores[matchKey] || {};
    const scores = match.playerMatches.map((pm) => ({
      playerId: pm.player?.id || '',
      scoreTotal: Number(scoresForMatch[pm.player?.id || ''] ?? ''),
    }));

    if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
      setError('Please enter valid scores for all players.');
      return;
    }

    setUpdatingMatchId(matchKey);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateCompletedMatchScores(matchTournamentId, match.id, scores, token);
      await reloadLiveViews({ showLoader: false });
      setEditingMatchId(null);
    } catch (err) {
      console.error('Error updating match scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to update match scores');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleEditStage = (stage: LiveViewPoolStage) => {
    setEditingStageId(stage.id);
    setStageStatusDrafts((current) => ({
      ...current,
      [stage.id]: stage.status,
    }));
    setStagePoolCountDrafts((current) => ({
      ...current,
      [stage.id]: String(stage.pools?.length ?? ''),
    }));
    setStagePlayersPerPoolDrafts((current) => ({
      ...current,
      [stage.id]: stage.playersPerPool == null ? '' : String(stage.playersPerPool),
    }));
  };

  const handleStageStatusChange = (stageId: string, status: string) => {
    setStageStatusDrafts((current) => ({
      ...current,
      [stageId]: status,
    }));
  };

  const handleStagePoolCountChange = (stageId: string, value: string) => {
    setStagePoolCountDrafts((current) => ({
      ...current,
      [stageId]: value,
    }));
  };

  const handleStagePlayersPerPoolChange = (stageId: string, value: string) => {
    setStagePlayersPerPoolDrafts((current) => ({
      ...current,
      [stageId]: value,
    }));
  };

  const handleUpdateStage = async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    const nextStatus = stageStatusDrafts[stage.id] || stage.status;
    const nextPoolCountRaw = stagePoolCountDrafts[stage.id];
    const nextPlayersPerPoolRaw = stagePlayersPerPoolDrafts[stage.id];
    const nextPoolCount = Number(nextPoolCountRaw);
    const nextPlayersPerPool = Number(nextPlayersPerPoolRaw);
    setUpdatingStageId(stage.id);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updatePoolStage(
        stageTournamentId,
        stage.id,
        {
          status: nextStatus,
          ...(Number.isFinite(nextPoolCount) && nextPoolCount > 0
            ? { poolCount: nextPoolCount }
            : {}),
          ...(Number.isFinite(nextPlayersPerPool) && nextPlayersPerPool > 0
            ? { playersPerPool: nextPlayersPerPool }
            : {}),
        },
        token
      );
      await reloadLiveViews({ showLoader: false });
      setEditingStageId(null);
    } catch (err) {
      console.error('Error updating pool stage status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update pool stage');
    } finally {
      setUpdatingStageId(null);
    }
  };

  const handleDeleteStage = async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.deleteStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await deletePoolStage(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (err) {
      console.error('Error deleting pool stage:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete pool stage');
    } finally {
      setUpdatingStageId(null);
    }
  };

  const buildPoolLeaderboard = (pool: LiveViewPool): PoolLeaderboardRow[] => {
    const rows = new Map<string, PoolLeaderboardRow>();
    for (const assignment of pool.assignments ?? []) {
      ensureLeaderboardRow(rows, assignment.player);
    }

    for (const match of pool.matches ?? []) {
      if (match.status !== 'COMPLETED') {
        continue;
      }
      for (const pm of match.playerMatches ?? []) {
        ensureLeaderboardRow(rows, pm.player);
      }
    }

    for (const match of pool.matches ?? []) {
      applyMatchResults(rows, match);
    }

    return sortLeaderboardRows(rows);
  };

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      reloadLiveViews();
    }
  }, [authEnabled, isAuthenticated, reloadLiveViews]);

  const gateContent = renderLiveTournamentGate({
    authLoading,
    authEnabled,
    isAuthenticated,
    tournamentId,
    requireTournamentId: !isAggregateView,
    loading,
    error,
    onRetry: () => {
      void reloadLiveViews();
    },
    onSignIn: () => {
      void loginWithRedirect();
    },
    t,
  });

  if (gateContent) {
    return gateContent;
  }

  const visibleLiveViews = getVisibleLiveViews(viewMode, liveViews);

  if (visibleLiveViews.length === 0) {
    if (isAggregateView && !loading && !error) {
      const emptyCopy = resolveEmptyLiveCopy(viewMode, t);
      return (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-300">{emptyCopy}</p>
        </div>
      );
    }
    return null;
  }

  const renderStageControls = (stageTournamentId: string, stage: LiveViewPoolStage) => {
    const isEditing = editingStageId === stage.id;
    if (!isEditing) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleEditStage(stage)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('live.editStage')}
          </button>
          <button
            onClick={() => handleDeleteStage(stageTournamentId, stage)}
            disabled={updatingStageId === stage.id}
            className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
          >
            {t('common.delete')}
          </button>
        </div>
      );
    }

    return (
      <>
        <label className="text-xs text-slate-400">
          {t('live.poolCount')}
          <input
            type="number"
            min={1}
            value={stagePoolCountDrafts[stage.id] ?? ''}
            onChange={(e) => handleStagePoolCountChange(stage.id, e.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('live.playersPerPool')}
          <input
            type="number"
            min={1}
            value={stagePlayersPerPoolDrafts[stage.id] ?? ''}
            onChange={(e) => handleStagePlayersPerPoolChange(stage.id, e.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <select
          value={stageStatusDrafts[stage.id] || stage.status}
          onChange={(e) => handleStageStatusChange(stage.id, e.target.value)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
        >
          {['NOT_STARTED', 'EDITION', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
            <option key={status} value={status}>
              {getStatusLabel('stage', status)}
            </option>
          ))}
        </select>
        <button
          onClick={() => handleUpdateStage(stageTournamentId, stage)}
          disabled={updatingStageId === stage.id}
          className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
        >
          {updatingStageId === stage.id ? t('live.updatingStage') : t('live.updateStage')}
        </button>
        <button
          onClick={() => setEditingStageId(null)}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
      </>
    );
  };

  const renderPoolAssignments = (pool: LiveViewPool) => {
    if (pool.assignments && pool.assignments.length > 0) {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {pool.assignments.map((assignment) => (
            <span
              key={assignment.id}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
            >
              {assignment.player.firstName} {assignment.player.lastName}
            </span>
          ))}
        </div>
      );
    }

    return <span className="text-xs text-slate-400">{t('live.noAssignments')}</span>;
  };

  const renderPoolLeaderboard = (pool: LiveViewPool) => {
    const leaderboard = buildPoolLeaderboard(pool);
    if (leaderboard.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noStandings')}</p>;
    }

    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-800/60">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{t('common.player')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsWon')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsLost')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leaderboard.map((row) => (
              <tr key={row.playerId} className="text-slate-200">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-right">{row.legsWon}</td>
                <td className="px-3 py-2 text-right">{row.legsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMatchScoreInputs = (matchTournamentId: string, match: LiveViewMatch) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {(match.playerMatches || []).map((pm) => (
        <label key={`${match.id}-${pm.playerPosition}`} className="text-xs text-slate-300">
          <span className="block text-slate-400">
            {pm.player?.firstName} {pm.player?.lastName}
          </span>
          <input
            type="number"
            min={0}
            value={matchScores[getMatchKey(matchTournamentId, match.id)]?.[pm.player?.id || ''] || ''}
            onChange={(e) => handleScoreChange(getMatchKey(matchTournamentId, match.id), pm.player?.id || '', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
      ))}
    </div>
  );

  const renderMatchStatusSection = (matchTournamentId: string, match: LiveViewMatch) => {
    switch (match.status) {
      case 'SCHEDULED':
        return (() => {
          const matchKey = getMatchKey(matchTournamentId, match.id);
          const availableTargets = availableTargetsByTournament.get(matchTournamentId) || [];
          const selectedTargetId = matchTargetSelections[matchKey] || '';
          const canStart = selectedTargetId.length > 0 && updatingMatchId !== matchKey;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={selectedTargetId}
                onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
                className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
              >
                <option value="">{t('live.queue.targetLabel')}</option>
                {availableTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {getTargetLabel(target)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleMatchStatusUpdate(matchTournamentId, match.id, 'IN_PROGRESS', selectedTargetId)}
                disabled={!canStart}
                className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
              >
                {updatingMatchId === matchKey ? t('live.startingMatch') : t('live.startMatch')}
              </button>
            </div>
          );
        })();
      case 'IN_PROGRESS':
        return (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.finalScore')}</p>
            {renderMatchScoreInputs(matchTournamentId, match)}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCompleteMatch(matchTournamentId, match)}
                disabled={updatingMatchId === getMatchKey(matchTournamentId, match.id)}
                className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
              >
                {updatingMatchId === getMatchKey(matchTournamentId, match.id) ? t('live.savingMatch') : t('live.completeMatch')}
              </button>
            </div>
          </div>
        );
      case 'COMPLETED': {
        const matchKey = getMatchKey(matchTournamentId, match.id);
        const isEditing = editingMatchId === matchKey;
        if (!isEditing) {
          return (
            <button
              onClick={() => handleEditMatch(matchTournamentId, match)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              {t('live.editScore')}
            </button>
          );
        }

        return (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.editScore')}</p>
            {renderMatchScoreInputs(matchTournamentId, match)}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleUpdateCompletedMatch(matchTournamentId, match)}
                disabled={updatingMatchId === matchKey}
                className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
              >
                {updatingMatchId === matchKey ? t('live.savingMatch') : t('live.saveScores')}
              </button>
              <button
                onClick={() => setEditingMatchId(null)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderMatchPlayers = (match: LiveViewMatch) => {
    if (match.playerMatches && match.playerMatches.length > 0) {
      return match.playerMatches.map((pm) => (
        <span key={`${match.id}-${pm.playerPosition}`}>
          {pm.player?.firstName} {pm.player?.lastName}
        </span>
      ));
    }

    return <span>No players assigned yet.</span>;
  };

  const renderPoolMatches = (matchTournamentId: string, pool: LiveViewPool) => {
    if (!pool.matches || pool.matches.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }

    return (
      <div className="mt-2 space-y-2">
        {pool.matches.map((match) => (
          <div key={match.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-200">Match {match.matchNumber} · Round {match.roundNumber}</span>
              <span className="text-xs text-slate-400">{getStatusLabel('match', match.status)}</span>
            </div>
            {renderMatchStatusSection(matchTournamentId, match)}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {renderMatchPlayers(match)}
            </div>
            {match.winner && (
              <p className="mt-2 text-xs text-emerald-300">
                {t('live.winner')}: {match.winner.firstName} {match.winner.lastName}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPoolStage = (stageTournamentId: string, stage: LiveViewPoolStage) => (
    <div key={stage.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-white">{t('live.stage')} {stage.stageNumber}: {stage.name}</h4>
          <p className="text-sm text-slate-400">{t('common.status')}: {getStatusLabel('stage', stage.status)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stage.pools?.length || 0} pools · {stage.playersPerPool ?? 'n/a'} per pool
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderStageControls(stageTournamentId, stage)}
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            {stage.pools?.length || 0} pools
          </span>
        </div>
      </div>

      {(!stage.pools || stage.pools.length === 0) ? (
        <p className="mt-5 text-xs text-slate-400">{t('live.noPools')}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {stage.pools?.map((pool) => (
            <div key={pool.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-base font-semibold text-slate-100">
                  Pool {pool.poolNumber} of {stage.pools?.length || 0}: {pool.name}
                </h5>
                <span className="text-xs text-slate-400">{getStatusLabel('pool', pool.status)}</span>
              </div>

              <div className="mt-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.participants')}</p>
                {renderPoolAssignments(pool)}
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.leaderboard')}</p>
                {renderPoolLeaderboard(pool)}
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
                {renderPoolMatches(stageTournamentId, pool)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLiveViewHeader = (view: LiveViewData) => (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('live.title')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">{view.name}</h2>
        <p className="mt-1 text-xs text-slate-500">ID: {view.id}</p>
        <p className="mt-1 text-sm text-slate-400">{t('common.status')}: {view.status}</p>
      </div>
      <button
        onClick={() => reloadLiveViews()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
      >
        {t('common.refresh')}
      </button>
    </div>
  );

  const renderPoolSummaryCards = (stats: { poolStageCount: number; totalPools: number; poolsPerStage: number[] }, hasLoserBracket: boolean) => (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.poolStages')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{stats.poolStageCount}</p>
        {stats.poolsPerStage.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {t('live.poolsPerStage')}: {stats.poolsPerStage.join(' · ')}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.totalPools')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{stats.totalPools}</p>
        <p className="mt-1 text-xs text-slate-400">{t('live.playersPerPoolNote')}</p>
      </div>
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.loserBracket')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{hasLoserBracket ? t('common.yes') : t('common.no')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('live.afterPools')}</p>
      </div>
    </div>
  );

  const renderMatchQueueSection = (view: LiveViewData, stages: LiveViewPoolStage[]) => {
    const queue = buildMatchQueue(view, stages);
    const availableTargets = availableTargetsByTournament.get(view.id) || [];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{t('live.queue.title')}</h3>
          <span className="text-xs text-slate-400">{queue.length}</span>
        </div>
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            {t('live.queue.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const matchKey = getMatchKey(item.tournamentId, item.matchId);
              const selectedTargetId = matchTargetSelections[matchKey] || '';
              const canStart = item.status === 'SCHEDULED' && selectedTargetId.length > 0 && updatingMatchId !== matchKey;
              return (
              <div key={item.matchId} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">
                    {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                  </div>
                  <span className="text-xs text-slate-400">{getStatusLabel('match', item.status)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    {t('live.queue.matchLabel')} {item.matchNumber}
                  </span>
                  <span>·</span>
                  <span>
                    {t('live.queue.roundLabel')} {item.roundNumber}
                  </span>
                  {(item.targetCode || item.targetNumber) && (
                    <>
                      <span>·</span>
                      <span>
                        {t('live.queue.targetLabel')} {item.targetCode ?? `#${item.targetNumber}`}
                      </span>
                    </>
                  )}
                </div>
                {item.players.length > 0 && (
                  <div className="mt-2 text-xs text-slate-300">{item.players.join(' · ')}</div>
                )}
                {item.status === 'SCHEDULED' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedTargetId}
                      onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
                      className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                    >
                      <option value="">{t('live.queue.targetLabel')}</option>
                      {availableTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {getTargetLabel(target)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleMatchStatusUpdate(item.tournamentId, item.matchId, 'IN_PROGRESS', selectedTargetId)}
                      disabled={!canStart}
                      className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                    >
                      {updatingMatchId === matchKey ? t('live.startingMatch') : t('live.startMatch')}
                    </button>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPoolStagesSection = (tournamentId: string, stages: LiveViewPoolStage[]) => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">{t('live.poolStages')}</h3>
      {stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('live.noPoolStages')}
        </div>
      ) : (
        <div className="space-y-6">
          {stages.map((stage) => renderPoolStage(tournamentId, stage))}
        </div>
      )}
    </div>
  );

  const renderBracketMatches = (bracket: LiveViewBracket) => {
    if (bracket.matches && bracket.matches.length > 0) {
      return (
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
                  {t('live.winner')}: {match.winner.firstName} {match.winner.lastName}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }

    return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
  };

  const renderBracketsSection = (brackets: LiveViewBracket[], hasLoserBracket: boolean) => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">{t('live.bracketStages')}</h3>
      <p className="text-xs text-slate-500">
        {t('live.loserBracket')}: {hasLoserBracket ? t('common.yes') : t('common.no')}
      </p>
      {brackets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('live.noBrackets')}
        </div>
      ) : (
        <div className="space-y-6">
          {brackets.map((bracket) => (
            <div key={bracket.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">{bracket.name}</h4>
                  <p className="text-sm text-slate-400">{bracket.bracketType} · {getStatusLabel('bracket', bracket.status)}</p>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                  {bracket.entries?.length || 0} entries
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
                {renderBracketMatches(bracket)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLiveView = (view: LiveViewData) => {
    const filteredPoolStages = filterPoolStagesForView(viewMode, view.poolStages);
    const filteredBrackets = filterBracketsForView(viewMode, view.brackets);
    const hasLoserBracket = getHasLoserBracket(view.brackets);
    const poolStats = getPoolStageStats(filteredPoolStages);
    const showPools = !isBracketsView(viewMode);
    const showBrackets = !isPoolStagesView(viewMode);

    return (
      <div key={view.id} className="space-y-10">
        {renderLiveViewHeader(view)}
        {showPools && renderPoolSummaryCards(poolStats, hasLoserBracket)}
        {showPools && !isPoolStagesView(viewMode) && renderMatchQueueSection(view, filteredPoolStages)}
        {showPools && renderPoolStagesSection(view.id, filteredPoolStages)}
        {showBrackets && renderBracketsSection(filteredBrackets, hasLoserBracket)}
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {visibleLiveViews.map(renderLiveView)}
    </div>
  );
}

export default LiveTournament;
