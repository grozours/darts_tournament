import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

type UseLiveTournamentMatchScoresResult = {
  matchScores: Record<string, Record<string, string>>;
  setMatchScores: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  handleScoreChange: (matchKey: string, playerId: string, value: string) => void;
  setMatchScoresForMatch: (matchKey: string, scores: Record<string, string>) => void;
};

const useLiveTournamentMatchScores = (): UseLiveTournamentMatchScoresResult => {
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});

  const handleScoreChange = useCallback((matchKey: string, playerId: string, value: string) => {
    setMatchScores((current) => ({
      ...current,
      [matchKey]: current[matchKey]
        ? { ...current[matchKey], [playerId]: value }
        : { [playerId]: value },
    }));
  }, []);

  const setMatchScoresForMatch = useCallback((matchKey: string, scores: Record<string, string>) => {
    setMatchScores((current) => ({
      ...current,
      [matchKey]: scores,
    }));
  }, []);

  return {
    matchScores,
    setMatchScores,
    handleScoreChange,
    setMatchScoresForMatch,
  };
};

export default useLiveTournamentMatchScores;
