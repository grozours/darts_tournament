import { useMemo } from 'react';
import { useOptionalAuth } from './optional-auth';
import { useI18n } from '../i18n';

type SignInPanelProperties = Readonly<{
  title: string;
  description: string;
  showTitle?: boolean;
  showProviderSeparator?: boolean;
}>;

type ProviderConfig = {
  key: string;
  label: string;
  connection: string;
  className: string;
  logo: JSX.Element;
};

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" focusable="false">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.5-.2-2.2H12z" />
    <path fill="#34A853" d="M12 22c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-3.9l-3.2 2.5C5.1 19.9 8.3 22 12 22z" />
    <path fill="#FBBC05" d="M6.6 14.2c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.4 7.7C2.8 9 2.5 10.5 2.5 12c0 1.6.4 3 .9 4.3l3.2-2.1z" />
    <path fill="#4285F4" d="M12 6.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 3.1 14.6 2 12 2 8.3 2 5.1 4.1 3.4 7.7l3.2 2.5c.8-2.3 2.9-4.1 5.4-4.1z" />
  </svg>
);

const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" focusable="false">
    <path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1c0 6 4.4 11 10.1 12v-8.5H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-2 1-2 1.9v2.3h3.4l-.5 3.5h-2.9V24c5.7-1 10.1-6 10.1-11.9z" />
  </svg>
);

const DiscordLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" focusable="false">
    <path fill="#5865F2" d="M20.3 4.4A17.8 17.8 0 0 0 16 3.1l-.2.4a16.1 16.1 0 0 1 4 1.3c-1.7-.8-3.5-1.3-5.3-1.5a17.2 17.2 0 0 0-5 0C7.6 3.5 5.8 4 4 4.8a16 16 0 0 1 4-1.3l-.2-.4a17.8 17.8 0 0 0-4.3 1.3C1.1 8 0.5 11.4.8 14.7A17.6 17.6 0 0 0 6 17.3l.7-1.2c-1-.4-2-.9-2.8-1.6l.4-.3c2.7 1.2 5.7 1.2 8.4 0l.4.3c-.8.7-1.8 1.2-2.8 1.6l.7 1.2a17.6 17.6 0 0 0 5.2-2.6c.4-3.8-.7-7.2-2.9-10.3zM9 13.1c-.8 0-1.5-.7-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm6 0c-.8 0-1.5-.7-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z" />
  </svg>
);

const getEnvironmentValue = (key: string): string | undefined => {
  const globalEnvironment = (globalThis as typeof globalThis & {
    __APP_ENV__?: Record<string, string>;
  }).__APP_ENV__;
  if (globalEnvironment && key in globalEnvironment) {
    return globalEnvironment[key];
  }
  const environment = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return environment ? environment[key] : undefined;
};

const getConnection = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

function SignInPanel({
  title,
  description,
  showTitle = true,
  showProviderSeparator = true,
}: SignInPanelProperties) {
  const { t } = useI18n();
  const { loginWithRedirect } = useOptionalAuth();

  const providers = useMemo<ProviderConfig[]>(() => {
    const googleConnection = getConnection(
      getEnvironmentValue('VITE_AUTH0_CONNECTION_GOOGLE'),
      'google-oauth2'
    );
    const facebookConnection = getConnection(
      getEnvironmentValue('VITE_AUTH0_CONNECTION_FACEBOOK'),
      'facebook'
    );
    const discordConnection = getConnection(
      getEnvironmentValue('VITE_AUTH0_CONNECTION_DISCORD'),
      'discord'
    );

    return [
      {
        key: 'google',
        label: t('auth.signInWithGoogle'),
        connection: googleConnection,
        className: 'border-rose-500/40 bg-rose-500/10 text-rose-100 hover:border-rose-300 hover:bg-rose-500/20',
        logo: <GoogleLogo />,
      },
      {
        key: 'facebook',
        label: t('auth.signInWithFacebook'),
        connection: facebookConnection,
        className: 'border-sky-500/40 bg-sky-500/10 text-sky-100 hover:border-sky-300 hover:bg-sky-500/20',
        logo: <FacebookLogo />,
      },
      {
        key: 'discord',
        label: t('auth.signInWithDiscord'),
        connection: discordConnection,
        className: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100 hover:border-indigo-300 hover:bg-indigo-500/20',
        logo: <DiscordLogo />,
      },
    ];
  }, [t]);

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
      {showTitle ? <h3 className="text-xl font-semibold text-white">{title}</h3> : null}
      <p className={`${showTitle ? 'mt-2' : ''} text-sm text-slate-300`}>{description}</p>
      <div className="mt-6 flex flex-col items-center gap-4">
        {showProviderSeparator ? (
          <div className="flex w-full items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span className="h-px w-12 bg-slate-800" />
            <span>{t('auth.orContinueWith')}</span>
            <span className="h-px w-12 bg-slate-800" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {providers.map((provider) => (
            <button
              key={provider.key}
              onClick={() => {
                void loginWithRedirect({
                  authorizationParams: {
                    connection: provider.connection,
                  },
                });
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${provider.className}`}
            >
              {provider.logo}
              {provider.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SignInPanel;
