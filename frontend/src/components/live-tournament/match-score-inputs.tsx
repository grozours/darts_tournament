import type { LiveViewMatch } from './types';

type MatchScoreInputsProperties = {
  matchTournamentId: string;
  match: LiveViewMatch;
  matchScores: Record<string, Record<string, string>>;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
};

const MatchScoreInputs = ({
  matchTournamentId,
  match,
  matchScores,
  getMatchKey,
  onScoreChange,
}: MatchScoreInputsProperties) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {(match.playerMatches || []).map((playerMatch) => {
      const matchKey = getMatchKey(matchTournamentId, match.id);
      const playerId = playerMatch.player?.id || '';
      return (
        <label key={`${match.id}-${playerMatch.playerPosition}`} className="text-xs text-slate-300">
          <span className="block text-slate-400">
            {playerMatch.player?.firstName} {playerMatch.player?.lastName}
          </span>
          <input
            type="number"
            min={0}
            value={matchScores[matchKey]?.[playerId] || ''}
            onChange={(event_) => onScoreChange(matchKey, playerId, event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
      );
    })}
  </div>
);

export default MatchScoreInputs;
