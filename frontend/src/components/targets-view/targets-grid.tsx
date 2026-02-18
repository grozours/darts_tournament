import TargetsGridCard from './targets-grid-card';
import type { LiveViewMatch, MatchQueueItem, SharedTarget, Translator } from './types';

type TargetsGridProperties = {
  t: Translator;
  isAdmin: boolean;
  sharedTargets: SharedTarget[];
  matchDetailsById: Map<string, LiveViewMatch>;
  matchSelectionByTarget: Record<string, string>;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | undefined;
  startingMatchId: string | undefined;
  queueItems: MatchQueueItem[];
  onQueueSelectionChange: (targetKey: string, matchId: string) => void;
  onStartMatch: (matchId: string, targetNumber: number) => void;
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
};

const TargetsGrid = ({
  t,
  isAdmin,
  sharedTargets,
  matchDetailsById,
  matchSelectionByTarget,
  matchScores,
  updatingMatchId,
  startingMatchId,
  queueItems,
  onQueueSelectionChange,
  onStartMatch,
  onScoreChange,
  onCompleteMatch,
}: TargetsGridProperties) => {
  const sharedProps = {
    t,
    isAdmin,
    matchDetailsById,
    matchSelectionByTarget,
    matchScores,
    updatingMatchId,
    startingMatchId,
    queueItems,
    onQueueSelectionChange,
    onStartMatch,
    onScoreChange,
    onCompleteMatch,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sharedTargets.map((target) => (
        <TargetsGridCard key={target.targetNumber} target={target} {...sharedProps} />
      ))}
    </div>
  );
};

export default TargetsGrid;
