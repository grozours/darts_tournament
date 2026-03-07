export const getBracketMatchAnchorId = (
  tournamentId: string,
  bracketId: string,
  matchId: string
) => `match-${tournamentId}-${bracketId}-${matchId}`;