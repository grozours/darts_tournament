import { useCallback, useState } from 'react';
import { fetchTournamentLiveView } from '../../services/tournament-service';
import type { LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData } from './types';

type UseLiveTournamentLoadersProperties = {
  getSafeAccessToken: () => Promise<string | undefined>;
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

const useLiveTournamentLoaders = ({
  getSafeAccessToken,
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
      const statusParameter = (viewStatus ?? 'LIVE').toUpperCase();
      const response = await fetch(`/api/tournaments?status=${encodeURIComponent(statusParameter)}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      if (!response.ok) {
        throw new Error('Failed to fetch live tournaments');
      }
      const data = await response.json();
      const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
      const liveTournaments = tournaments.filter((t: { status?: string }) =>
        (t.status ?? '').toUpperCase() === statusParameter
      );
      const views = await Promise.all(
        liveTournaments.map((t: { id: string }) => fetchTournamentLiveView(t.id, token))
      );
      setLiveViews(views as LiveViewData[]);
    } catch (error_) {
      console.error('Error fetching live view:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to load live view');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getSafeAccessToken, viewStatus]);

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
