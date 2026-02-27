import { render, waitFor } from '@testing-library/react';
import { act, useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useAdminStatus } from '../../../src/auth/use-admin-status';

const authState = {
  enabled: true,
  isAuthenticated: true,
  isLoading: false,
  getAccessTokenSilently: vi.fn().mockResolvedValue('token'),
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

type HookHarnessProperties<T> = {
  useHook: () => T;
  onUpdate: (value: T) => void;
};

const HookHarness = <T,>({ useHook, onUpdate }: HookHarnessProperties<T>) => {
  const value = useHook();
  useEffect(() => {
    onUpdate(value);
  }, [value, onUpdate]);
  return <></>;
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  authState.enabled = true;
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.getAccessTokenSilently = vi.fn().mockResolvedValue('token');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('useAdminStatus prerequisites', () => {
  it('returns false when auth is disabled', async () => {
    let latest: ReturnType<typeof useAdminStatus> | undefined;
    authState.enabled = false;
    globalThis.fetch = vi.fn();

    render(
      <HookHarness
        useHook={() => useAdminStatus()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.isAdmin).toBe(false);
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/me'), {
      headers: {},
    });
  });

  it('skips fetch while auth is loading', async () => {
    let latest: ReturnType<typeof useAdminStatus> | undefined;
    authState.isLoading = true;
    globalThis.fetch = vi.fn();

    render(
      <HookHarness
        useHook={() => useAdminStatus()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {});
    expect(latest?.isAdmin).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('useAdminStatus fetch responses', () => {
  it('sets admin true on successful response', async () => {
    let latest: ReturnType<typeof useAdminStatus> | undefined;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ isAdmin: true }),
    });

    render(
      <HookHarness
        useHook={() => useAdminStatus()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.isAdmin).toBe(true);
      expect(latest?.checkingAdmin).toBe(false);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/me'), {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('returns false when response is not ok', async () => {
    let latest: ReturnType<typeof useAdminStatus> | undefined;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    render(
      <HookHarness
        useHook={() => useAdminStatus()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.isAdmin).toBe(false);
      expect(latest?.checkingAdmin).toBe(false);
    });
  });

  it('returns false when fetch throws', async () => {
    let latest: ReturnType<typeof useAdminStatus> | undefined;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));

    render(
      <HookHarness
        useHook={() => useAdminStatus()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.isAdmin).toBe(false);
      expect(latest?.checkingAdmin).toBe(false);
    });
  });
});
