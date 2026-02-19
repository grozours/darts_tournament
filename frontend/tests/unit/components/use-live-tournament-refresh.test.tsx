import { act, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import useLiveTournamentRefresh from '../../../src/components/live-tournament/use-live-tournament-refresh';

type HookHarnessProperties = {
  authEnabled: boolean;
  isAuthenticated: boolean;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const HookHarness = ({ authEnabled, isAuthenticated, reloadLiveViews }: HookHarnessProperties) => {
  useLiveTournamentRefresh({ authEnabled, isAuthenticated, reloadLiveViews });
  useEffect(() => {}, []);
  return <></>;
};

describe('useLiveTournamentRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('reloads when auth is disabled', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        authEnabled={false}
        isAuthenticated={false}
        reloadLiveViews={reloadLiveViews}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(reloadLiveViews).toHaveBeenCalledTimes(1);
  });

  it('does not reload when auth is enabled but unauthenticated', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        authEnabled={true}
        isAuthenticated={false}
        reloadLiveViews={reloadLiveViews}
      />
    );

    await act(async () => {});
    expect(reloadLiveViews).not.toHaveBeenCalled();
  });

  it('reloads when auth is enabled and authenticated', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        authEnabled={true}
        isAuthenticated={true}
        reloadLiveViews={reloadLiveViews}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(reloadLiveViews).toHaveBeenCalledTimes(1);
  });

  it('reloads on interval without showing loader', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        authEnabled={false}
        isAuthenticated={false}
        reloadLiveViews={reloadLiveViews}
      />
    );

    reloadLiveViews.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
  });
});
