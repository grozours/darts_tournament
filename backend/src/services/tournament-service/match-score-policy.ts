import { AppError } from '../../middleware/error-handler';

export type MatchScoreInput = { playerId: string; scoreTotal: number };

export type MatchScoreWithWinner = MatchScoreInput & { isWinner: boolean };

export type MatchWithParticipants = {
  playerMatches: Array<{ playerId: string }>;
};

export const normalizeMatchScores = (
  match: MatchWithParticipants,
  scores: MatchScoreInput[]
): MatchScoreInput[] => {
  const participantIds = new Set(match.playerMatches.map((playerMatch) => playerMatch.playerId));
  if (scores.length < 2) {
    throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
  }

  const invalidScore = scores.find((score) => !participantIds.has(score.playerId));
  if (invalidScore) {
    throw new AppError('Invalid player score entry', 400, 'MATCH_SCORE_INVALID_PLAYER');
  }

  return scores
    .filter((score) => participantIds.has(score.playerId))
    .map((score) => ({
      playerId: score.playerId,
      scoreTotal: score.scoreTotal,
    }));
};

export const resolveWinnerAndResultScores = (scores: MatchScoreInput[]) => {
  const sorted = [...scores].sort((left, right) => right.scoreTotal - left.scoreTotal);
  if (sorted.length < 2) {
    throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
  }
  const [first, second] = sorted;
  if (!first || !second) {
    throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
  }
  if (first.scoreTotal === second.scoreTotal) {
    throw new AppError('Match cannot end in a tie', 400, 'MATCH_SCORE_TIED');
  }

  const winnerId = first.playerId;
  const resultScores: MatchScoreWithWinner[] = scores.map((score) => ({
    ...score,
    isWinner: score.playerId === winnerId,
  }));
  return { winnerId, resultScores };
};
