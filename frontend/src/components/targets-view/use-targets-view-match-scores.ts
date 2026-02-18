import { useCallback, useState } from 'react';

type TargetsViewMatchScoresResult = {
  matchScores: Record<string, Record<string, string>>;
  handleScoreChange: (matchId: string, playerId: string, value: string) => void;
};

const useTargetsViewMatchScores = (): TargetsViewMatchScoresResult => {
  const [matchScores, setMatchScores] = useState<Record<string, Record<string, string>>>({});

  const handleScoreChange = useCallback((matchId: string, playerId: string, value: string) => {
    setMatchScores((current) => ({
      ...current,
      [matchId]: current[matchId]
        ? { ...current[matchId], [playerId]: value }
        : { [playerId]: value },
    }));
  }, []);

  return { matchScores, handleScoreChange };
};

export default useTargetsViewMatchScores;
