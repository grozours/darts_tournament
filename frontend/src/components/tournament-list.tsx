import { useCallback, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import SignInPanel from '../auth/sign-in-panel';
import { useI18n } from '../i18n';
import { updateTournamentStatus } from '../services/tournament-service';
import TournamentEditPanel from './tournament-list/tournament-edit-panel';
import PoolStageAssignmentsModal from './tournament-list/pool-stage-assignments-modal';
import TournamentListGroups from './tournament-list/tournament-list-groups';
import TournamentListHeader from './tournament-list/tournament-list-header';
import useTournamentPlayers from './tournament-list/use-tournament-players';
import useTournamentStructure from './tournament-list/use-tournament-structure';
import useTournamentListRegistrations from './tournament-list/use-tournament-list-registrations';
import useTournamentListData from './tournament-list/use-tournament-list-data';
import useTournamentListGrouping from './tournament-list/use-tournament-list-grouping';
import useTournamentOptions from './tournament-list/use-tournament-options';
import useTournamentEditState from './tournament-list/use-tournament-edit-state';
import useTournamentListEditFlow from './tournament-list/use-tournament-list-edit-flow';
import {
  getStatusLabel as getTournamentStatusLabel,
  normalizeStageStatus,
  normalizeTournamentStatus,
} from './tournament-list/tournament-status-helpers';
import usePoolStageAssignments from './tournament-list/use-pool-stage-assignments';

function TournamentList() { // NOSONAR
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    user,
  } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();
  const { t } = useI18n();
  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const view = parameters.get('view');
  const editTournamentId = parameters.get('tournamentId');
  const isEditPage = view === 'edit-tournament';
  // Helper to safely get access token, falling back to undefined if it fails
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) {
      console.log('[TournamentList] Auth not enabled, skipping token');
      return undefined;
    }
    try {
      console.log('[TournamentList] Attempting to get access token...');
      const token = await getAccessTokenSilently();
      console.log('[TournamentList] Got access token successfully');
      return token;
    } catch (error_) {
      console.warn('[TournamentList] Failed to get access token, proceeding without auth:', error_);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);
  const getStatusLabel = useCallback(
    (scope: 'stage' | 'bracket', status: string) => getTournamentStatusLabel(t, scope, status),
    [t]
  );

  const {
    tournaments,
    loading,
    error,
    fetchTournaments,
    deleteTournament,
  } = useTournamentListData({
    authEnabled,
    isAuthenticated,
    getSafeAccessToken,
  });
  const [openingRegistrationId, setOpeningRegistrationId] = useState<string | undefined>();
  const [openingSignatureId, setOpeningSignatureId] = useState<string | undefined>();
  const visibleTournaments = useMemo(
    () => (isAdmin
      ? tournaments
      : tournaments.filter(
        (tournament) => normalizeTournamentStatus(tournament.status) !== 'DRAFT'
      )),
    [tournaments, isAdmin]
  );
  const openRegistrationFromCard = useCallback(async (tournamentId: string) => {
    setOpeningRegistrationId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      await updateTournamentStatus(tournamentId, 'OPEN', token);
      globalThis.window?.location.assign('/?status=OPEN');
      await fetchTournaments();
    } catch (error_) {
      console.error('[TournamentList] Failed to open registration:', error_);
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedOpenRegistration'));
    } finally {
      setOpeningRegistrationId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);
  const openSignatureFromCard = useCallback(async (tournamentId: string) => {
    setOpeningSignatureId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      await updateTournamentStatus(tournamentId, 'SIGNATURE', token);
      globalThis.window?.location.assign('/?status=SIGNATURE');
      await fetchTournaments();
    } catch (error_) {
      console.error('[TournamentList] Failed to open signature:', error_);
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedMoveToSignature'));
    } finally {
      setOpeningSignatureId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);
  const refreshTournaments = useCallback(() => {
    void fetchTournaments();
  }, [fetchTournaments]);
  const {
    editingTournament,
    editForm,
    editError,
    editLoading,
    editLoadError,
    isSaving,
    logoFile,
    isUploadingLogo,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
    setIsSaving,
    setLogoFile,
    setIsUploadingLogo,
  } = useTournamentEditState();
  const {
    players,
    playersLoading,
    playersError,
    playerForm,
    editingPlayerId,
    checkingInPlayerId,
    isRegisteringPlayer,
    isAutoFillingPlayers,
    isConfirmingAll,
    playerActionLabel,
    setPlayerForm,
    clearPlayers,
    clearPlayersError,
    resetPlayersState,
    fetchPlayers,
    startEditPlayer,
    cancelEditPlayer,
    registerPlayer,
    savePlayerEdit,
    removePlayer,
    togglePlayerCheckIn,
    confirmAllPlayers,
    autoFillPlayers,
  } = useTournamentPlayers({
    t,
    editingTournament,
    getSafeAccessToken,
  });
  const {
    poolStages,
    poolStagesError,
    isAddingPoolStage,
    newPoolStage,
    brackets,
    bracketsError,
    isAddingBracket,
    newBracket,
    loadPoolStages,
    loadBrackets,
    handlePoolStageNumberChange,
    handlePoolStageNameChange,
    handlePoolStagePoolCountChange,
    handlePoolStagePlayersPerPoolChange,
    handlePoolStageAdvanceCountChange,
    handlePoolStageLosersAdvanceChange,
    handlePoolStageStatusChange,
    addPoolStage,
    savePoolStage,
    removePoolStage,
    startAddPoolStage,
    cancelAddPoolStage,
    handleNewPoolStageStageNumberChange,
    handleNewPoolStageNameChange,
    handleNewPoolStagePoolCountChange,
    handleNewPoolStagePlayersPerPoolChange,
    handleNewPoolStageAdvanceCountChange,
    handleNewPoolStageLosersAdvanceChange,
    handleBracketNameChange,
    handleBracketTypeChange,
    handleBracketRoundsChange,
    handleBracketStatusChange,
    addBracket,
    saveBracket,
    removeBracket,
    startAddBracket,
    cancelAddBracket,
    handleNewBracketNameChange,
    handleNewBracketTypeChange,
    handleNewBracketRoundsChange,
    resetStructureState,
  } = useTournamentStructure({
    t,
    editingTournament,
    getSafeAccessToken,
  });
  const {
    openEdit,
    closeEdit,
    uploadLogo,
    saveEdit,
    openRegistration,
    moveToSignature,
    moveToLive,
  } = useTournamentListEditFlow({
    t,
    isEditPage,
    editTournamentId,
    getSafeAccessToken,
    players,
    fetchPlayers,
    clearPlayers,
    clearPlayersError,
    resetPlayersState,
    resetStructureState,
    loadPoolStages,
    loadBrackets,
    fetchTournaments: refreshTournaments,
    editingTournament,
    editForm,
    logoFile,
    setEditingTournament,
    setEditForm,
    setEditError,
    setEditLoading,
    setEditLoadError,
    setIsSaving,
    setLogoFile,
    setIsUploadingLogo,
  });
  const {
    editingPoolStage,
    poolStagePools,
    poolStagePlayers,
    poolStageAssignments,
    poolStageEditError,
    isSavingAssignments,
    openPoolStageAssignments,
    closePoolStageAssignments,
    updatePoolStageAssignment,
    savePoolStageAssignments,
  } = usePoolStageAssignments({
    t,
    editingTournament,
    getSafeAccessToken,
    onStopAddingPoolStage: cancelAddPoolStage,
  });
  const {
    userRegistrations,
    registeringTournamentId,
    handleRegisterSelf,
    handleUnregisterSelf,
  } = useTournamentListRegistrations({
    t,
    tournaments: visibleTournaments,
    isAuthenticated,
    isAdmin,
    user,
    getSafeAccessToken,
  });

  const { formatOptions, durationOptions, skillLevelOptions } = useTournamentOptions(t);
  const { groupedTournaments } = useTournamentListGrouping({
    t,
    tournaments: visibleTournaments,
    isAdmin,
    userRegistrations,
  });


  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('auth.checkingSession')}</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <SignInPanel
        title={t('auth.signInToViewTournaments')}
        description={t('auth.protectedContinue')}
      />
    );
  }

  if (!isEditPage && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('tournaments.loading')}</span>
      </div>
    );
  }

  if (!isEditPage && error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={refreshTournaments}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TournamentListHeader
        isEditPage={isEditPage}
        editingTournament={editingTournament}
        tournamentsCount={visibleTournaments.length}
        t={t}
      />

      {isEditPage && editLoadError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {editLoadError}
        </div>
      )}
      {isEditPage && editLoading && (
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          {t('tournaments.loading')}
        </div>
      )}

      {!isEditPage && (visibleTournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">{t('tournaments.none')}</p>
          <p className="mt-2">{t('tournaments.none.subtitle')}</p>
        </div>
      ) : (
        <TournamentListGroups
          groupedTournaments={groupedTournaments}
          normalizeStatus={normalizeTournamentStatus}
          isAdmin={isAdmin}
          t={t}
          userRegistrations={userRegistrations}
          registeringTournamentId={registeringTournamentId ?? undefined}
          onEdit={openEdit}
          onDelete={deleteTournament}
          onRegister={handleRegisterSelf}
          onUnregister={handleUnregisterSelf}
          onOpenRegistration={openRegistrationFromCard}
          onOpenSignature={openSignatureFromCard}
          openingRegistrationId={openingRegistrationId ?? undefined}
          openingSignatureId={openingSignatureId ?? undefined}
        />
      ))}

      {editingTournament && editForm && (
        <TournamentEditPanel
          t={t}
          isEditPage={isEditPage}
          editForm={editForm}
          editingTournament={editingTournament}
          formatOptions={formatOptions}
          durationOptions={durationOptions}
          skillLevelOptions={skillLevelOptions}
          editError={editError}
          isSaving={isSaving}
          isUploadingLogo={isUploadingLogo}
          logoFile={logoFile}
          normalizedStatus={normalizeTournamentStatus(editingTournament.status)}
          onClose={closeEdit}
          onEditFormChange={(next) => setEditForm(next)}
          onLogoFileChange={setLogoFile}
          onUploadLogo={() => {
            void uploadLogo();
          }}
          poolStages={poolStages}
          poolStagesError={poolStagesError}
          onLoadPoolStages={() => {
            if (editingTournament) {
              void loadPoolStages(editingTournament.id);
            }
          }}
          onPoolStageNumberChange={handlePoolStageNumberChange}
          onPoolStageNameChange={handlePoolStageNameChange}
          onPoolStagePoolCountChange={handlePoolStagePoolCountChange}
          onPoolStagePlayersPerPoolChange={handlePoolStagePlayersPerPoolChange}
          onPoolStageAdvanceCountChange={handlePoolStageAdvanceCountChange}
          onPoolStageLosersAdvanceChange={handlePoolStageLosersAdvanceChange}
          onPoolStageStatusChange={handlePoolStageStatusChange}
          onOpenPoolStageAssignments={(stage) => {
            void openPoolStageAssignments(stage);
          }}
          onSavePoolStage={(stage) => {
            void savePoolStage(stage);
          }}
          onRemovePoolStage={(id) => {
            void removePoolStage(id);
          }}
          isAddingPoolStage={isAddingPoolStage}
          newPoolStage={newPoolStage}
          onStartAddPoolStage={startAddPoolStage}
          onCancelAddPoolStage={cancelAddPoolStage}
          onNewPoolStageStageNumberChange={handleNewPoolStageStageNumberChange}
          onNewPoolStageNameChange={handleNewPoolStageNameChange}
          onNewPoolStagePoolCountChange={handleNewPoolStagePoolCountChange}
          onNewPoolStagePlayersPerPoolChange={handleNewPoolStagePlayersPerPoolChange}
          onNewPoolStageAdvanceCountChange={handleNewPoolStageAdvanceCountChange}
          onNewPoolStageLosersAdvanceChange={handleNewPoolStageLosersAdvanceChange}
          onAddPoolStage={addPoolStage}
          brackets={brackets}
          bracketsError={bracketsError}
          onLoadBrackets={() => {
            if (editingTournament) {
              void loadBrackets(editingTournament.id);
            }
          }}
          onBracketNameChange={handleBracketNameChange}
          onBracketTypeChange={handleBracketTypeChange}
          onBracketRoundsChange={handleBracketRoundsChange}
          onBracketStatusChange={handleBracketStatusChange}
          onSaveBracket={(bracket) => {
            void saveBracket(bracket);
          }}
          onRemoveBracket={(id) => {
            void removeBracket(id);
          }}
          isAddingBracket={isAddingBracket}
          newBracket={newBracket}
          onStartAddBracket={startAddBracket}
          onCancelAddBracket={cancelAddBracket}
          onNewBracketNameChange={handleNewBracketNameChange}
          onNewBracketTypeChange={handleNewBracketTypeChange}
          onNewBracketRoundsChange={handleNewBracketRoundsChange}
          onAddBracket={addBracket}
          getStatusLabel={getStatusLabel}
          normalizeStageStatus={normalizeStageStatus}
          players={players}
          playersLoading={playersLoading}
          playersError={playersError}
          playerForm={playerForm}
          editingPlayerId={editingPlayerId}
          checkingInPlayerId={checkingInPlayerId}
          playerActionLabel={playerActionLabel}
          isRegisteringPlayer={isRegisteringPlayer}
          isAutoFillingPlayers={isAutoFillingPlayers}
          isConfirmingAll={isConfirmingAll}
          onPlayerFormChange={setPlayerForm}
          onStartEditPlayer={startEditPlayer}
          onCancelEditPlayer={cancelEditPlayer}
          onSubmitPlayer={() => {
            void (editingPlayerId ? savePlayerEdit() : registerPlayer());
          }}
          onAutoFillPlayers={autoFillPlayers}
          onRemovePlayer={removePlayer}
          onFetchPlayers={() => {
            void fetchPlayers(editingTournament.id);
          }}
          onConfirmAllPlayers={() => {
            void confirmAllPlayers();
          }}
          onTogglePlayerCheckIn={(player) => {
            void togglePlayerCheckIn(player);
          }}
          onMoveToSignature={() => {
            void moveToSignature();
          }}
          onMoveToLive={() => {
            void moveToLive();
          }}
          onOpenRegistration={() => {
            void openRegistration();
          }}
          onSaveEdit={() => {
            void saveEdit();
          }}
        />
      )}

      <PoolStageAssignmentsModal
        editingPoolStage={editingPoolStage}
        poolStagePools={poolStagePools}
        poolStagePlayers={poolStagePlayers}
        poolStageAssignments={poolStageAssignments}
        poolStageEditError={poolStageEditError}
        isSavingAssignments={isSavingAssignments}
        t={t}
        onClose={closePoolStageAssignments}
        onSave={savePoolStageAssignments}
        onUpdateAssignment={updatePoolStageAssignment}
      />
    </div>
  );
}

export default TournamentList;