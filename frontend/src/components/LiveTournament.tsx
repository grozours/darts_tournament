import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { useAdminStatus } from '../auth/useAdminStatus';
import SignInPanel from '../auth/SignInPanel';
import { fetchTournamentLiveView, updateMatchStatus, completeMatch, updateCompletedMatchScores, updatePoolStage, completePoolStageWithScores, deletePoolStage, completeBracketRoundWithScores } from '../services/tournamentService';
import { useI18n } from '../i18n';
import {
  getVisibleLiveViews,
  resolveEmptyLiveCopy,
  isBracketsView,
  isPoolStagesView,
  type LiveViewStatus,
} from '../utils/liveViewHelpers';

interface LiveViewMatchPlayer {
  player?: {
    id: string;
    firstName: string;
    lastName: string;
    surname?: string | null;
    teamName?: string | null;
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
      surname?: string | null;
      teamName?: string | null;
    };
  }>;
  matches?: LiveViewMatch[];
}

interface PoolLeaderboardRow {
  playerId: string;
  name: string;
  legsWon: number;
  legsLost: number;
  position: number;
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

const filterPoolStagesForView = (viewMode: LiveViewMode, viewStatus: LiveViewStatus, poolStages?: LiveViewPoolStage[]) => {
  const stages = poolStages || [];
  if (!isPoolStagesView(viewMode)) {
    return stages;
  }
  const allowedStatuses = viewStatus === 'FINISHED'
    ? new Set(['COMPLETED'])
    : new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
  return stages.filter((stage) => allowedStatuses.has(stage.status) && (stage.pools?.length || 0) > 0);
};

const filterBracketsForView = (viewMode: LiveViewMode, viewStatus: LiveViewStatus, brackets?: LiveViewBracket[]) => {
  const bracketList = brackets || [];
  if (!isBracketsView(viewMode)) {
    return bracketList;
  }
  if (viewStatus !== 'FINISHED') {
    return bracketList;
  }
  return bracketList.filter(
    (bracket) => bracket.status === 'COMPLETED' && (bracket.matches?.length || 0) > 0
  );
};

type PoolQueue = {
  poolId: string;
  stageNumber: number;
  poolNumber: number;
  progress: number;
  matches: MatchQueueItem[];
};

const sortPoolMatches = (queue: PoolQueue) => {
  const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);
  queue.matches.sort((a, b) => {
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
  poolStages: LiveViewPoolStage[],
  poolQueues: PoolQueue[],
  isMatchBlocked: (match: LiveViewMatch) => boolean
) => {
  const shouldQueueMatch = (match: LiveViewMatch) => {
    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      return false;
    }
    return !isMatchBlocked(match);
  };

  const createQueueItem = (stage: LiveViewPoolStage, pool: LiveViewPool, match: LiveViewMatch) => {
    const players = (match.playerMatches ?? [])
      .map((pm) => (pm.player ? `${pm.player.firstName} ${pm.player.lastName}` : ''))
      .filter(Boolean);

    return {
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
  for (const stage of poolStages) {
    if (stage.status !== 'IN_PROGRESS') {
      continue;
    }
    for (const pool of stage.pools ?? []) {
      const poolQueue = poolQueues.find((queue) => queue.poolId === pool.id);
      items.push(...buildPoolItems(stage, pool, poolQueue));
    }
  }
  return items;
};

const buildMatchQueue = (view: LiveViewData, poolStages: LiveViewPoolStage[]): MatchQueueItem[] => {
  const activePlayerIds = new Set<string>();
  const activePlayerLabels = new Set<string>();

  const collectActivePlayers = (match: LiveViewMatch) => {
    for (const pm of match.playerMatches ?? []) {
      const player = pm.player;
      if (!player) continue;
      if (player.id) {
        activePlayerIds.add(player.id);
      }
      const label = `${player.firstName} ${player.lastName}`.trim();
      if (label) {
        activePlayerLabels.add(label);
      }
    }
  };

  const poolQueues = buildPoolQueues(poolStages, collectActivePlayers);

  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match.status === 'IN_PROGRESS') {
        collectActivePlayers(match);
      }
    }
  }

  const isMatchBlocked = (match: LiveViewMatch) => {
    for (const pm of match.playerMatches ?? []) {
      const player = pm.player;
      if (!player) continue;
      if (player.id && activePlayerIds.has(player.id)) {
        return true;
      }
      const label = `${player.firstName} ${player.lastName}`.trim();
      if (label && activePlayerLabels.has(label)) {
        return true;
      }
    }
    return false;
  };
  const items = buildQueueItems(view, poolStages, poolQueues, isMatchBlocked);
  for (const queue of poolQueues) {
    sortPoolMatches(queue);
  }
  const ordered = interleavePools(poolQueues);
  return ordered.length > 0 ? ordered : items;
};

const getHasLoserBracket = (brackets?: LiveViewBracket[]) =>
  (brackets || []).some(
    (bracket) =>
      bracket.bracketType === 'DOUBLE_ELIMINATION' ||
      bracket.name.toLowerCase().includes('loser')
  );

const formatTargetLabel = (value: string, t: ReturnType<typeof useI18n>['t']) => {
  const match = /^target\s*(\d+)$/i.exec(value.trim());
  if (match) {
    return `${t('targets.target')} ${match[1]}`;
  }
  return value;
};

const getMatchTargetLabel = (target: LiveViewMatch['target'] | null | undefined, t: ReturnType<typeof useI18n>['t']) => {
  if (!target) return null;
  const base = target.targetCode || target.name || (target.targetNumber ? `#${target.targetNumber}` : null);
  return base ? formatTargetLabel(base, t) : null;
};

const getBracketRoundLabel = (roundNumber: number, totalRounds: number, t: ReturnType<typeof useI18n>['t']) => {
  const distance = totalRounds - roundNumber;
  if (distance === 0) return t('live.round.final');
  if (distance === 1) return t('live.round.semiFinal');
  if (distance === 2) return t('live.round.quarterFinal');
  if (distance === 3) return t('live.round.roundOf16');
  return `${t('live.queue.roundLabel')} ${roundNumber}`;
};

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

const getLeaderboardPlayerLabel = (player: LiveViewMatchPlayer['player']) => {
  if (!player) return '';
  const fullName = `${player.firstName} ${player.lastName}`.trim();
  if (player.teamName) {
    return `${player.teamName} / ${fullName}`.trim();
  }
  if (player.surname) {
    return `${player.surname} / ${fullName}`.trim();
  }
  return fullName;
};

const ensureLeaderboardRow = (
  rows: Map<string, PoolLeaderboardRow>,
  player: LiveViewMatchPlayer['player']
) => {
  if (!player) return undefined;
  if (!rows.has(player.id)) {
    rows.set(player.id, {
      playerId: player.id,
      name: getLeaderboardPlayerLabel(player),
      legsWon: 0,
      legsLost: 0,
      position: 0,
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

const sortLeaderboardRows = (rows: Map<string, PoolLeaderboardRow>) => {
  const sorted = Array.from(rows.values()).sort((a, b) => {
    if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
    if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
    return a.name.localeCompare(b.name);
  });
  
  // Add position/ranking to each row
  sorted.forEach((row, index) => {
    row.position = index + 1;
  });
  
  return sorted;
};

const getTargetLabel = (target: LiveViewTarget, t: ReturnType<typeof useI18n>['t']) =>
  formatTargetLabel(target.targetCode || target.name || `#${target.targetNumber}`, t);

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

const buildInUseTargetNumbers = (views: LiveViewData[]) => {
  const inUse = new Set<number>();
  for (const view of views) {
    const matchStatusById = buildMatchStatusMap(view);
    for (const target of view.targets ?? []) {
      if (isTargetInUse(target, matchStatusById)) {
        inUse.add(target.targetNumber);
      }
    }
  }
  return inUse;
};

const getSharedAvailableTargets = (view: LiveViewData, inUseTargetNumbers: Set<number>) =>
  (view.targets || []).filter((target) => {
    const normalizedStatus = (target.status ?? '').toUpperCase();
    if (normalizedStatus === 'MAINTENANCE') {
      return false;
    }
    if (inUseTargetNumbers.has(target.targetNumber)) {
      return false;
    }
    return true;
  });

const renderLiveTournamentGate = (params: {
  authLoading: boolean;
  authEnabled: boolean;
  isAuthenticated: boolean;
  authError?: Error;
  tournamentId: string | null;
  requireTournamentId: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) => {
  const { authLoading, authEnabled, isAuthenticated, authError, tournamentId, requireTournamentId, loading, error, onRetry, t } = params;
  const hasRecentAuthCallback = (() => {
    if (globalThis.window === undefined) return false;
    const params = new URLSearchParams(globalThis.window.location.search);
    if (params.has('code') || params.has('state')) return true;
    try {
      const stored = globalThis.window.sessionStorage.getItem('auth0:callback');
      if (!stored) return false;
      const timestamp = Number(stored);
      return Number.isFinite(timestamp) && Date.now() - timestamp < 2 * 60 * 1000;
    } catch {
      return false;
    }
  })();

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

  if (authEnabled && authError) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-2">{t('auth.signInFailed')}</div>
        <div className="text-xs text-rose-100/80 space-y-1">
          <div><strong>Error:</strong> {authError.message}</div>
          {authError.name && <div><strong>Type:</strong> {authError.name}</div>}
          {(authError as any).error && <div><strong>Code:</strong> {(authError as any).error}</div>}
          {(authError as any).error_description && (
            <div><strong>Description:</strong> {(authError as any).error_description}</div>
          )}
        </div>
        <div className="mt-4 text-xs text-rose-100/60">Check browser console for detailed logs</div>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="space-y-4">
        {hasRecentAuthCallback && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <div className="text-amber-200 mb-2">{t('auth.signInFailed')}</div>
            <div className="text-xs text-amber-100/80">Auth callback detected but session not established.</div>
          </div>
        )}
        <SignInPanel
          title={t('auth.signInToViewLive')}
          description={t('auth.protectedContinue')}
        />
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
    getAccessTokenSilently,
    error: authError,
  } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const viewMode = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('view');
  }, []);

  const viewStatus: LiveViewStatus = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('status');
  }, []);

  const tournamentId = useMemo(() => {
    if (globalThis.window === undefined) return null;
    return new URLSearchParams(globalThis.window.location.search).get('tournamentId');
  }, []);

  const isAggregateView =
    !tournamentId
    && (
      viewMode === 'live'
      || viewMode === 'pool-stages'
      || viewMode === 'brackets'
    );

  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [selectedLiveTournamentId, setSelectedLiveTournamentId] = useState('ALL');
  const [selectedPoolStagesTournamentId, setSelectedPoolStagesTournamentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [updatingRoundKey, setUpdatingRoundKey] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageStatusDrafts, setStageStatusDrafts] = useState<Record<string, string>>({});
  const [stagePoolCountDrafts, setStagePoolCountDrafts] = useState<Record<string, string>>({});
  const [stagePlayersPerPoolDrafts, setStagePlayersPerPoolDrafts] = useState<Record<string, string>>({});
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [matchTargetSelections, setMatchTargetSelections] = useState<Record<string, string>>({});
  const [activeBracketByTournament, setActiveBracketByTournament] = useState<Record<string, string>>({});

  const inUseTargetNumbers = useMemo(() => buildInUseTargetNumbers(liveViews), [liveViews]);

  const availableTargetsByTournament = useMemo(() => {
    const map = new Map<string, LiveViewTarget[]>();
    liveViews.forEach((view) => {
      map.set(view.id, getSharedAvailableTargets(view, inUseTargetNumbers));
    });
    return map;
  }, [liveViews, inUseTargetNumbers]);

  const targetIdByTournamentAndNumber = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    liveViews.forEach((view) => {
      const targetMap = new Map<number, string>();
      (view.targets ?? []).forEach((target) => {
        targetMap.set(target.targetNumber, target.id);
      });
      map.set(view.id, targetMap);
    });
    return map;
  }, [liveViews]);

  const visibleLiveViews = getVisibleLiveViews(viewMode, liveViews, viewStatus);
  const isPoolStagesReadonly = !isAdmin && isPoolStagesView(viewMode);
  const isBracketsReadonly = !isAdmin && isBracketsView(viewMode);

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

  useEffect(() => {
    if (viewMode === 'live') {
      setSelectedLiveTournamentId('ALL');
    }
  }, [viewMode, liveViews.length]);

  useEffect(() => {
    if (viewMode !== 'pool-stages' || tournamentId) {
      return;
    }
    if (!selectedPoolStagesTournamentId && visibleLiveViews.length > 0) {
      setSelectedPoolStagesTournamentId(visibleLiveViews[0].id);
    }
  }, [viewMode, tournamentId, visibleLiveViews, selectedPoolStagesTournamentId]);

  const displayedLiveViews = useMemo(() => {
    if (viewMode !== 'live') {
      if (viewMode === 'pool-stages' && !tournamentId && selectedPoolStagesTournamentId) {
        return visibleLiveViews.filter((view) => view.id === selectedPoolStagesTournamentId);
      }
      return visibleLiveViews;
    }
    if (selectedLiveTournamentId === 'ALL') {
      return visibleLiveViews;
    }
    return visibleLiveViews.filter((view) => view.id === selectedLiveTournamentId);
  }, [selectedLiveTournamentId, selectedPoolStagesTournamentId, viewMode, visibleLiveViews, tournamentId]);

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
      const token = await getSafeAccessToken();
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
  }, [authEnabled, getSafeAccessToken, tournamentId]);

  const loadAggregateLiveViews = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await getSafeAccessToken();
      const statusParam = (viewStatus ?? 'LIVE').toUpperCase();
      const response = await fetch(`/api/tournaments?status=${encodeURIComponent(statusParam)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch live tournaments');
      }
      const data = await response.json();
      const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
      const liveTournaments = tournaments.filter((t: { status?: string }) =>
        (t.status ?? '').toUpperCase() === statusParam
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
  }, [authEnabled, getSafeAccessToken, viewStatus]);

  const reloadLiveViews = useCallback((options?: { showLoader?: boolean }) => {
    if (isAggregateView) {
      return loadAggregateLiveViews(options);
    }
    return loadSingleLiveView(options);
  }, [isAggregateView, loadAggregateLiveViews, loadSingleLiveView]);

  const getMatchKey = (matchTournamentId: string, matchId: string) => `${matchTournamentId}:${matchId}`;

  const getTargetIdForSelection = (matchTournamentId: string, targetNumberValue: string) => {
    const parsedNumber = Number(targetNumberValue);
    if (!Number.isFinite(parsedNumber)) {
      return undefined;
    }
    return targetIdByTournamentAndNumber.get(matchTournamentId)?.get(parsedNumber);
  };

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
      const token = await getSafeAccessToken();
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
      const token = await getSafeAccessToken();
      await completeMatch(matchTournamentId, match.id, scores, token);
      setUpdatingMatchId(null);
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
      const token = await getSafeAccessToken();
      await updateCompletedMatchScores(matchTournamentId, match.id, scores, token);
      setUpdatingMatchId(null);
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

  const handleCompleteBracketRound = async (matchTournamentId: string, bracket: LiveViewBracket) => {
    const activeMatches = (bracket.matches || [])
      .filter((match) => match.status !== 'COMPLETED' && match.status !== 'CANCELLED');
    if (activeMatches.length === 0) {
      setError('No matches available to complete in this bracket round.');
      return;
    }

    const roundNumber = Math.min(...activeMatches.map((match) => match.roundNumber || 1));
    const roundKey = `${matchTournamentId}:${bracket.id}:${roundNumber}`;
    setUpdatingRoundKey(roundKey);
    setError(null);
    try {
      const token = await getSafeAccessToken();
      await completeBracketRoundWithScores(matchTournamentId, bracket.id, roundNumber, token);
      await reloadLiveViews({ showLoader: false });
    } catch (err) {
      console.error('Error completing bracket round:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete bracket round');
    } finally {
      setUpdatingRoundKey(null);
    }
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
      const token = await getSafeAccessToken();
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
      const token = await getSafeAccessToken();
      await deletePoolStage(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (err) {
      console.error('Error deleting pool stage:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete pool stage');
    } finally {
      setUpdatingStageId(null);
    }
  };

  const handleCompleteStageWithScores = async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.completeStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(null);
    try {
      const token = await getSafeAccessToken();
      await completePoolStageWithScores(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (err) {
      console.error('Error completing pool stage:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete pool stage');
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

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadLiveViews({ showLoader: false });
    }, 10000);
    return () => globalThis.clearInterval(intervalId);
  }, [reloadLiveViews]);

  const gateContent = renderLiveTournamentGate({
    authLoading,
    authEnabled,
    isAuthenticated,
    authError,
    tournamentId,
    requireTournamentId: !isAggregateView,
    loading,
    error,
    onRetry: () => {
      void reloadLiveViews();
    },
    t,
  });

  if (gateContent) {
    return gateContent;
  }

  if (displayedLiveViews.length === 0) {
    if (isAggregateView && !loading && !error) {
      const emptyCopy = resolveEmptyLiveCopy(viewMode, t, viewStatus);
      return (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-300">{emptyCopy}</p>
        </div>
      );
    }
    return null;
  }

  const renderStageControls = (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (isPoolStagesReadonly) {
      return null;
    }
    const isEditing = editingStageId === stage.id;
    if (!isEditing) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {stage.status === 'IN_PROGRESS' && (
            <button
              onClick={() => handleCompleteStageWithScores(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id}
              className="rounded-full border border-amber-500/70 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-300 disabled:opacity-60"
            >
              {updatingStageId === stage.id ? t('live.completingStage') : t('live.completeStage')}
            </button>
          )}
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
              <th className="px-2 py-2 text-center font-semibold">{t('live.position')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('common.player')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsWon')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsLost')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leaderboard.map((row) => (
              <tr key={row.playerId} className="text-slate-200">
                <td className="px-2 py-2 text-center font-semibold text-slate-300">#{row.position}</td>
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
    if (isPoolStagesReadonly) {
      return null;
    }
    switch (match.status) {
      case 'SCHEDULED':
        return (() => {
          const matchKey = getMatchKey(matchTournamentId, match.id);
          const availableTargets = availableTargetsByTournament.get(matchTournamentId) || [];
          const selectedTargetNumber = matchTargetSelections[matchKey] || '';
          const selectedTargetId = getTargetIdForSelection(matchTournamentId, selectedTargetNumber);
          const canStart = Boolean(selectedTargetId) && updatingMatchId !== matchKey;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={selectedTargetNumber}
                onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
                className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
              >
                <option value="">{t('live.queue.targetLabel')}</option>
                {availableTargets.map((target) => (
                  <option key={target.id} value={String(target.targetNumber)}>
                    {getTargetLabel(target, t)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedTargetId && handleMatchStatusUpdate(matchTournamentId, match.id, 'IN_PROGRESS', selectedTargetId)}
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
            {match.status === 'IN_PROGRESS' && getMatchTargetLabel(match.target, t) && (
              <p className="mt-1 text-xs text-slate-400">
                {t('live.queue.targetLabel')}: {getMatchTargetLabel(match.target, t)}
              </p>
            )}
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
    const showTournamentName = isAggregateView && visibleLiveViews.length > 1;

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
              const availableTargets = availableTargetsByTournament.get(item.tournamentId) || [];
              const selectedTargetNumber = matchTargetSelections[matchKey] || '';
              const selectedTargetId = getTargetIdForSelection(item.tournamentId, selectedTargetNumber);
              const canStart = item.status === 'SCHEDULED' && Boolean(selectedTargetId) && updatingMatchId !== matchKey;
              return (
              <div key={item.matchId} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">
                    {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                  </div>
                  <span className="text-xs text-slate-400">{getStatusLabel('match', item.status)}</span>
                </div>
                {showTournamentName && (
                  <div className="mt-1 text-xs text-slate-500">{item.tournamentName}</div>
                )}
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
                        {t('live.queue.targetLabel')} {formatTargetLabel(item.targetCode ?? `#${item.targetNumber}`, t)}
                      </span>
                    </>
                  )}
                </div>
                {item.players.length > 0 && (
                  <div className="mt-2 text-xs text-slate-300">{item.players.join(' · ')}</div>
                )}
                {item.status === 'SCHEDULED' && !isPoolStagesReadonly && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedTargetNumber}
                      onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
                      className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                    >
                      <option value="">{t('live.queue.targetLabel')}</option>
                      {availableTargets.map((target) => (
                        <option key={target.id} value={String(target.targetNumber)}>
                          {getTargetLabel(target, t)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => selectedTargetId && handleMatchStatusUpdate(item.tournamentId, item.matchId, 'IN_PROGRESS', selectedTargetId)}
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

  const renderGlobalMatchQueueSection = (views: LiveViewData[]) => {
    const sortedViews = [...views].sort((a, b) => a.name.localeCompare(b.name));
    const queue = sortedViews.flatMap((view) =>
      buildMatchQueue(view, filterPoolStagesForView(viewMode, viewStatus, view.poolStages))
    );

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
              const availableTargets = availableTargetsByTournament.get(item.tournamentId) || [];
              const selectedTargetNumber = matchTargetSelections[matchKey] || '';
              const selectedTargetId = getTargetIdForSelection(item.tournamentId, selectedTargetNumber);
              const canStart = item.status === 'SCHEDULED' && Boolean(selectedTargetId) && updatingMatchId !== matchKey;
              return (
                <div key={`${item.tournamentId}-${item.matchId}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-200">
                      {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                    </div>
                    <span className="text-xs text-slate-400">{getStatusLabel('match', item.status)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.tournamentName}</div>
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
                          {t('live.queue.targetLabel')} {formatTargetLabel(item.targetCode ?? `#${item.targetNumber}`, t)}
                        </span>
                      </>
                    )}
                  </div>
                  {item.players.length > 0 && (
                    <div className="mt-2 text-xs text-slate-300">{item.players.join(' · ')}</div>
                  )}
                  {item.status === 'SCHEDULED' && !isPoolStagesReadonly && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        value={selectedTargetNumber}
                        onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
                        className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                      >
                        <option value="">{t('live.queue.targetLabel')}</option>
                        {availableTargets.map((target) => (
                          <option key={target.id} value={String(target.targetNumber)}>
                            {getTargetLabel(target, t)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedTargetId && handleMatchStatusUpdate(item.tournamentId, item.matchId, 'IN_PROGRESS', selectedTargetId)}
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

  const getBracketPlayerLabel = (pm?: LiveViewMatch['playerMatches'][number]) => {
    if (!pm?.player) return 'TBD';
    return `${pm.player.firstName} ${pm.player.lastName}`.trim();
  };

  type BracketMatchSlot = LiveViewMatch & { isPlaceholder?: boolean };

  const buildBracketRounds = (bracket: LiveViewBracket) => {
    const matches = bracket.matches ?? [];
    const roundMap = new Map<number, LiveViewMatch[]>();
    for (const match of matches) {
      const round = match.roundNumber || 1;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)?.push(match);
    }

    const entryCount = bracket.entries?.length ?? 0;
    const round1Count = roundMap.get(1)?.length ?? 0;
    const inferredSize = Math.max(entryCount, round1Count * 2, 2);
    const bracketSize = 2 ** Math.ceil(Math.log2(inferredSize));
    const inferredRounds = Math.max(1, Math.log2(bracketSize));
    const totalRounds = Math.max(bracket.totalRounds || 0, inferredRounds);

    const rounds: Array<{ roundNumber: number; matches: BracketMatchSlot[] }> = [];
    for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
      const expectedMatches = Math.max(1, Math.floor(bracketSize / (2 ** roundNumber)));
      const roundMatches = [...(roundMap.get(roundNumber) ?? [])]
        .sort((a, b) => a.matchNumber - b.matchNumber);
      const slots: BracketMatchSlot[] = Array.from({ length: expectedMatches }, (_, index) => ({
        id: `placeholder-${bracket.id}-${roundNumber}-${index}`,
        matchNumber: index + 1,
        roundNumber,
        status: 'SCHEDULED',
        playerMatches: [],
        isPlaceholder: true,
      } as BracketMatchSlot));
      for (const match of roundMatches) {
        const slotIndex = match.matchNumber - 1;
        if (slotIndex >= 0 && slotIndex < slots.length) {
          slots[slotIndex] = match as BracketMatchSlot;
        }
      }
      rounds.push({ roundNumber, matches: slots });
    }

    return rounds;
  };

  const renderBracketMatchActions = (matchTournamentId: string, match: BracketMatchSlot) => {
    if (isBracketsReadonly) {
      return null;
    }
    if (match.isPlaceholder) {
      return null;
    }
    const matchKey = getMatchKey(matchTournamentId, match.id);
    switch (match.status) {
      case 'SCHEDULED': {
        if (!match.playerMatches || match.playerMatches.length < 2) {
          return null;
        }
        const availableTargets = availableTargetsByTournament.get(matchTournamentId) || [];
        const selectedTargetNumber = matchTargetSelections[matchKey] || '';
        const selectedTargetId = getTargetIdForSelection(matchTournamentId, selectedTargetNumber);
        const canStart = Boolean(selectedTargetId) && updatingMatchId !== matchKey;
        return (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedTargetNumber}
              onChange={(e) => handleTargetSelectionChange(matchKey, e.target.value)}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
            >
              <option value="">{t('live.queue.targetLabel')}</option>
              {availableTargets.map((target) => (
                <option key={target.id} value={String(target.targetNumber)}>
                  {getTargetLabel(target, t)}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedTargetId && handleMatchStatusUpdate(matchTournamentId, match.id, 'IN_PROGRESS', selectedTargetId)}
              disabled={!canStart}
              className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
            >
              {updatingMatchId === matchKey ? t('live.startingMatch') : t('live.startMatch')}
            </button>
          </div>
        );
      }
      case 'IN_PROGRESS':
        return (
          <div className="mt-3 space-y-2">
            {renderMatchScoreInputs(matchTournamentId, match)}
            <button
              onClick={() => handleCompleteMatch(matchTournamentId, match)}
              disabled={updatingMatchId === matchKey}
              className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
            >
              {updatingMatchId === matchKey ? t('live.savingMatch') : t('live.completeMatch')}
            </button>
          </div>
        );
      case 'COMPLETED': {
        const isEditing = editingMatchId === matchKey;
        if (!isEditing) {
          return (
            <button
              onClick={() => handleEditMatch(matchTournamentId, match)}
              className="mt-3 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              {t('live.editScore')}
            </button>
          );
        }

        return (
          <div className="mt-3 space-y-2">
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

  const getBracketTone = (roundIndex: number, totalRounds: number) => {
    if (roundIndex >= totalRounds - 1) {
      return {
        card: 'bg-slate-900/90 text-slate-100 border-slate-600',
        row: 'bg-slate-950/70 border-slate-700',
        accent: 'text-slate-300',
        winner: 'text-amber-300',
      };
    }
    if (roundIndex % 2 === 0) {
      return {
        card: 'bg-slate-900/80 text-slate-100 border-slate-700',
        row: 'bg-slate-950/70 border-slate-700',
        accent: 'text-slate-300',
        winner: 'text-emerald-300',
      };
    }
    return {
      card: 'bg-slate-900/85 text-slate-100 border-slate-600',
      row: 'bg-slate-950/70 border-slate-700',
      accent: 'text-slate-300',
      winner: 'text-emerald-300',
    };
  };

  const renderBracketCard = (
    matchTournamentId: string,
    match: BracketMatchSlot,
    options: {
      showConnector: boolean;
      connectorSide: 'left' | 'right';
      tone: ReturnType<typeof getBracketTone>;
      isFinal?: boolean;
    }
  ) => (
    <div className="relative">
      <div
        className={`rounded-xl border px-3 py-2 text-xs shadow-[0_12px_24px_-16px_rgba(0,0,0,0.6)] ${options.tone.card}`}
        style={{ minHeight: 220, width: 200 }}
      >
        <div className={`flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.3em] ${options.tone.accent}`}>
          <span>{t('live.queue.matchLabel')} {match.matchNumber}</span>
          <span>{getStatusLabel('match', match.status)}</span>
        </div>
        <div className="mt-3 space-y-2">
          {[1, 2].map((position) => {
            const pm = match.playerMatches?.find((item) => item.playerPosition === position) || { playerPosition: position };
            return (
              <div
                key={`${match.id}-${position}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${options.tone.row}`}
              >
                  <span className={pm.player?.id === match.winner?.id ? options.tone.winner : options.tone.accent}>
                    {getBracketPlayerLabel(pm)}
                    {options.isFinal && match.status === 'COMPLETED' && pm.player?.id === match.winner?.id && (
                      <span className="ml-1">🏆</span>
                    )}
                    {!options.isFinal && match.status === 'COMPLETED' && pm.player?.id === match.winner?.id && (
                      <span className="ml-2 text-[10px] font-semibold text-emerald-300">
                        {t('live.winnerShort')}
                      </span>
                    )}
                  </span>
                <span className={options.tone.accent}>
                  {pm.scoreTotal ?? pm.legsWon ?? '-'}
                </span>
              </div>
            );
          })}
        </div>
        {renderBracketMatchActions(matchTournamentId, match)}
      </div>
      {options.showConnector && (
        <div
          className={`absolute top-1/2 h-px w-6 -translate-y-1/2 bg-slate-600 ${
            options.connectorSide === 'right' ? 'right-[-16px]' : 'left-[-16px]'
          }`}
        />
      )}
    </div>
  );

  const renderBracketMatches = (matchTournamentId: string, bracket: LiveViewBracket) => {
    const rounds = buildBracketRounds(bracket);
    if (rounds.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }

    const totalRounds = rounds.length;
    const finalRound = rounds[rounds.length - 1];
    const earlyRounds = rounds.slice(0, -1);
    const bracketGap = 40;
    const bracketCardHeight = 220;
    const baseStep = (bracketCardHeight + bracketGap) / 2;
    const columnHeight = (Math.pow(2, totalRounds) - 2) * baseStep + bracketCardHeight;
    const showWinnerColumn = (finalRound?.matches?.length ?? 0) === 1;
    const finalLeftOffset = /loser/i.test(bracket.name) ? -60 : -80;
    const roundsToRender = showWinnerColumn ? earlyRounds : rounds;

    const renderRoundColumn = (round: { roundNumber: number; matches: BracketMatchSlot[] }, index: number) => {
      const tone = getBracketTone(index, totalRounds);
      const cardWidth = 200;
      const connectorGap = 18;
      const leftOffset = round.roundNumber > 2 ? -40 : round.roundNumber > 1 ? -22 : 0;
      const connectorX = cardWidth + 6 + leftOffset;
      const connectorToNext = connectorGap + 8;
      const positions = round.matches.map((_, matchIndex) => {
        const roundIndex = Math.max(1, round.roundNumber);
        return (Math.pow(2, roundIndex) * matchIndex + (Math.pow(2, roundIndex - 1) - 1)) * baseStep;
      });
      return (
        <div key={`${bracket.id}-round-${round.roundNumber}`} className="min-w-[220px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            {getBracketRoundLabel(round.roundNumber, totalRounds, t)}
          </p>
          <div className="relative mt-5" style={{ height: Math.max(260, columnHeight) }}>
            {round.matches.map((match, matchIndex) => {
              const top = positions[matchIndex] ?? 0;
              return (
              <div key={match.id} className="absolute" style={{ top, left: leftOffset }}>
                {renderBracketCard(matchTournamentId, match, {
                  showConnector: true,
                  connectorSide: 'right',
                  tone,
                  isFinal: round.roundNumber === totalRounds,
                })}
              </div>
            );
            })}
            {positions.map((top, matchIndex) => (
              <div
                key={`line-${round.roundNumber}-${matchIndex}`}
                className="absolute h-px bg-slate-600"
                style={{
                  left: connectorX,
                  top: top + bracketCardHeight / 2,
                  width: connectorGap,
                }}
              />
            ))}
            {positions.map((top, matchIndex) => {
              if (matchIndex % 2 !== 0) return null;
              const nextTop = positions[matchIndex + 1];
              if (nextTop === undefined) return null;
              const startY = top + bracketCardHeight / 2;
              const endY = nextTop + bracketCardHeight / 2;
              const midY = (startY + endY) / 2;
              return (
                <div key={`pair-${round.roundNumber}-${matchIndex}`}>
                  <div
                    className="absolute w-px bg-slate-600"
                    style={{
                      left: connectorX + connectorGap,
                      top: startY,
                      height: Math.max(2, endY - startY),
                    }}
                  />
                  <div
                    className="absolute h-px bg-slate-600"
                    style={{
                      left: connectorX + connectorGap,
                      top: midY,
                      width: connectorToNext,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="mt-6 overflow-x-auto pb-6">
        <div className="flex min-w-[960px] items-start gap-12">
          <div className="flex gap-12">
            {roundsToRender.map((round, index) => renderRoundColumn(round, index))}
          </div>
          {showWinnerColumn && (
            <div className="flex min-w-[220px] flex-col items-center gap-4 pt-6">
              <div className="flex items-center gap-2 text-amber-300" style={{ marginLeft: finalLeftOffset }}>
                <span className="text-[11px] uppercase tracking-[0.4em]">
                  {getBracketRoundLabel(totalRounds, totalRounds, t)}
                </span>
                <span aria-hidden="true">🏆</span>
              </div>
              {finalRound?.matches?.[0] && (
                <div className="relative min-w-[200px]" style={{ height: Math.max(260, columnHeight) }}>
                  <div
                    className="absolute"
                    style={{
                      top: (Math.max(260, columnHeight) - bracketCardHeight) / 2,
                      left: finalLeftOffset,
                    }}
                  >
                    {renderBracketCard(matchTournamentId, finalRound.matches[0], {
                      showConnector: false,
                      connectorSide: 'right',
                      tone: getBracketTone(totalRounds - 1, totalRounds),
                      isFinal: true,
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBracketsSection = (tournamentId: string, brackets: LiveViewBracket[], hasLoserBracket: boolean) => {
    if (brackets.length === 0) {
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">{t('live.bracketStages')}</h3>
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            {t('live.noBrackets')}
          </div>
        </div>
      );
    }

    const preferredBracket = brackets.find((bracket) => /winner/i.test(bracket.name)) ?? brackets[0];
    const activeBracketId = activeBracketByTournament[tournamentId] ?? preferredBracket.id;
    const activeBracket = brackets.find((bracket) => bracket.id === activeBracketId) ?? preferredBracket;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('live.bracketStages')}</h3>
            <p className="text-xs text-slate-500">
              {t('live.loserBracket')}: {hasLoserBracket ? t('common.yes') : t('common.no')}
            </p>
          </div>
          {!isBracketsReadonly && (
            <div className="flex flex-wrap gap-2">
              {brackets.map((bracket) => (
                <button
                  key={bracket.id}
                  type="button"
                  onClick={() => setActiveBracketByTournament((current) => ({
                    ...current,
                    [tournamentId]: bracket.id,
                  }))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    bracket.id === activeBracket.id
                      ? 'border-amber-400/80 text-amber-200'
                      : 'border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {bracket.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-white">{activeBracket.name}</h4>
              <p className="text-sm text-slate-400">{activeBracket.bracketType} · {getStatusLabel('bracket', activeBracket.status)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isBracketsReadonly && (
                <button
                  type="button"
                  onClick={() => handleCompleteBracketRound(tournamentId, activeBracket)}
                  disabled={updatingRoundKey?.startsWith(`${tournamentId}:${activeBracket.id}:`) ?? false}
                  className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
                >
                  {updatingRoundKey?.startsWith(`${tournamentId}:${activeBracket.id}:`)
                    ? t('live.completingRound')
                    : t('live.completeRound')}
                </button>
              )}
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {activeBracket.entries?.length || 0} entries
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
            {renderBracketMatches(tournamentId, activeBracket)}
          </div>
        </div>
      </div>
    );
  };

  const showGlobalQueue = viewMode === 'live' && selectedLiveTournamentId === 'ALL' && visibleLiveViews.length > 1;

  const renderLiveView = (view: LiveViewData) => {
    const filteredPoolStages = filterPoolStagesForView(viewMode, viewStatus, view.poolStages);
    const filteredBrackets = filterBracketsForView(viewMode, viewStatus, view.brackets);
    const hasLoserBracket = getHasLoserBracket(view.brackets);
    const poolStats = getPoolStageStats(filteredPoolStages);
    const showPools = !isBracketsView(viewMode);
    const showBrackets = !isPoolStagesView(viewMode);

    return (
      <div key={view.id} className="space-y-10">
        {renderLiveViewHeader(view)}
        {showPools && renderPoolSummaryCards(poolStats, hasLoserBracket)}
        {showPools && !isPoolStagesView(viewMode) && !showGlobalQueue && renderMatchQueueSection(view, filteredPoolStages)}
        {showPools && renderPoolStagesSection(view.id, filteredPoolStages)}
        {showBrackets && renderBracketsSection(view.id, filteredBrackets, hasLoserBracket)}
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {viewMode === 'live' && visibleLiveViews.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs uppercase tracking-widest text-slate-500" htmlFor="live-tournament-filter">
            {t('live.selectTournament')}
          </label>
          <select
            id="live-tournament-filter"
            value={selectedLiveTournamentId}
            onChange={(event) => setSelectedLiveTournamentId(event.target.value)}
            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          >
            <option value="ALL">{t('live.allTournaments')}</option>
            {visibleLiveViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {viewMode === 'pool-stages' && !tournamentId && visibleLiveViews.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs uppercase tracking-widest text-slate-500" htmlFor="pool-stages-tournament-filter">
            {t('live.selectTournament')}
          </label>
          <select
            id="pool-stages-tournament-filter"
            value={selectedPoolStagesTournamentId}
            onChange={(event) => setSelectedPoolStagesTournamentId(event.target.value)}
            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          >
            {visibleLiveViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {showGlobalQueue && renderGlobalMatchQueueSection(displayedLiveViews)}
      {displayedLiveViews.map(renderLiveView)}
    </div>
  );
}

export default LiveTournament;
