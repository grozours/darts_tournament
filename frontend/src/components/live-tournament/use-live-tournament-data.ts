import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData, LiveViewMode, MatchQueueItem } from './types';
import useLiveTournamentGlobalQueue from './use-live-tournament-global-queue';
import useLiveTournamentLoaders from './use-live-tournament-loaders';
import useLiveTournamentSelection from './use-live-tournament-selection';

type UseLiveTournamentDataProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  tournamentId?: string | undefined;
  isAggregateView: boolean;
};

type LiveTournamentDataResult = {
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  visibleLiveViews: LiveViewData[];
  displayedLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  setSelectedLiveTournamentId: (value: string) => void;
  selectedPoolStagesTournamentId: string;
  setSelectedPoolStagesTournamentId: (value: string) => void;
  showGlobalQueue: boolean;
  globalQueue: MatchQueueItem[];
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
    viewStatus,
    tournamentId,
    isAggregateView,
  });
  const {
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
  } = useLiveTournamentSelection({
    viewMode,
    viewStatus,
    tournamentId,
    liveViews,
  });
  const { showGlobalQueue, globalQueue } = useLiveTournamentGlobalQueue({
    viewMode,
    viewStatus,
    displayedLiveViews,
    selectedLiveTournamentId,
    visibleLiveViewsCount: visibleLiveViews.length,
  });

  return {
    liveViews,
    loading,
    error,
    setError,
    reloadLiveViews,
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
    showGlobalQueue,
    globalQueue,
  };
};

export default useLiveTournamentData;
