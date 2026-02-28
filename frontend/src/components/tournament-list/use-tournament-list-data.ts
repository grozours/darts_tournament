import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tournament } from './types';

type UseTournamentListDataProperties = {
  authEnabled: boolean;
  isAuthenticated: boolean;
  getSafeAccessToken: () => Promise<string | undefined>;
};

type TournamentListDataResult = {
  tournaments: Tournament[];
  loading: boolean;
  error: string | undefined;
  fetchTournaments: () => Promise<void>;
  deleteTournament: (tournamentId: string) => Promise<void>;
};

const useTournamentListData = (
  { getSafeAccessToken }: UseTournamentListDataProperties
): TournamentListDataResult => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const latestFetchRequestId = useRef(0);

  const fetchTournaments = useCallback(async () => {
    latestFetchRequestId.current += 1;
    const requestId = latestFetchRequestId.current;
    setLoading(true);
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      const response = await fetch('/api/tournaments', token
        ? { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
        : { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch tournaments: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const normalizedTournaments = (data.tournaments || []).map((item: Tournament) => {
        const fallbackLogoUrl = (item as Tournament & { logo_url?: string }).logo_url;
        return {
          ...item,
          logoUrl: item.logoUrl ?? fallbackLogoUrl,
        };
      });
      if (requestId === latestFetchRequestId.current) {
        setTournaments(normalizedTournaments);
      }
    } catch (error_) {
      if (requestId === latestFetchRequestId.current) {
        setError(error_ instanceof Error ? error_.message : 'Failed to fetch tournaments');
      }
    } finally {
      if (requestId === latestFetchRequestId.current) {
        setLoading(false);
      }
    }
  }, [getSafeAccessToken]);

  const deleteTournament = useCallback(async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
      const token = await getSafeAccessToken();
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'DELETE',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });

      if (response.ok) {
        await fetchTournaments();
      } else {
        alert('Failed to delete tournament');
      }
    } catch {
      alert('Failed to delete tournament');
    }
  }, [fetchTournaments, getSafeAccessToken]);

  useEffect(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  return {
    tournaments,
    loading,
    error,
    fetchTournaments,
    deleteTournament,
  };
};

export default useTournamentListData;
