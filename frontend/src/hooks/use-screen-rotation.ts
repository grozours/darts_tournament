import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchLiveTournamentSummary } from '../services/tournament-service';

type LiveViewPoolStageSummary = {
  id: string;
  status?: string;
  pools?: Array<{ assignments?: Array<{ player?: { id?: string } }> }>;
  poolCount?: number;
};

type LiveViewBracketSummary = {
  id: string;
  status?: string;
  entries?: Array<{ player?: { id?: string } }>;
};

type LiveViewSummary = {
  id: string;
  poolStages?: LiveViewPoolStageSummary[];
  brackets?: LiveViewBracketSummary[];
};

type ScreenRotationItem = {
  view: 'pool-stages' | 'brackets' | 'targets';
  tournamentId?: string;
  stageId?: string;
  bracketId?: string;
};

type UseScreenRotationProperties = {
  screenMode: boolean;
  tournamentId: string | undefined;
  stageId: string | undefined;
  bracketId: string | undefined;
  view: string | undefined;
  status: string | undefined;
  authEnabled: boolean;
  isAuthenticated: boolean;
  getAccessTokenSilently: () => Promise<string>;
};

const loadLiveView = async (tournamentId: string): Promise<LiveViewSummary | undefined> => {
  const response = await fetch(`/api/tournaments/${tournamentId}/live`);
  if (!response.ok) {
    return undefined;
  }
  return response.json();
};

const isLivePoolStage = (stage: LiveViewPoolStageSummary) => (
  stage.status === 'IN_PROGRESS'
  && ((stage.pools?.length ?? stage.poolCount ?? 0) > 0)
  && (stage.pools || []).some((pool) => (pool.assignments || []).some((assignment) => Boolean(assignment?.player?.id)))
);

const isLiveBracket = (bracket: LiveViewBracketSummary) => (
  bracket.status === 'IN_PROGRESS'
  && (bracket.entries || []).some((entry) => Boolean(entry?.player?.id))
);

const toRotationItems = (data: LiveViewSummary, fallbackTournamentId?: string): ScreenRotationItem[] => {
  const resolvedTournamentId = fallbackTournamentId || data.id;
  const poolStageItems = (data.poolStages || [])
    .filter(isLivePoolStage)
    .map((stage) => ({
      view: 'pool-stages' as const,
      tournamentId: resolvedTournamentId,
      stageId: stage.id,
    }));
  const bracketItems = (data.brackets || [])
    .filter(isLiveBracket)
    .map((bracket) => ({
      view: 'brackets' as const,
      tournamentId: resolvedTournamentId,
      bracketId: bracket.id,
    }));

  return [...poolStageItems, ...bracketItems];
};

const resolveScreenRotationItems = async (tournamentId?: string): Promise<ScreenRotationItem[] | undefined> => {
  if (tournamentId) {
    const data = await loadLiveView(tournamentId);
    if (!data) {
      return undefined;
    }
    const items = toRotationItems(data, tournamentId);
    return [...items, { view: 'targets', tournamentId }];
  }

  const tournaments = await fetchLiveTournamentSummary(['LIVE']) as LiveViewSummary[];
  const items: ScreenRotationItem[] = [];
  for (const tournament of tournaments) {
    if (!tournament?.id) {
      continue;
    }
    items.push(...toRotationItems(tournament, tournament.id));
  }

  return [...items, { view: 'targets' }];
};

const resolveSocketAccessToken = async (
  authEnabled: boolean,
  isAuthenticated: boolean,
  getAccessTokenSilently: () => Promise<string>
): Promise<string | undefined> => {
  if (!authEnabled || !isAuthenticated) {
    return undefined;
  }
  try {
    return await getAccessTokenSilently();
  } catch {
    return undefined;
  }
};

const buildDefaultScreenRotationItems = (tournamentId?: string): ScreenRotationItem[] => ([
  { view: 'pool-stages', ...(tournamentId ? { tournamentId } : {}) },
  { view: 'brackets', ...(tournamentId ? { tournamentId } : {}) },
  { view: 'targets', ...(tournamentId ? { tournamentId } : {}) },
]);

const resetRotationStateForNonScreenMode = (
  setScreenRotationItems: (value: ScreenRotationItem[]) => void,
  setScreenRotationReady: (value: boolean) => void
): void => {
  setScreenRotationItems(buildDefaultScreenRotationItems());
  setScreenRotationReady(true);
};

const findCurrentScreenRotationIndex = (
  screenRotationItems: ScreenRotationItem[],
  current: {
    view: string | undefined;
    tournamentId: string | undefined;
    stageId: string | undefined;
    bracketId: string | undefined;
  }
): number => (
  screenRotationItems.findIndex((item) => {
    if (item.view !== current.view) return false;
    if ((item.tournamentId ?? '') !== (current.tournamentId ?? '')) return false;
    if ((item.stageId ?? '') !== (current.stageId ?? '')) return false;
    if ((item.bracketId ?? '') !== (current.bracketId ?? '')) return false;
    return true;
  })
);

const navigateToScreenRotationItem = (
  windowReference: Window,
  item: ScreenRotationItem,
  status: string | undefined
): void => {
  const url = new URL(windowReference.location.href);
  url.searchParams.set('view', item.view);
  url.searchParams.set('screen', '1');
  if (item.tournamentId) {
    url.searchParams.set('tournamentId', item.tournamentId);
  } else {
    url.searchParams.delete('tournamentId');
  }
  if (item.stageId) {
    url.searchParams.set('stageId', item.stageId);
  } else {
    url.searchParams.delete('stageId');
  }
  if (item.bracketId) {
    url.searchParams.set('bracketId', item.bracketId);
  } else {
    url.searchParams.delete('bracketId');
  }
  if (status) {
    url.searchParams.set('status', status);
  } else {
    url.searchParams.delete('status');
  }
  windowReference.location.assign(`${url.pathname}${url.search}`);
};

const openScreenRotationSocket = async (
  tournamentId: string,
  authEnabled: boolean,
  isAuthenticated: boolean,
  getAccessTokenSilently: () => Promise<string>,
  resolveScreenViews: () => Promise<void>,
  isDisposed: () => boolean,
  setSocket: (nextSocket: ReturnType<typeof io>) => void
): Promise<void> => {
  const token = await resolveSocketAccessToken(authEnabled, isAuthenticated, getAccessTokenSilently);
  if (isDisposed()) {
    return;
  }

  const nextSocket = io(globalThis.window?.location.origin ?? '', {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    ...(token ? { auth: { token } } : {}),
  });
  setSocket(nextSocket);

  nextSocket.on('connect', () => {
    nextSocket.emit('join-tournament', tournamentId);
  });

  nextSocket.on('match:finished', (payload: { match?: { source?: string } }) => {
    if (payload?.match?.source === 'bracket') {
      void resolveScreenViews();
    }
  });
};

const useScreenRotation = ({
  screenMode,
  tournamentId,
  stageId,
  bracketId,
  view,
  status,
  authEnabled,
  isAuthenticated,
  getAccessTokenSilently,
}: UseScreenRotationProperties) => {
  const [screenRotationItems, setScreenRotationItems] = useState<ScreenRotationItem[]>(
    buildDefaultScreenRotationItems(tournamentId)
  );
  const [screenRotationReady, setScreenRotationReady] = useState(!screenMode);

  const resolveScreenViews = useCallback(async () => {
    if (!screenMode) {
      return;
    }
    try {
      const items = await resolveScreenRotationItems(tournamentId ?? undefined);
      if (!items || items.length === 0) {
        setScreenRotationReady(true);
        return;
      }
      setScreenRotationItems(items);
    } catch {
      void 0;
    } finally {
      setScreenRotationReady(true);
    }
  }, [screenMode, tournamentId]);

  useEffect(() => {
    if (!screenMode) {
      resetRotationStateForNonScreenMode(setScreenRotationItems, setScreenRotationReady);
      return undefined;
    }
    setScreenRotationReady(false);
    void resolveScreenViews();
    const intervalId = globalThis.window?.setInterval(resolveScreenViews, 300_000);
    return () => {
      if (intervalId) {
        globalThis.window?.clearInterval(intervalId);
      }
    };
  }, [screenMode, resolveScreenViews]);

  useEffect(() => {
    if (!screenMode || !tournamentId) {
      return undefined;
    }

    let isDisposed = false;
    let socket: ReturnType<typeof io> | undefined;

    void openScreenRotationSocket(
      tournamentId,
      authEnabled,
      isAuthenticated,
      getAccessTokenSilently,
      resolveScreenViews,
      () => isDisposed,
      (nextSocket) => {
        socket = nextSocket;
      }
    );

    return () => {
      isDisposed = true;
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [authEnabled, getAccessTokenSilently, isAuthenticated, screenMode, tournamentId, resolveScreenViews]);

  useEffect(() => {
    if (!screenMode) {
      return undefined;
    }
    if (!screenRotationReady) {
      return undefined;
    }
    if (screenRotationItems.length === 0) {
      return undefined;
    }
    const windowReference = globalThis.window;
    if (!windowReference) {
      return undefined;
    }

    const currentIndex = findCurrentScreenRotationIndex(screenRotationItems, {
      view,
      tournamentId,
      stageId,
      bracketId,
    });
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % screenRotationItems.length;
    const nextItem = screenRotationItems[nextIndex] ?? { view: 'targets' as const };
    const delayMs = 10_000;

    const timeoutId = windowReference.setTimeout(() => {
      navigateToScreenRotationItem(windowReference, nextItem, status);
    }, delayMs);

    return () => {
      windowReference.clearTimeout(timeoutId);
    };
  }, [bracketId, screenMode, screenRotationItems, screenRotationReady, stageId, status, tournamentId, view]);
};

export default useScreenRotation;
