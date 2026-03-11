import { useMemo } from 'react';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import type { Tournament, TournamentListGroup, Translator } from './types';

type UseTournamentListGroupingProperties = {
  t: Translator;
  tournaments: Tournament[];
  isAdmin: boolean;
  userRegistrations: Set<string>;
};

type TournamentListGroupingResult = {
  groupedTournaments: TournamentListGroup[];
};

const getStatusFilterFromLocation = (): string => {
  if (globalThis.window === undefined) {
    return 'ALL';
  }
  const parameters = new URLSearchParams(globalThis.window.location.search);
  return parameters.get('status')?.toUpperCase() || 'ALL';
};

const buildStatusLabels = (t: Translator): Record<string, string> => ({
  DRAFT: t('tournaments.draft'),
  OPEN: t('tournaments.open'),
  SIGNATURE: t('tournaments.signature'),
  LIVE: t('tournaments.live'),
  FINISHED: t('tournaments.finished'),
});

const isTournamentVisible = (tournament: Tournament, isAdmin: boolean): boolean => (
  isAdmin || normalizeTournamentStatus(tournament.status) !== 'DRAFT'
);

const matchesSelectedStatus = (
  tournament: Tournament,
  normalizedStatus: string,
  isAdmin: boolean,
  userRegistrations: Set<string>
): boolean => {
  const normalized = normalizeTournamentStatus(tournament.status);
  if (normalized === normalizedStatus) {
    return true;
  }

  return normalizedStatus === 'OPEN'
    && normalized === 'SIGNATURE'
    && !isAdmin
    && userRegistrations.has(tournament.id);
};

const buildSingleStatusGroup = (
  normalizedStatus: string,
  visibleTournaments: Tournament[],
  statusLabels: Record<string, string>,
  t: Translator,
  isAdmin: boolean,
  userRegistrations: Set<string>
): TournamentListGroup[] => {
  if (!isAdmin && normalizedStatus === 'DRAFT') {
    return [];
  }

  const title = statusLabels[normalizedStatus] ?? t('tournaments.hub');
  const items = visibleTournaments.filter((tournament) => (
    matchesSelectedStatus(tournament, normalizedStatus, isAdmin, userRegistrations)
  ));

  return [{ title, status: normalizedStatus, items }];
};

const buildAllStatusGroups = (
  visibleTournaments: Tournament[],
  statusLabels: Record<string, string>,
  t: Translator,
  isAdmin: boolean
): TournamentListGroup[] => {
  const statuses = isAdmin
    ? (['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'] as const)
    : (['OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'] as const);

  return statuses.map((status) => ({
    title: statusLabels[status] ?? t('tournaments.hub'),
    status,
    items: visibleTournaments.filter((tournament) => normalizeTournamentStatus(tournament.status) === status),
  }));
};

const useTournamentListGrouping = ({
  t,
  tournaments,
  isAdmin,
  userRegistrations,
}: UseTournamentListGroupingProperties): TournamentListGroupingResult => {
  const statusFilter = useMemo(() => getStatusFilterFromLocation(), []);

  const normalizedStatusFilter = statusFilter === 'ALL'
    ? 'ALL'
    : normalizeTournamentStatus(statusFilter);

  const groupedTournaments = useMemo(() => {
    const statusLabels = buildStatusLabels(t);
    const visibleTournaments = tournaments.filter((tournament) => isTournamentVisible(tournament, isAdmin));

    if (statusFilter !== 'ALL') {
      return buildSingleStatusGroup(
        normalizedStatusFilter,
        visibleTournaments,
        statusLabels,
        t,
        isAdmin,
        userRegistrations
      );
    }

    return buildAllStatusGroups(visibleTournaments, statusLabels, t, isAdmin);
  }, [tournaments, statusFilter, normalizedStatusFilter, t, isAdmin, userRegistrations]);

  return { groupedTournaments };
};

export default useTournamentListGrouping;
