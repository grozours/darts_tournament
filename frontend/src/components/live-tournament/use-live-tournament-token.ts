import { useCallback } from 'react';

type UseLiveTournamentTokenProperties = {
  authEnabled: boolean;
  isAuthenticated: boolean;
  getAccessTokenSilently: () => Promise<string>;
};

type LiveTournamentTokenResult = {
  getSafeAccessToken: () => Promise<string | undefined>;
};

const useLiveTournamentToken = ({
  authEnabled,
  isAuthenticated,
  getAccessTokenSilently,
}: UseLiveTournamentTokenProperties): LiveTournamentTokenResult => {
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      console.warn('Failed to get access token, proceeding without auth:', error);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);

  return { getSafeAccessToken };
};

export default useLiveTournamentToken;
