import { useOptionalAuth } from '../auth/optional-auth';
import SignInPanel from '../auth/sign-in-panel';
import { useI18n } from '../i18n';

type Translator = ReturnType<typeof useI18n>['t'];

type AccountUserDetails = {
  name?: string;
  picture?: string;
  email?: string;
  nickname?: string;
  sub?: string;
  email_verified?: boolean;
  updated_at?: string;
};

type AccountProfileProperties = {
  t: Translator;
  userDetails: AccountUserDetails;
  onSignOut: () => void;
};

const AccountProfile = ({ t, userDetails, onSignOut }: AccountProfileProperties) => (
  <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8">
    <div className="flex items-start gap-6">
      {userDetails.picture && (
        <img
          src={userDetails.picture}
          alt={userDetails.name || t('account.userAvatar')}
          className="h-20 w-20 rounded-full border-2 border-slate-700"
        />
      )}
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-white">{userDetails.name || t('account.anonymous')}</h3>
        {userDetails.email && (
          <p className="mt-1 text-sm text-slate-400">{userDetails.email}</p>
        )}
        {userDetails.nickname && userDetails.nickname !== userDetails.name && (
          <p className="mt-1 text-xs text-slate-500">@{userDetails.nickname}</p>
        )}
      </div>
    </div>

    <div className="mt-6 pt-6 border-t border-slate-800/70">
      <h4 className="text-sm font-semibold text-slate-300 mb-4">{t('account.accountDetails')}</h4>
      <div className="space-y-3">
        {userDetails.sub && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('account.userId')}</span>
            <span className="text-slate-300 font-mono text-xs">{userDetails.sub}</span>
          </div>
        )}
        {userDetails.email_verified !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('account.emailVerified')}</span>
            <span className={userDetails.email_verified ? 'text-emerald-400' : 'text-amber-400'}>
              {userDetails.email_verified ? t('common.yes') : t('common.no')}
            </span>
          </div>
        )}
        {userDetails.updated_at && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('account.lastUpdated')}</span>
            <span className="text-slate-300">{new Date(userDetails.updated_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>

    <div className="mt-8 flex justify-end">
      <button
        onClick={onSignOut}
        className="rounded-full border border-rose-500/60 px-5 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
      >
        {t('account.signOut')}
      </button>
    </div>
  </div>
);

type AccountRawDataProperties = {
  t: Translator;
  user: unknown;
};

const AccountRawData = ({ t, user }: AccountRawDataProperties) => (
  <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6">
    <h4 className="text-sm font-semibold text-slate-300 mb-3">{t('account.rawData')}</h4>
    <pre className="overflow-x-auto rounded-lg bg-slate-950/80 p-4 text-xs text-slate-400">
      {JSON.stringify(user, undefined, 2)}
    </pre>
  </div>
);

function AccountView() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading,
    user,
    logout,
  } = useOptionalAuth();

  if (!authEnabled) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">{t('account.notConfigured')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('account.loading')}</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('account.title')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">{t('account.signInRequired')}</h2>
        </div>
        <SignInPanel
          title={t('auth.signIn')}
          description={t('auth.protectedContinue')}
        />
      </div>
    );
  }

  // Type assertion to access Auth0 user properties
  const userDetails = user as AccountUserDetails;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('account.title')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">{t('account.myAccount')}</h2>
      </div>

      <AccountProfile
        t={t}
        userDetails={userDetails}
        onSignOut={() => logout({ logoutParams: { returnTo: globalThis.window?.location.origin } })}
      />
      <AccountRawData t={t} user={user} />
    </div>
  );
}

export default AccountView;
