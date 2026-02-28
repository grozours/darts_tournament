import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import useLiveTournamentToken from '../../../../src/components/live-tournament/use-live-tournament-token';

describe('useLiveTournamentToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined when auth is disabled', async () => {
    const getAccessTokenSilently = vi.fn(async () => 'token');
    const { result } = renderHook(() => useLiveTournamentToken({
      authEnabled: false,
      isAuthenticated: true,
      getAccessTokenSilently,
    }));

    await expect(result.current.getSafeAccessToken()).resolves.toBeUndefined();
    expect(getAccessTokenSilently).not.toHaveBeenCalled();
  });

  it('retries and resolves token before max attempts', async () => {
    const getAccessTokenSilently = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('token-123');

    const { result } = renderHook(() => useLiveTournamentToken({
      authEnabled: true,
      isAuthenticated: true,
      getAccessTokenSilently,
    }));

    const promise = result.current.getSafeAccessToken();
    await vi.advanceTimersByTimeAsync(400);

    await expect(promise).resolves.toBe('token-123');
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(2);
  });

  it('returns undefined and warns after max retries', async () => {
    const getAccessTokenSilently = vi.fn().mockRejectedValue(new Error('always fails'));

    const { result } = renderHook(() => useLiveTournamentToken({
      authEnabled: true,
      isAuthenticated: true,
      getAccessTokenSilently,
    }));

    const promise = result.current.getSafeAccessToken();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBeUndefined();
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(3);
  });
});
