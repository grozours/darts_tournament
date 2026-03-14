import type { Tournament, Translator } from './types';

type TournamentPlayersContext = {
  t: Translator;
  editingTournament: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  refreshTournamentDetails?: (tournamentId: string) => Promise<void>;
};

type UnregisteredAccountOption = {
  id: string;
  firstName: string;
  lastName: string;
  surname?: string | null;
  email?: string | null;
};

export type { TournamentPlayersContext, UnregisteredAccountOption };
