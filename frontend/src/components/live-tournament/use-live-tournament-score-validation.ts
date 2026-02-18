import type { LiveViewMatch } from './types';

type ScoresValidationResult = { scores?: { playerId: string; scoreTotal: number }[]; error?: string };

const validateMatchScores = (
  match: LiveViewMatch,
  scoresForMatch: Record<string, string>,
  insufficientPlayersMessage: string
): ScoresValidationResult => {
  if (!match.playerMatches || match.playerMatches.length < 2) {
    return { error: insufficientPlayersMessage };
  }

  const scores = match.playerMatches.map((playerMatch) => ({
    playerId: playerMatch.player?.id || '',
    scoreTotal: Number(scoresForMatch[playerMatch.player?.id || ''] ?? ''),
  }));

  if (scores.some((score) => !score.playerId || Number.isNaN(score.scoreTotal))) {
    return { error: 'Please enter valid scores for all players.' };
  }

  return { scores };
};

export default validateMatchScores;
