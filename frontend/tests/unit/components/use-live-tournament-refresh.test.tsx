import { render } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import useLiveTournamentRefresh from '../../../src/components/live-tournament/use-live-tournament-refresh';

type HookHarnessProperties = {
  canRefresh: boolean;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const HookHarness = ({ canRefresh, reloadLiveViews }: HookHarnessProperties) => {
  useLiveTournamentRefresh({ canRefresh, reloadLiveViews });
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
        canRefresh
        reloadLiveViews={reloadLiveViews}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(reloadLiveViews).toHaveBeenCalledTimes(1);
  });

  it('reloads when auth is enabled but unauthenticated', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        canRefresh
        reloadLiveViews={reloadLiveViews}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(reloadLiveViews).toHaveBeenCalledTimes(1);
  });

  it('reloads when auth is enabled and authenticated', async () => {
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});

    render(
      <HookHarness
        canRefresh
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
        canRefresh
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
