import { useOptionalAuth } from "./auth/optionalAuth";
import TournamentList from "./components/TournamentList";

function App() {
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
  } = useOptionalAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_45%),radial-gradient(circle_at_30%_20%,_rgba(99,102,241,0.18),_transparent_40%)]" />

      <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900 font-semibold">
                🎯
              </span>
              <span className="text-sm font-semibold tracking-wide">Darts Hub</span>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-200">
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/api">
                API Home
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/api/tournaments">
                Tournaments
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/api/tournaments/stats">
                Stats
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/api/tournaments/date-range?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.000Z">
                Date range
              </a>
              <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/api/tournaments/check-name/demo">
                Name check
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <label className="sr-only" htmlFor="global-search">Search</label>
              <div className="hidden md:block">
                <input
                  id="global-search"
                  type="text"
                  placeholder="Search or jump to..."
                  className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              {!authEnabled ? (
                <span className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300">
                  OAuth disabled
                </span>
              ) : isLoading ? null : isAuthenticated ? (
                <div className="flex items-center gap-3">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user?.name || "User avatar"}
                      className="h-8 w-8 rounded-full border border-slate-700"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-white">
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  )}
                  <button
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:border-slate-400"
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
                    onClick={() => loginWithRedirect()}
                  >
                    Sign in
                  </button>
                  <button
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:border-slate-400"
                    onClick={() => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } })}
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
          <TournamentList />
        </section>
      </main>
    </div>
  );
}

export default App;
