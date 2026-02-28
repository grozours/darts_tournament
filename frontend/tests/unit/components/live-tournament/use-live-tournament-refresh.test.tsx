import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useLiveTournamentRefresh from '../../../../src/components/live-tournament/use-live-tournament-refresh';

describe('useLiveTournamentRefresh', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when refresh is disabled', () => {
    const reloadLiveViews = vi.fn(async () => undefined);

    renderHook(() => useLiveTournamentRefresh({
      reloadLiveViews,
      canRefresh: false,
    }));

    expect(reloadLiveViews).not.toHaveBeenCalled();
  });

  it('reloads immediately, on interval, and on bracket update event', () => {
    vi.useFakeTimers();
    const reloadLiveViews = vi.fn(async () => undefined);

    renderHook(() => useLiveTournamentRefresh({
      reloadLiveViews,
      canRefresh: true,
    }));

    expect(reloadLiveViews).toHaveBeenCalledTimes(1);
    expect(reloadLiveViews).toHaveBeenLastCalledWith();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });

    act(() => {
      globalThis.window.dispatchEvent(new Event('tournament:brackets-updated'));
    });
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
  });
});
