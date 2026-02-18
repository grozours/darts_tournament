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

const useTournamentListGrouping = ({
  t,
  tournaments,
  isAdmin,
  userRegistrations,
}: UseTournamentListGroupingProperties): TournamentListGroupingResult => {
  const statusFilter = useMemo(() => {
    if (globalThis.window === undefined) return 'ALL';
    const parameters = new URLSearchParams(globalThis.window.location.search);
    return parameters.get('status')?.toUpperCase() || 'ALL';
  }, []);

  const normalizedStatusFilter = statusFilter === 'ALL'
    ? 'ALL'
    : normalizeTournamentStatus(statusFilter);

  const groupedTournaments = useMemo(() => {
    const statusLabels: Record<string, string> = {
      DRAFT: t('tournaments.draft'),
      OPEN: t('tournaments.open'),
      SIGNATURE: t('tournaments.signature'),
      LIVE: t('tournaments.live'),
      FINISHED: t('tournaments.finished'),
    };

    if (statusFilter !== 'ALL') {
      const normalizedStatus = normalizedStatusFilter;
      const title = statusLabels[normalizedStatus] ?? t('tournaments.hub');
      const items = tournaments.filter((tournament) => {
        const normalized = normalizeTournamentStatus(tournament.status);
        if (normalized === normalizedStatus) {
          return true;
        }

        if (
          normalizedStatus === 'OPEN' &&
          normalized === 'SIGNATURE' &&
          !isAdmin &&
          userRegistrations.has(tournament.id)
        ) {
          return true;
        }

        return false;
      });

      return [{ title, status: normalizedStatus, items }];
    }

    const statuses = ['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'] as const;
    return statuses.map((status) => ({
      title: statusLabels[status] ?? t('tournaments.hub'),
      status,
      items: tournaments.filter(
        (tournament) => normalizeTournamentStatus(tournament.status) === status
      ),
    }));
  }, [tournaments, statusFilter, normalizedStatusFilter, t, isAdmin, userRegistrations]);

  return { groupedTournaments };
};

export default useTournamentListGrouping;
