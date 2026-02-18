/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import type { GetTokenSilentlyOptions, LogoutOptions, RedirectLoginOptions } from '@auth0/auth0-react';

const isDebugAuth0 = import.meta.env.VITE_DEBUG_AUTH0 === 'true';
const debugLog = (...args: unknown[]) => {
  if (isDebugAuth0) {
    console.log(...args);
  }
};
const debugWarn = (...args: unknown[]) => {
  if (isDebugAuth0) {
    console.warn(...args);
  }
};
const debugError = (...args: unknown[]) => {
  if (isDebugAuth0) {
    console.error(...args);
  }
};

type OptionalAuthContextValue = {
  enabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: Error;
  user?: { name?: string; picture?: string; email?: string };
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
    error,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = auth0;

  // Log Auth0 state changes for debugging
  useEffect(() => {
    debugLog('[Auth0Bridge] State changed:', {
      isAuthenticated,
      isLoading,
      hasError: !!error,
      errorMessage: error?.message,
      errorName: error?.name,
      hasUser: !!user,
      userName: user?.name,
    });

    if (error) {
      debugError('[Auth0Bridge] Auth0 error detected:', error);
      debugError('[Auth0Bridge] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        error: (error as any).error,
        error_description: (error as any).error_description,
        state: (error as any).state,
      });
      debugError('[Auth0Bridge] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }

    if (isAuthenticated && user) {
      debugLog('[Auth0Bridge] 🔐 User authenticated successfully');
      debugLog('[Auth0Bridge] 👤 Full user object:', JSON.stringify(user, null, 2));
      
      // Try to get and decode tokens
      (async () => {
        try {
          debugLog('[Auth0Bridge] 🎫 Fetching ID token claims...');
          const idTokenClaims = await getIdTokenClaims();
          debugLog('[Auth0Bridge] 🎫 ID Token Claims:', JSON.stringify(idTokenClaims, null, 2));
          
          debugLog('[Auth0Bridge] 🔑 Fetching access token...');
          const accessToken = await getAccessTokenSilently();
          debugLog('[Auth0Bridge] 🔑 Access token retrieved (length:', accessToken.length, ')');
          
          // Decode JWT (base64 decode the payload part)
          const parts = accessToken.split('.');
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(atob(parts[1]));
              debugLog('[Auth0Bridge] 🔓 Decoded Access Token Payload:', JSON.stringify(payload, null, 2));
              debugLog('[Auth0Bridge] 📋 Access Token Claims:', Object.keys(payload));
              
              // Specifically check for email
              if (payload.email) {
                debugLog('[Auth0Bridge] ✅ Email found in access token:', payload.email);
              } else {
                debugWarn('[Auth0Bridge] ⚠️ Email NOT found in access token');
                debugWarn('[Auth0Bridge] ⚠️ This will cause admin authentication to fail!');
                debugWarn('[Auth0Bridge] ⚠️ Please add email claim via Auth0 Action');
              }
              
              // Check for subject
              if (payload.sub) {
                debugLog('[Auth0Bridge] ✅ Subject ID in access token:', payload.sub);
              }
            } catch (decodeError) {
              debugError('[Auth0Bridge] ❌ Failed to decode access token:', decodeError);
            }
          }
        } catch (tokenError) {
          debugError('[Auth0Bridge] ❌ Failed to get tokens:', tokenError);
        }
      })();
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

  debugLog('[OptionalAuthProvider] Initializing Auth0 with:', {
    domain,
    clientId,
    audience: audience || '(not set)',
    redirectUri,
  });

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="localstorage"
      useRefreshTokens
      useCookiesForTransactions
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
      }}
      onRedirectCallback={(appState) => {
        debugLog('[Auth0] 🔄 onRedirectCallback fired');
        debugLog('[Auth0] 📦 App state:', JSON.stringify(appState, null, 2));
        debugLog('[Auth0] 🌐 Current URL:', globalThis.window?.location.href);
        
        try {
          const timestamp = Date.now();
          globalThis.window?.sessionStorage.setItem('auth0:callback', String(timestamp));
          debugLog('[Auth0] ✅ Set callback timestamp:', timestamp);
        } catch (err) {
          debugError('[Auth0] ❌ Failed to set sessionStorage:', err);
        }
        
        const url = new URL(globalThis.window?.location.href ?? '', globalThis.window?.location.origin);
        const hadCode = url.searchParams.has('code');
        const hadState = url.searchParams.has('state');
        
        debugLog('[Auth0] 🔍 URL parameters:', {
          hadCode,
          hadState,
          allParams: Array.from(url.searchParams.entries()),
        });
        
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        globalThis.window?.history.replaceState({}, globalThis.document.title, url.toString());
        debugLog('[Auth0] 🧹 Cleaned URL:', url.toString());
      }}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
        scope: 'openid profile email',
      }}
      cacheLocation="localstorage"
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function useOptionalAuth() {
  return useContext(OptionalAuthContext);
}
