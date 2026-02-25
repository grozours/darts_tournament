import { useCallback, useMemo, useState } from 'react';
import {
  buildInUseTargetNumbers,
  getSchedulableTargets,
  getSharedAvailableTargets,
} from './target-utilities';
import type { LiveViewData, LiveViewTarget } from './types';

type UseLiveTournamentTargetsProperties = {
  liveViews: LiveViewData[];
};

type LiveTournamentTargetsResult = {
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  schedulableTargetCountByTournament: Map<string, number>;
  matchTargetSelections: Record<string, string>;
  handleTargetSelectionChange: (matchKey: string, targetId: string) => void;
  getTargetIdForSelection: (matchTournamentId: string, targetNumberValue: string) => string | undefined;
  clearMatchTargetSelection: (matchKey: string) => void;
};

const useLiveTournamentTargets = ({ liveViews }: UseLiveTournamentTargetsProperties): LiveTournamentTargetsResult => {
  const [matchTargetSelections, setMatchTargetSelections] = useState<Record<string, string>>({});

  const inUseTargetNumbers = useMemo(() => buildInUseTargetNumbers(liveViews), [liveViews]);

  const availableTargetsByTournament = useMemo(() => {
    const map = new Map<string, LiveViewTarget[]>();
    for (const view of liveViews) {
      map.set(view.id, getSharedAvailableTargets(view, inUseTargetNumbers));
    }
    return map;
  }, [liveViews, inUseTargetNumbers]);

  const schedulableTargetCountByTournament = useMemo(() => {
    const map = new Map<string, number>();
    for (const view of liveViews) {
      map.set(view.id, Math.max(getSchedulableTargets(view).length, 1));
    }
    return map;
  }, [liveViews]);

  const targetIdByTournamentAndNumber = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    for (const view of liveViews) {
      const targetMap = new Map<number, string>();
      for (const target of view.targets ?? []) {
        targetMap.set(target.targetNumber, target.id);
      }
      map.set(view.id, targetMap);
    }
    return map;
  }, [liveViews]);

  const getTargetIdForSelection = useCallback(
    (matchTournamentId: string, targetNumberValue: string) => {
      const parsedNumber = Number(targetNumberValue);
      if (!Number.isFinite(parsedNumber)) {
        return;
      }
      return targetIdByTournamentAndNumber.get(matchTournamentId)?.get(parsedNumber);
    },
    [targetIdByTournamentAndNumber]
  );

  const handleTargetSelectionChange = useCallback((matchKey: string, targetId: string) => {
    setMatchTargetSelections((current) => ({
      ...current,
      [matchKey]: targetId,
    }));
  }, []);

  const clearMatchTargetSelection = useCallback((matchKey: string) => {
    setMatchTargetSelections((current) => {
      if (!current[matchKey]) {
        return current;
      }
      const next = { ...current };
      delete next[matchKey];
      return next;
    });
  }, []);

  return {
    availableTargetsByTournament,
    schedulableTargetCountByTournament,
    matchTargetSelections,
    handleTargetSelectionChange,
    getTargetIdForSelection,
    clearMatchTargetSelection,
  };
};

export default useLiveTournamentTargets;
