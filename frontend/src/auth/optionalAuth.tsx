import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

type OptionalAuthContextValue = {
  enabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: { name?: string; picture?: string };
  loginWithRedirect: (options?: any) => Promise<void>;
  logout: (options?: any) => void;
  getAccessTokenSilently: (options?: any) => Promise<string>;
};

const noopAsync = async () => {
  throw new Error('OAuth is not configured');
};

const OptionalAuthContext = createContext<OptionalAuthContextValue>({
  enabled: false,
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  loginWithRedirect: async () => undefined,
  logout: () => undefined,
  getAccessTokenSilently: noopAsync,
});

function Auth0Bridge({ children }: { children: ReactNode }) {
  const auth0 = useAuth0();
  const value = useMemo<OptionalAuthContextValue>(
    () => ({
      enabled: true,
      isAuthenticated: auth0.isAuthenticated,
      isLoading: auth0.isLoading,
      user: auth0.user,
      loginWithRedirect: auth0.loginWithRedirect,
      logout: auth0.logout,
      getAccessTokenSilently: auth0.getAccessTokenSilently,
    }),
    [
      auth0.isAuthenticated,
      auth0.isLoading,
      auth0.user,
      auth0.loginWithRedirect,
      auth0.logout,
      auth0.getAccessTokenSilently,
    ]
  );

  return <OptionalAuthContext.Provider value={value}>{children}</OptionalAuthContext.Provider>;
}

export function OptionalAuthProvider({
  children,
  domain,
  clientId,
  audience,
}: {
  children: ReactNode;
  domain?: string;
  clientId?: string;
  audience?: string;
}) {
  if (!domain || !clientId) {
    return (
      <OptionalAuthContext.Provider
        value={{
          enabled: false,
          isAuthenticated: false,
          isLoading: false,
          user: undefined,
          loginWithRedirect: async () => undefined,
          logout: () => undefined,
          getAccessTokenSilently: noopAsync,
        }}
      >
        {children}
      </OptionalAuthContext.Provider>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
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
