import { useCallback } from 'react';
import { formatTargetLabel, getMatchTargetLabel, getTargetLabel } from './target-utilities';
import type { LiveViewMatch, LiveViewTarget, Translator } from './types';

type LiveTournamentTargetLabelsResult = {
  formatTargetLabel: (value: string) => string;
  getTargetLabel: (target: LiveViewTarget) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
};

const useLiveTournamentTargetLabels = (t: Translator): LiveTournamentTargetLabelsResult => {
  const formatTarget = useCallback((value: string) => formatTargetLabel(value, t), [t]);
  const targetLabel = useCallback((target: LiveViewTarget) => getTargetLabel(target, t), [t]);
  const matchTargetLabel = useCallback(
    (target: LiveViewMatch['target'] | undefined) => getMatchTargetLabel(target, t),
    [t]
  );

  return {
    formatTargetLabel: formatTarget,
    getTargetLabel: targetLabel,
    getMatchTargetLabel: matchTargetLabel,
  };
};

export default useLiveTournamentTargetLabels;
