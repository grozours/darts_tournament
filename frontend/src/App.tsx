import { useOptionalAuth } from "./auth/optionalAuth";
import TournamentList from "./components/TournamentList";
import RegistrationPlayers from "./components/RegistrationPlayers";
import LiveTournament from "./components/LiveTournament";

function App() {
  const {
    enabled: authEnabled,
    isAuthenticated,
  } = useOptionalAuth();

  const view = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('view')
    : null;

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
                Darts Hub
              </a>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-200">
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=players">
                Registration players
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?status=DRAFT">
                Drafts
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=OPEN"
              >
                Open
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=SIGNATURE"
              >
                Signature
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?status=LIVE">
                Live
              </a>
              <a
                className="rounded-md px-2 py-1 hover:bg-slate-800"
                href="/?status=FINISHED"
              >
                Finished
              </a>
            </nav>

            <div className="ml-auto" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
          {view === 'players' ? (
            <RegistrationPlayers />
          ) : view === 'live' ? (
            <LiveTournament />
          ) : (
            <TournamentList />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
