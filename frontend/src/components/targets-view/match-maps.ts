import type { LiveViewData, LiveViewMatch, LiveViewTarget, SharedTarget, TargetMatchInfo, Translator } from './types';
import { getMatchPlayers, getTargetLabel } from './target-labels';

const shouldReplaceTargetMatch = (existingStatus: string | undefined, nextStatus: string) => {
  if (!existingStatus) return true;
  if (nextStatus === 'IN_PROGRESS') return true;
  return existingStatus !== 'IN_PROGRESS';
};

const buildMatchInfo = (
  match: LiveViewMatch,
  label: string,
  tournamentId: string,
  tournamentName: string
): TargetMatchInfo => ({
  matchId: match.id,
  status: match.status,
  label,
  players: getMatchPlayers(match),
  tournamentId,
  tournamentName,
});

const updateTargetMatchInfo = (
  byTargetId: Map<string, TargetMatchInfo>,
  targetId: string | undefined,
  info: TargetMatchInfo
) => {
  if (!targetId) return;
  const existingStatus = byTargetId.get(targetId)?.status;
  if (shouldReplaceTargetMatch(existingStatus, info.status)) {
    byTargetId.set(targetId, info);
  }
};

const addMatchInfo = (
  byTargetId: Map<string, TargetMatchInfo>,
  byId: Map<string, TargetMatchInfo>,
  match: LiveViewMatch,
  label: string,
  tournamentId: string,
  tournamentName: string
) => {
  const info = buildMatchInfo(match, label, tournamentId, tournamentName);
  const targetId = match.target?.id ?? match.targetId;
  updateTargetMatchInfo(byTargetId, targetId, info);
  byId.set(match.id, info);
};

const createMatchRegistrar = (
  byTargetId: Map<string, TargetMatchInfo>,
  byId: Map<string, TargetMatchInfo>,
  matchDetailsById: Map<string, LiveViewMatch>,
  matchTournamentById: Map<string, { tournamentId: string; tournamentName: string }>
) => (
  match: LiveViewMatch,
  label: string,
  tournamentId: string,
  tournamentName: string
) => {
  matchDetailsById.set(match.id, match);
  matchTournamentById.set(match.id, { tournamentId, tournamentName });
  addMatchInfo(byTargetId, byId, match, label, tournamentId, tournamentName);
};

const collectPoolMatchesForView = (
  view: LiveViewData,
  registerMatch: (match: LiveViewMatch, label: string, tournamentId: string, tournamentName: string) => void,
  labels: { stageLabel: string; poolLabel: string; matchLabel: string }
) => {
  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        registerMatch(
          match,
          `${labels.stageLabel} ${stage.stageNumber} · ${labels.poolLabel} ${pool.poolNumber} · ${labels.matchLabel} ${match.matchNumber}`,
          view.id,
          view.name
        );
      }
    }
  }
};

const collectBracketMatchesForView = (
  view: LiveViewData,
  registerMatch: (match: LiveViewMatch, label: string, tournamentId: string, tournamentName: string) => void,
  labels: { bracketLabel: string; matchLabel: string }
) => {
  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      registerMatch(
        match,
        `${labels.bracketLabel} ${bracket.name} · ${labels.matchLabel} ${match.matchNumber}`,
        view.id,
        view.name
      );
    }
  }
};

export const buildMatchMaps = (views: LiveViewData[], t: Translator) => {
  const byTargetId = new Map<string, TargetMatchInfo>();
  const byId = new Map<string, TargetMatchInfo>();
  const matchDetailsById = new Map<string, LiveViewMatch>();
  const matchTournamentById = new Map<string, { tournamentId: string; tournamentName: string }>();

  const registerMatch = createMatchRegistrar(byTargetId, byId, matchDetailsById, matchTournamentById);
  const poolLabels = {
    stageLabel: t('targets.stageLabel'),
    poolLabel: t('targets.poolLabel'),
    matchLabel: t('targets.matchLabel'),
  };
  const bracketLabels = {
    bracketLabel: t('targets.bracketLabel'),
    matchLabel: t('targets.matchLabel'),
  };

  for (const view of views) {
    collectPoolMatchesForView(view, registerMatch, poolLabels);
    collectBracketMatchesForView(view, registerMatch, bracketLabels);
  }

  return { matchByTargetId: byTargetId, matchById: byId, matchDetailsById, matchTournamentById };
};

const addMatchStatusesFromPools = (view: LiveViewData, statusById: Map<string, string>) => {
  for (const stage of view.poolStages ?? []) {
    for (const pool of stage.pools ?? []) {
      for (const match of pool.matches ?? []) {
        if (match?.id) {
          statusById.set(match.id, match.status);
        }
      }
    }
  }
};

const addMatchStatusesFromBrackets = (view: LiveViewData, statusById: Map<string, string>) => {
  for (const bracket of view.brackets ?? []) {
    for (const match of bracket.matches ?? []) {
      if (match?.id) {
        statusById.set(match.id, match.status);
      }
    }
  }
};

const buildMatchStatusMap = (view: LiveViewData) => {
  const statusById = new Map<string, string>();
  addMatchStatusesFromPools(view, statusById);
  addMatchStatusesFromBrackets(view, statusById);
  return statusById;
};

const isTargetInUse = (target: { status?: string; currentMatchId?: string }, matchStatusById: Map<string, string>) => {
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

const getOrCreateSharedTarget = (
  sharedByNumber: Map<number, SharedTarget>,
  target: LiveViewTarget,
  t: Translator
) => {
  const targetNumber = target.targetNumber;
  const existing = sharedByNumber.get(targetNumber);
  if (existing) {
    return existing;
  }
  const entry: SharedTarget = {
    targetNumber,
    label: getTargetLabel(target, t),
    isInUse: false,
    targetIdsByTournament: new Map<string, string>(),
  };
  sharedByNumber.set(targetNumber, entry);
  return entry;
};

const updateSharedTargetUsage = (
  entry: SharedTarget,
  target: { status?: string; currentMatchId?: string },
  matchStatusById: Map<string, string>,
  matchInfo?: TargetMatchInfo
) => {
  if (!entry.isInUse && isTargetInUse(target, matchStatusById)) {
    entry.isInUse = true;
  }
  if (matchInfo && (!entry.activeMatchInfo || matchInfo.status === 'IN_PROGRESS')) {
    entry.activeMatchInfo = matchInfo;
  }
};

export const buildSharedTargets = (
  views: LiveViewData[],
  matchByTargetId: Map<string, TargetMatchInfo>,
  matchById: Map<string, TargetMatchInfo>,
  t: Translator
) => {
  const sharedByNumber = new Map<number, SharedTarget>();

  for (const view of views) {
    const matchStatusById = buildMatchStatusMap(view);
    for (const target of view.targets ?? []) {
      const entry = getOrCreateSharedTarget(sharedByNumber, target, t);
      entry.targetIdsByTournament.set(view.id, target.id);
      let matchInfo = matchByTargetId.get(target.id);
      if (!matchInfo && target.currentMatchId) {
        matchInfo = matchById.get(target.currentMatchId);
      }
      updateSharedTargetUsage(entry, target, matchStatusById, matchInfo);
    }
  }

  return [...sharedByNumber.values()].toSorted((a, b) => a.targetNumber - b.targetNumber);
};
