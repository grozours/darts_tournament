import { useCallback, useEffect, useRef, useState } from 'react';
import SignInPanel from '../auth/sign-in-panel';
import { useOptionalAuth } from '../auth/optional-auth';
import { useI18n } from '../i18n';
import type { MatchNotificationPayload, NotificationItem } from './notifications/notifications-types';
import { NOTIFICATIONS_STORAGE_KEY } from './notifications/notifications-types';

const NOTIFICATION_PERMISSION_REQUESTED_KEY = 'notifications:permission-requested';

const hasRequestedNotificationPermission = (): boolean => {
  try {
    return globalThis.window?.localStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED_KEY) === '1';
  } catch {
    return false;
  }
};

const markNotificationPermissionAsRequested = () => {
  try {
    globalThis.window?.localStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED_KEY, '1');
  } catch {
    void 0;
  }
};

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

const formatTargetLabel = (payload: MatchNotificationPayload, t: (key: string) => string) => {
  const target = payload.target;
  if (!target) return '';
  const rawLabel = target.targetCode || target.name || `#${target.targetNumber}`;
  const match = /^target\s*(\d+)$/i.exec(rawLabel.trim());
  if (match) {
    return `${t('targets.target')} ${match[1]}`;
  }
  return rawLabel;
};

const getPlayerDisplayName = (player: MatchNotificationPayload['players'][number]) =>
  player.teamName
  || player.surname
  || `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();

const fetchAuthEmail = async (token: string, t: (key: string) => string) => {
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
  return email;
};

const fetchLiveTournaments = async (token: string, t: (key: string) => string) => {
  const statuses = ['LIVE', 'SIGNATURE'];
  const responses = await Promise.all(statuses.map((status) =>
    fetch(`/api/tournaments?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ));
  if (responses.some((response) => !response.ok)) {
    throw new Error(t('notifications.loadFailed'));
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

function NotificationsView() {
  const { t } = useI18n();
  const { enabled: authEnabled, isAuthenticated, isLoading, getAccessTokenSilently } = useOptionalAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const connected = authEnabled && isAuthenticated;
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const permissionReference = useRef<'default' | 'granted' | 'denied' | 'unsupported'>('default');

  const persistNotifications = useCallback((items: NotificationItem[]) => {
    try {
      globalThis.window?.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items));
      globalThis.window?.dispatchEvent(new Event('notifications:updated'));
    } catch {
      void 0;
    }
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

  const buildMatchLabel = useCallback(
    (payload: MatchNotificationPayload) => {
      if (payload.match.source === 'pool') {
        const stage = payload.match.stageNumber ?? '-';
        const pool = payload.match.poolNumber ?? '-';
        return `${t('live.queue.stageLabel')} ${stage} · ${t('live.queue.poolLabel')} ${pool} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
      }
      return `${t('targets.bracketLabel')} ${payload.match.bracketName ?? ''} · ${t('live.queue.matchLabel')} ${payload.match.matchNumber}`;
    },
    [t]
  );

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

  const updatePlayerIdsState = useCallback((payload: { tournamentsToJoin: string[] }) => {
    setJoinedTournaments(payload.tournamentsToJoin);
  }, []);

  const loadPlayerIds = useCallback(async (isMounted: () => boolean) => {
    setLoading(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      if (!token) {
        throw new Error(t('notifications.authRequired'));
      }

      const email = await fetchAuthEmail(token, t);
      const tournaments = await fetchLiveTournaments(token, t);
      const data = await fetchPlayerIdsForEmail(token, tournaments, email);

      if (!isMounted()) {
        return;
      }

      updatePlayerIdsState({ tournamentsToJoin: data.tournamentsToJoin });
    } catch (error) {
      if (!isMounted()) {
        return;
      }
      setError(error instanceof Error ? error.message : t('notifications.loadFailed'));
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [getSafeAccessToken, t, updatePlayerIdsState]);

  const requestBrowserNotifications = useCallback(async () => {
    markNotificationPermissionAsRequested();

    if (!('Notification' in globalThis.window)) {
      setNotificationPermission('unsupported');
      permissionReference.current = 'unsupported';
      return;
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      setNotificationPermission(Notification.permission);
      permissionReference.current = Notification.permission;
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      permissionReference.current = result;
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    const updateNotifications = () => {
      const stored = globalThis.window?.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!stored) {
        setNotifications([]);
        return;
      }
      try {
        const parsed = JSON.parse(stored) as NotificationItem[];
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      } catch {
        void 0;
      }
    };

    updateNotifications();
    globalThis.window?.addEventListener('notifications:updated', updateNotifications);
    globalThis.window?.addEventListener('storage', updateNotifications);

    return () => {
      globalThis.window?.removeEventListener('notifications:updated', updateNotifications);
      globalThis.window?.removeEventListener('storage', updateNotifications);
    };
  }, []);

  useEffect(() => {
    if (!('Notification' in globalThis.window)) {
      setNotificationPermission('unsupported');
      permissionReference.current = 'unsupported';
      return;
    }
    setNotificationPermission(Notification.permission);
    permissionReference.current = Notification.permission;
  }, []);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }
    if (!('Notification' in globalThis.window)) {
      return;
    }
    if (Notification.permission !== 'default') {
      return;
    }
    if (hasRequestedNotificationPermission()) {
      return;
    }

    const windowReference = globalThis.window;
    const triggerPermissionRequest = () => {
      void requestBrowserNotifications();
      windowReference?.removeEventListener('pointerdown', triggerPermissionRequest);
      windowReference?.removeEventListener('keydown', triggerPermissionRequest);
      windowReference?.removeEventListener('touchstart', triggerPermissionRequest);
    };

    windowReference?.addEventListener('pointerdown', triggerPermissionRequest, { once: true });
    windowReference?.addEventListener('keydown', triggerPermissionRequest, { once: true });
    windowReference?.addEventListener('touchstart', triggerPermissionRequest, { once: true });

    return () => {
      windowReference?.removeEventListener('pointerdown', triggerPermissionRequest);
      windowReference?.removeEventListener('keydown', triggerPermissionRequest);
      windowReference?.removeEventListener('touchstart', triggerPermissionRequest);
    };
  }, [authEnabled, isAuthenticated, requestBrowserNotifications]);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    let isMounted = true;
    void loadPlayerIds(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [authEnabled, isAuthenticated, loadPlayerIds]);

  useEffect(() => {
    if (!authEnabled || !isAuthenticated) {
      return;
    }

    let isMounted = true;
    void loadPlayerIds(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [authEnabled, isAuthenticated, loadPlayerIds]);

  const acknowledgeNotification = useCallback(
    (id: string) => {
      setNotifications((current) => {
        const next = current.map((item) =>
          item.id === id && !item.acknowledgedAt
            ? { ...item, acknowledgedAt: new Date().toISOString() }
            : item
        );
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
  );

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
        <SignInPanel
          title={t('auth.signInToViewLive')}
          description={t('auth.protectedContinue')}
        />
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
  let permissionMessage = t('notifications.permissionPrompt');
  if (isPermissionUnsupported) {
    permissionMessage = t('notifications.permissionUnsupported');
  } else if (isPermissionDenied) {
    permissionMessage = t('notifications.permissionDenied');
  }

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
                {permissionMessage}
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
            const targetLabel = formatTargetLabel(item.payload, t);
            const players = item.payload.players
              .map((player) => getPlayerDisplayName(player))
              .filter(Boolean);
            const isAcknowledged = Boolean(item.acknowledgedAt);
            let title = t('notifications.matchCancelled');
            if (item.payload.event === 'started') {
              title = `${t('notifications.calledToTarget')} ${targetLabel}`.trim();
            } else if (item.payload.event === 'completed') {
              title = t('notifications.matchCompleted');
            } else if (item.payload.event === 'format_changed') {
              title = t('notifications.matchFormatChanged');
            }
            const scoreSummary = buildScoreSummary(item.payload);
            return (
              <div key={item.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">{item.payload.tournamentName}</div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{new Date(item.receivedAt).toLocaleTimeString()}</span>
                    {isAcknowledged ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                        {t('notifications.acknowledged')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledgeNotification(item.id)}
                        className="rounded-full border border-cyan-500/60 px-3 py-1 text-cyan-200 transition hover:border-cyan-300"
                      >
                        {t('notifications.acknowledge')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {title}
                </div>
                <div className="mt-2 text-sm text-slate-300">{label}</div>
                {item.payload.matchFormatTooltip && (
                  <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                    <div className="text-xs uppercase tracking-widest text-cyan-200">{t('notifications.matchFormat')}</div>
                    <pre className="mt-1 whitespace-pre-line text-xs text-cyan-100">{item.payload.matchFormatTooltip}</pre>
                  </div>
                )}
                {scoreSummary && (
                  <div className="mt-2 text-sm text-slate-300">
                    {t('live.finalScore')}: {scoreSummary}
                  </div>
                )}
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
