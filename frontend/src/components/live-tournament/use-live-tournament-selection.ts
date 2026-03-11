import { useEffect, useMemo, useState } from 'react';
import { getVisibleLiveViews, type LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData, LiveViewMode } from './types';

type UseLiveTournamentSelectionProperties = {
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  screenMode?: boolean;
  tournamentId?: string;
  liveViews: LiveViewData[];
  canViewEditionByViewId?: (viewId: string) => boolean;
  allowEmptyPoolsByViewId?: (viewId: string) => boolean;
};

type LiveTournamentSelectionResult = {
  visibleLiveViews: LiveViewData[];
  displayedLiveViews: LiveViewData[];
  selectedLiveTournamentId: string;
  setSelectedLiveTournamentId: (value: string) => void;
  selectedPoolStagesTournamentId: string;
  setSelectedPoolStagesTournamentId: (value: string) => void;
};

const resolveVisibleLiveViews = (
  viewMode: LiveViewMode | undefined,
  tournamentId: string | undefined,
  liveViews: LiveViewData[],
  viewStatus: LiveViewStatus | undefined,
  canViewEditionByViewId: ((viewId: string) => boolean) | undefined,
  allowEmptyPoolsByViewId: ((viewId: string) => boolean) | undefined,
  screenMode: boolean
): LiveViewData[] => {
  if (viewMode === 'pool-stages' && tournamentId) {
    return liveViews;
  }

  return getVisibleLiveViews(
    viewMode,
    liveViews,
    viewStatus,
    canViewEditionByViewId,
    allowEmptyPoolsByViewId,
    screenMode
  );
};

const resolveDisplayedLiveViews = (
  viewMode: LiveViewMode | undefined,
  tournamentId: string | undefined,
  selectedLiveTournamentId: string,
  selectedPoolStagesTournamentId: string,
  visibleLiveViews: LiveViewData[]
): LiveViewData[] => {
  if (viewMode === 'live') {
    if (selectedLiveTournamentId === 'ALL') {
      return visibleLiveViews;
    }
    return visibleLiveViews.filter((view) => view.id === selectedLiveTournamentId);
  }

  if (viewMode === 'pool-stages' && !tournamentId && selectedPoolStagesTournamentId) {
    return visibleLiveViews.filter((view) => view.id === selectedPoolStagesTournamentId);
  }

  return visibleLiveViews;
};

const ensureDefaultPoolStagesSelection = (
  selectedPoolStagesTournamentId: string,
  visibleLiveViews: LiveViewData[],
  setSelectedPoolStagesTournamentId: (value: string) => void
): void => {
  if (selectedPoolStagesTournamentId || visibleLiveViews.length === 0) {
    return;
  }

  const firstView = visibleLiveViews.at(0);
  if (firstView) {
    setSelectedPoolStagesTournamentId(firstView.id);
  }
};

const useLiveTournamentSelection = ({
  viewMode,
  viewStatus,
  screenMode = false,
  tournamentId,
  liveViews,
  canViewEditionByViewId,
  allowEmptyPoolsByViewId,
}: UseLiveTournamentSelectionProperties): LiveTournamentSelectionResult => {
  const [selectedLiveTournamentId, setSelectedLiveTournamentId] = useState('ALL');
  const [selectedPoolStagesTournamentId, setSelectedPoolStagesTournamentId] = useState('');

  const visibleLiveViews = resolveVisibleLiveViews(
    viewMode,
    tournamentId,
    liveViews,
    viewStatus,
    canViewEditionByViewId,
    allowEmptyPoolsByViewId,
    screenMode
  );

  useEffect(() => {
    if (viewMode === 'live') {
      setSelectedLiveTournamentId('ALL');
    }
  }, [viewMode, liveViews.length]);

  useEffect(() => {
    if (viewMode !== 'pool-stages' || tournamentId) {
      return;
    }
    ensureDefaultPoolStagesSelection(
      selectedPoolStagesTournamentId,
      visibleLiveViews,
      setSelectedPoolStagesTournamentId
    );
  }, [viewMode, tournamentId, visibleLiveViews, selectedPoolStagesTournamentId]);

  const displayedLiveViews = useMemo(() => (
    resolveDisplayedLiveViews(
      viewMode,
      tournamentId,
      selectedLiveTournamentId,
      selectedPoolStagesTournamentId,
      visibleLiveViews
    )
  ), [selectedLiveTournamentId, selectedPoolStagesTournamentId, viewMode, visibleLiveViews, tournamentId]);

  return {
    visibleLiveViews,
    displayedLiveViews,
    selectedLiveTournamentId,
    setSelectedLiveTournamentId,
    selectedPoolStagesTournamentId,
    setSelectedPoolStagesTournamentId,
  };
};

export default useLiveTournamentSelection;
