type LiveTournamentMatchKeyResult = {
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
};

const useLiveTournamentMatchKey = (): LiveTournamentMatchKeyResult => ({
  getMatchKey: (matchTournamentId: string, matchId: string) => `${matchTournamentId}:${matchId}`,
});

export default useLiveTournamentMatchKey;
