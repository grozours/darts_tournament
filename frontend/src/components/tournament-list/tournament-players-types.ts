import type { Tournament, Translator } from './types';

type TournamentPlayersContext = {
  t: Translator;
  editingTournament: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  refreshTournamentDetails?: (tournamentId: string) => Promise<void>;
};

export type { TournamentPlayersContext };
