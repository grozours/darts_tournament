import { useMemo } from 'react';
import { buildGlobalMatchQueue } from './queue-helpers';
import { buildMatchMaps, buildSharedTargets } from './match-maps';
import type { LiveViewData, Translator } from './types';

type UseTargetsViewDerivedProperties = {
  liveViews: LiveViewData[];
  tournamentId: string | undefined;
  t: Translator;
};

type TargetsViewDerivedResult = {
  scopedViews: LiveViewData[];
  matchDetailsById: Map<string, import('../live-tournament/types').LiveViewMatch>;
  matchTournamentById: Map<string, { tournamentId: string; tournamentName: string }>;
  sharedTargets: import('./types').SharedTarget[];
  queueItems: import('./types').MatchQueueItem[];
  queuePreview: import('./types').MatchQueueItem[];
};

const useTargetsViewDerived = ({
  liveViews,
  tournamentId,
  t,
}: UseTargetsViewDerivedProperties): TargetsViewDerivedResult => {
  const activeViews = useMemo(
    () => liveViews.filter((view) => (view.status ?? '').toUpperCase() === 'LIVE'),
    [liveViews]
  );
  const scopedViews = useMemo(
    () => (tournamentId ? activeViews.filter((view) => view.id === tournamentId) : activeViews),
    [activeViews, tournamentId]
  );

  const { matchByTargetId, matchById, matchDetailsById, matchTournamentById } = useMemo(
    () => buildMatchMaps(scopedViews, t),
    [scopedViews, t]
  );

  const sharedTargets = useMemo(
    () => buildSharedTargets(scopedViews, matchByTargetId, matchById, t),
    [scopedViews, matchByTargetId, matchById, t]
  );

  const queueItems = useMemo(
    () => buildGlobalMatchQueue(scopedViews),
    [scopedViews]
  );
  const queuePreview = useMemo(() => queueItems.slice(0, 5), [queueItems]);

  return {
    scopedViews,
    matchDetailsById,
    matchTournamentById,
    sharedTargets,
    queueItems,
    queuePreview,
  };
};

export default useTargetsViewDerived;
