import { useMemo } from 'react';
import type { LiveViewMode } from './types';
import type { LiveViewStatus } from '../../utils/live-view-helpers';

type LiveTournamentParameters = {
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  tournamentId?: string | undefined;
  stageId?: string | undefined;
  bracketId?: string | undefined;
  isAggregateView: boolean;
  screenMode: boolean;
};

const readQueryParam = (key: string): string | undefined => {
  if (globalThis.window === undefined) return undefined;
  const value = new URLSearchParams(globalThis.window.location.search).get(key);
  return value ?? undefined;
};

const isScreenMode = (value: string | undefined) => value === '1' || value === 'true' || value === 'screen';

const useLiveTournamentParameters = (): LiveTournamentParameters => {
  const viewMode = useMemo<LiveViewMode | undefined>(() => {
    return readQueryParam('view');
  }, []);

  const viewStatus = useMemo<LiveViewStatus | undefined>(() => {
    return readQueryParam('status');
  }, []);

  const tournamentId = useMemo<string | undefined>(() => {
    return readQueryParam('tournamentId');
  }, []);

  const stageId = useMemo<string | undefined>(() => {
    return readQueryParam('stageId');
  }, []);

  const bracketId = useMemo<string | undefined>(() => {
    return readQueryParam('bracketId');
  }, []);

  const screenMode = useMemo(() => isScreenMode(readQueryParam('screen')), []);

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
    stageId,
    bracketId,
    isAggregateView,
    screenMode,
  };
};

export default useLiveTournamentParameters;
