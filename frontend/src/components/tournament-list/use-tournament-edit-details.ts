import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import type { Tournament } from './types';

type UseTournamentEditDetailsProperties = {
  editingTournament?: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  fetchPlayers: (tournamentId: string) => Promise<void>;
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
};

type TournamentEditDetailsResult = {
  fetchTournamentDetails: (tournamentId: string) => Promise<void>;
};

const useTournamentEditDetails = ({
  editingTournament,
  getSafeAccessToken,
  fetchPlayers,
  setEditingTournament,
}: UseTournamentEditDetailsProperties): TournamentEditDetailsResult => {
  useEffect(() => {
    if (!editingTournament) return;
    const normalizedStatus = normalizeTournamentStatus(editingTournament.status);
    if (normalizedStatus === 'OPEN' || normalizedStatus === 'SIGNATURE') {
      void fetchPlayers(editingTournament.id);
    }
  }, [editingTournament, fetchPlayers]);

  const fetchTournamentDetails = useCallback(async (tournamentId: string) => {
    try {
      const token = await getSafeAccessToken();
      const response = await fetch(`/api/tournaments/${tournamentId}`, token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {});
      if (!response.ok) {
        throw new Error('Failed to fetch tournament details');
      }
      const data = await response.json();
      setEditingTournament((current) => (current ? { ...current, ...data } : data));
    } catch (error_) {
      console.error('Error fetching tournament details:', error_);
    }
  }, [getSafeAccessToken, setEditingTournament]);

  return { fetchTournamentDetails };
};

export default useTournamentEditDetails;
