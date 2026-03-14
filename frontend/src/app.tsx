import { Suspense, lazy, useEffect, useState } from 'react';
import type { JSX as ReactJSX } from 'react';
import { fetchMatchFormatPresets } from './services/tournament-service';
import { setMatchFormatPresets } from './utils/match-format-presets';
import useMatchStartedNotifications from "./components/notifications/use-match-started-notifications";
import { useI18n } from './i18n';
import { useOptionalAuth } from './auth/optional-auth';
import { useAdminStatus } from './auth/use-admin-status';
import useScreenRotation from './hooks/use-screen-rotation';
const AppHeader = lazy(() => import('./components/app-header'));

const TournamentList = lazy(() => import('./components/tournament-list'));
const RegistrationPlayers = lazy(() => import('./components/registration-players'));
const PlayersView = lazy(() => import('./components/players-view'));
const LiveTournament = lazy(() => import('./components/live-tournament-page'));
const TargetsView = lazy(() => import('./components/targets-view'));
const NotificationsView = lazy(() => import('./components/notifications-view'));
const CreateTournamentPage = lazy(() => import('./components/tournaments/create-tournament-page'));
const AccountView = lazy(() => import('./components/account-view'));
const UserAccountsView = lazy(() => import('./components/user-accounts-view'));
const TournamentPlayersView = lazy(() => import('./components/tournament-players-view'));
const TournamentPresetsView = lazy(() => import('./components/tournament-presets-view'));
const MatchFormatsView = lazy(() => import('./components/match-formats-view'));
const DoublettesView = lazy(() => import('./components/doublettes-view'));
const EquipesView = lazy(() => import('./components/equipes-view'));
const DocsView = lazy(() => import('./components/docs-view'));
const OpenSourceView = lazy(() => import('./components/open-source-view'));
const TournamentSnapshotsView = lazy(() => import('./components/tournament-snapshots-view'));


const renderAdminOnly = (isAdmin: boolean, t: (key: string) => string, content: ReactJSX.Element) => (
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
  isAuthenticated: boolean,
  docsAccountTypeOverride: 'anonymous' | 'player' | 'admin' | undefined,
  t: (key: string) => string
): ReactJSX.Element => {
  let docsAccountType: 'anonymous' | 'player' | 'admin' = 'anonymous';
  if (isAdmin) {
    docsAccountType = 'admin';
  } else if (isAuthenticated) {
    docsAccountType = 'player';
  }

  switch (view) {
    case 'single': {
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
    case 'tournament-snapshots': {
      return renderAdminOnly(isAdmin, t, <TournamentSnapshotsView />);
    }
    case 'doublettes': {
      return <DoublettesView />;
    }
    case 'equipes': {
      return <EquipesView />;
    }
    case 'account': {
      return <AccountView />;
    }
    case 'user-accounts': {
      return renderAdminOnly(isAdmin, t, <UserAccountsView />);
    }
    case 'doc': {
      return <DocsView accountType={docsAccountTypeOverride ?? docsAccountType} />;
    }
    case 'github':
    case 'open-source': {
      return <OpenSourceView />;
    }
    default: {
      if (normalizedStatus === 'live') {
        return <LiveTournament />;
      }
      return <TournamentList />;
    }
  }
};

type AppRouteState = {
  view: string | undefined;
  status: string | undefined;
  normalizedStatus: string | undefined;
  tournamentId: string | undefined;
  stageId: string | undefined;
  bracketId: string | undefined;
  screenMode: boolean;
  debugEnabled: boolean;
  docsAccountTypeOverride: 'anonymous' | 'player' | 'admin' | undefined;
};

const parseAppRouteState = (locationSearch: string): AppRouteState => {
  const parameters = new URLSearchParams(locationSearch);
  const view = parameters.get('view') ?? undefined;
  const status = parameters.get('status') ?? undefined;
  const screenParam = parameters.get('screen') ?? undefined;
  const docsProfileParam = parameters.get('docProfile') ?? undefined;

  return {
    view,
    status,
    normalizedStatus: status?.toLowerCase(),
    tournamentId: parameters.get('tournamentId') ?? undefined,
    stageId: parameters.get('stageId') ?? undefined,
    bracketId: parameters.get('bracketId') ?? undefined,
    screenMode: screenParam === '1' || screenParam === 'true' || screenParam === 'screen',
    debugEnabled: parameters.get('debug') === '1',
    docsAccountTypeOverride:
      docsProfileParam === 'admin' || docsProfileParam === 'player' || docsProfileParam === 'anonymous'
        ? docsProfileParam
        : undefined,
  };
};

const deriveHeaderAuthState = (
  screenMode: boolean,
  isAdmin: boolean,
  isAuthenticated: boolean,
  adminUserId: string | undefined
): {
  headerIsAdmin: boolean;
  headerIsAuthenticated: boolean;
  docsIsAuthenticated: boolean;
} => {
  const headerIsAdmin = screenMode ? false : isAdmin;
  const headerIsAuthenticated = screenMode ? false : isAuthenticated;
  const docsHasSession = isAuthenticated || Boolean(adminUserId);
  const docsIsAuthenticated = screenMode ? false : docsHasSession;

  return {
    headerIsAdmin,
    headerIsAuthenticated,
    docsIsAuthenticated,
  };
};

function App() {
  const { lang, setLanguage, t } = useI18n();
  const { enabled: authEnabled, isAuthenticated, getAccessTokenSilently } = useOptionalAuth();
  const { isAdmin, adminUser } = useAdminStatus();

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

  const [locationSearch, setLocationSearch] = useState(
    globalThis.window?.location.search ?? ''
  );

  useEffect(() => {
    if (!globalThis.window || !globalThis.document) {
      return undefined;
    }

    const updateLocationSearch = () => {
      setLocationSearch(globalThis.window?.location.search ?? '');
    };

    globalThis.window.addEventListener('popstate', updateLocationSearch);

    return () => {
      globalThis.window?.removeEventListener('popstate', updateLocationSearch);
    };
  }, []);

  const {
    view,
    status,
    normalizedStatus,
    tournamentId,
    stageId,
    bracketId,
    screenMode,
    debugEnabled,
    docsAccountTypeOverride,
  } = parseAppRouteState(locationSearch);
  const {
    headerIsAdmin,
    headerIsAuthenticated,
    docsIsAuthenticated,
  } = deriveHeaderAuthState(screenMode, isAdmin, isAuthenticated, adminUser?.id);
  const buildId = import.meta.env.VITE_BUILD_ID
    || import.meta.env.VITE_COMMIT_SHA
    || import.meta.env.VITE_APP_VERSION
    || 'local';

  const mainContent = resolveMainContent(
    view,
    normalizedStatus,
    headerIsAdmin,
    docsIsAuthenticated,
    docsAccountTypeOverride,
    t
  );

  useScreenRotation({
    screenMode,
    tournamentId,
    stageId,
    bracketId,
    view,
    status,
    authEnabled,
    isAuthenticated,
    getAccessTokenSilently: async () => getAccessTokenSilently(),
  });


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
        <Suspense fallback={<div className="h-[74px]" />}>
          <AppHeader
            t={t}
            isAdmin={headerIsAdmin}
            isAuthenticated={headerIsAuthenticated}
            lang={lang}
            setLanguage={setLanguage}
          />
        </Suspense>
      )}

      <main className={screenMode
        ? 'mx-auto flex w-full max-w-[1800px] justify-center px-4 py-6'
        : 'max-w-6xl mx-auto px-6 py-16'}>
        <section className={screenMode
          ? 'w-full rounded-3xl border border-slate-800/40 bg-slate-900/30 p-4'
          : 'rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8'}>
          <Suspense fallback={<div className="text-center text-slate-300">Loading...</div>}>
            {mainContent}
          </Suspense>
        </section>
      </main>
    </div>
  );
}

export default App;
