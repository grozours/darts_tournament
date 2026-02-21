import { useEffect, useMemo, useState } from 'react';
import { getVisibleLiveViews, type LiveViewStatus } from '../../utils/live-view-helpers';
import type { LiveViewData, LiveViewMode } from './types';

type UseLiveTournamentSelectionProperties = {
  viewMode?: LiveViewMode;
  viewStatus?: LiveViewStatus;
  screenMode?: boolean;
  tournamentId?: string | undefined;
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

  const visibleLiveViews = (viewMode === 'pool-stages' && tournamentId)
    ? liveViews
    : getVisibleLiveViews(
      viewMode,
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
    if (!selectedPoolStagesTournamentId && visibleLiveViews.length > 0) {
      const firstView = visibleLiveViews.at(0);
      if (firstView) {
        setSelectedPoolStagesTournamentId(firstView.id);
      }
    }
  }, [viewMode, tournamentId, visibleLiveViews, selectedPoolStagesTournamentId]);

  const displayedLiveViews = useMemo(() => {
    if (viewMode !== 'live') {
      if (viewMode === 'pool-stages' && !tournamentId && selectedPoolStagesTournamentId) {
        return visibleLiveViews.filter((view) => view.id === selectedPoolStagesTournamentId);
      }
      return visibleLiveViews;
    }
    if (selectedLiveTournamentId === 'ALL') {
      return visibleLiveViews;
    }
    return visibleLiveViews.filter((view) => view.id === selectedLiveTournamentId);
  }, [selectedLiveTournamentId, selectedPoolStagesTournamentId, viewMode, visibleLiveViews, tournamentId]);

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
