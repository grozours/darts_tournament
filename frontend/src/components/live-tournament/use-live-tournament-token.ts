import { useCallback } from 'react';

type UseLiveTournamentTokenProperties = {
  authEnabled: boolean;
  isAuthenticated: boolean;
  getAccessTokenSilently: () => Promise<string>;
};

type LiveTournamentTokenResult = {
  getSafeAccessToken: () => Promise<string | undefined>;
};

const wait = (durationMs: number): Promise<void> => new Promise((resolve) => {
  globalThis.setTimeout(resolve, durationMs);
});

const useLiveTournamentToken = ({
  authEnabled,
  isAuthenticated,
  getAccessTokenSilently,
}: UseLiveTournamentTokenProperties): LiveTournamentTokenResult => {
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) return undefined;

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await getAccessTokenSilently();
      } catch {
        if (attempt < maxAttempts) {
          await wait(400);
          continue;
        }
        return undefined;
      }
    }

    return undefined;
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);

  return { getSafeAccessToken };
};

export default useLiveTournamentToken;
