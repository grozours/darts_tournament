import { useMemo } from 'react';
import { buildGlobalMatchQueue } from './queue-helpers';
import { buildMatchMaps, buildSharedTargets } from './match-maps';
import type { LiveViewData, Translator } from './types';

type UseTargetsViewDerivedProperties = {
  liveViews: LiveViewData[];
  tournamentId: string | undefined;
  t: Translator;
  groupNameByPlayerIdByTournament?: Map<string, Map<string, string>>;
};

type TargetsViewDerivedResult = {
  scopedViews: LiveViewData[];
  matchDetailsById: Map<string, import('./types').LiveViewMatch>;
  matchTournamentById: Map<string, { tournamentId: string; tournamentName: string }>;
  sharedTargets: import('./types').SharedTarget[];
  queueItems: import('./types').MatchQueueItem[];
  queuePreview: import('./types').MatchQueueItem[];
};

const useTargetsViewDerived = ({
  liveViews,
  tournamentId,
  t,
  groupNameByPlayerIdByTournament,
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
    () => buildMatchMaps(scopedViews, t, groupNameByPlayerIdByTournament),
    [groupNameByPlayerIdByTournament, scopedViews, t]
  );

  const sharedTargets = useMemo(
    () => buildSharedTargets(scopedViews, matchByTargetId, matchById, t),
    [scopedViews, matchByTargetId, matchById, t]
  );

  const queueItems = useMemo(
    () => buildGlobalMatchQueue(scopedViews, groupNameByPlayerIdByTournament),
    [groupNameByPlayerIdByTournament, scopedViews]
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
