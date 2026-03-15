import { useCallback, useState } from 'react';
import { fetchLiveTournamentSummary, fetchTournamentLiveView } from '../../services/tournament-service';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData } from './types';

type UseLiveTournamentLoadersProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
  viewMode: string | undefined;
  viewStatus: LiveViewStatus | undefined;
  tournamentId: string | undefined;
  isAggregateView: boolean;
};

type LiveTournamentLoadersResult = {
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
};

type LiveTournamentIdentifier = {
  id: string;
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

const updateTournamentIdInUrl = (tournamentId: string): void => {
  const windowReference = globalThis.window;
  if (!windowReference) {
    return;
  }

  const url = new URL(windowReference.location.href);
  url.searchParams.set('tournamentId', tournamentId);
  windowReference.history.replaceState({}, '', `${url.pathname}${url.search}`);
};

const resolveLiveFallbackTournamentId = (
  fallbackViews: LiveTournamentIdentifier[],
  currentTournamentId?: string
): string | undefined => {
  const firstLiveView = fallbackViews.at(0);
  if (!firstLiveView) {
    return undefined;
  }

  if (currentTournamentId && fallbackViews.some((view) => view.id === currentTournamentId)) {
    return currentTournamentId;
  }

  return firstLiveView.id;
};

type ResolveSingleLiveErrorProperties = {
  errorValue: unknown;
  hasAttemptsLeft: boolean;
  tournamentId: string;
  getSafeAccessToken: () => Promise<string | undefined>;
  setLiveViews: (value: LiveViewData[]) => void;
  setError: (value: string | undefined) => void;
};

const resolveSingleLiveError = async ({
  errorValue,
  hasAttemptsLeft,
  tournamentId,
  getSafeAccessToken,
  setLiveViews,
  setError,
}: ResolveSingleLiveErrorProperties): Promise<{ retry: boolean; handled: boolean }> => {
  const isTransientNotLive = getErrorCode(errorValue) === 'TOURNAMENT_NOT_LIVE';

  if (isTransientNotLive && hasAttemptsLeft) {
    await wait(NOT_LIVE_RETRY_DELAY_MS);
    return { retry: true, handled: true };
  }

  if (isTransientNotLive) {
    const token = await getSafeAccessToken();
    const fallbackViews = await fetchViewsForStatuses(['LIVE'], token);
    const fallbackTournamentId = resolveLiveFallbackTournamentId(fallbackViews, tournamentId);

    if (fallbackTournamentId && fallbackTournamentId !== tournamentId) {
      const fallbackData = (await fetchTournamentLiveView(fallbackTournamentId, token)) as LiveViewData;
      setLiveViews([fallbackData]);
      setError(undefined);
      updateTournamentIdInUrl(fallbackTournamentId);
      return { retry: false, handled: true };
    }
  }

  setError(getUserFacingError(errorValue));
  return { retry: false, handled: false };
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
          const { retry } = await resolveSingleLiveError({
            errorValue: error_,
            hasAttemptsLeft: attempt < MAX_NOT_LIVE_RETRIES,
            tournamentId,
            getSafeAccessToken,
            setLiveViews,
            setError,
          });

          if (retry) {
            continue;
          }
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
