import { isBracketsView, isPoolStagesView } from '../../utils/live-view-helpers';
import type { LiveViewMode } from './types';

type UseLiveTournamentReadonlyProperties = {
  isAdmin: boolean;
  viewMode?: LiveViewMode;
};

type LiveTournamentReadonlyResult = {
  isPoolStagesReadonly: boolean;
  isBracketsReadonly: boolean;
};

const useLiveTournamentReadonly = ({
  isAdmin,
  viewMode,
}: UseLiveTournamentReadonlyProperties): LiveTournamentReadonlyResult => {
  const isPoolStagesReadonly = !isAdmin && (isPoolStagesView(viewMode) || viewMode === 'live');
  const isBracketsReadonly = !isAdmin && isBracketsView(viewMode);

  return { isPoolStagesReadonly, isBracketsReadonly };
};

export default useLiveTournamentReadonly;
