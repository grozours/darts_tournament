import usePoolStageAssignments from './use-pool-stage-assignments';
import useTournamentEditState from './use-tournament-edit-state';
import useTournamentListEditFlow from './use-tournament-list-edit-flow';
import useTournamentListPresetActions from './use-tournament-list-preset-actions';
import useTournamentPlayers from './use-tournament-players';
import useTournamentStructure from './use-tournament-structure';
import { normalizeStageStatus } from './tournament-status-helpers';
import composeTournamentListEditSectionProperties from './compose-tournament-list-edit-section-properties';

type ComposeTournamentListEditingPropertiesInput = {
  t: (key: string) => string;
  isEditPage: boolean;
  isAdmin: boolean;
  getStatusLabel: (scope: 'stage' | 'bracket', status: string) => string;
  handleSaveEdit: () => Promise<void>;
  editState: ReturnType<typeof useTournamentEditState>;
  structure: ReturnType<typeof useTournamentStructure>;
  players: ReturnType<typeof useTournamentPlayers>;
  presets: ReturnType<typeof useTournamentListPresetActions>;
  editFlow: ReturnType<typeof useTournamentListEditFlow>;
  poolStageAssignments: ReturnType<typeof usePoolStageAssignments>;
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  skillLevelOptions: Array<{ value: string; label: string }>;
};

const wrapAsyncVoid = <TArguments extends unknown[]>(
  callback: (...arguments_: TArguments) => Promise<unknown>
) => (...arguments_: TArguments): void => {
  void callback(...arguments_);
};

const buildEditSectionProperties = ({
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
}: ComposeTournamentListEditingPropertiesInput) => composeTournamentListEditSectionProperties({
  t,
  isEditPage,
  isAdmin,
  editForm: editState.editForm,
  editingTournament: editState.editingTournament,
  formatOptions,
  durationOptions,
  skillLevelOptions,
  editError: editState.editError,
  isSaving: editState.isSaving,
  isUploadingLogo: editState.isUploadingLogo,
  logoFiles: editState.logoFiles,
  onClose: editFlow.closeEdit,
  onEditFormChange: editState.setEditForm,
  onLogoFilesChange: editState.setLogoFiles,
  onUploadLogo: wrapAsyncVoid(editFlow.uploadLogo),
  onDeleteLogo: wrapAsyncVoid(editFlow.deleteLogo),
  poolStages: structure.poolStages,
  poolStagesError: structure.poolStagesError,
  onPoolStageNumberChange: structure.handlePoolStageNumberChange,
  onPoolStageNameChange: structure.handlePoolStageNameChange,
  onPoolStagePoolCountChange: structure.handlePoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange: structure.handlePoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange: structure.handlePoolStageAdvanceCountChange,
  onPoolStageMatchFormatChange: structure.handlePoolStageMatchFormatChange,
  onPoolStageLosersAdvanceChange: structure.handlePoolStageLosersAdvanceChange,
  onPoolStageRankingDestinationChange: structure.handlePoolStageRankingDestinationChange,
  onPoolStageStatusChange: structure.handlePoolStageStatusChange,
  onOpenPoolStageAssignments: wrapAsyncVoid(poolStageAssignments.openPoolStageAssignments),
  onSavePoolStage: wrapAsyncVoid(structure.savePoolStage),
  onRemovePoolStage: wrapAsyncVoid(structure.removePoolStage),
  isAddingPoolStage: structure.isAddingPoolStage,
  newPoolStage: structure.newPoolStage,
  onStartAddPoolStage: structure.startAddPoolStage,
  onCancelAddPoolStage: structure.cancelAddPoolStage,
  onNewPoolStageStageNumberChange: structure.handleNewPoolStageStageNumberChange,
  onNewPoolStageNameChange: structure.handleNewPoolStageNameChange,
  onNewPoolStagePoolCountChange: structure.handleNewPoolStagePoolCountChange,
  onNewPoolStagePlayersPerPoolChange: structure.handleNewPoolStagePlayersPerPoolChange,
  onNewPoolStageAdvanceCountChange: structure.handleNewPoolStageAdvanceCountChange,
  onNewPoolStageMatchFormatChange: structure.handleNewPoolStageMatchFormatChange,
  onNewPoolStageLosersAdvanceChange: structure.handleNewPoolStageLosersAdvanceChange,
  onNewPoolStageRankingDestinationChange: structure.handleNewPoolStageRankingDestinationChange,
  onAddPoolStage: structure.addPoolStage,
  isApplyingPreset: presets.isApplyingPreset,
  quickStructurePresets: presets.quickStructurePresets,
  quickStructurePresetsLoading: presets.quickStructurePresetsLoading,
  onApplyStructurePreset: wrapAsyncVoid(presets.handleApplyStructurePreset),
  brackets: structure.brackets,
  bracketsError: structure.bracketsError,
  targets: structure.targets,
  targetsError: structure.targetsError,
  onBracketNameChange: structure.handleBracketNameChange,
  onBracketTypeChange: structure.handleBracketTypeChange,
  onBracketRoundsChange: structure.handleBracketRoundsChange,
  onBracketRoundMatchFormatChange: structure.handleBracketRoundMatchFormatChange,
  onBracketStatusChange: structure.handleBracketStatusChange,
  onBracketTargetToggle: structure.handleBracketTargetToggle,
  onSaveBracket: wrapAsyncVoid(structure.saveBracket),
  onSaveBracketTargets: wrapAsyncVoid(structure.saveBracketTargets),
  onRemoveBracket: wrapAsyncVoid(structure.removeBracket),
  isAddingBracket: structure.isAddingBracket,
  newBracket: structure.newBracket,
  onStartAddBracket: structure.startAddBracket,
  onCancelAddBracket: structure.cancelAddBracket,
  onNewBracketNameChange: structure.handleNewBracketNameChange,
  onNewBracketTypeChange: structure.handleNewBracketTypeChange,
  onNewBracketRoundsChange: structure.handleNewBracketRoundsChange,
  onNewBracketRoundMatchFormatChange: structure.handleNewBracketRoundMatchFormatChange,
  onAddBracket: wrapAsyncVoid(structure.addBracket),
  getStatusLabel,
  normalizeStageStatus,
  players: players.players,
  playersLoading: players.playersLoading,
  playersError: players.playersError,
  playerForm: players.playerForm,
  editingPlayerId: players.editingPlayerId,
  checkingInPlayerId: players.checkingInPlayerId,
  playerActionLabel: players.playerActionLabel,
  isRegisteringPlayer: players.isRegisteringPlayer,
  isAutoFillingPlayers: players.isAutoFillingPlayers,
  isConfirmingAll: players.isConfirmingAll,
  autoFillProgress: players.autoFillProgress,
  confirmAllProgress: players.confirmAllProgress,
  onPlayerFormChange: players.setPlayerForm,
  onStartEditPlayer: players.startEditPlayer,
  onCancelEditPlayer: players.cancelEditPlayer,
  onAutoFillPlayers: wrapAsyncVoid(players.autoFillPlayers),
  onRemovePlayer: wrapAsyncVoid(players.removePlayer),
  onConfirmAllPlayers: wrapAsyncVoid(players.confirmAllPlayers),
  onTogglePlayerCheckIn: wrapAsyncVoid(players.togglePlayerCheckIn),
  onSearchUnregisteredAccounts: players.searchUnregisteredAccounts,
  onRegisterPlayerFromAccount: wrapAsyncVoid(players.registerPlayerFromAccount),
  onMoveToSignature: wrapAsyncVoid(editFlow.moveToSignature),
  onMoveToLive: wrapAsyncVoid(editFlow.moveToLive),
  onOpenRegistration: wrapAsyncVoid(editFlow.openRegistration),
  onSaveEdit: wrapAsyncVoid(handleSaveEdit),
  loadPoolStages: structure.loadPoolStages,
  loadBrackets: structure.loadBrackets,
  loadTargets: structure.loadTargets,
  fetchPlayers: players.fetchPlayers,
  savePlayerEdit: players.savePlayerEdit,
  registerPlayer: players.registerPlayer,
});

const buildPoolStageAssignmentsProperties = (
  t: (key: string) => string,
  poolStageAssignments: ReturnType<typeof usePoolStageAssignments>
) => ({
  editingPoolStage: poolStageAssignments.editingPoolStage,
  poolStagePools: poolStageAssignments.poolStagePools,
  poolStagePlayers: poolStageAssignments.poolStagePlayers,
  poolStageAssignments: poolStageAssignments.poolStageAssignments,
  poolStageEditError: poolStageAssignments.poolStageEditError,
  isSavingAssignments: poolStageAssignments.isSavingAssignments,
  t,
  onClose: poolStageAssignments.closePoolStageAssignments,
  onSave: poolStageAssignments.savePoolStageAssignments,
  onUpdateAssignment: poolStageAssignments.updatePoolStageAssignment,
});

const composeTournamentListEditingProperties = ({
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
}: ComposeTournamentListEditingPropertiesInput) => {
  const editSectionProperties = buildEditSectionProperties({
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

  const poolStageAssignmentsModalProperties = buildPoolStageAssignmentsProperties(t, poolStageAssignments);

  return {
    editSectionProperties,
    poolStageAssignmentsModalProperties,
  };
};

export default composeTournamentListEditingProperties;
