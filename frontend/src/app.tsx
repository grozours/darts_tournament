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
import useMatchStartedNotifications from "./components/notifications/use-match-started-notifications";
import { useI18n } from './i18n';
import { useOptionalAuth } from './auth/optional-auth';
import { useAdminStatus } from './auth/use-admin-status';
import AppHeader from './components/app-header';

type LiveViewPoolStageSummary = {
  pools?: Array<{ assignments?: Array<{ player?: { id?: string } }> }>;
};

type LiveViewBracketSummary = {
  entries?: Array<{ player?: { id?: string } }>;
};

type LiveViewSummary = {
  poolStages?: LiveViewPoolStageSummary[];
  brackets?: LiveViewBracketSummary[];
};

type ScreenViewFlags = {
  hasPoolPlayers: boolean;
  hasBracketPlayers: boolean;
};

const hasPoolPlayers = (data: LiveViewSummary): boolean =>
  (data.poolStages || []).some((stage) =>
    (stage.pools || []).some((pool) =>
      (pool.assignments || []).some((assignment) => Boolean(assignment?.player?.id))
    )
  );

const hasBracketPlayers = (data: LiveViewSummary): boolean =>
  (data.brackets || []).some((bracket) =>
    (bracket.entries || []).some((entry) => Boolean(entry?.player?.id))
  );

const loadLiveView = async (tournamentId: string): Promise<LiveViewSummary | undefined> => {
  const response = await fetch(`/api/tournaments/${tournamentId}/live`);
  if (!response.ok) {
    return undefined;
  }
  return response.json();
};

const resolveScreenViewFlags = async (tournamentId?: string): Promise<ScreenViewFlags | undefined> => {
  if (tournamentId) {
    const data = await loadLiveView(tournamentId);
    if (!data) {
      return undefined;
    }
    return {
      hasPoolPlayers: hasPoolPlayers(data),
      hasBracketPlayers: hasBracketPlayers(data),
    };
  }

  const listResponse = await fetch('/api/tournaments?status=LIVE');
  if (!listResponse.ok) {
    return undefined;
  }
  const listData = await listResponse.json();
  const tournaments = Array.isArray(listData?.tournaments) ? listData.tournaments : [];

  let hasPools = false;
  let hasBrackets = false;
  for (const tournament of tournaments) {
    if (!tournament?.id) {
      continue;
    }
    const data = await loadLiveView(tournament.id);
    if (!data) {
      continue;
    }
    hasPools = hasPools || hasPoolPlayers(data);
    hasBrackets = hasBrackets || hasBracketPlayers(data);
    if (hasPools && hasBrackets) {
      break;
    }
  }

  return {
    hasPoolPlayers: hasPools,
    hasBracketPlayers: hasBrackets,
  };
};

const resolveScreenViewsFromFlags = ({ hasPoolPlayers, hasBracketPlayers }: ScreenViewFlags) => {
  const nextViews: Array<'pool-stages' | 'brackets' | 'targets'> = [];
  if (hasPoolPlayers) nextViews.push('pool-stages');
  if (hasBracketPlayers) nextViews.push('brackets');
  nextViews.push('targets');
  return nextViews.length > 0 ? nextViews : ['targets'];
};

function App() {
  const { lang, toggleLang, t } = useI18n();
  const { isAuthenticated } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  useMatchStartedNotifications();

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const view = parameters.get('view');
  const status = parameters.get('status');
  const tournamentId = parameters.get('tournamentId');
  const screenParam = parameters.get('screen');
  const screenMode = screenParam === '1' || screenParam === 'true' || screenParam === 'screen';
  const normalizedStatus = status?.toLowerCase();
  const headerIsAdmin = screenMode ? false : isAdmin;
  const headerIsAuthenticated = screenMode ? false : isAuthenticated;
  const debugEnabled = parameters.get('debug') === '1';
  const buildId = import.meta.env.VITE_BUILD_ID
    || import.meta.env.VITE_COMMIT_SHA
    || import.meta.env.VITE_APP_VERSION
    || 'local';

  let mainContent = <TournamentList />;
  switch (view) {
    case 'players': {
      mainContent = isAdmin
        ? <PlayersView />
        : (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-center text-slate-200">
            {t('auth.adminOnly')}
          </div>
        );
      break;
    }
    case 'registration-players': {
      mainContent = <RegistrationPlayers />;
      break;
    }
    case 'tournament-players': {
      mainContent = <TournamentPlayersView />;
      break;
    }
    case 'live':
    case 'pool-stages':
    case 'brackets': {
      mainContent = <LiveTournament />;
      break;
    }
    case 'targets': {
      mainContent = <TargetsView />;
      break;
    }
    case 'notifications': {
      mainContent = <NotificationsView />;
      break;
    }
    case 'create-tournament': {
      mainContent = <CreateTournamentPage />;
      break;
    }
    case 'account': {
      mainContent = <AccountView />;
      break;
    }
    default: {
      if (normalizedStatus === 'live') {
        mainContent = <LiveTournament />;
      }
    }
  }

  const [screenViews, setScreenViews] = useState<Array<'pool-stages' | 'brackets' | 'targets'>>(
    ['pool-stages', 'brackets', 'targets']
  );

  const resolveScreenViews = useCallback(async () => {
    if (!screenMode) {
      return;
    }
    try {
      const flags = await resolveScreenViewFlags(tournamentId);
      if (!flags) {
        return;
      }
      setScreenViews(resolveScreenViewsFromFlags(flags));
    } catch (error) {
      console.warn('Failed to resolve screen rotation views:', error);
    }
  }, [screenMode, tournamentId]);

  useEffect(() => {
    if (!screenMode) {
      setScreenViews(['pool-stages', 'brackets', 'targets']);
      return undefined;
    }
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
    if (screenViews.length === 0) {
      return undefined;
    }
    const windowReference = globalThis.window;
    if (!windowReference) {
      return undefined;
    }

    const currentIndex = view ? screenViews.indexOf(view as (typeof screenViews)[number]) : -1;
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % screenViews.length;
    const nextView = screenViews[nextIndex];
    const delayMs = currentIndex === -1 ? 0 : 10_000;

    const timeoutId = windowReference.setTimeout(() => {
      const url = new URL(windowReference.location.href);
      url.searchParams.set('view', nextView);
      url.searchParams.set('screen', '1');
      if (tournamentId) {
        url.searchParams.set('tournamentId', tournamentId);
      } else {
        url.searchParams.delete('tournamentId');
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
  }, [screenMode, screenViews, status, tournamentId, view]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_45%),radial-gradient(circle_at_30%_20%,_rgba(99,102,241,0.18),_transparent_40%)]" />

      {debugEnabled && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-xs text-amber-100">
          <div>Debug: view={view ?? 'none'} status={status ?? 'none'} build={buildId}</div>
          <div>search: {globalThis.window?.location.search ?? ''}</div>
        </div>
      )}

      <AppHeader
        t={t}
        isAdmin={headerIsAdmin}
        isAuthenticated={headerIsAuthenticated}
        lang={lang}
        toggleLang={toggleLang}
      />

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
          {mainContent}
        </section>
      </main>
    </div>
  );
}

export default App;
