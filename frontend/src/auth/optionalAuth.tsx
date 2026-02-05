/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import type { GetTokenSilentlyOptions, LogoutOptions, RedirectLoginOptions } from '@auth0/auth0-react';

type OptionalAuthContextValue = {
  enabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: { name?: string; picture?: string };
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
  user: undefined,
  loginWithRedirect: noopLogin,
  logout: () => undefined,
  getAccessTokenSilently: noopAsync,
});

type Auth0BridgeProps = Readonly<{ children: ReactNode }>;

function Auth0Bridge({ children }: Auth0BridgeProps) {
  const auth0 = useAuth0();
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = auth0;

  const value = useMemo<OptionalAuthContextValue>(
    () => ({
      enabled: true,
      isAuthenticated,
      isLoading,
      user,
      loginWithRedirect,
      logout: (options) => {
        logout(options);
      },
      getAccessTokenSilently,
    }),
    [
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

type OptionalAuthProviderProps = Readonly<{
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
}: OptionalAuthProviderProps) {
  const fallbackValue = useMemo<OptionalAuthContextValue>(
    () => ({
      enabled: false,
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      loginWithRedirect: noopLogin,
      logout: () => undefined,
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

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
      }}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function useOptionalAuth() {
  return useContext(OptionalAuthContext);
}
