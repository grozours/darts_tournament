import { useCallback, useEffect, useState } from 'react';
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

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      console.log('[TournamentList] Fetching tournaments, token:', token ? 'present' : 'none');
      const response = await fetch('/api/tournaments', token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {});
      console.log('[TournamentList] Response status:', response.status, response.statusText);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TournamentList] Response error:', errorText);
        throw new Error(`Failed to fetch tournaments: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[TournamentList] Received tournaments:', data.tournaments?.length || 0);
      const normalizedTournaments = (data.tournaments || []).map((item: Tournament) => {
        const fallbackLogoUrl = (item as Tournament & { logo_url?: string }).logo_url;
        return {
          ...item,
          logoUrl: item.logoUrl ?? fallbackLogoUrl,
        };
      });
      setTournaments(normalizedTournaments);
    } catch (error_) {
      console.error('[TournamentList] Error fetching tournaments:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
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
    } catch (error_) {
      console.error('Error deleting tournament:', error_);
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
