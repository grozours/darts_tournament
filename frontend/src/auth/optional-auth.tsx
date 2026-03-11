import { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import type { GetTokenSilentlyOptions, LogoutOptions, RedirectLoginOptions } from '@auth0/auth0-react';

type Auth0CacheLocation = 'memory' | 'localstorage';

const isDebugAuth0 = import.meta.env.VITE_DEBUG_AUTH0 === 'true';
const debugNoop = (...arguments_: unknown[]) => (
  isDebugAuth0 && arguments_.includes('__never__')
);
const debugLog = debugNoop;
const debugWarn = debugNoop;
const debugError = debugNoop;

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

const resolveAuth0CacheLocation = (): Auth0CacheLocation => {
  const rawValue = String(getEnvironmentValue('VITE_AUTH0_CACHE_LOCATION') || '').trim().toLowerCase();
  if (rawValue === 'memory') {
    return 'memory';
  }
  return 'localstorage';
};

const decodeJwtPayload = (accessToken: string): Record<string, unknown> | undefined => {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    return undefined;
  }
  const payloadPart = parts.at(1);
  if (!payloadPart) {
    return undefined;
  }
  return JSON.parse(atob(payloadPart)) as Record<string, unknown>;
};

type Auth0ErrorDetails = {
  code?: string;
  description?: string;
  state?: string;
};

const getAuth0ErrorDetails = (value: unknown): Auth0ErrorDetails => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;

  const details: Auth0ErrorDetails = {};
  if (typeof record.error === 'string') {
    details.code = record.error;
  }
  if (typeof record.error_description === 'string') {
    details.description = record.error_description;
  }
  if (typeof record.state === 'string') {
    details.state = record.state;
  }
  return details;
};

type OptionalAuthContextValue = {
  enabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  user: { name?: string; picture?: string; email?: string } | undefined;
  loginWithRedirect: (options?: RedirectLoginOptions) => Promise<void>;
  logout: (options?: LogoutOptions) => void;
  getAccessTokenSilently: (options?: GetTokenSilentlyOptions) => Promise<string>;
};

const noopLogin: OptionalAuthContextValue['loginWithRedirect'] = () => Promise.resolve();

const noopAsync = async () => {
  throw new Error('OAuth is not configured');
};

const OptionalAuthContext = createContext<OptionalAuthContextValue>({
  enabled: false,
  isAuthenticated: false,
  isLoading: false,
  error: undefined,
  user: undefined,
  loginWithRedirect: noopLogin,
  logout: () => {},
  getAccessTokenSilently: noopAsync,
});

type Auth0BridgeProperties = Readonly<{ children: ReactNode }>;

const logAuthStateChange = (payload: {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  user: { name?: string } | undefined;
}) => {
  debugLog('[Auth0Bridge] State changed:', {
    isAuthenticated: payload.isAuthenticated,
    isLoading: payload.isLoading,
    hasError: !!payload.error,
    errorMessage: payload.error?.message,
    errorName: payload.error?.name,
    hasUser: !!payload.user,
    userName: payload.user?.name,
  });
};

const logAuthErrorDetails = (error: Error) => {
  const authErrorDetails = getAuth0ErrorDetails(error);

  debugError('[Auth0Bridge] Auth0 error detected:', error);
  debugError('[Auth0Bridge] Error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    error: authErrorDetails.code,
    error_description: authErrorDetails.description,
    state: authErrorDetails.state,
  });
  debugError('[Auth0Bridge] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
};

const logAuthenticatedUserTokens = async (options: {
  user: { name?: string };
  getIdTokenClaims: () => Promise<unknown>;
  getAccessTokenSilently: () => Promise<string>;
}) => {
  debugLog('[Auth0Bridge] 🔐 User authenticated successfully');
  debugLog('[Auth0Bridge] 👤 Full user object:', JSON.stringify(options.user, undefined, 2));

  debugLog('[Auth0Bridge] 🎫 Fetching ID token claims...');
  const idTokenClaims = await options.getIdTokenClaims();
  debugLog('[Auth0Bridge] 🎫 ID Token Claims:', JSON.stringify(idTokenClaims, undefined, 2));

  debugLog('[Auth0Bridge] 🔑 Fetching access token...');
  const accessToken = await options.getAccessTokenSilently();
  debugLog('[Auth0Bridge] 🔑 Access token retrieved (length:', accessToken.length, ')');

  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    debugWarn('[Auth0Bridge] ⚠️ Access token did not contain a JWT payload');
    return;
  }

  debugLog('[Auth0Bridge] 🔓 Decoded Access Token Payload:', JSON.stringify(payload, undefined, 2));
  debugLog('[Auth0Bridge] 📋 Access Token Claims:', Object.keys(payload));

  const email = typeof payload.email === 'string' ? payload.email : undefined;
  if (email) {
    debugLog('[Auth0Bridge] ✅ Email found in access token:', email);
  } else {
    debugWarn('[Auth0Bridge] ⚠️ Email NOT found in access token');
    debugWarn('[Auth0Bridge] ⚠️ This will cause admin authentication to fail!');
    debugWarn('[Auth0Bridge] ⚠️ Please add email claim via Auth0 Action');
  }

  const subject = typeof payload.sub === 'string' ? payload.sub : undefined;
  if (subject) {
    debugLog('[Auth0Bridge] ✅ Subject ID in access token:', subject);
  }
};

function Auth0Bridge({ children }: Auth0BridgeProperties) {
  const auth0 = useAuth0();
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = auth0;

  // Log Auth0 state changes for debugging
  useEffect(() => {
    logAuthStateChange({ isAuthenticated, isLoading, error, user });

    if (error) {
      logAuthErrorDetails(error);
    }

    if (isAuthenticated && user) {
      logAuthenticatedUserTokens({
        user,
        getIdTokenClaims,
        getAccessTokenSilently,
      }).catch((tokenError) => {
        debugError('[Auth0Bridge] ❌ Failed to get tokens:', tokenError);
      });
    }
  }, [isAuthenticated, isLoading, error, user, getAccessTokenSilently, getIdTokenClaims]);

  const value = useMemo<OptionalAuthContextValue>(
    () => ({
      enabled: true,
      isAuthenticated,
      isLoading,
      error,
      user,
      loginWithRedirect,
      logout: (options) => {
        logout(options);
      },
      getAccessTokenSilently,
    }),
    [
      error,
      getAccessTokenSilently,
      isAuthenticated,
      isLoading,
      loginWithRedirect,
      logout,
      user,
    ]
  );

  return <OptionalAuthContext.Provider value={value}>{children}</OptionalAuthContext.Provider>;
}

type OptionalAuthProviderProperties = Readonly<{
  children: ReactNode;
  domain?: string;
  clientId?: string;
  audience?: string;
}>;

export function OptionalAuthProvider({
  children,
  domain,
  clientId,
  audience,
}: OptionalAuthProviderProperties) {
  const fallbackValue = useMemo<OptionalAuthContextValue>(
    () => ({
      enabled: false,
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
      user: undefined,
      loginWithRedirect: noopLogin,
      logout: () => {},
      getAccessTokenSilently: noopAsync,
    }),
    []
  );

  if (!domain || !clientId) {
    return (
      <OptionalAuthContext.Provider value={fallbackValue}>
        {children}
      </OptionalAuthContext.Provider>
    );
  }

  const redirectUri = globalThis.window?.location.origin ?? '';
  const cacheLocation = resolveAuth0CacheLocation();

  debugLog('[OptionalAuthProvider] Initializing Auth0 with:', {
    domain,
    clientId,
    audience: audience || '(not set)',
    redirectUri,
    cacheLocation,
  });

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      useRefreshTokens
      useCookiesForTransactions
      onRedirectCallback={(appState) => {
        debugLog('[Auth0] 🔄 onRedirectCallback fired');
        debugLog('[Auth0] 📦 App state:', JSON.stringify(appState, undefined, 2));
        debugLog('[Auth0] 🌐 Current URL:', globalThis.window?.location.href);
        
        try {
          const timestamp = Date.now();
          globalThis.window?.sessionStorage.setItem('auth0:callback', String(timestamp));
          debugLog('[Auth0] ✅ Set callback timestamp:', timestamp);
        } catch (error) {
          debugError('[Auth0] ❌ Failed to set sessionStorage:', error);
        }
        
        const url = new URL(globalThis.window?.location.href ?? '', globalThis.window?.location.origin);
        const hadCode = url.searchParams.has('code');
        const hadState = url.searchParams.has('state');
        
        debugLog('[Auth0] 🔍 URL parameters:', {
          hadCode,
          hadState,
          allParams: [...url.searchParams.entries()],
        });
        
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        globalThis.window?.history.replaceState({}, globalThis.document.title, url.toString());
        debugLog('[Auth0] 🧹 Cleaned URL:', url.toString());
      }}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
        scope: 'openid profile email offline_access',
      }}
      cacheLocation={cacheLocation}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function useOptionalAuth() {
  return useContext(OptionalAuthContext);
}
