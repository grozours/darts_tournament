import { useMemo } from 'react';
import { useOptionalAuth } from './optionalAuth';
import { useI18n } from '../i18n';

type SignInPanelProps = Readonly<{
  title: string;
  description: string;
}>;

type ProviderConfig = {
  key: string;
  label: string;
  connection: string;
  className: string;
};

const getConnection = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

function SignInPanel({ title, description }: SignInPanelProps) {
  const { t } = useI18n();
  const { loginWithRedirect } = useOptionalAuth();

  const providers = useMemo<ProviderConfig[]>(() => {
    const googleConnection = getConnection(
      import.meta.env.VITE_AUTH0_CONNECTION_GOOGLE as string | undefined,
      'google-oauth2'
    );
    const facebookConnection = getConnection(
      import.meta.env.VITE_AUTH0_CONNECTION_FACEBOOK as string | undefined,
      'facebook'
    );
    const instagramConnection = getConnection(
      import.meta.env.VITE_AUTH0_CONNECTION_INSTAGRAM as string | undefined,
      'instagram'
    );

    return [
      {
        key: 'google',
        label: t('auth.signInWithGoogle'),
        connection: googleConnection,
        className: 'border-slate-700 text-slate-100 hover:border-slate-500',
      },
      {
        key: 'facebook',
        label: t('auth.signInWithFacebook'),
        connection: facebookConnection,
        className: 'border-slate-700 text-slate-100 hover:border-slate-500',
      },
      {
        key: 'instagram',
        label: t('auth.signInWithInstagram'),
        connection: instagramConnection,
        className: 'border-slate-700 text-slate-100 hover:border-slate-500',
      },
    ];
  }, [t]);

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={() => {
            void loginWithRedirect();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          {t('auth.signIn')}
        </button>
        <div className="flex w-full items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
          <span className="h-px w-12 bg-slate-800" />
          <span>{t('auth.orContinueWith')}</span>
          <span className="h-px w-12 bg-slate-800" />
        </div>
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
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${provider.className}`}
            >
              {provider.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SignInPanel;
