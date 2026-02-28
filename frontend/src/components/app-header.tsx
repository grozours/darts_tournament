import { useEffect, useState } from 'react';
import type { useI18n } from '../i18n';

type AppHeaderProperties = {
  t: ReturnType<typeof useI18n>['t'];
  isAdmin: boolean;
  isAuthenticated: boolean;
  lang: string;
  setLanguage: (lang: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl') => void;
};

type DevAutologinMode = 'anonymous' | 'player' | 'admin';

const NOTIFICATIONS_STORAGE_KEY = 'notifications:match-started';

const readUnreadCount = () => {
  try {
    const stored = globalThis.window?.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) {
      return 0;
    }
    const parsed = JSON.parse(stored) as Array<{ acknowledgedAt?: string }>;
    if (!Array.isArray(parsed)) {
      return 0;
    }
    return parsed.filter((item) => !item.acknowledgedAt).length;
  } catch {
    return 0;
  }
};

const AppHeader = ({ t, isAdmin, isAuthenticated, lang, setLanguage }: AppHeaderProperties) => {
  const languageOrder = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'] as const;
  const devAutologinOrder: DevAutologinMode[] = ['anonymous', 'player', 'admin'];
  const languageLabels: Record<(typeof languageOrder)[number], string> = {
    fr: 'Français',
    en: 'English',
    es: 'Español',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    nl: 'Nederlands',
  };
  const languageFlags: Record<(typeof languageOrder)[number], string> = {
    fr: '🇫🇷',
    en: '🇬🇧',
    es: '🇪🇸',
    de: '🇩🇪',
    it: '🇮🇹',
    pt: '🇵🇹',
    nl: '🇳🇱',
  };
  const [unreadCount, setUnreadCount] = useState(0);
  const [devAutologinMode, setDevAutologinMode] = useState<DevAutologinMode>('anonymous');
  const [devAutologinReady, setDevAutologinReady] = useState(false);
  const [devAutologinUpdating, setDevAutologinUpdating] = useState(false);
  const hostname = globalThis.window?.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const currentLanguage = languageOrder.includes(lang as (typeof languageOrder)[number])
    ? (lang as (typeof languageOrder)[number])
    : 'fr';
  const devAutologinLabels: Record<DevAutologinMode, string> = {
    anonymous: t('account.devAutologinAnonymous'),
    player: t('account.devAutologinPlayer'),
    admin: t('account.devAutologinAdmin'),
  };

  const buildId = import.meta.env.VITE_BUILD_ID
    || import.meta.env.VITE_COMMIT_SHA
    || import.meta.env.VITE_APP_VERSION
    || 'local';
  const isDebugUiEnabled = import.meta.env.VITE_DEBUG_UI === 'true';
  const screenParam = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search).get('screen')
    : undefined;
  const screenMode = screenParam === '1' || screenParam === 'true' || screenParam === 'screen';

  const buildScreenLink = (enable: boolean) => {
    if (!globalThis.window) {
      return enable ? '/?screen=1' : '/';
    }
    const url = new URL(globalThis.window.location.href);
    if (enable) {
      url.searchParams.set('screen', '1');
    } else {
      url.searchParams.delete('screen');
    }
    return `${url.pathname}${url.search}`;
  };

  const handleCacheBust = () => {
    if (!globalThis.window) {
      return;
    }
    const url = new URL(globalThis.window.location.href);
    url.searchParams.set('v', buildId);
    globalThis.window.location.href = url.toString();
  };

  useEffect(() => {
    if (!globalThis.window) {
      return;
    }
    const updateUnreadCount = () => {
      setUnreadCount(readUnreadCount());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATIONS_STORAGE_KEY) {
        updateUnreadCount();
      }
    };
    const handleVisibility = () => {
      if (globalThis.document?.visibilityState === 'visible') {
        updateUnreadCount();
      }
    };

    updateUnreadCount();
    globalThis.window.addEventListener('storage', handleStorage);
    globalThis.window.addEventListener('notifications:updated', updateUnreadCount);
    globalThis.document?.addEventListener('visibilitychange', handleVisibility);

    return () => {
      globalThis.window.removeEventListener('storage', handleStorage);
      globalThis.window.removeEventListener('notifications:updated', updateUnreadCount);
      globalThis.document?.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isLocalhost) {
      return;
    }

    let isMounted = true;
    const loadMode = async () => {
      try {
        const response = await fetch('/api/auth/dev-autologin');
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { mode?: DevAutologinMode };
        if (isMounted && data.mode) {
          setDevAutologinMode(data.mode);
        }
      } catch {
        // Ignore outside local dev.
      } finally {
        if (isMounted) {
          setDevAutologinReady(true);
        }
      }
    };

    void loadMode();
    return () => {
      isMounted = false;
    };
  }, [isLocalhost]);

  const applyDevAutologinMode = async (mode: DevAutologinMode) => {
    setDevAutologinUpdating(true);
    try {
      const response = await fetch('/api/auth/dev-autologin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        return;
      }
      setDevAutologinMode(mode);
      globalThis.window?.location.reload();
    } catch {
      // Ignore request errors.
    } finally {
      setDevAutologinUpdating(false);
    }
  };

  return (
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
          {isAdmin && (
            <div className="relative group">
              <button
                type="button"
                className="rounded-md px-2 py-1 hover:bg-slate-800 inline-flex items-center gap-2"
                aria-haspopup="true"
                aria-expanded="false"
              >
                {t('nav.manage')}{' '}
                <span aria-hidden="true">▾</span>
              </button>
              <div className="absolute left-0 top-full z-10 pt-2 opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                <div className="min-w-[10rem] rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-lg">
                  <a
                    className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800"
                    href="/?view=create-tournament"
                  >
                    {t('tournaments.create')}
                  </a>
                  <a
                    className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800"
                    href="/?view=tournament-presets"
                  >
                    {t('nav.tournamentPresets')}
                  </a>
                  <a
                    className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800"
                    href="/?view=match-formats"
                  >
                    Match formats
                  </a>
                  <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?status=DRAFT">
                    {t('nav.drafts')}
                  </a>
                  <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?status=OPEN">
                    {t('nav.open')}
                  </a>
                  <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?status=SIGNATURE">
                    {t('nav.signature')}
                  </a>
                </div>
              </div>
            </div>
          )}
          {isAdmin && (
            <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=players">
              {t('nav.players')}
            </a>
          )}
          <div className="relative group">
            <button
              type="button"
              className="rounded-md px-2 py-1 hover:bg-slate-800 inline-flex items-center gap-2"
              aria-haspopup="true"
              aria-expanded="false"
            >
              {t('nav.inscription')}{' '}
              <span aria-hidden="true">▾</span>
            </button>
            <div className="absolute left-0 top-full z-10 pt-2 opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
              <div className="min-w-[12rem] rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-lg">
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?status=OPEN">
                  {t('nav.open')}
                </a>
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?view=doublettes">
                  {t('groups.doublettes')}
                </a>
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?view=equipes">
                  {t('groups.equipes')}
                </a>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button
              type="button"
              className="rounded-md px-2 py-1 hover:bg-slate-800 inline-flex items-center gap-2"
              aria-haspopup="true"
              aria-expanded="false"
            >
              {t('nav.live')}{' '}
              <span aria-hidden="true">▾</span>
            </button>
            <div className="absolute left-0 top-full z-10 pt-2 opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
              <div className="min-w-[12rem] rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-lg">
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?status=live">
                  {t('nav.all')}
                </a>
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?view=pool-stages">
                  {t('nav.poolStagesRunning')}
                </a>
                <a className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800" href="/?view=brackets">
                  {t('nav.bracketsRunning')}
                </a>
              </div>
            </div>
          </div>
          <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=targets">
            {t('nav.targets')}
          </a>
          <a
            className="rounded-md px-2 py-1 hover:bg-slate-800"
            href="/?status=FINISHED"
          >
            {t('nav.finished')}
          </a>
          <a
            className={`rounded-md px-2 py-1 hover:bg-slate-800 ${isAuthenticated ? 'text-emerald-400' : ''}`}
            href="/?view=account"
          >
            {t('nav.account')}
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {(screenMode || isAdmin) && (
            <a
              className={`rounded-md px-2 py-1 hover:bg-slate-800 inline-flex items-center gap-2 ${
                screenMode ? 'text-rose-300' : 'text-slate-200'
              }`}
              href={buildScreenLink(!screenMode)}
              aria-label={screenMode ? t('live.exitScreenMode') : t('live.screenMode')}
              title={screenMode ? t('live.exitScreenMode') : t('live.screenMode')}
            >
              {screenMode ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="12" rx="2" />
                  <path d="M7 21h10" />
                  <path d="M12 17v4" />
                  <path d="M8 9l3 3-3 3" />
                  <path d="M16 9l-3 3 3 3" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="12" rx="2" />
                  <path d="M7 21h10" />
                  <path d="M12 17v4" />
                </svg>
              )}
            </a>
          )}
          {isDebugUiEnabled && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Build:</span>
              <span className="rounded-full border border-slate-800/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200">
                {buildId}
              </span>
              <button
                type="button"
                onClick={handleCacheBust}
                className="rounded-md px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                title="Reload with cache-bust"
              >
                Refresh
              </button>
            </div>
          )}
          {isAuthenticated && (
            <a className="rounded-md px-2 py-1 hover:bg-slate-800 inline-flex items-center" href="/?view=notifications">
              <span>{t('nav.notifications')}</span>
              {unreadCount > 0 && (
                <span
                  className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500/90 px-1 text-[11px] font-semibold text-white"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount}
                </span>
              )}
            </a>
          )}
          {isLocalhost && devAutologinReady && (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="text-slate-400">Dev:</span>
              <details className="relative">
                <summary
                  className="list-none cursor-pointer rounded-md px-2 py-1 hover:bg-slate-800"
                  aria-label={t('account.devAutologinMode')}
                  title={devAutologinLabels[devAutologinMode]}
                >
                  <span>{devAutologinLabels[devAutologinMode]}</span>
                </summary>
                <div className="absolute right-0 z-20 mt-2 min-w-[11rem] rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-lg">
                  {devAutologinOrder.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={(event) => {
                        void applyDevAutologinMode(mode);
                        const detailsElement = event.currentTarget.closest('details');
                        detailsElement?.removeAttribute('open');
                      }}
                      disabled={devAutologinUpdating}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 ${
                        mode === devAutologinMode ? 'text-emerald-300' : 'text-slate-200'
                      }`}
                      aria-label={devAutologinLabels[mode]}
                    >
                      <span>{devAutologinLabels[mode]}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}
          <a className="rounded-md px-2 py-1 hover:bg-slate-800" href="/?view=doc">
            Doc
          </a>
          <details className="relative">
            <summary
              className="list-none cursor-pointer rounded-md px-2 py-1 hover:bg-slate-800"
              aria-label="Choose language"
              title={languageLabels[currentLanguage]}
            >
              <span aria-hidden="true">{languageFlags[currentLanguage]}</span>
              <span className="sr-only">{languageLabels[currentLanguage]}</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 min-w-[11rem] rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-lg">
              {languageOrder.map((languageCode) => (
                <button
                  key={languageCode}
                  type="button"
                  onClick={(event) => {
                    setLanguage(languageCode);
                    const detailsElement = event.currentTarget.closest('details');
                    detailsElement?.removeAttribute('open');
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-800 ${
                    languageCode === currentLanguage ? 'text-emerald-300' : 'text-slate-200'
                  }`}
                >
                  <span aria-hidden="true">{languageFlags[languageCode]}</span>
                  <span>{languageLabels[languageCode]}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
