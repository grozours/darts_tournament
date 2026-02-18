import { useEffect } from 'react';

type UseLiveTournamentRefreshProperties = {
  authEnabled: boolean;
  isAuthenticated: boolean;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const useLiveTournamentRefresh = ({
  authEnabled,
  isAuthenticated,
  reloadLiveViews,
}: UseLiveTournamentRefreshProperties) => {
  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      void reloadLiveViews();
    }
  }, [authEnabled, isAuthenticated, reloadLiveViews]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadLiveViews({ showLoader: false });
    }, 10_000);
    return () => globalThis.clearInterval(intervalId);
  }, [reloadLiveViews]);
};

export default useLiveTournamentRefresh;
