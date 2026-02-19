import { useCallback, useState } from 'react';
import { fetchTournamentLiveView } from '../../services/tournament-service';
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

const getStatusList = (viewMode?: string, viewStatus?: LiveViewStatus): string[] => {
  if (viewMode === 'pool-stages' && !viewStatus) {
    return ['LIVE', 'OPEN'];
  }
  return [(viewStatus ?? 'LIVE').toUpperCase()];
};

const fetchViewsForStatus = async (
  statusParameter: string,
  token?: string
): Promise<LiveViewData[]> => {
  const response = await fetch(`/api/tournaments?status=${encodeURIComponent(statusParameter)}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  if (!response.ok) {
    throw new Error('Failed to fetch live tournaments');
  }
  const data = await response.json();
  const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
  const filteredTournaments = tournaments.filter((t: { status?: string }) =>
    (t.status ?? '').toUpperCase() === statusParameter
  );
  const results = await Promise.allSettled(
    filteredTournaments.map((t: { id: string }) => fetchTournamentLiveView(t.id, token))
  );
  const views = results
    .filter((result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled')
    .map((result) => result.value as LiveViewData);
  return views;
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
      const token = await getSafeAccessToken();
      const data = (await fetchTournamentLiveView(tournamentId, token)) as LiveViewData;
      setLiveViews([data]);
    } catch (error_) {
      console.error('Error fetching live view:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to load live view');
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

      const viewMap = new Map<string, LiveViewData>();

      for (const statusParameter of statusList) {
        const views = await fetchViewsForStatus(statusParameter, token);
        for (const view of views) {
          viewMap.set(view.id, view);
        }
      }

      setLiveViews([...viewMap.values()]);
    } catch (error_) {
      console.error('Error fetching live view:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to load live view');
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
