import { useMemo } from 'react';
import type { LiveViewMode } from './types';
import type { LiveViewStatus } from '../../utils/live-view-helpers';

type LiveTournamentParameters = {
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  tournamentId?: string | undefined;
  isAggregateView: boolean;
};

const useLiveTournamentParameters = (): LiveTournamentParameters => {
  const viewMode = useMemo<LiveViewMode | undefined>(() => {
    if (globalThis.window === undefined) return;
    const value = new URLSearchParams(globalThis.window.location.search).get('view');
    return value ?? undefined;
  }, []);

  const viewStatus = useMemo<LiveViewStatus | undefined>(() => {
    if (globalThis.window === undefined) return;
    const value = new URLSearchParams(globalThis.window.location.search).get('status');
    return value ?? undefined;
  }, []);

  const tournamentId = useMemo<string | undefined>(() => {
    if (globalThis.window === undefined) return;
    const value = new URLSearchParams(globalThis.window.location.search).get('tournamentId');
    return value ?? undefined;
  }, []);

  const resolvedViewMode = (() => {
    if (viewMode) return viewMode;
    if ((viewStatus ?? '').toLowerCase() === 'live') {
      return 'live';
    }
    return undefined;
  })();

  const isAggregateView =
    !tournamentId
    && (
      resolvedViewMode === 'live'
      || resolvedViewMode === 'pool-stages'
      || resolvedViewMode === 'brackets'
    );

  return {
    viewMode: resolvedViewMode,
    viewStatus,
    tournamentId,
    isAggregateView,
  };
};

export default useLiveTournamentParameters;
