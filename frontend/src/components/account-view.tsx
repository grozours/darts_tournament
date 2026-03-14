import { useEffect, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import SignInPanel from '../auth/sign-in-panel';
import { useI18n } from '../i18n';

type Translator = ReturnType<typeof useI18n>['t'];

type AccountUserDetails = {
  name?: string;
  picture?: string;
  email?: string;
  nickname?: string;
  sub?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
  email_verified?: boolean;
  updated_at?: string;
};

type AccountProfileProperties = {
  t: Translator;
  userDetails: AccountUserDetails;
  onSignOut?: () => void;
  showDetails: boolean;
  roleLabel?: string;
  onSaveProfile?: (values: { firstName: string; lastName: string; surname: string }) => Promise<void>;
  isSavingProfile?: boolean;
  profileError?: string;
  profileSuccess?: string;
};

const deriveNames = (userDetails: AccountUserDetails) => {
  const firstName = (userDetails.firstName ?? '').trim();
  const lastName = (userDetails.lastName ?? '').trim();
  const surname = (userDetails.surname ?? '').trim();

  if (firstName && lastName) {
    return { firstName, lastName, surname };
  }

  const displayName = (userDetails.name ?? '').trim();
  if (!displayName) {
    return { firstName: '', lastName: '', surname };
  }

  const [firstFromName, ...rest] = displayName.split(/\s+/).filter(Boolean);
  return {
    firstName: firstFromName ?? '',
    lastName: rest.join(' ').trim(),
    surname,
  };
};

const AccountProfile = ({
  t,
  userDetails,
  onSignOut,
  showDetails,
  roleLabel,
  onSaveProfile,
  isSavingProfile,
  profileError,
  profileSuccess,
}: AccountProfileProperties) => {
  const [{ firstName, lastName, surname }, setFormValues] = useState(() => deriveNames(userDetails));

  useEffect(() => {
    setFormValues(deriveNames(userDetails));
  }, [userDetails.firstName, userDetails.lastName, userDetails.surname, userDetails.name]);

  const submitProfile = async () => {
    if (!onSaveProfile || isSavingProfile) {
      return;
    }
    await onSaveProfile({ firstName, lastName, surname });
  };

  const canSaveProfile = Boolean(onSaveProfile);

  return (
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
        {roleLabel && (
          <p className="mt-1 inline-flex rounded-full border border-cyan-700/50 bg-cyan-900/30 px-2 py-1 text-xs font-semibold text-cyan-200">
            {roleLabel}
          </p>
        )}
        {userDetails.email && (
          <p className="mt-1 text-sm text-slate-400">{userDetails.email}</p>
        )}
        {userDetails.nickname && userDetails.nickname !== userDetails.name && (
          <p className="mt-1 text-xs text-slate-500">@{userDetails.nickname}</p>
        )}
      </div>
    </div>

    {showDetails && (
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
    )}

    {canSaveProfile && (
      <div className="mt-6 border-t border-slate-800/70 pt-6">
        <h4 className="mb-4 text-sm font-semibold text-slate-300">{t('account.accountDetails')}</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            {t('edit.firstName')}
            <input
              type="text"
              value={firstName}
              onChange={(event_) => setFormValues((current) => ({ ...current, firstName: event_.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            {t('edit.lastName')}
            <input
              type="text"
              value={lastName}
              onChange={(event_) => setFormValues((current) => ({ ...current, lastName: event_.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">
            {t('edit.surname')}
            <input
              type="text"
              value={surname}
              onChange={(event_) => setFormValues((current) => ({ ...current, surname: event_.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        {profileError && (
          <p className="mt-3 text-sm text-rose-300">{profileError}</p>
        )}
        {profileSuccess && !profileError && (
          <p className="mt-3 text-sm text-emerald-300">{profileSuccess}</p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              void submitProfile();
            }}
            disabled={isSavingProfile}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
          >
            {isSavingProfile ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    )}

    {onSignOut && (
      <div className="mt-8 flex justify-end">
        <button
          onClick={onSignOut}
          className="rounded-full border border-rose-500/60 px-5 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          {t('account.signOut')}
        </button>
      </div>
    )}
  </div>
  );
};

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

const patchAccountProfile = async (
  values: { firstName: string; lastName: string; surname: string },
  options: {
    authEnabled: boolean;
    isAuthenticated: boolean;
    getAccessTokenSilently: () => Promise<string>;
  }
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.authEnabled && options.isAuthenticated) {
    const token = await options.getAccessTokenSilently();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch('/api/auth/me/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(values),
  });

  const payload = await response.json().catch(() => undefined);

  return {
    ok: response.ok,
    payload,
  };
};

const resolveEffectiveUser = (parameters: {
  isAuthenticated: boolean;
  user: unknown;
  adminUser: unknown;
}) => {
  const hasAuthSession = parameters.isAuthenticated && Boolean(parameters.user);
  let effectiveUser = parameters.user;

  if (!hasAuthSession && parameters.adminUser) {
    effectiveUser = parameters.adminUser;
  } else if (hasAuthSession && parameters.adminUser) {
    effectiveUser = {
      ...(parameters.user as Record<string, unknown> ?? {}),
      ...(parameters.adminUser as Record<string, unknown>),
    };
  }

  return {
    hasAuthSession,
    hasAutologinProfile: !hasAuthSession && Boolean(parameters.adminUser),
    effectiveUser,
  };
};

const saveAccountProfile = async (parameters: {
  values: { firstName: string; lastName: string; surname: string };
  authEnabled: boolean;
  isAuthenticated: boolean;
  getAccessTokenSilently: () => Promise<string>;
  t: Translator;
}) => {
  try {
    const { ok, payload } = await patchAccountProfile(parameters.values, {
      authEnabled: parameters.authEnabled,
      isAuthenticated: parameters.isAuthenticated,
      getAccessTokenSilently: parameters.getAccessTokenSilently,
    });

    if (!ok) {
      return {
        error: typeof payload?.message === 'string'
          ? payload.message
          : parameters.t('account.profileUpdateFailed'),
      };
    }

    return {
      user: payload?.user as AccountUserDetails | undefined,
    };
  } catch (error_) {
    return {
      error: error_ instanceof Error ? error_.message : parameters.t('account.profileUpdateFailed'),
    };
  }
};

const renderMissingAccountState = (parameters: {
  authEnabled: boolean;
  t: Translator;
}) => {
  if (!parameters.authEnabled) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">{parameters.t('account.notConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{parameters.t('account.title')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">{parameters.t('account.signInRequired')}</h2>
      </div>
      <SignInPanel
        title={parameters.t('auth.signIn')}
        description={parameters.t('auth.protectedContinue')}
        showTitle={false}
        showProviderSeparator={false}
      />
    </div>
  );
};

const resolveAutologinRoleLabel = (parameters: {
  hasAutologinProfile: boolean;
  isAdmin: boolean;
  t: Translator;
}) => {
  if (!parameters.hasAutologinProfile) {
    return undefined;
  }

  return parameters.isAdmin
    ? parameters.t('account.autologinAdmin')
    : parameters.t('account.autologinPlayer');
};

const createSaveProfileHandler = (parameters: {
  authEnabled: boolean;
  isAuthenticated: boolean;
  getAccessTokenSilently: () => Promise<string>;
  t: Translator;
  setIsSavingProfile: (value: boolean) => void;
  setProfileError: (value: string | undefined) => void;
  setProfileSuccess: (value: string | undefined) => void;
  setProfileOverride: (value: AccountUserDetails | undefined) => void;
}) => async (values: { firstName: string; lastName: string; surname: string }) => {
  parameters.setIsSavingProfile(true);
  parameters.setProfileError(undefined);
  parameters.setProfileSuccess(undefined);

  const result = await saveAccountProfile({
    values,
    authEnabled: parameters.authEnabled,
    isAuthenticated: parameters.isAuthenticated,
    getAccessTokenSilently: parameters.getAccessTokenSilently,
    t: parameters.t,
  });

  if (result.error) {
    parameters.setProfileError(result.error);
    parameters.setIsSavingProfile(false);
    return;
  }

  if (result.user) {
    parameters.setProfileOverride(result.user);
  }

  parameters.setProfileSuccess(parameters.t('account.profileUpdateSuccess'));
  parameters.setIsSavingProfile(false);
};

function AccountView() {
  const { t } = useI18n();
  const { isAdmin, adminUser } = useAdminStatus();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading,
    user,
    logout,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const [profileError, setProfileError] = useState<string | undefined>();
  const [profileSuccess, setProfileSuccess] = useState<string | undefined>();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileOverride, setProfileOverride] = useState<AccountUserDetails | undefined>();

  useEffect(() => {
    setProfileOverride(undefined);
    setProfileError(undefined);
    setProfileSuccess(undefined);
  }, [isAuthenticated, user, adminUser]);

  useEffect(() => {
    if (!profileSuccess) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setProfileSuccess(undefined);
    }, 3000);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [profileSuccess]);

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

  const { hasAuthSession, hasAutologinProfile, effectiveUser } = resolveEffectiveUser({
    isAuthenticated,
    user,
    adminUser,
  });

  const autologinRoleLabel = resolveAutologinRoleLabel({
    hasAutologinProfile,
    isAdmin,
    t,
  });

  if (!effectiveUser) {
    return renderMissingAccountState({ authEnabled, t });
  }

  // Type assertion to access Auth0 user properties
  const fallbackUserDetails = effectiveUser as AccountUserDetails;
  const userDetails = profileOverride ?? fallbackUserDetails;

  const saveProfile = createSaveProfileHandler({
    authEnabled,
    isAuthenticated,
    getAccessTokenSilently,
    t,
    setIsSavingProfile,
    setProfileError,
    setProfileSuccess,
    setProfileOverride,
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('account.title')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">{t('account.myAccount')}</h2>
      </div>

      <AccountProfile
        t={t}
        userDetails={userDetails}
        showDetails={isAdmin}
        {...(autologinRoleLabel ? { roleLabel: autologinRoleLabel } : {})}
        onSaveProfile={saveProfile}
        isSavingProfile={isSavingProfile}
        {...(profileError ? { profileError } : {})}
        {...(profileSuccess ? { profileSuccess } : {})}
        {...(hasAuthSession
          ? {
              onSignOut: () => logout({ logoutParams: { returnTo: globalThis.window?.location.origin } }),
            }
          : {})}
      />
      {isAdmin && <AccountRawData t={t} user={effectiveUser} />}
    </div>
  );
}

export default AccountView;
