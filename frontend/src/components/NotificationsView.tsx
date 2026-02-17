import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import SignInPanel from '../auth/SignInPanel';
import { useOptionalAuth } from '../auth/optionalAuth';
import { useI18n } from '../i18n';

type MatchStartedPayload = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  startedAt?: string;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string | null;
  };
  match: {
    source: 'pool' | 'bracket';
    matchNumber: number;
    roundNumber?: number | null;
    stageNumber?: number;
    poolNumber?: number;
    bracketName?: string | null;
  };
  players: Array<{
    id?: string;
    firstName?: string;
    lastName?: string;
    surname?: string;
    teamName?: string;
  }>;
};

type NotificationItem = {
  id: string;
  receivedAt: string;
  payload: MatchStartedPayload;
};

const STORAGE_KEY = 'notifications:match-started';
const STORAGE_LIMIT = 50;

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

const formatTargetLabel = (payload: MatchStartedPayload) => {
  const target = payload.target;
  if (!target) return '';
  return target.targetCode || target.name || `#${target.targetNumber}`;
};

function NotificationsView() {
  const { t } = useI18n();
  const { enabled: authEnabled, isAuthenticated, isLoading, getAccessTokenSilently } = useOptionalAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const playerIdsRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<'default' | 'granted' | 'denied' | 'unsupported'>('default');

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (err) {
      console.warn('Failed to get access token, proceeding without auth:', err);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const buildMatchLabel = useCallback(
    (payload: MatchStartedPayload) => {
      if (payload.match.source === 'pool') {
        const stage = payload.match.stageNumber ?? '-';
        const pool = payload.match.poolNumber ?? '-';
        return `${t('live.queue.stageLabel')} ${stage} · ${t('live.queue.poolLabel')} ${pool} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
      }
      return `${t('targets.bracketLabel')} ${payload.match.bracketName ?? ''} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
    },
    [t]
  );

  const shouldNotify = useCallback((payload: MatchStartedPayload) => {
    if (playerIdsRef.current.size === 0) {
      return false;
    }
    return payload.players.some((player) => player.id && playerIdsRef.current.has(player.id));
  }, []);

  const requestBrowserNotifications = useCallback(async () => {
    if (!('Notification' in globalThis.window)) {
      setNotificationPermission('unsupported');
      permissionRef.current = 'unsupported';
      return;
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      setNotificationPermission(Notification.permission);
      permissionRef.current = Notification.permission;
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      permissionRef.current = result;
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
    }
  }, []);

  useEffect(() => {
    const stored = globalThis.window?.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as NotificationItem[];
      if (Array.isArray(parsed)) {
        setNotifications(parsed);
      }
    } catch (err) {
      console.warn('Failed to parse stored notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (!('Notification' in globalThis.window)) {
      setNotificationPermission('unsupported');
      permissionRef.current = 'unsupported';
      return;
    }
    setNotificationPermission(Notification.permission);
    permissionRef.current = Notification.permission;
  }, []);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    let isMounted = true;

    const fetchPlayerIds = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getSafeAccessToken();
        if (!token) {
          throw new Error(t('notifications.authRequired'));
        }

        const meResponse = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meResponse.ok) {
          throw new Error(t('notifications.authRequired'));
        }
        const meData = await meResponse.json();
        const email = (meData?.user?.email as string | undefined)?.toLowerCase();
        if (!email) {
          throw new Error(t('notifications.emailMissing'));
        }

        const tournamentsResponse = await fetch('/api/tournaments?status=LIVE', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tournamentsResponse.ok) {
          throw new Error(t('notifications.loadFailed'));
        }
        const tournamentsData = await tournamentsResponse.json();
        const tournaments: TournamentSummary[] = Array.isArray(tournamentsData?.tournaments)
          ? tournamentsData.tournaments
          : [];

        const playerIds = new Set<string>();
        const tournamentsToJoin: string[] = [];

        await Promise.all(
          tournaments.map(async (tournament) => {
            const playersResponse = await fetch(`/api/tournaments/${tournament.id}/players`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!playersResponse.ok) {
              return;
            }
            const playersData = (await playersResponse.json()) as TournamentPlayersResponse;
            const matched = (playersData.players ?? []).find((player) =>
              (player.email ?? '').toLowerCase() === email
            );
            if (matched?.playerId) {
              playerIds.add(matched.playerId);
              tournamentsToJoin.push(tournament.id);
            }
          })
        );

        if (!isMounted) {
          return;
        }

        playerIdsRef.current = playerIds;
        setJoinedTournaments(tournamentsToJoin);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof Error ? err.message : t('notifications.loadFailed'));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchPlayerIds();

    return () => {
      isMounted = false;
    };
  }, [authEnabled, isAuthenticated, getSafeAccessToken, t]);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    if (joinedTournaments.length === 0) {
      return;
    }

    const socket = io(globalThis.window?.location.origin ?? '', {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      setConnected(true);
      joinedTournaments.forEach((tournamentId) => {
        socket.emit('join-tournament', tournamentId);
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('match:started', (payload: MatchStartedPayload) => {
      if (!shouldNotify(payload)) {
        return;
      }
      setNotifications((current) => {
        const next = [
          {
            id: `${payload.matchId}-${Date.now()}`,
            receivedAt: new Date().toISOString(),
            payload,
          },
          ...current,
        ].slice(0, STORAGE_LIMIT);
        try {
          globalThis.window?.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.warn('Failed to persist notifications:', err);
        }
        return next;
      });

      if (permissionRef.current === 'granted') {
        const targetLabel = formatTargetLabel(payload);
        const matchLabel = buildMatchLabel(payload);
        const title = `${t('notifications.calledToTarget')} ${targetLabel}`.trim();
        const body = `${payload.tournamentName} · ${matchLabel}`;
        try {
          new Notification(title, { body });
        } catch (err) {
          console.warn('Failed to show notification:', err);
        }
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [authEnabled, isAuthenticated, joinedTournaments, shouldNotify]);

  if (!authEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        {t('notifications.authDisabled')}
      </div>
    );
  }

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="space-y-6">
        <SignInPanel />
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('notifications.signInPrompt')}
        </div>
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
        <span className="ml-3 text-slate-300">{t('notifications.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">{error}</div>
        <button
          onClick={() => globalThis.window?.location.reload()}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  const statusLabel = connected ? t('notifications.connected') : t('notifications.disconnected');
  const canRequestPermission = notificationPermission === 'default';
  const isPermissionDenied = notificationPermission === 'denied';
  const isPermissionUnsupported = notificationPermission === 'unsupported';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('notifications.title')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">{t('notifications.subtitle')}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          connected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'
        }`}>
          {statusLabel}
        </span>
      </div>

      {(canRequestPermission || isPermissionDenied || isPermissionUnsupported) && (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{t('notifications.permissionTitle')}</p>
              <p className="mt-1 text-xs text-slate-400">
                {isPermissionUnsupported
                  ? t('notifications.permissionUnsupported')
                  : isPermissionDenied
                    ? t('notifications.permissionDenied')
                    : t('notifications.permissionPrompt')}
              </p>
            </div>
            {canRequestPermission && (
              <button
                onClick={requestBrowserNotifications}
                className="rounded-full border border-cyan-500/60 px-4 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300"
              >
                {t('notifications.permissionAction')}
              </button>
            )}
          </div>
        </div>
      )}

      {joinedTournaments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('notifications.noTournaments')}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('notifications.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((item) => {
            const label = buildMatchLabel(item.payload);
            const targetLabel = formatTargetLabel(item.payload);
            const players = item.payload.players
              .map((player) => player.teamName || player.surname || `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim())
              .filter(Boolean);
            return (
              <div key={item.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">{item.payload.tournamentName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(item.receivedAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {t('notifications.calledToTarget')} {targetLabel}
                </div>
                <div className="mt-2 text-sm text-slate-300">{label}</div>
                {players.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    {players.map((player) => (
                      <span key={player} className="rounded-full border border-slate-700 px-3 py-1">
                        {player}
                      </span>
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
}

export default NotificationsView;
