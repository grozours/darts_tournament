import { useEffect } from 'react';

type UseLiveTournamentRefreshProperties = {
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const useLiveTournamentRefresh = ({ reloadLiveViews }: UseLiveTournamentRefreshProperties) => {
  useEffect(() => {
    void reloadLiveViews();
  }, [reloadLiveViews]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadLiveViews({ showLoader: false });
    }, 10_000);
    return () => globalThis.clearInterval(intervalId);
  }, [reloadLiveViews]);

  useEffect(() => {
    const handleBracketsUpdated = () => {
      void reloadLiveViews({ showLoader: false });
    };

    globalThis.window?.addEventListener('tournament:brackets-updated', handleBracketsUpdated);
    return () => {
      globalThis.window?.removeEventListener('tournament:brackets-updated', handleBracketsUpdated);
    };
  }, [reloadLiveViews]);
};

export default useLiveTournamentRefresh;
