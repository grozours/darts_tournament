import TournamentList from "./components/tournament-list";
import RegistrationPlayers from "./components/registration-players";
import PlayersView from "./components/players-view";
import LiveTournament from "./components/live-tournament";
import TargetsView from "./components/targets-view";
import NotificationsView from "./components/notifications-view";
import CreateTournamentPage from "./components/tournaments/create-tournament-page";
import AccountView from "./components/account-view";
import TournamentPlayersView from "./components/tournament-players-view";
import { useI18n } from './i18n';
import { useOptionalAuth } from './auth/optional-auth';
import { useAdminStatus } from './auth/use-admin-status';
import AppHeader from './components/app-header';

function App() {
  const { lang, toggleLang, t } = useI18n();
  const { isAuthenticated } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const view = parameters.get('view');
  const status = parameters.get('status');
  const normalizedStatus = status?.toLowerCase();
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
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
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
