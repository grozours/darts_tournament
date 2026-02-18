import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { fetchTournamentLiveView } from '../../services/tournament-service';
import type { LiveViewData, Translator } from './types';

type UseTargetsViewDataProperties = {
  t: Translator;
  authEnabled: boolean;
  getAccessTokenSilently: () => Promise<string>;
  tournamentId: string | undefined;
};

type TargetsViewDataResult = {
  liveViews: LiveViewData[];
  loading: boolean;
  error: string | undefined;
  setError: (value: string | undefined) => void;
  setLiveViews: Dispatch<SetStateAction<LiveViewData[]>>;
  loadTargets: (options?: { silent?: boolean }) => Promise<void>;
  fetchLiveViews: (token?: string) => Promise<LiveViewData[]>;
  getSafeAccessToken: () => Promise<string | undefined>;
};

const useTargetsViewData = ({
  t,
  authEnabled,
  getAccessTokenSilently,
  tournamentId,
}: UseTargetsViewDataProperties): TargetsViewDataResult => {
  const [liveViews, setLiveViews] = useState<LiveViewData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (error_) {
      console.warn('Failed to get access token, proceeding without auth:', error_);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const fetchLiveViews = useCallback(async (token?: string): Promise<LiveViewData[]> => {
    if (tournamentId) {
      const data = (await fetchTournamentLiveView(tournamentId, token)) as LiveViewData;
      return [data];
    }

    const response = await fetch('/api/tournaments?status=LIVE', token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {});
    if (!response.ok) {
      throw new Error('Failed to fetch live tournaments');
    }
    const data = await response.json();
    const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
    const liveTournaments = tournaments.filter((item: { status?: string }) =>
      (item.status ?? '').toUpperCase() === 'LIVE'
    );
    const views = await Promise.all(
      liveTournaments.map((item: { id: string }) => fetchTournamentLiveView(item.id, token))
    );
    return views as LiveViewData[];
  }, [tournamentId]);

  const loadTargets = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent ?? false;
    if (!isSilent) {
      setLoading(true);
      setError(undefined);
    }
    try {
      const token = await getSafeAccessToken();
      const views = await fetchLiveViews(token);
      setLiveViews(views);
    } catch (error_) {
      console.error('Error fetching targets view:', error_);
      if (!isSilent) {
        setError(error_ instanceof Error ? error_.message : t('targets.error'));
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [fetchLiveViews, getSafeAccessToken, t]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void loadTargets({ silent: true });
    }, 10_000);
    return () => globalThis.clearInterval(intervalId);
  }, [loadTargets]);

  return {
    liveViews,
    loading,
    error,
    setError,
    setLiveViews,
    loadTargets,
    fetchLiveViews,
    getSafeAccessToken,
  };
};

export default useTargetsViewData;
