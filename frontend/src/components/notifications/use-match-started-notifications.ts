import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useI18n } from '../../i18n';
import {
  type MatchFormatChangedPayload,
  type MatchFinishedPayload,
  type MatchNotificationPayload,
  type MatchStartedPayload,
  NOTIFICATIONS_AUDIO_ENABLED_KEY,
  NOTIFICATIONS_STORAGE_KEY,
  NOTIFICATIONS_VIBRATION_ENABLED_KEY,
  STORAGE_LIMIT,
} from './notifications-types';
import { playBellNotificationTone } from '../../utils/notification-audio';

type TournamentSummary = {
  id: string;
  name?: string;
  status?: string;
};

type TournamentPlayersResponse = {
  players?: Array<{
    playerId?: string;
    email?: string;
  }>;
};

type TournamentGroupResponse = {
  members?: Array<{
    playerId?: string;
    email?: string;
  }>;
};

type TournamentGroupCollectionResponse = {
  doublettes?: TournamentGroupResponse[];
  equipes?: TournamentGroupResponse[];
};

export const parseTournamentGroupPayload = (
  payload: unknown,
  path: 'doublettes' | 'equipes'
): TournamentGroupResponse[] => {
  if (Array.isArray(payload)) {
    return payload as TournamentGroupResponse[];
  }

  const collectionPayload = payload as TournamentGroupCollectionResponse;
  if (path === 'doublettes' && Array.isArray(collectionPayload.doublettes)) {
    return collectionPayload.doublettes;
  }
  if (path === 'equipes' && Array.isArray(collectionPayload.equipes)) {
    return collectionPayload.equipes;
  }

  return [];
};

type PoolStageSummary = {
  id: string;
};

type PoolStagePoolSummary = {
  id: string;
  assignments?: Array<{
    playerId?: string;
  }>;
};

const buildPoolKey = (tournamentId: string, poolId: string) => `${tournamentId}:${poolId}`;

const buildAuthRequestOptions = (token?: string): RequestInit =>
  (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

const readStoredNotifications = () => {
  try {
    const stored = globalThis.window?.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) {
      return [] as Array<{ acknowledgedAt?: string }>;
    }
    const parsed = JSON.parse(stored) as Array<{ acknowledgedAt?: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as Array<{ acknowledgedAt?: string }>;
  }
};

const appendNotification = (payload: MatchNotificationPayload) => {
  const stored = readStoredNotifications() as Array<{ id?: string; receivedAt?: string; payload?: MatchNotificationPayload }>;
  const next = [
    {
      id: `${payload.matchId}-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      payload,
    },
    ...stored,
  ].slice(0, STORAGE_LIMIT);

  try {
    globalThis.window?.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
    globalThis.window?.dispatchEvent(new Event('notifications:updated'));
  } catch {
    void 0;
  }
};

const fetchAuthEmail = async (token: string) => {
  const meResponse = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meResponse.ok) {
    throw new Error('AUTH_REQUIRED');
  }
  const meData = await meResponse.json();
  return (meData?.user?.email as string | undefined)?.toLowerCase();
};

const fetchTrackedTournaments = async (token: string) => {
  const statuses = ['OPEN', 'SIGNATURE', 'LIVE'];
  const responses = await Promise.all(statuses.map((status) =>
    fetch(`/api/tournaments?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ));
  if (responses.some((response) => !response.ok)) {
    throw new Error('LOAD_FAILED');
  }
  const payloads = await Promise.all(responses.map((response) => response.json()));
  const tournamentMap = new Map<string, TournamentSummary>();
  for (const data of payloads) {
    const tournaments = Array.isArray(data?.tournaments)
      ? (data.tournaments as TournamentSummary[])
      : [];
    for (const tournament of tournaments) {
      if (tournament?.id) {
        tournamentMap.set(tournament.id, tournament);
      }
    }
  }
  return [...tournamentMap.values()];
};

const fetchPoolStagesForTournament = async (tournamentId: string, token?: string) => {
  const response = await fetch(
    `/api/tournaments/${tournamentId}/pool-stages`,
    buildAuthRequestOptions(token)
  );
  if (!response.ok) {
    throw new Error('POOL_STAGES_LOAD_FAILED');
  }
  const data = await response.json();
  return (data.poolStages || []) as PoolStageSummary[];
};

const fetchPoolStagePools = async (tournamentId: string, stageId: string, token?: string) => {
  const response = await fetch(
    `/api/tournaments/${tournamentId}/pool-stages/${stageId}/pools`,
    buildAuthRequestOptions(token)
  );
  if (!response.ok) {
    throw new Error('POOL_STAGE_POOLS_LOAD_FAILED');
  }
  const data = await response.json();
  return (data.pools || []) as PoolStagePoolSummary[];
};

const fetchPlayerIdsForEmail = async (
  token: string,
  tournaments: TournamentSummary[],
  email: string
) => {
  const playerIds = new Set<string>();
  const tournamentsToJoin: string[] = [];

  for (const tournament of tournaments) {
    const playersResponse = await fetch(`/api/tournaments/${tournament.id}/players`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!playersResponse.ok) {
      continue;
    }
    const playersData = (await playersResponse.json()) as TournamentPlayersResponse;
    let matchedPlayerId: string | undefined;
    for (const player of playersData.players ?? []) {
      if ((player.email ?? '').toLowerCase() === email) {
        matchedPlayerId = player.playerId;
        break;
      }
    }
    if (matchedPlayerId) {
      playerIds.add(matchedPlayerId);
      tournamentsToJoin.push(tournament.id);
    }
  }

  return { playerIds, tournamentsToJoin };
};

const fetchTournamentGroups = async (
  tournamentId: string,
  path: 'doublettes' | 'equipes',
  token: string
) => {
  const response = await fetch(`/api/tournaments/${tournamentId}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return [] as TournamentGroupResponse[];
  }

  const payload = await response.json();
  return parseTournamentGroupPayload(payload, path);
};

const getGroupMembers = (group: TournamentGroupResponse) => (
  Array.isArray(group.members) ? group.members : []
);

const isMemberMatchingEmail = (
  member: { playerId?: string; email?: string },
  email: string
) => (member.email ?? '').toLowerCase() === email;

const collectGroupMemberIdsIfUserPresent = (
  group: TournamentGroupResponse,
  email: string,
  ownPlayerIds: Set<string>,
  collector: Set<string>
) => {
  const members = getGroupMembers(group);
  const userIsMember = members.some((member) => (
    isMemberMatchingEmail(member, email)
    || (member.playerId !== undefined && ownPlayerIds.has(member.playerId))
  ));
  if (!userIsMember) {
    return;
  }

  for (const member of members) {
    if (member.playerId) {
      collector.add(member.playerId);
    }
  }
};

const fetchTeammatePlayerIdsForEmail = async (
  token: string,
  tournaments: TournamentSummary[],
  email: string,
  ownPlayerIds: Set<string>
) => {
  const teammatePlayerIds = new Set<string>();

  for (const tournament of tournaments) {
    const [doublettes, equipes] = await Promise.all([
      fetchTournamentGroups(tournament.id, 'doublettes', token),
      fetchTournamentGroups(tournament.id, 'equipes', token),
    ]);

    for (const group of [...doublettes, ...equipes]) {
      collectGroupMemberIdsIfUserPresent(group, email, ownPlayerIds, teammatePlayerIds);
    }
  }

  return teammatePlayerIds;
};

const syncJoinedTournamentState = (
  playerIdsReference: { current: Set<string> },
  joinedTournamentsReference: { current: Set<string> },
  setJoinedTournaments: (value: string[]) => void,
  playerIds: Set<string>,
  tournamentsToJoin: string[]
) => {
  playerIdsReference.current = playerIds;
  joinedTournamentsReference.current = new Set(tournamentsToJoin);
  setJoinedTournaments(tournamentsToJoin);
};

const buildPlayerPoolKeys = async (
  tournaments: TournamentSummary[],
  token: string,
  playerIds: Set<string>
) => {
  const poolKeys = new Set<string>();
  for (const tournament of tournaments) {
    const stages = await fetchPoolStagesForTournament(tournament.id, token);
    for (const stage of stages) {
      const pools = await fetchPoolStagePools(tournament.id, stage.id, token);
      for (const pool of pools) {
        const hasPlayer = (pool.assignments || []).some((assignment) => (
          assignment.playerId && playerIds.has(assignment.playerId)
        ));
        if (hasPlayer) {
          poolKeys.add(buildPoolKey(tournament.id, pool.id));
        }
      }
    }
  }

  return poolKeys;
};

const hasTrackedPlayerInPayload = (
  payload: MatchNotificationPayload,
  trackedPlayerIds: Set<string>
) => payload.players.some((player) => player.id !== undefined && trackedPlayerIds.has(player.id));

const isCancelledForJoinedTournamentWithoutPlayerIds = (
  payload: MatchNotificationPayload,
  joinedTournamentIds: Set<string>
) => (
  payload.event === 'cancelled'
  && payload.players.every((player) => !player.id)
  && joinedTournamentIds.has(payload.tournamentId)
);

const isPoolMatchForTrackedPool = (
  payload: MatchNotificationPayload,
  trackedPoolKeys: Set<string>
) => (
  payload.match.source === 'pool'
  && Boolean(payload.match.poolId)
  && trackedPoolKeys.has(buildPoolKey(payload.tournamentId, payload.match.poolId!))
);

const canShowBrowserNotifications = () => (
  'Notification' in globalThis.window
  && Notification.permission === 'granted'
);

const readFeedbackPreference = (key: string, fallbackValue: boolean): boolean => {
  try {
    const raw = globalThis.window?.localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return fallbackValue;
    }
    return raw === '1';
  } catch {
    return fallbackValue;
  }
};

const playNotificationTone = async () => {
  await playBellNotificationTone();
};

const triggerNotificationFeedback = () => {
  const audioEnabled = readFeedbackPreference(NOTIFICATIONS_AUDIO_ENABLED_KEY, true);
  if (audioEnabled) {
    void playNotificationTone();
  }

  const vibrationEnabled = readFeedbackPreference(NOTIFICATIONS_VIBRATION_ENABLED_KEY, false);
  if (vibrationEnabled && typeof globalThis.navigator?.vibrate === 'function') {
    globalThis.navigator.vibrate([110, 50, 110]);
  }
};

const buildBrowserNotificationTitle = (
  payload: MatchNotificationPayload,
  targetLabel: string,
  translate: (key: string) => string
) => {
  if (payload.event === 'started') {
    return `${translate('notifications.calledToTarget')} ${targetLabel}`.trim();
  }
  if (payload.event === 'completed') {
    return translate('notifications.matchCompleted');
  }
  if (payload.event === 'format_changed') {
    return translate('notifications.matchFormatChanged');
  }
  return translate('notifications.matchCancelled');
};

const buildBrowserNotificationBody = (
  payload: MatchNotificationPayload,
  matchLabel: string,
  scoreSummary: string | undefined,
  translate: (key: string) => string
) => {
  const formatSuffix = payload.matchFormatKey
    ? ` · ${translate('notifications.matchFormat')}: ${payload.matchFormatKey}`
    : '';
  const formatDetails = payload.matchFormatTooltip ? `\n${payload.matchFormatTooltip}` : '';
  const scoreSuffix = scoreSummary ? ` · ${translate('live.finalScore')}: ${scoreSummary}` : '';
  return `${payload.tournamentName} · ${matchLabel}${formatSuffix}${scoreSuffix}${formatDetails}`.trim();
};

type ScoredNotificationPlayer = {
  player: MatchNotificationPayload['players'][number];
  score: number;
};

const extractScoredPlayers = (players: MatchNotificationPayload['players']): ScoredNotificationPlayer[] => (
  players
    .map((player) => ({ player, score: typeof player.scoreTotal === 'number' ? player.scoreTotal : null }))
    .filter((item): item is ScoredNotificationPlayer => item.score !== null)
);

const selectScorePair = (scoredPlayers: ScoredNotificationPlayer[]) => {
  const winner = scoredPlayers.find((item) => item.player.isWinner);
  const sorted = [...scoredPlayers].sort((a, b) => b.score - a.score);
  const first = winner ?? sorted[0];
  const second = sorted.find((item) => item !== first) ?? sorted[1];
  if (!first || !second) {
    return undefined;
  }

  return { first, second };
};

const attachMatchSocketHandlers = (
  socket: ReturnType<typeof io>,
  joinedTournaments: string[],
  scheduleRefreshTrackedState: () => void,
  appendNotificationEntry: (payload: MatchNotificationPayload) => void,
  maybeShowBrowserNotification: (payload: MatchNotificationPayload) => void,
  shouldNotifyPlayer: (payload: MatchNotificationPayload) => boolean
) => {
  socket.on('connect', () => {
    for (const tournamentId of joinedTournaments) {
      socket.emit('join-tournament', tournamentId);
    }
  });

  socket.on('tournament:updated', (payload: { status?: string }) => {
    const status = (payload.status ?? '').toUpperCase();
    if (status === 'OPEN' || status === 'SIGNATURE' || status === 'LIVE') {
      scheduleRefreshTrackedState();
    }
  });

  const notify = (payload: MatchNotificationPayload) => {
    if (!shouldNotifyPlayer(payload)) {
      return;
    }
    appendNotificationEntry(payload);
    triggerNotificationFeedback();
    maybeShowBrowserNotification(payload);
  };

  socket.on('match:started', (payload: Omit<MatchStartedPayload, 'event'>) => {
    notify({ ...payload, event: 'started' as const });
  });

  socket.on('match:finished', (payload: MatchFinishedPayload) => {
    notify(payload);
  });

  socket.on('match:format-changed', (payload: MatchFormatChangedPayload) => {
    notify(payload);
  });
};

const openMatchSocket = async (
  getSafeAccessToken: () => Promise<string | undefined>,
  onMissingToken: () => void,
  onConnected: (socket: ReturnType<typeof io>) => void
): Promise<void> => {
  const token = await getSafeAccessToken();
  if (!token) {
    onMissingToken();
    return;
  }

  const socket = io(globalThis.window?.location.origin ?? '', {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    auth: { token },
  });

  onConnected(socket);
};

const useMatchStartedNotifications = () => {
  const { t } = useI18n();
  const { enabled: authEnabled, isAuthenticated, getAccessTokenSilently } = useOptionalAuth();
  const formatTargetLabel = useCallback((payload: MatchNotificationPayload) => {
    const target = payload.target;
    if (!target) return '';
    const rawLabel = target.targetCode || target.name || `#${target.targetNumber}`;
    const match = /^target\s*(\d+)$/i.exec(rawLabel.trim());
    if (match) {
      return `${t('targets.target')} ${match[1]}`;
    }
    return rawLabel;
  }, [t]);

  const buildMatchLabel = useCallback((payload: MatchNotificationPayload) => {
    if (payload.match.source === 'pool') {
      const stage = payload.match.stageNumber ?? '-';
      const pool = payload.match.poolNumber ?? '-';
      return `${t('live.queue.stageLabel')} ${stage} · ${t('live.queue.poolLabel')} ${pool} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
    }
    return `${t('targets.bracketLabel')} ${payload.match.bracketName ?? ''} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
  }, [t]);

  const buildScoreSummary = useCallback((payload: MatchNotificationPayload) => {
    if (payload.event !== 'completed') {
      return undefined;
    }

    const scoredPlayers = extractScoredPlayers(payload.players);
    if (scoredPlayers.length < 2) {
      return undefined;
    }

    const pair = selectScorePair(scoredPlayers);
    if (!pair) {
      return undefined;
    }

    return `${pair.first.score} - ${pair.second.score}`;
  }, []);

  const maybeShowBrowserNotification = useCallback((payload: MatchNotificationPayload) => {
    if (!canShowBrowserNotifications()) {
      return;
    }
    const targetLabel = formatTargetLabel(payload);
    const matchLabel = buildMatchLabel(payload);
    const scoreSummary = buildScoreSummary(payload);
    const title = buildBrowserNotificationTitle(payload, targetLabel, t);
    const body = buildBrowserNotificationBody(payload, matchLabel, scoreSummary, t);
    try {
      new Notification(title, { body });
    } catch {
      void 0;
    }
  }, [buildMatchLabel, buildScoreSummary, formatTargetLabel, t]);

  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const playerIdsReference = useRef<Set<string>>(new Set());
  const poolKeysReference = useRef<Set<string>>(new Set());
  const joinedTournamentsReference = useRef<Set<string>>(new Set());
  const refreshInProgressReference = useRef(false);
  const refreshQueuedReference = useRef(false);
  const refreshTimeoutReference = useRef<ReturnType<typeof setTimeout> | undefined>();

  const shouldNotifyPlayer = useCallback((payload: MatchNotificationPayload) => {
    const trackedPlayerIds = playerIdsReference.current;
    if (trackedPlayerIds.size === 0) {
      return false;
    }
    if (hasTrackedPlayerInPayload(payload, trackedPlayerIds)) {
      return true;
    }
    if (isCancelledForJoinedTournamentWithoutPlayerIds(payload, joinedTournamentsReference.current)) {
      return true;
    }
    return isPoolMatchForTrackedPool(payload, poolKeysReference.current);
  }, []);

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch {
      void 0;
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const refreshTrackedState = useCallback(async () => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    if (refreshInProgressReference.current) {
      refreshQueuedReference.current = true;
      return;
    }

    refreshInProgressReference.current = true;

    try {
      const token = await getSafeAccessToken();
      if (!token) {
        return;
      }
      const email = await fetchAuthEmail(token);
      if (!email) {
        return;
      }
      const tournaments = await fetchTrackedTournaments(token);
      const data = await fetchPlayerIdsForEmail(token, tournaments, email);

      syncJoinedTournamentState(
        playerIdsReference,
        joinedTournamentsReference,
        setJoinedTournaments,
        data.playerIds,
        data.tournamentsToJoin
      );

      const teammatePlayerIds = await fetchTeammatePlayerIdsForEmail(token, tournaments, email, data.playerIds);
      for (const teammatePlayerId of teammatePlayerIds) {
        data.playerIds.add(teammatePlayerId);
      }
      const poolKeys = await buildPlayerPoolKeys(tournaments, token, data.playerIds);

      syncJoinedTournamentState(
        playerIdsReference,
        joinedTournamentsReference,
        setJoinedTournaments,
        data.playerIds,
        data.tournamentsToJoin
      );
      poolKeysReference.current = poolKeys;
    } catch {
      void 0;
    } finally {
      refreshInProgressReference.current = false;
      if (refreshQueuedReference.current) {
        refreshQueuedReference.current = false;
        void refreshTrackedState();
      }
    }
  }, [authEnabled, getSafeAccessToken, isAuthenticated]);

  const scheduleRefreshTrackedState = useCallback((immediate = false) => {
    if (immediate) {
      if (refreshTimeoutReference.current) {
        globalThis.window?.clearTimeout(refreshTimeoutReference.current);
        refreshTimeoutReference.current = undefined;
      }
      void refreshTrackedState();
      return;
    }

    if (refreshTimeoutReference.current) {
      globalThis.window?.clearTimeout(refreshTimeoutReference.current);
    }

    refreshTimeoutReference.current = globalThis.window?.setTimeout(() => {
      refreshTimeoutReference.current = undefined;
      void refreshTrackedState();
    }, 500);
  }, [refreshTrackedState]);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }
    scheduleRefreshTrackedState(true);
  }, [authEnabled, isAuthenticated, scheduleRefreshTrackedState]);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    const onRegistrationUpdated = () => {
      scheduleRefreshTrackedState(true);
    };

    globalThis.window?.addEventListener('tournaments:registration-updated', onRegistrationUpdated);

    return () => {
      globalThis.window?.removeEventListener('tournaments:registration-updated', onRegistrationUpdated);
    };
  }, [authEnabled, isAuthenticated, scheduleRefreshTrackedState]);

  useEffect(() => () => {
    if (refreshTimeoutReference.current) {
      globalThis.window?.clearTimeout(refreshTimeoutReference.current);
      refreshTimeoutReference.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }
    if (joinedTournaments.length === 0) {
      return;
    }

    let isDisposed = false;
    let socket: ReturnType<typeof io> | undefined;
    let tokenRetryTimeout: ReturnType<typeof setTimeout> | undefined;

    const scheduleRetry = () => {
      tokenRetryTimeout = globalThis.window?.setTimeout(() => {
        if (!isDisposed) {
          void tryConnect();
        }
      }, 4_000);
    };

    const handleConnectedSocket = (connectedSocket: ReturnType<typeof io>) => {
      if (isDisposed) {
        connectedSocket.disconnect();
        return;
      }

      socket = connectedSocket;
      attachMatchSocketHandlers(
        connectedSocket,
        joinedTournaments,
        scheduleRefreshTrackedState,
        appendNotification,
        maybeShowBrowserNotification,
        shouldNotifyPlayer
      );
    };

    const tryConnect = async () => {
      await openMatchSocket(
        getSafeAccessToken,
        scheduleRetry,
        handleConnectedSocket
      );
    };

    void tryConnect();

    return () => {
      isDisposed = true;
      if (tokenRetryTimeout) {
        globalThis.window?.clearTimeout(tokenRetryTimeout);
      }
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [authEnabled, getSafeAccessToken, isAuthenticated, joinedTournaments, maybeShowBrowserNotification, scheduleRefreshTrackedState, shouldNotifyPlayer]);
};

export default useMatchStartedNotifications;
