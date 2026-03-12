import useTournamentListEditingData from './use-tournament-list-editing-data';
import useTournamentListSharedData from './use-tournament-list-shared-data';
import composeTournamentListOverviewSectionProperties from './compose-tournament-list-overview-section-properties';
import type { TournamentListLayoutProperties } from './tournament-list-layout';

const useTournamentListLayoutProperties = (): TournamentListLayoutProperties => {
  const shared = useTournamentListSharedData();
  const editing = useTournamentListEditingData({
    t: shared.t,
    isAdmin: shared.isAdmin,
    isEditPage: shared.viewContext.isEditPage,
    editTournamentId: shared.viewContext.editTournamentId,
    authEnabled: shared.auth.enabled,
    authLoading: shared.auth.isLoading,
    isAuthenticated: shared.auth.isAuthenticated,
    getSafeAccessToken: shared.getSafeAccessToken,
    getStatusLabel: shared.getStatusLabel,
    refreshTournaments: shared.refreshTournaments,
  });

  const overviewSectionProperties = composeTournamentListOverviewSectionProperties({
    isEditPage: shared.viewContext.isEditPage,
    visibleTournaments: shared.visibleTournaments,
    groupedTournaments: shared.grouping.groupedTournaments,
    isAdmin: shared.isAdmin,
    isAuthenticated: shared.effectiveIsAuthenticated,
    t: shared.t,
    userRegistrations: shared.registrations.userRegistrations,
    userGroupStatuses: shared.registrations.userGroupStatuses,
    registeringTournamentId: shared.registrations.registeringTournamentId,
    onEdit: editing.openEdit,
    onDelete: shared.listData.deleteTournament,
    onRegister: shared.registrations.handleRegisterSelf,
    onRegisterGroup: shared.registrations.handleRegisterGroup,
    onUnregisterGroup: shared.registrations.handleUnregisterGroup,
    onUnregister: shared.registrations.handleUnregisterSelf,
    onOpenDraft: shared.cardActions.openDraftFromCard,
    onOpenRegistration: shared.cardActions.openRegistrationFromCard,
    onOpenSignature: shared.cardActions.openSignatureFromCard,
    onAutoFillPlayers: shared.cardActions.autoFillTournamentFromCard,
    onConfirmAllPlayers: shared.cardActions.confirmAllFromCard,
    hideOpenSignatureAction: shared.viewContext.hideOpenSignatureAction,
    showOpenAutoFillAction: shared.viewContext.showOpenAutoFillAction,
    showSignatureAutoConfirmAction: shared.viewContext.showSignatureAutoConfirmAction,
    openingDraftId: shared.cardActions.openingDraftId,
    openingRegistrationId: shared.cardActions.openingRegistrationId,
    openingSignatureId: shared.cardActions.openingSignatureId,
    autoFillingTournamentId: shared.cardActions.autoFillingTournamentId,
    confirmingTournamentId: shared.cardActions.confirmingTournamentId,
    autoFillProgressByTournament: shared.cardActions.autoFillProgressByTournament,
    confirmAllProgressByTournament: shared.cardActions.confirmAllProgressByTournament,
  });

  return {
    stateGateProperties: {
      authLoading: shared.auth.isLoading,
      isEditPage: shared.viewContext.isEditPage,
      loading: shared.listData.loading,
      error: shared.listData.error,
      refreshTournaments: shared.refreshTournaments,
      t: shared.t,
    },
    headerProperties: {
      isEditPage: shared.viewContext.isEditPage,
      editingTournament: editing.editingTournament,
      tournamentsCount: shared.visibleTournaments.length,
      t: shared.t,
    },
    noticesProperties: {
      isEditPage: shared.viewContext.isEditPage,
      editLoadError: editing.editLoadError,
      editLoading: editing.editLoading,
      showAnonymousOpenRegistrationHint: shared.showAnonymousOpenRegistrationHint,
      t: shared.t,
    },
    overviewSectionProperties,
    editSectionProperties: editing.editSectionProperties,
    poolStageAssignmentsModalProperties: editing.poolStageAssignmentsModalProperties,
  };
};

export default useTournamentListLayoutProperties;
