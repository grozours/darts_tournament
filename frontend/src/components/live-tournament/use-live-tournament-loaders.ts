import { useCallback, useState } from 'react';
import { fetchLiveTournamentSummary, fetchTournamentLiveView } from '../../services/tournament-service';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData } from './types';

type UseLiveTournamentLoadersProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  viewMode?: string | undefined;
  viewStatus?: LiveViewStatus;
  tournamentId?: string | undefined;
  isAggregateView: boolean;
};

type LiveTournamentLoadersResult = {
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

const getErrorCode = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as { code?: unknown };
  return typeof candidate.code === 'string' ? candidate.code : undefined;
};

const getUserFacingError = (value: unknown): string => {
  const code = getErrorCode(value);
  if (code === 'TOURNAMENT_NOT_LIVE') {
    return 'Tournament is not open for live view yet';
  }
  if (value instanceof Error && value.message.trim() !== '') {
    return value.message;
  }
  return 'Failed to load live view';
};

const wait = (durationMs: number): Promise<void> => new Promise((resolve) => {
  globalThis.setTimeout(resolve, durationMs);
});

const MAX_NOT_LIVE_RETRIES = 4;
const NOT_LIVE_RETRY_DELAY_MS = 1200;

const getStatusList = (viewMode?: string, viewStatus?: LiveViewStatus): string[] => {
  if (viewMode === 'pool-stages' && !viewStatus) {
    return ['LIVE', 'OPEN', 'SIGNATURE'];
  }
  return [(viewStatus ?? 'LIVE').toUpperCase()];
};

const fetchViewsForStatuses = async (
  statuses: string[],
  token?: string
): Promise<LiveViewData[]> => {
  const views = await fetchLiveTournamentSummary(statuses, token);
  return views as LiveViewData[];
};

const useLiveTournamentLoaders = ({
  getSafeAccessToken,
  viewMode,
  viewStatus,
  tournamentId,
  isAggregateView,
}: UseLiveTournamentLoadersProperties): LiveTournamentLoadersResult => {
  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadSingleLiveView = useCallback(async (options?: { showLoader?: boolean }) => {
    if (!tournamentId) return;
    const showLoader = options?.showLoader ?? true;
    if (showLoader) {
      setLoading(true);
    }
    setError(undefined);

    try {
      for (let attempt = 0; attempt <= MAX_NOT_LIVE_RETRIES; attempt += 1) {
        try {
          const token = await getSafeAccessToken();
          const data = (await fetchTournamentLiveView(tournamentId, token)) as LiveViewData;
          setLiveViews([data]);
          return;
        } catch (error_) {
          const isTransientNotLive = getErrorCode(error_) === 'TOURNAMENT_NOT_LIVE';
          const hasAttemptsLeft = attempt < MAX_NOT_LIVE_RETRIES;

          if (isTransientNotLive && hasAttemptsLeft) {
            await wait(NOT_LIVE_RETRY_DELAY_MS);
            continue;
          }

          setError(getUserFacingError(error_));
          return;
        }
      }
    } catch (error_) {
      setError(getUserFacingError(error_));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getSafeAccessToken, tournamentId]);

  const loadAggregateLiveViews = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    if (showLoader) {
      setLoading(true);
    }
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      const statusList = getStatusList(viewMode, viewStatus);
      const views = await fetchViewsForStatuses(statusList, token);
      setLiveViews(views);
    } catch (error_) {
      setError(getUserFacingError(error_));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getSafeAccessToken, viewMode, viewStatus]);

  const reloadLiveViews = useCallback(async (options?: { showLoader?: boolean }) => {
    if (isAggregateView) {
      await loadAggregateLiveViews(options);
      return;
    }
    await loadSingleLiveView(options);
  }, [isAggregateView, loadAggregateLiveViews, loadSingleLiveView]);

  return {
    liveViews,
    loading,
    error,
    setError,
    reloadLiveViews,
  };
};

export default useLiveTournamentLoaders;
