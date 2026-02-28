import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import { TournamentFormat } from '@shared/types';
import {
  createBracket,
  createPoolStage,
  deleteBracket,
  deletePoolStage,
  fetchTournamentPlayers,
  fetchTournamentPresets,
  type TournamentPreset,
  updatePoolStage,
  updateTournamentStatus,
} from '../services/tournament-service';
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
import {
  autoFillTournamentPlayers,
  confirmAllTournamentPlayers,
} from './tournament-list/tournament-players-actions';
import {
  buildPresetRoutingUpdates,
  buildTournamentPresetTemplate,
} from '../utils/tournament-presets';

function TournamentList() { // NOSONAR
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
    user,
  } = useOptionalAuth();
  const { isAdmin, adminUser } = useAdminStatus();
  const effectiveUser = user ?? adminUser;
  const effectiveIsAuthenticated = isAuthenticated || Boolean(adminUser);
  const { t } = useI18n();
  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const view = parameters.get('view');
  const status = parameters.get('status');
  const editTournamentId = parameters.get('tournamentId');
  const isEditPage = view === 'edit-tournament';
  const normalizedRequestedStatus = normalizeTournamentStatus(status ?? undefined);
  const hideOpenSignatureAction = normalizedRequestedStatus === 'DRAFT';
  const isRootStatusView = normalizedRequestedStatus.length === 0;
  const showOpenAutoFillAction = isRootStatusView || normalizedRequestedStatus === 'OPEN';
  const showSignatureAutoConfirmAction = isRootStatusView || normalizedRequestedStatus === 'SIGNATURE';
  // Helper to safely get access token, falling back to undefined if it fails
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) {
      return undefined;
    }
    try {
      const token = await getAccessTokenSilently();
      return token;
    } catch {
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);
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
  const [autoFillingTournamentId, setAutoFillingTournamentId] = useState<string | undefined>();
  const [confirmingTournamentId, setConfirmingTournamentId] = useState<string | undefined>();
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
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedMoveToSignature'));
    } finally {
      setOpeningSignatureId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);
  const autoFillTournamentFromCard = useCallback(async (tournamentId: string) => {
    const tournament = visibleTournaments.find((item) => item.id === tournamentId);
    if (!tournament) {
      return;
    }

    setAutoFillingTournamentId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      const tournamentPlayers = await fetchTournamentPlayers(tournamentId, token);
      await autoFillTournamentPlayers({
        tournament,
        players: tournamentPlayers,
        token,
      });
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedAutoFillPlayers'));
    } finally {
      setAutoFillingTournamentId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t, visibleTournaments]);
  const confirmAllFromCard = useCallback(async (tournamentId: string) => {
    const tournament = visibleTournaments.find((item) => item.id === tournamentId);
    if (!tournament) {
      return;
    }

    setConfirmingTournamentId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      const tournamentPlayers = await fetchTournamentPlayers(tournamentId, token);
      await confirmAllTournamentPlayers({
        tournament,
        players: tournamentPlayers,
        token,
      });
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedConfirmAllPlayers'));
    } finally {
      setConfirmingTournamentId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t, visibleTournaments]);
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
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [quickStructurePresets, setQuickStructurePresets] = useState<TournamentPreset[]>([]);
  const [quickStructurePresetsLoading, setQuickStructurePresetsLoading] = useState(false);
  const refreshTournamentDetails = useCallback(async (tournamentId: string) => {
    try {
      const token = await getSafeAccessToken();
      const response = await fetch(`/api/tournaments/${tournamentId}`, token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {});
      if (!response.ok) {
        throw new Error('Failed to fetch tournament details');
      }
      const data = await response.json();
      setEditingTournament((current) => (current ? { ...current, ...data } : data));
    } catch {
      void 0;
    }
  }, [getSafeAccessToken, setEditingTournament]);
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
    refreshTournamentDetails,
  });
  const {
    poolStages,
    poolStagesError,
    isAddingPoolStage,
    newPoolStage,
    brackets,
    bracketsError,
    targets,
    targetsError,
    isAddingBracket,
    newBracket,
    loadPoolStages,
    loadBrackets,
    loadTargets,
    handlePoolStageNumberChange,
    handlePoolStageNameChange,
    handlePoolStagePoolCountChange,
    handlePoolStagePlayersPerPoolChange,
    handlePoolStageAdvanceCountChange,
    handlePoolStageMatchFormatChange,
    handlePoolStageLosersAdvanceChange,
    handlePoolStageRankingDestinationChange,
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
    handleNewPoolStageMatchFormatChange,
    handleNewPoolStageLosersAdvanceChange,
    handleNewPoolStageRankingDestinationChange,
    handleBracketNameChange,
    handleBracketTypeChange,
    handleBracketRoundsChange,
    handleBracketRoundMatchFormatChange,
    handleBracketStatusChange,
    handleBracketTargetToggle,
    addBracket,
    saveBracket,
    saveBracketTargets,
    removeBracket,
    startAddBracket,
    cancelAddBracket,
    handleNewBracketNameChange,
    handleNewBracketTypeChange,
    handleNewBracketRoundsChange,
    handleNewBracketRoundMatchFormatChange,
    resetStructureState,
  } = useTournamentStructure({
    t,
    editingTournament,
    authEnabled,
    getSafeAccessToken,
  });

  useEffect(() => {
    if (!editingTournament?.id) {
      return;
    }
    if (authEnabled && (authLoading || !isAuthenticated)) {
      return;
    }
    void loadTargets(editingTournament.id);
  }, [authEnabled, authLoading, editingTournament?.id, isAuthenticated, loadTargets]);
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
    loadTargets,
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
  const handleApplyStructurePreset = useCallback(async (preset: Pick<TournamentPreset, 'name' | 'presetType' | 'templateConfig'>) => {
    if (!editingTournament) return;
    if (normalizeTournamentStatus(editingTournament.status) === 'LIVE') {
      setEditError(t('edit.quickStructureDisabledLive'));
      return;
    }
    const totalParticipants = Number(editForm?.totalParticipants ?? editingTournament.totalParticipants ?? 0);
    const template = buildTournamentPresetTemplate(preset, totalParticipants);
    const confirmLabel = template.format === 'DOUBLE'
      ? t('edit.quickStructureConfirmDouble')
      : t('edit.quickStructureConfirmSingle');
    if (!confirm(confirmLabel)) return;

    setIsApplyingPreset(true);
    setEditError(undefined);
    try {
      const token = await getSafeAccessToken();
      for (const bracket of brackets) {
        await deleteBracket(editingTournament.id, bracket.id, token);
      }
      for (const stage of poolStages) {
        await deletePoolStage(editingTournament.id, stage.id, token);
      }
      const createdStages = [];
      for (const stage of template.stages) {
        const createdStage = await createPoolStage(editingTournament.id, stage, token);
        createdStages.push(createdStage);
      }
      const createdBrackets = [];
      for (const bracket of template.brackets) {
        const createdBracket = await createBracket(editingTournament.id, bracket, token);
        createdBrackets.push(createdBracket);
      }

      const routingUpdates = buildPresetRoutingUpdates(
        preset.templateConfig,
        createdStages,
        createdBrackets
      );
      for (const update of routingUpdates) {
        await updatePoolStage(editingTournament.id, update.stageId, {
          rankingDestinations: update.rankingDestinations,
        }, token);
      }
      if (editForm) {
        setEditForm({
          ...editForm,
          format: template.format,
          doubleStageEnabled: template.format === TournamentFormat.DOUBLE,
        });
      }
      await loadPoolStages(editingTournament.id);
      await loadBrackets(editingTournament.id);
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedApplyPreset'));
    } finally {
      setIsApplyingPreset(false);
    }
  }, [brackets, editForm, editingTournament, getSafeAccessToken, loadBrackets, loadPoolStages, poolStages, setEditError, setEditForm, t]);
  const loadQuickStructurePresets = useCallback(async () => {
    if (!isAdmin) {
      setQuickStructurePresets([]);
      return;
    }
    setQuickStructurePresetsLoading(true);
    try {
      const token = await getSafeAccessToken();
      const presets = await fetchTournamentPresets(token);

      if (isEditPage && presets.length === 0 && globalThis.window) {
        const redirectUrl = new URL(globalThis.window.location.href);
        redirectUrl.searchParams.set('view', 'tournament-presets');
        redirectUrl.searchParams.set('from', 'edit-tournament');
        if (editTournamentId) {
          redirectUrl.searchParams.set('tournamentId', editTournamentId);
        }
        globalThis.window.location.assign(`${redirectUrl.pathname}${redirectUrl.search}`);
        return;
      }

      setQuickStructurePresets(presets);
    } catch {
      setQuickStructurePresets([]);
    } finally {
      setQuickStructurePresetsLoading(false);
    }
  }, [editTournamentId, getSafeAccessToken, isAdmin, isEditPage]);
  useEffect(() => {
    void loadQuickStructurePresets();
  }, [loadQuickStructurePresets]);
  const handleSaveEdit = useCallback(async () => {
    if (isAddingPoolStage && newPoolStage.name.trim()) {
      const created = await addPoolStage();
      if (!created) {
        return;
      }
    }
    await saveEdit();
  }, [addPoolStage, isAddingPoolStage, newPoolStage.name, saveEdit]);
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
    userGroupStatuses,
    registeringTournamentId,
    handleRegisterSelf,
    handleRegisterGroup,
    handleUnregisterGroup,
    handleUnregisterSelf,
  } = useTournamentListRegistrations({
    t,
    tournaments: visibleTournaments,
    isAdmin,
    isAuthenticated: effectiveIsAuthenticated,
    user: effectiveUser,
    getSafeAccessToken,
    refreshTournaments,
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
          isAuthenticated={effectiveIsAuthenticated}
          t={t}
          userRegistrations={userRegistrations}
          userGroupStatuses={userGroupStatuses}
          registeringTournamentId={registeringTournamentId ?? undefined}
          onEdit={openEdit}
          onDelete={deleteTournament}
          onRegister={handleRegisterSelf}
          onRegisterGroup={handleRegisterGroup}
          onUnregisterGroup={handleUnregisterGroup}
          onUnregister={handleUnregisterSelf}
          onOpenRegistration={openRegistrationFromCard}
          onOpenSignature={openSignatureFromCard}
          onAutoFillPlayers={autoFillTournamentFromCard}
          onConfirmAllPlayers={confirmAllFromCard}
          hideOpenSignatureAction={hideOpenSignatureAction}
          showOpenAutoFillAction={showOpenAutoFillAction}
          showSignatureAutoConfirmAction={showSignatureAutoConfirmAction}
          openingRegistrationId={openingRegistrationId ?? undefined}
          openingSignatureId={openingSignatureId ?? undefined}
          autoFillingTournamentId={autoFillingTournamentId ?? undefined}
          confirmingTournamentId={confirmingTournamentId ?? undefined}
        />
      ))}

      {editingTournament && editForm && (
        <TournamentEditPanel
          t={t}
          isEditPage={isEditPage}
            isAdmin={isAdmin}
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
          onEditFormChange={setEditForm}
          onLogoFileChange={setLogoFile}
          onUploadLogo={uploadLogo}
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
          onPoolStageMatchFormatChange={handlePoolStageMatchFormatChange}
          onPoolStageLosersAdvanceChange={handlePoolStageLosersAdvanceChange}
          onPoolStageRankingDestinationChange={handlePoolStageRankingDestinationChange}
          onPoolStageStatusChange={handlePoolStageStatusChange}
          onOpenPoolStageAssignments={openPoolStageAssignments}
          onSavePoolStage={savePoolStage}
          onRemovePoolStage={removePoolStage}
          isAddingPoolStage={isAddingPoolStage}
          newPoolStage={newPoolStage}
          onStartAddPoolStage={startAddPoolStage}
          onCancelAddPoolStage={cancelAddPoolStage}
          onNewPoolStageStageNumberChange={handleNewPoolStageStageNumberChange}
          onNewPoolStageNameChange={handleNewPoolStageNameChange}
          onNewPoolStagePoolCountChange={handleNewPoolStagePoolCountChange}
          onNewPoolStagePlayersPerPoolChange={handleNewPoolStagePlayersPerPoolChange}
          onNewPoolStageAdvanceCountChange={handleNewPoolStageAdvanceCountChange}
          onNewPoolStageMatchFormatChange={handleNewPoolStageMatchFormatChange}
          onNewPoolStageLosersAdvanceChange={handleNewPoolStageLosersAdvanceChange}
          onNewPoolStageRankingDestinationChange={handleNewPoolStageRankingDestinationChange}
          onAddPoolStage={addPoolStage}
          isApplyingPreset={isApplyingPreset}
          quickStructurePresets={quickStructurePresets}
          quickStructurePresetsLoading={quickStructurePresetsLoading}
          onApplyStructurePreset={handleApplyStructurePreset}
          brackets={brackets}
          bracketsError={bracketsError}
          targets={targets}
          targetsError={targetsError}
          onLoadBrackets={() => {
            if (editingTournament) {
              void loadBrackets(editingTournament.id);
              void loadTargets(editingTournament.id);
            }
          }}
          onBracketNameChange={handleBracketNameChange}
          onBracketTypeChange={handleBracketTypeChange}
          onBracketRoundsChange={handleBracketRoundsChange}
          onBracketRoundMatchFormatChange={handleBracketRoundMatchFormatChange}
          onBracketStatusChange={handleBracketStatusChange}
          onBracketTargetToggle={handleBracketTargetToggle}
          onSaveBracket={saveBracket}
          onSaveBracketTargets={saveBracketTargets}
          onRemoveBracket={removeBracket}
          isAddingBracket={isAddingBracket}
          newBracket={newBracket}
          onStartAddBracket={startAddBracket}
          onCancelAddBracket={cancelAddBracket}
          onNewBracketNameChange={handleNewBracketNameChange}
          onNewBracketTypeChange={handleNewBracketTypeChange}
          onNewBracketRoundsChange={handleNewBracketRoundsChange}
          onNewBracketRoundMatchFormatChange={handleNewBracketRoundMatchFormatChange}
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
          onConfirmAllPlayers={confirmAllPlayers}
          onTogglePlayerCheckIn={togglePlayerCheckIn}
          onMoveToSignature={moveToSignature}
          onMoveToLive={moveToLive}
          onOpenRegistration={openRegistration}
          onSaveEdit={handleSaveEdit}
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