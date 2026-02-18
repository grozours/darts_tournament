import { useCallback, useMemo } from 'react';
import type { Translator } from './types';

type StatusScope = 'pool' | 'match' | 'bracket' | 'stage';

type StatusLabels = Record<StatusScope, Record<string, string>>;

type UseLiveTournamentStatusLabelsResult = {
  getStatusLabel: (scope: StatusScope, status?: string) => string;
};

const useLiveTournamentStatusLabels = (t: Translator): UseLiveTournamentStatusLabelsResult => {
  const statusLabels = useMemo<StatusLabels>(
    () => ({
      stage: {
        NOT_STARTED: t('status.stage.not_started'),
        EDITION: t('status.stage.edition'),
        IN_PROGRESS: t('status.stage.in_progress'),
        COMPLETED: t('status.stage.completed'),
      },
      pool: {
        NOT_STARTED: t('status.pool.not_started'),
        IN_PROGRESS: t('status.pool.in_progress'),
        COMPLETED: t('status.pool.completed'),
      },
      match: {
        SCHEDULED: t('status.match.scheduled'),
        IN_PROGRESS: t('status.match.in_progress'),
        COMPLETED: t('status.match.completed'),
        CANCELLED: t('status.match.cancelled'),
      },
      bracket: {
        NOT_STARTED: t('status.bracket.not_started'),
        IN_PROGRESS: t('status.bracket.in_progress'),
        COMPLETED: t('status.bracket.completed'),
      },
    }),
    [t]
  );

  const getStatusLabel = useCallback(
    (scope: StatusScope, status?: string) => {
      if (!status) return '';
      return statusLabels[scope]?.[status] ?? status;
    },
    [statusLabels]
  );

  return { getStatusLabel };
};

export default useLiveTournamentStatusLabels;
