import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEffect, type ReactElement } from 'react';
import { OptionalAuthProvider, useOptionalAuth } from '../../../src/auth/optional-auth';

const auth0Mocks = vi.hoisted(() => ({
  auth0State: {
    isAuthenticated: true,
    isLoading: false,
    error: undefined as Error | undefined,
    user: { name: 'Test User' },
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('token'),
    getIdTokenClaims: vi.fn().mockResolvedValue({}),
  },
  lastAuth0Props: undefined as Record<string, unknown> | undefined,
  Auth0Provider: ({ children, ...properties }: { children: ReactElement | ReactElement[] } & Record<string, unknown>) => {
    auth0Mocks.lastAuth0Props = properties;
    return <div>{children}</div>;
  },
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: auth0Mocks.Auth0Provider,
  useAuth0: () => auth0Mocks.auth0State,
}));

type HookHarnessProperties = {
  onUpdate: (value: ReturnType<typeof useOptionalAuth>) => void;
};

const HookHarness = ({ onUpdate }: HookHarnessProperties) => {
  const value = useOptionalAuth();
  useEffect(() => {
    onUpdate(value);
  }, [value, onUpdate]);
  return <></>;
};

beforeEach(() => {
  auth0Mocks.auth0State.isAuthenticated = true;
  auth0Mocks.auth0State.isLoading = false;
  auth0Mocks.auth0State.error = undefined;
});

describe('OptionalAuthProvider configuration', () => {
  it('falls back when auth config is missing', async () => {
    let latest: ReturnType<typeof useOptionalAuth> | undefined;

    render(
      <OptionalAuthProvider>
        <HookHarness onUpdate={(value) => { latest = value; }} />
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(latest?.enabled).toBe(false);
      expect(latest?.isAuthenticated).toBe(false);
    });

    await expect(latest?.getAccessTokenSilently()).rejects.toThrow('OAuth is not configured');
  });

  it('provides auth context when config is present', async () => {
    let latest: ReturnType<typeof useOptionalAuth> | undefined;

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc" audience="aud">
        <HookHarness onUpdate={(value) => { latest = value; }} />
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(latest?.enabled).toBe(true);
      expect(latest?.isAuthenticated).toBe(true);
    });

    expect(latest?.loginWithRedirect).toBe(auth0Mocks.auth0State.loginWithRedirect);
    latest?.logout({ logoutParams: { returnTo: 'http://example.com' } });
    expect(auth0Mocks.auth0State.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: 'http://example.com' } });
  });
});

describe('OptionalAuthProvider redirects', () => {
  it('cleans up auth callback params on redirect callback', async () => {
    globalThis.window?.history.pushState({}, '', '/?code=abc&state=def');
    const replaceSpy = vi.spyOn(globalThis.window?.history ?? {}, 'replaceState');

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc" audience="aud">
        <div>child</div>
      </OptionalAuthProvider>
    );

    const onRedirectCallback = auth0Mocks.lastAuth0Props?.onRedirectCallback as ((appState?: unknown) => void) | undefined;
    expect(onRedirectCallback).toBeDefined();

    onRedirectCallback?.({});

    expect(replaceSpy).toHaveBeenCalled();
    const newUrl = globalThis.window?.location.href ?? '';
    expect(newUrl.includes('code=')).toBe(false);
    expect(newUrl.includes('state=')).toBe(false);
  });
  it('continues when sessionStorage is unavailable', async () => {
    const originalSetItem = globalThis.window?.sessionStorage.setItem;
    if (globalThis.window) {
      globalThis.window.sessionStorage.setItem = () => {
        throw new Error('storage blocked');
      };
    }
    globalThis.window?.history.pushState({}, '', '/?code=abc&state=def');
    const replaceSpy = vi.spyOn(globalThis.window?.history ?? {}, 'replaceState');

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc" audience="aud">
        <div>child</div>
      </OptionalAuthProvider>
    );

    const onRedirectCallback = auth0Mocks.lastAuth0Props?.onRedirectCallback as ((appState?: unknown) => void) | undefined;
    onRedirectCallback?.({});

    expect(replaceSpy).toHaveBeenCalled();

    if (globalThis.window && originalSetItem) {
      globalThis.window.sessionStorage.setItem = originalSetItem;
    }
  });
});

describe('OptionalAuthProvider tokens', () => {
  it('handles authenticated user tokens with invalid jwt', async () => {
    auth0Mocks.auth0State.getAccessTokenSilently = vi.fn().mockResolvedValue('invalid-token');

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc">
        <div>child</div>
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(auth0Mocks.auth0State.getAccessTokenSilently).toHaveBeenCalled();
    });
  });

  it('handles authenticated user tokens with email', async () => {
    const payload = btoa(JSON.stringify({ email: 'test@example.com' }));
    auth0Mocks.auth0State.getAccessTokenSilently = vi.fn().mockResolvedValue(`a.${payload}.c`);

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc">
        <div>child</div>
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(auth0Mocks.auth0State.getAccessTokenSilently).toHaveBeenCalled();
    });
  });

  it('handles authenticated user tokens without email', async () => {
    const payload = btoa(JSON.stringify({}));
    auth0Mocks.auth0State.getAccessTokenSilently = vi.fn().mockResolvedValue(`a.${payload}.c`);

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc">
        <div>child</div>
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(auth0Mocks.auth0State.getAccessTokenSilently).toHaveBeenCalled();
    });
  });
});

describe('OptionalAuthProvider errors', () => {
  it('exposes auth error state', async () => {
    let latest: ReturnType<typeof useOptionalAuth> | undefined;
    auth0Mocks.auth0State.error = new Error('Auth failed');

    render(
      <OptionalAuthProvider domain="example.com" clientId="abc">
        <HookHarness onUpdate={(value) => { latest = value; }} />
      </OptionalAuthProvider>
    );

    await waitFor(() => {
      expect(latest?.error?.message).toBe('Auth failed');
    });
  });
});
