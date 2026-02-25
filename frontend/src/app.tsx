import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import TournamentList from "./components/tournament-list";
import RegistrationPlayers from "./components/registration-players";
import PlayersView from "./components/players-view";
import LiveTournament from "./components/live-tournament";
import TargetsView from "./components/targets-view";
import NotificationsView from "./components/notifications-view";
import CreateTournamentPage from "./components/tournaments/create-tournament-page";
import AccountView from "./components/account-view";
import TournamentPlayersView from "./components/tournament-players-view";
import TournamentPresetsView from './components/tournament-presets-view';
import MatchFormatsView from './components/match-formats-view';
import { fetchMatchFormatPresets } from './services/tournament-service';
import { setMatchFormatPresets } from './utils/match-format-presets';
import useMatchStartedNotifications from "./components/notifications/use-match-started-notifications";
import { useI18n } from './i18n';
import { useOptionalAuth } from './auth/optional-auth';
import { useAdminStatus } from './auth/use-admin-status';
import AppHeader from './components/app-header';

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

  const listResponse = await fetch('/api/tournaments?status=LIVE');
  if (!listResponse.ok) {
    return undefined;
  }
  const listData = await listResponse.json();
  const tournaments = Array.isArray(listData?.tournaments) ? listData.tournaments : [];

  const items: ScreenRotationItem[] = [];
  for (const tournament of tournaments) {
    if (!tournament?.id) {
      continue;
    }
    const data = await loadLiveView(tournament.id);
    if (!data) {
      continue;
    }
    items.push(...toRotationItems(data, tournament.id));
  }

  return [...items, { view: 'targets' }];
};

const renderAdminOnly = (isAdmin: boolean, t: (key: string) => string, content: JSX.Element) => (
  isAdmin
    ? content
    : (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-center text-slate-200">
        {t('auth.adminOnly')}
      </div>
    )
);

const resolveMainContent = (
  view: string | undefined,
  normalizedStatus: string | undefined,
  isAdmin: boolean,
  t: (key: string) => string
): JSX.Element => {
  switch (view) {
    case 'players': {
      return renderAdminOnly(isAdmin, t, <PlayersView />);
    }
    case 'registration-players': {
      return <RegistrationPlayers />;
    }
    case 'tournament-players': {
      return <TournamentPlayersView />;
    }
    case 'live':
    case 'pool-stages':
    case 'brackets': {
      return <LiveTournament />;
    }
    case 'targets': {
      return <TargetsView />;
    }
    case 'notifications': {
      return <NotificationsView />;
    }
    case 'create-tournament': {
      return <CreateTournamentPage />;
    }
    case 'tournament-presets': {
      return renderAdminOnly(isAdmin, t, <TournamentPresetsView mode="list" />);
    }
    case 'tournament-preset-editor': {
      return renderAdminOnly(isAdmin, t, <TournamentPresetsView mode="editor" />);
    }
    case 'match-formats': {
      return <MatchFormatsView />;
    }
    case 'account': {
      return <AccountView />;
    }
    default: {
      if (normalizedStatus === 'live') {
        return <LiveTournament />;
      }
      return <TournamentList />;
    }
  }
};

function App() {
  const { lang, toggleLang, t } = useI18n();
  const { isAuthenticated } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  useMatchStartedNotifications();

  useEffect(() => {
    const loadMatchFormatPresets = async () => {
      try {
        const presets = await fetchMatchFormatPresets();
        const mapped = presets.map((preset) => ({
          key: preset.key,
          durationMinutes: preset.durationMinutes,
          segments: preset.segments,
        }));
        setMatchFormatPresets(mapped);
      } catch {
        setMatchFormatPresets([]);
      }
    };

    void loadMatchFormatPresets();
  }, []);

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const view = parameters.get('view') ?? undefined;
  const status = parameters.get('status') ?? undefined;
  const tournamentId = parameters.get('tournamentId') ?? undefined;
  const stageId = parameters.get('stageId') ?? undefined;
  const bracketId = parameters.get('bracketId') ?? undefined;
  const screenParam = parameters.get('screen') ?? undefined;
  const screenMode = screenParam === '1' || screenParam === 'true' || screenParam === 'screen';
  const normalizedStatus = status?.toLowerCase();
  const headerIsAdmin = screenMode ? false : isAdmin;
  const headerIsAuthenticated = screenMode ? false : isAuthenticated;
  const debugEnabled = parameters.get('debug') === '1';
  const buildId = import.meta.env.VITE_BUILD_ID
    || import.meta.env.VITE_COMMIT_SHA
    || import.meta.env.VITE_APP_VERSION
    || 'local';

  const mainContent = resolveMainContent(view, normalizedStatus, isAdmin, t);

  const [screenRotationItems, setScreenRotationItems] = useState<ScreenRotationItem[]>([
    { view: 'pool-stages', ...(tournamentId ? { tournamentId } : {}) },
    { view: 'brackets', ...(tournamentId ? { tournamentId } : {}) },
    { view: 'targets', ...(tournamentId ? { tournamentId } : {}) },
  ]);
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
    } catch (error) {
      console.warn('Failed to resolve screen rotation views:', error);
    } finally {
      setScreenRotationReady(true);
    }
  }, [screenMode, tournamentId]);

  useEffect(() => {
    if (!screenMode) {
      setScreenRotationItems([
        { view: 'pool-stages' },
        { view: 'brackets' },
        { view: 'targets' },
      ]);
      setScreenRotationReady(true);
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

    const socket = io(globalThis.window?.location.origin ?? '', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      socket.emit('join-tournament', tournamentId);
    });

    socket.on('match:finished', (payload: { match?: { source?: string } }) => {
      if (payload?.match?.source === 'bracket') {
        void resolveScreenViews();
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [screenMode, tournamentId, resolveScreenViews]);

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

    const currentIndex = screenRotationItems.findIndex((item) => {
      if (item.view !== view) return false;
      if ((item.tournamentId ?? '') !== (tournamentId ?? '')) return false;
      if ((item.stageId ?? '') !== (stageId ?? '')) return false;
      if ((item.bracketId ?? '') !== (bracketId ?? '')) return false;
      return true;
    });
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % screenRotationItems.length;
    const nextItem = screenRotationItems[nextIndex] ?? { view: 'targets' as const };
    const delayMs = 10_000;

    const timeoutId = windowReference.setTimeout(() => {
      const url = new URL(windowReference.location.href);
      url.searchParams.set('view', nextItem.view);
      url.searchParams.set('screen', '1');
      if (nextItem.tournamentId) {
        url.searchParams.set('tournamentId', nextItem.tournamentId);
      } else {
        url.searchParams.delete('tournamentId');
      }
      if (nextItem.stageId) {
        url.searchParams.set('stageId', nextItem.stageId);
      } else {
        url.searchParams.delete('stageId');
      }
      if (nextItem.bracketId) {
        url.searchParams.set('bracketId', nextItem.bracketId);
      } else {
        url.searchParams.delete('bracketId');
      }
      if (status) {
        url.searchParams.set('status', status);
      } else {
        url.searchParams.delete('status');
      }
      windowReference.location.assign(`${url.pathname}${url.search}`);
    }, delayMs);

    return () => {
      windowReference.clearTimeout(timeoutId);
    };
  }, [bracketId, screenMode, screenRotationItems, screenRotationReady, stageId, status, tournamentId, view]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_45%),radial-gradient(circle_at_30%_20%,_rgba(99,102,241,0.18),_transparent_40%)]" />

      {debugEnabled && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-xs text-amber-100">
          <div>Debug: view={view ?? 'none'} status={status ?? 'none'} build={buildId}</div>
          <div>search: {globalThis.window?.location.search ?? ''}</div>
        </div>
      )}

      {!screenMode && (
        <AppHeader
          t={t}
          isAdmin={headerIsAdmin}
          isAuthenticated={headerIsAuthenticated}
          lang={lang}
          toggleLang={toggleLang}
        />
      )}

      <main className={screenMode
        ? 'mx-auto flex w-full max-w-[1800px] justify-center px-4 py-6'
        : 'max-w-6xl mx-auto px-6 py-16'}>
        <section className={screenMode
          ? 'w-full rounded-3xl border border-slate-800/40 bg-slate-900/30 p-4'
          : 'rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8'}>
          {mainContent}
        </section>
      </main>
    </div>
  );
}

export default App;
