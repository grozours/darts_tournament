import { useMemo } from 'react';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import { buildMatchQueue } from './queue-utilities';
import type { LiveViewData, LiveViewMode, MatchQueueItem } from './types';
import { filterPoolStagesForView } from './view-utilities';

type UseLiveTournamentGlobalQueueProperties = {
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  displayedLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  visibleLiveViewsCount: number;
};

type LiveTournamentGlobalQueueResult = {
  showGlobalQueue: boolean;
  globalQueue: MatchQueueItem[];
};

const useLiveTournamentGlobalQueue = ({
  viewMode,
  viewStatus,
  displayedLiveViews,
  selectedLiveTournamentId,
  visibleLiveViewsCount,
}: UseLiveTournamentGlobalQueueProperties): LiveTournamentGlobalQueueResult => {
  const showGlobalQueue = viewMode === 'live'
    && selectedLiveTournamentId === 'ALL'
    && visibleLiveViewsCount > 1;

  const globalQueue = useMemo(() => {
    if (!showGlobalQueue) {
      return [] as MatchQueueItem[];
    }
    const sortedViews = [...displayedLiveViews].toSorted((a, b) => a.name.localeCompare(b.name));
    return sortedViews.flatMap((view) =>
      buildMatchQueue(view, filterPoolStagesForView(viewMode, viewStatus, view.poolStages))
    );
  }, [displayedLiveViews, showGlobalQueue, viewMode, viewStatus]);

  return { showGlobalQueue, globalQueue };
};

export default useLiveTournamentGlobalQueue;
