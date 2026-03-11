import { useCallback } from 'react';
import usePoolStageAssignments from './use-pool-stage-assignments';
import useTournamentEditState from './use-tournament-edit-state';
import useTournamentListEditData from './use-tournament-list-edit-data';
import useTournamentListEditFlow from './use-tournament-list-edit-flow';
import useTournamentListPresetActions from './use-tournament-list-preset-actions';
import useTournamentOptions from './use-tournament-options';
import useTournamentPlayers from './use-tournament-players';
import useTournamentStructure from './use-tournament-structure';
import composeTournamentListEditingProperties from './compose-tournament-list-editing-properties';

type UseTournamentListEditingDataInput = {
  t: (key: string) => string;
  isAdmin: boolean;
  isEditPage: boolean;
  editTournamentId: string | null;
  authEnabled: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  getSafeAccessToken: () => Promise<string | undefined>;
  getStatusLabel: (scope: 'stage' | 'bracket', status: string) => string;
  refreshTournaments: () => void;
};

const buildEditFlowInput = ({
  t,
  isEditPage,
  editTournamentId,
  getSafeAccessToken,
  refreshTournaments,
  editState,
  structure,
  players,
}: {
  t: (key: string) => string;
  isEditPage: boolean;
  editTournamentId: string | null;
  getSafeAccessToken: () => Promise<string | undefined>;
  refreshTournaments: () => void;
  editState: ReturnType<typeof useTournamentEditState>;
  structure: ReturnType<typeof useTournamentStructure>;
  players: ReturnType<typeof useTournamentPlayers>;
}) => ({
  t,
  isEditPage,
  editTournamentId,
  getSafeAccessToken,
  players: players.players,
  fetchPlayers: players.fetchPlayers,
  clearPlayers: players.clearPlayers,
  clearPlayersError: players.clearPlayersError,
  resetPlayersState: players.resetPlayersState,
  resetStructureState: structure.resetStructureState,
  loadPoolStages: structure.loadPoolStages,
  loadBrackets: structure.loadBrackets,
  loadTargets: structure.loadTargets,
  fetchTournaments: refreshTournaments,
  editingTournament: editState.editingTournament,
  editForm: editState.editForm,
  logoFile: editState.logoFile,
  setEditingTournament: editState.setEditingTournament,
  setEditForm: editState.setEditForm,
  setEditError: editState.setEditError,
  setEditLoading: editState.setEditLoading,
  setEditLoadError: editState.setEditLoadError,
  setIsSaving: editState.setIsSaving,
  setLogoFile: editState.setLogoFile,
  setIsUploadingLogo: editState.setIsUploadingLogo,
});

const toEditingDataResult = (
  editState: ReturnType<typeof useTournamentEditState>,
  editFlow: ReturnType<typeof useTournamentListEditFlow>,
  editSectionProperties: ReturnType<typeof composeTournamentListEditingProperties>['editSectionProperties'],
  poolStageAssignmentsModalProperties: ReturnType<typeof composeTournamentListEditingProperties>['poolStageAssignmentsModalProperties']
) => ({
  editingTournament: editState.editingTournament,
  editLoadError: editState.editLoadError,
  editLoading: editState.editLoading,
  openEdit: editFlow.openEdit,
  editSectionProperties,
  poolStageAssignmentsModalProperties,
});

const useTournamentListEditingData = ({
  t,
  isAdmin,
  isEditPage,
  editTournamentId,
  authEnabled,
  authLoading,
  isAuthenticated,
  getSafeAccessToken,
  getStatusLabel,
  refreshTournaments,
}: UseTournamentListEditingDataInput) => {
  const editState = useTournamentEditState();

  const structure = useTournamentStructure({
    t,
    editingTournament: editState.editingTournament,
    authEnabled,
    getSafeAccessToken,
  });

  const { refreshTournamentDetails } = useTournamentListEditData({
    editingTournamentId: editState.editingTournament?.id,
    authEnabled,
    authLoading,
    isAuthenticated,
    loadTargets: structure.loadTargets,
    getSafeAccessToken,
    setEditingTournament: editState.setEditingTournament,
  });

  const players = useTournamentPlayers({
    t,
    editingTournament: editState.editingTournament,
    getSafeAccessToken,
    refreshTournamentDetails,
  });

  const editFlow = useTournamentListEditFlow(buildEditFlowInput({
    t,
    isEditPage,
    editTournamentId,
    getSafeAccessToken,
    refreshTournaments,
    editState,
    structure,
    players,
  }));

  const presets = useTournamentListPresetActions({
    t,
    isAdmin,
    isEditPage,
    editTournamentId,
    editingTournament: editState.editingTournament,
    editForm: editState.editForm,
    setEditForm: editState.setEditForm,
    setEditError: editState.setEditError,
    poolStages: structure.poolStages,
    brackets: structure.brackets,
    loadPoolStages: structure.loadPoolStages,
    loadBrackets: structure.loadBrackets,
    getSafeAccessToken,
  });

  const handleSaveEdit = useCallback(async () => {
    if (structure.isAddingPoolStage && structure.newPoolStage.name.trim()) {
      const created = await structure.addPoolStage();
      if (!created) {
        return;
      }
    }
    await editFlow.saveEdit();
  }, [editFlow, structure]);

  const poolStageAssignments = usePoolStageAssignments({
    t,
    editingTournament: editState.editingTournament,
    getSafeAccessToken,
    onStopAddingPoolStage: structure.cancelAddPoolStage,
  });

  const { formatOptions, durationOptions, skillLevelOptions } = useTournamentOptions(t);

  const {
    editSectionProperties,
    poolStageAssignmentsModalProperties,
  } = composeTournamentListEditingProperties({
    t,
    isEditPage,
    isAdmin,
    getStatusLabel,
    handleSaveEdit,
    editState,
    structure,
    players,
    presets,
    editFlow,
    poolStageAssignments,
    formatOptions,
    durationOptions,
    skillLevelOptions,
  });

  return toEditingDataResult(
    editState,
    editFlow,
    editSectionProperties,
    poolStageAssignmentsModalProperties
  );
};

export default useTournamentListEditingData;
