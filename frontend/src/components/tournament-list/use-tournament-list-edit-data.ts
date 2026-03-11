import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Tournament } from './types';

type UseTournamentListEditDataProperties = {
  editingTournamentId: string | undefined;
  authEnabled: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  loadTargets: (tournamentId: string) => Promise<void>;
  getSafeAccessToken: () => Promise<string | undefined>;
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
};

const useTournamentListEditData = ({
  editingTournamentId,
  authEnabled,
  authLoading,
  isAuthenticated,
  loadTargets,
  getSafeAccessToken,
  setEditingTournament,
}: UseTournamentListEditDataProperties) => {
  const refreshTournamentDetails = useCallback(async (tournamentId: string) => {
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
    } catch {
      void 0;
    }
  }, [getSafeAccessToken, setEditingTournament]);

  useEffect(() => {
    if (!editingTournamentId) {
      return;
    }
    if (authEnabled && (authLoading || !isAuthenticated)) {
      return;
    }
    void loadTargets(editingTournamentId);
  }, [authEnabled, authLoading, editingTournamentId, isAuthenticated, loadTargets]);

  return { refreshTournamentDetails };
};

export default useTournamentListEditData;
