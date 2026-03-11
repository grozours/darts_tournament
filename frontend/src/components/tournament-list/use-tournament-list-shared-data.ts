import { useCallback, useMemo } from 'react';
import { useOptionalAuth } from '../../auth/optional-auth';
import { useAdminStatus } from '../../auth/use-admin-status';
import { useI18n } from '../../i18n';
import useTournamentListCardActions from './use-tournament-list-card-actions';
import useTournamentListData from './use-tournament-list-data';
import useTournamentListGrouping from './use-tournament-list-grouping';
import useTournamentListRegistrations from './use-tournament-list-registrations';
import useTournamentListViewContext from './use-tournament-list-view-context';
import {
  getStatusLabel as getTournamentStatusLabel,
  normalizeTournamentStatus,
} from './tournament-status-helpers';

const useTournamentListSharedData = () => {
  const auth = useOptionalAuth();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    user,
  } = auth;
  const { isAdmin, adminUser } = useAdminStatus();
  const { t } = useI18n();
  const viewContext = useTournamentListViewContext();

  const effectiveUser = user ?? adminUser;
  const effectiveIsAuthenticated = isAuthenticated || Boolean(adminUser);

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) {
      return undefined;
    }
    try {
      return await getAccessTokenSilently();
    } catch {
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);

  const getStatusLabel = useCallback(
    (scope: 'stage' | 'bracket', status: string) => getTournamentStatusLabel(t, scope, status),
    [t]
  );

  const listData = useTournamentListData({
    authEnabled,
    isAuthenticated,
    getSafeAccessToken,
  });
  const { fetchTournaments } = listData;

  const visibleTournaments = useMemo(
    () => (isAdmin
      ? listData.tournaments
      : listData.tournaments.filter(
        (tournament) => normalizeTournamentStatus(tournament.status) !== 'DRAFT'
      )),
    [isAdmin, listData.tournaments]
  );

  const hasOpenTournament = useMemo(
    () => visibleTournaments.some((tournament) => normalizeTournamentStatus(tournament.status) === 'OPEN'),
    [visibleTournaments]
  );

  const showAnonymousOpenRegistrationHint = (
    !viewContext.isEditPage
    && !effectiveIsAuthenticated
    && hasOpenTournament
    && (viewContext.isRootStatusView || viewContext.normalizedRequestedStatus === 'OPEN')
  );

  const cardActions = useTournamentListCardActions({
    t,
    visibleTournaments,
    getSafeAccessToken,
    fetchTournaments,
  });

  const refreshTournaments = useCallback(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  const registrations = useTournamentListRegistrations({
    t,
    tournaments: visibleTournaments,
    isAdmin,
    isAuthenticated: effectiveIsAuthenticated,
    user: effectiveUser,
    getSafeAccessToken,
    refreshTournaments,
  });

  const grouping = useTournamentListGrouping({
    t,
    tournaments: visibleTournaments,
    isAdmin,
    userRegistrations: registrations.userRegistrations,
  });

  return {
    t,
    auth,
    authLoading,
    authEnabled,
    isAuthenticated,
    isAdmin,
    effectiveIsAuthenticated,
    viewContext,
    getSafeAccessToken,
    getStatusLabel,
    listData,
    visibleTournaments,
    showAnonymousOpenRegistrationHint,
    cardActions,
    refreshTournaments,
    registrations,
    grouping,
  };
};

export default useTournamentListSharedData;
