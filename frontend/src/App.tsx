import TournamentList from "./components/TournamentList";
import RegistrationPlayers from "./components/RegistrationPlayers";
import PlayersView from "./components/PlayersView";
import LiveTournament from "./components/LiveTournament";
import TargetsView from "./components/TargetsView";
import { useI18n } from './i18n';

function App() {
  const { lang, toggleLang, t } = useI18n();

  const view = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search).get('view')
    : null;

  let mainContent = <TournamentList />;
  if (view === 'players') {
    mainContent = <PlayersView />;
  } else if (view === 'registration-players') {
    mainContent = <RegistrationPlayers />;
  } else if (view === 'live' || view === 'pool-stages' || view === 'brackets') {
    mainContent = <LiveTournament />;
  } else if (view === 'targets') {
    mainContent = <TargetsView />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_45%),radial-gradient(circle_at_30%_20%,_rgba(99,102,241,0.18),_transparent_40%)]" />

      <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <a
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900 font-semibold"
                href="/"
                aria-label="Darts Hub home"
              >
                🎯
              </a>
              <a className="text-sm font-semibold tracking-wide hover:text-white" href="/">
                {t('app.title')}
              </a>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-200">
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=players">
                {t('nav.players')}
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?status=DRAFT">
                {t('nav.drafts')}
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=OPEN"
              >
                {t('nav.open')}
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=SIGNATURE"
              >
                {t('nav.signature')}
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?status=LIVE">
                {t('nav.live')}
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=pool-stages">
                {t('nav.poolStagesRunning')}
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=brackets">
                {t('nav.bracketsRunning')}
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=targets">
                {t('nav.targets')}
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=FINISHED"
              >
                {t('nav.finished')}
              </a>
            </nav>

            <div className="ml-auto" />
            <button
              onClick={toggleLang}
              className="rounded-md px-2 py-1 hover:bg-slate-800"
              aria-label="Toggle language"
              title={lang === 'en' ? 'Français' : 'English'}
            >
              {lang === 'en' ? '🇫🇷' : '🇬🇧'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
          {mainContent}
        </section>
      </main>
    </div>
  );
}

export default App;
