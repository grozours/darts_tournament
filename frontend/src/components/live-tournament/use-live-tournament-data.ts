import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData } from './types';
import useLiveTournamentLoaders from './use-live-tournament-loaders';

type UseLiveTournamentDataProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  viewMode: string | undefined;
  viewStatus: LiveViewStatus | undefined;
  tournamentId: string | undefined;
  isAggregateView: boolean;
};

type LiveTournamentDataResult = {
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const useLiveTournamentData = ({
  getSafeAccessToken,
  viewMode,
  viewStatus,
  tournamentId,
  isAggregateView,
}: UseLiveTournamentDataProperties): LiveTournamentDataResult => {
  const { liveViews, loading, error, setError, reloadLiveViews } = useLiveTournamentLoaders({
    getSafeAccessToken,
    viewMode,
    viewStatus,
    tournamentId,
    isAggregateView,
  });

  return {
    liveViews,
    loading,
    error,
    setError,
    reloadLiveViews,
  };
};

export default useLiveTournamentData;
