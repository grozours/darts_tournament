import TargetsGridCard from './targets-grid-card';
import type { LiveViewMatch, MatchQueueItem, SharedTarget, Translator } from '../live-tournament/types';

type TargetsGridProperties = {
  t: Translator;
  isAdmin: boolean;
  sharedTargets: SharedTarget[];
  matchDetailsById: Map<string, LiveViewMatch>;
  matchSelectionByTarget: Record<string, string>;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | undefined;
  startingMatchId: string | undefined;
  cancellingMatchId: string | undefined;
  queueItems: MatchQueueItem[];
  onQueueSelectionChange: (targetKey: string, matchId: string) => void;
  onStartMatch: (matchId: string, targetNumber: number) => void;
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
  onCancelMatch: (match: LiveViewMatch) => void;
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
  cancellingMatchId,
  queueItems,
  onQueueSelectionChange,
  onStartMatch,
  onScoreChange,
  onCompleteMatch,
  onCancelMatch,
}: TargetsGridProperties) => {
  const sharedProperties = {
    t,
    isAdmin,
    matchDetailsById,
    matchSelectionByTarget,
    matchScores,
    updatingMatchId,
    startingMatchId,
    cancellingMatchId,
    queueItems,
    onQueueSelectionChange,
    onStartMatch,
    onScoreChange,
    onCompleteMatch,
    onCancelMatch,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sharedTargets.map((target) => (
        <TargetsGridCard key={target.targetNumber} target={target} {...sharedProperties} />
      ))}
    </div>
  );
};

export default TargetsGrid;
