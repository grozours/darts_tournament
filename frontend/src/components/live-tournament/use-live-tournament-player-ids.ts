import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTournamentPlayers } from '../../services/tournament-service';
import type { LiveViewData } from './types';

type UseLiveTournamentPlayerIdsProperties = {
  liveViews: LiveViewData[];
  isAuthenticated: boolean;
  user?: { email?: string };
  fallbackUserEmail?: string;
  getSafeAccessToken: () => Promise<string | undefined>;
};

type LiveTournamentPlayerIdsResult = {
  playerIdByTournament: Record<string, string>;
};

const buildPlayerIdMap = (entries: Array<readonly [string, string] | undefined>) => {
  const filtered = entries.filter(Boolean) as Array<readonly [string, string]>;
  return Object.fromEntries(filtered);
};

const useLiveTournamentPlayerIds = ({
  liveViews,
  isAuthenticated,
  user,
  fallbackUserEmail,
  getSafeAccessToken,
}: UseLiveTournamentPlayerIdsProperties): LiveTournamentPlayerIdsResult => {
  const [playerIdByTournament, setPlayerIdByTournament] = useState<Record<string, string>>({});
  const userEmail = useMemo(
    () => (user?.email ?? fallbackUserEmail ?? '').toLowerCase(),
    [fallbackUserEmail, user?.email]
  );

  const fetchPlayerIdForView = useCallback(async (viewId: string, token: string | undefined) => {
    try {
      const players = await fetchTournamentPlayers(viewId, token);
      const matched = players.find((player) => (player.email ?? '').toLowerCase() === userEmail);
      return matched ? ([viewId, matched.playerId] as const) : undefined;
    } catch {
      return;
    }
  }, [userEmail]);

  useEffect(() => {
    let isMounted = true;

    const loadPlayerIds = async () => {
      if (!userEmail || liveViews.length === 0) {
        if (isMounted) {
          setPlayerIdByTournament({});
        }
        return;
      }

      const token = await getSafeAccessToken();
      const entries = await Promise.all(
        liveViews.map((view) => fetchPlayerIdForView(view.id, token))
      );
      const next = buildPlayerIdMap(entries);

      if (isMounted) {
        setPlayerIdByTournament(next);
      }
    };

    void loadPlayerIds();

    return () => {
      isMounted = false;
    };
  }, [fetchPlayerIdForView, getSafeAccessToken, isAuthenticated, liveViews, userEmail]);

  return { playerIdByTournament };
};

export default useLiveTournamentPlayerIds;
