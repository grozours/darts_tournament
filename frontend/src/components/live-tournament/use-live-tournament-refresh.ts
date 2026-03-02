import { useEffect } from 'react';

type UseLiveTournamentRefreshProperties = {
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  canRefresh: boolean;
  refreshIntervalMs?: number;
};

const useLiveTournamentRefresh = ({
  reloadLiveViews,
  canRefresh,
  refreshIntervalMs = 10_000,
}: UseLiveTournamentRefreshProperties) => {
  useEffect(() => {
    if (!canRefresh) {
      return;
    }
    void reloadLiveViews();
  }, [canRefresh, reloadLiveViews]);

  useEffect(() => {
    if (!canRefresh) {
      return;
    }
    const intervalId = globalThis.setInterval(() => {
      void reloadLiveViews({ showLoader: false });
    }, refreshIntervalMs);
    return () => globalThis.clearInterval(intervalId);
  }, [canRefresh, refreshIntervalMs, reloadLiveViews]);

  useEffect(() => {
    if (!canRefresh) {
      return;
    }
    const handleBracketsUpdated = () => {
      void reloadLiveViews({ showLoader: false });
    };

    globalThis.window?.addEventListener('tournament:brackets-updated', handleBracketsUpdated);
    return () => {
      globalThis.window?.removeEventListener('tournament:brackets-updated', handleBracketsUpdated);
    };
  }, [canRefresh, reloadLiveViews]);
};

export default useLiveTournamentRefresh;
