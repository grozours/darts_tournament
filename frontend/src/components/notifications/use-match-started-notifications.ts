import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useI18n } from '../../i18n';
import {
  type MatchFormatChangedPayload,
  type MatchFinishedPayload,
  type MatchNotificationPayload,
  type MatchStartedPayload,
  NOTIFICATIONS_STORAGE_KEY,
  STORAGE_LIMIT,
} from './notifications-types';

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

const fetchLiveTournaments = async (token: string) => {
  const statuses = ['LIVE', 'SIGNATURE'];
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

    const scored = payload.players
      .map((player) => ({ player, score: typeof player.scoreTotal === 'number' ? player.scoreTotal : null }))
      .filter((item): item is { player: MatchNotificationPayload['players'][number]; score: number } => item.score !== null);

    if (scored.length < 2) {
      return undefined;
    }

    const winner = scored.find((item) => item.player.isWinner);
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const first = winner ?? sorted[0];
    const second = sorted.find((item) => item !== first) ?? sorted[1];
    if (!first || !second) {
      return undefined;
    }
    return `${first.score} - ${second.score}`;
  }, []);

  const maybeShowBrowserNotification = useCallback((payload: MatchNotificationPayload) => {
    if (!('Notification' in globalThis.window)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }
    const targetLabel = formatTargetLabel(payload);
    const matchLabel = buildMatchLabel(payload);
    const scoreSummary = buildScoreSummary(payload);
    let title = t('notifications.matchCancelled');
    if (payload.event === 'started') {
      title = `${t('notifications.calledToTarget')} ${targetLabel}`.trim();
    } else if (payload.event === 'completed') {
      title = t('notifications.matchCompleted');
    } else if (payload.event === 'format_changed') {
      title = t('notifications.matchFormatChanged');
    }
    const formatSuffix = payload.matchFormatKey
      ? ` · ${t('notifications.matchFormat')}: ${payload.matchFormatKey}`
      : '';
    const formatDetails = payload.matchFormatTooltip ? `\n${payload.matchFormatTooltip}` : '';
    const scoreSuffix = scoreSummary ? ` · ${t('live.finalScore')}: ${scoreSummary}` : '';
    const body = `${payload.tournamentName} · ${matchLabel}${formatSuffix}${scoreSuffix}${formatDetails}`.trim();
    try {
      new Notification(title, { body });
    } catch {
      void 0;
    }
  }, [buildMatchLabel, buildScoreSummary, formatTargetLabel, t]);

  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const playerIdsReference = useRef<Set<string>>(new Set());
  const poolKeysReference = useRef<Set<string>>(new Set());

  const shouldNotifyPlayer = useCallback((payload: MatchNotificationPayload) => {
    const playerIds = playerIdsReference.current;
    if (playerIds.size === 0) {
      return false;
    }
    if (payload.players.some((player) => player.id && playerIds.has(player.id))) {
      return true;
    }
    if (payload.match.source === 'pool' && payload.match.poolId) {
      return poolKeysReference.current.has(buildPoolKey(payload.tournamentId, payload.match.poolId));
    }
    return false;
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

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    let isMounted = true;
    const loadPlayerIds = async () => {
      try {
        const token = await getSafeAccessToken();
        if (!token) {
          return;
        }
        const email = await fetchAuthEmail(token);
        if (!email) {
          return;
        }
        const tournaments = await fetchLiveTournaments(token);
        const data = await fetchPlayerIdsForEmail(token, tournaments, email);
        const poolKeys = new Set<string>();
        for (const tournament of tournaments) {
          const stages = await fetchPoolStagesForTournament(tournament.id, token);
          for (const stage of stages) {
            const pools = await fetchPoolStagePools(tournament.id, stage.id, token);
            for (const pool of pools) {
              const hasPlayer = (pool.assignments || []).some((assignment) =>
                assignment.playerId && data.playerIds.has(assignment.playerId)
              );
              if (hasPlayer) {
                poolKeys.add(buildPoolKey(tournament.id, pool.id));
              }
            }
          }
        }

        if (!isMounted) {
          return;
        }
        playerIdsReference.current = data.playerIds;
        poolKeysReference.current = poolKeys;
        setJoinedTournaments(data.tournamentsToJoin);
      } catch {
        void 0;
      }
    };

    void loadPlayerIds();

    return () => {
      isMounted = false;
    };
  }, [authEnabled, getSafeAccessToken, isAuthenticated]);

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

    const openSocket = async () => {
      const token = await getSafeAccessToken();
      if (isDisposed) {
        return;
      }

      if (!token) {
        tokenRetryTimeout = globalThis.window?.setTimeout(() => {
          if (!isDisposed) {
            void openSocket();
          }
        }, 4_000);
        return;
      }

      socket = io(globalThis.window?.location.origin ?? '', {
        path: '/socket.io',
        transports: ['websocket'],
        withCredentials: true,
        auth: { token },
      });

      socket.on('connect', () => {
        for (const tournamentId of joinedTournaments) {
          socket?.emit('join-tournament', tournamentId);
        }
      });

      socket.on('match:started', (payload: Omit<MatchStartedPayload, 'event'>) => {
        const enriched = { ...payload, event: 'started' as const };
        if (!shouldNotifyPlayer(enriched)) {
          return;
        }
        appendNotification(enriched);
        maybeShowBrowserNotification(enriched);
      });

      socket.on('match:finished', (payload: MatchFinishedPayload) => {
        if (!shouldNotifyPlayer(payload)) {
          return;
        }
        appendNotification(payload);
        maybeShowBrowserNotification(payload);
      });

      socket.on('match:format-changed', (payload: MatchFormatChangedPayload) => {
        if (!shouldNotifyPlayer(payload)) {
          return;
        }
        appendNotification(payload);
        maybeShowBrowserNotification(payload);
      });
    };

    void openSocket();

    return () => {
      isDisposed = true;
      if (tokenRetryTimeout) {
        globalThis.window?.clearTimeout(tokenRetryTimeout);
      }
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [authEnabled, getSafeAccessToken, isAuthenticated, joinedTournaments, maybeShowBrowserNotification, shouldNotifyPlayer]);
};

export default useMatchStartedNotifications;
