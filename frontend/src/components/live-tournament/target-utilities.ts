import type {
  LiveViewBracket,
  LiveViewData,
  LiveViewMatch,
  LiveViewTarget,
  Translator,
} from './types';

export const getHasLoserBracket = (brackets?: LiveViewBracket[]) =>
  (brackets || []).some(
    (bracket) =>
      bracket.bracketType === 'DOUBLE_ELIMINATION' ||
      bracket.name.toLowerCase().includes('loser')
  );

export const formatTargetLabel = (value: string, t: Translator) => {
  const match = /^target\s*(\d+)$/i.exec(value.trim());
  if (match) {
    return `${t('targets.target')} ${match[1]}`;
  }
  return value;
};

export const getMatchTargetLabel = (
  target: LiveViewMatch['target'] | undefined,
  t: Translator
) => {
  if (!target) return;
  const base = target.targetCode || target.name || (target.targetNumber ? `#${target.targetNumber}` : undefined);
  if (!base) return;
  return formatTargetLabel(base, t);
};

export const getTargetLabel = (target: LiveViewTarget, t: Translator) =>
  formatTargetLabel(target.targetCode || target.name || `#${target.targetNumber}`, t);

const addMatchStatusFromPools = (view: LiveViewData, matchStatusById: Map<string, string>) => {
  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match?.id) {
          matchStatusById.set(match.id, match.status);
        }
      }
    }
  }
};

const addMatchStatusFromBrackets = (view: LiveViewData, matchStatusById: Map<string, string>) => {
  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match?.id) {
        matchStatusById.set(match.id, match.status);
      }
    }
  }
};

const buildMatchStatusMap = (view: LiveViewData) => {
  const matchStatusById = new Map<string, string>();
  addMatchStatusFromPools(view, matchStatusById);
  addMatchStatusFromBrackets(view, matchStatusById);
  return matchStatusById;
};

const isTargetInUse = (target: LiveViewTarget, matchStatusById: Map<string, string>) => {
  const normalizedStatus = (target.status ?? '').toUpperCase();
  if (normalizedStatus !== 'IN_USE') {
    return false;
  }
  if (!target.currentMatchId) {
    return true;
  }
  const matchStatus = matchStatusById.get(target.currentMatchId);
  return matchStatus !== 'COMPLETED' && matchStatus !== 'CANCELLED';
};

export const buildInUseTargetNumbers = (views: LiveViewData[]) => {
  const inUse = new Set<number>();
  for (const view of views) {
    const matchStatusById = buildMatchStatusMap(view);
    for (const target of view.targets ?? []) {
      if (isTargetInUse(target, matchStatusById)) {
        inUse.add(target.targetNumber);
      }
    }
  }
  return inUse;
};

export const getSharedAvailableTargets = (view: LiveViewData, inUseTargetNumbers: Set<number>) =>
  (view.targets || []).filter((target) => {
    const normalizedStatus = (target.status ?? '').toUpperCase();
    if (normalizedStatus === 'MAINTENANCE') {
      return false;
    }
    if (inUseTargetNumbers.has(target.targetNumber)) {
      return false;
    }
    return true;
  });
