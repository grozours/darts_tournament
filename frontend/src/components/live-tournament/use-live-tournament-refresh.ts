import { useEffect } from 'react';

type UseLiveTournamentRefreshProperties = {
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  canRefresh: boolean;
};

const useLiveTournamentRefresh = ({ reloadLiveViews, canRefresh }: UseLiveTournamentRefreshProperties) => {
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
    }, 10_000);
    return () => globalThis.clearInterval(intervalId);
  }, [canRefresh, reloadLiveViews]);

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
