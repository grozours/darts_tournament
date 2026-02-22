import TargetsGrid from './targets-grid';
import TargetsQueuePanel from './targets-queue-panel';
import TargetsViewHeader from './targets-view-header';
import type { LiveViewData, LiveViewMatch, MatchQueueItem, SharedTarget, Translator } from './types';

type TargetsViewContentProperties = {
  t: Translator;
  isAdmin: boolean;
  tournamentId: string | null | undefined;
  scopedViews: LiveViewData[];
  sharedTargets: SharedTarget[];
  queueItems: MatchQueueItem[];
  queuePreview: MatchQueueItem[];
  matchDetailsById: Map<string, LiveViewMatch>;
  matchSelectionByTarget: Record<string, string>;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | undefined;
  startingMatchId: string | undefined;
  cancellingMatchId: string | undefined;
  onQueueSelectionChange: (targetKey: string, matchId: string) => void;
  onStartMatch: (matchId: string, targetNumber: number) => void;
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
  onCancelMatch: (match: LiveViewMatch) => void;
};

const TargetsViewContent = ({
  t,
  isAdmin,
  tournamentId,
  scopedViews,
  sharedTargets,
  queueItems,
  queuePreview,
  matchDetailsById,
  matchSelectionByTarget,
  matchScores,
  updatingMatchId,
  startingMatchId,
  cancellingMatchId,
  onQueueSelectionChange,
  onStartMatch,
  onScoreChange,
  onCompleteMatch,
  onCancelMatch,
}: TargetsViewContentProperties) => {
  if (sharedTargets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        {t('targets.none')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TargetsViewHeader t={t} tournamentId={tournamentId} scopedViews={scopedViews} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TargetsGrid
          t={t}
          isAdmin={isAdmin}
          sharedTargets={sharedTargets}
          matchDetailsById={matchDetailsById}
          matchSelectionByTarget={matchSelectionByTarget}
          matchScores={matchScores}
          updatingMatchId={updatingMatchId}
          startingMatchId={startingMatchId}
          cancellingMatchId={cancellingMatchId}
          queueItems={queueItems}
          onQueueSelectionChange={onQueueSelectionChange}
          onStartMatch={onStartMatch}
          onScoreChange={onScoreChange}
          onCompleteMatch={onCompleteMatch}
          onCancelMatch={onCancelMatch}
        />
        <TargetsQueuePanel t={t} queueItems={queueItems} queuePreview={queuePreview} />
      </div>
    </div>
  );
};

export default TargetsViewContent;
