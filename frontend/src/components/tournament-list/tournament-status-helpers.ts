import type { Translator } from './types';

type StatusScope = 'stage' | 'bracket';

type StatusLabelMap = Record<string, string>;

const buildStageStatusLabels = (t: Translator): StatusLabelMap => ({
  NOT_STARTED: t('status.stage.not_started'),
  EDITION: t('status.stage.edition'),
  IN_PROGRESS: t('status.stage.in_progress'),
  COMPLETED: t('status.stage.completed'),
});

const buildBracketStatusLabels = (t: Translator): StatusLabelMap => ({
  NOT_STARTED: t('status.bracket.not_started'),
  IN_PROGRESS: t('status.bracket.in_progress'),
  COMPLETED: t('status.bracket.completed'),
});

const getStatusLabel = (t: Translator, scope: StatusScope, status: string) => {
  const stageMap = buildStageStatusLabels(t);
  const bracketMap = buildBracketStatusLabels(t);
  const statusMap = scope === 'stage' ? stageMap : bracketMap;
  return statusMap[status] ?? status;
};

const normalizeTournamentStatus = (status?: string) => {
  if (!status) return '';
  const normalized = status.trim().toUpperCase();
  switch (normalized) {
    case 'REGISTRATION_OPEN': {
      return 'OPEN';
    }
    case 'IN_PROGRESS': {
      return 'LIVE';
    }
    case 'COMPLETED':
    case 'ARCHIVED': {
      return 'FINISHED';
    }
    default: {
      return normalized;
    }
  }
};

const normalizeStageStatus = (status?: string) => {
  if (!status) return '';
  return status.trim().toUpperCase();
};

export { getStatusLabel, normalizeStageStatus, normalizeTournamentStatus };
