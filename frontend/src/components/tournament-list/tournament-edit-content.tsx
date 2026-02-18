import type { BracketConfig, CreatePlayerPayload, PoolStageConfig, TournamentPlayer } from '../../services/tournament-service';
import type { EditFormState, Translator } from './types';
import TournamentEditForm from './tournament-edit-form';
import PoolStagesEditor from './pool-stages-editor';
import BracketsEditor from './brackets-editor';
import TournamentStatusSections from './tournament-status-sections';

export type TournamentEditContentProperties = {
  t: Translator;
  editForm: EditFormState;
  editingTournament: {
    status: string;
    logoUrl?: string | undefined;
    createdAt?: string | undefined;
    completedAt?: string | undefined;
    historicalFlag?: boolean | undefined;
    format: string;
    totalParticipants: number;
  };
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  skillLevelOptions: Array<{ value: string; label: string }>;
  logoFile?: File | undefined;
  isUploadingLogo: boolean;
  poolStages: PoolStageConfig[];
  poolStagesError?: string | undefined;
  isAddingPoolStage: boolean;
  newPoolStage: {
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket: boolean;
  };
  brackets: BracketConfig[];
  bracketsError?: string | undefined;
  isAddingBracket: boolean;
  newBracket: {
    name: string;
    bracketType: string;
    totalRounds: number;
  };
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError?: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId?: string | undefined;
  checkingInPlayerId?: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  isConfirmingAll: boolean;
  normalizedStatus: string;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
  onLoadPoolStages: () => void;
  onPoolStageNumberChange: (id: string, value: number) => void;
  onPoolStageNameChange: (id: string, value: string) => void;
  onPoolStagePoolCountChange: (id: string, value: number) => void;
  onPoolStagePlayersPerPoolChange: (id: string, value: number) => void;
  onPoolStageAdvanceCountChange: (id: string, value: number) => void;
  onPoolStageLosersAdvanceChange: (id: string, value: boolean) => void;
  onPoolStageStatusChange: (stage: PoolStageConfig, status: string) => void;
  onOpenPoolStageAssignments: (stage: PoolStageConfig) => void;
  onSavePoolStage: (stage: PoolStageConfig) => void;
  onRemovePoolStage: (id: string) => void;
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onAddPoolStage: () => void;
  onLoadBrackets: () => void;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onAddBracket: () => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
  onConfirmAllPlayers: () => void;
  onTogglePlayerCheckIn: (player: TournamentPlayer) => void;
};

const getFormProperties = (properties: TournamentEditContentProperties) => ({
  t: properties.t,
  editForm: properties.editForm,
  editingTournament: properties.editingTournament,
  formatOptions: properties.formatOptions,
  durationOptions: properties.durationOptions,
  logoFile: properties.logoFile,
  isUploadingLogo: properties.isUploadingLogo,
  onEditFormChange: properties.onEditFormChange,
  onLogoFileChange: properties.onLogoFileChange,
  onUploadLogo: properties.onUploadLogo,
});

const getPoolStagesProperties = (properties: TournamentEditContentProperties) => ({
  t: properties.t,
  poolStages: properties.poolStages,
  poolStagesError: properties.poolStagesError,
  isAddingPoolStage: properties.isAddingPoolStage,
  newPoolStage: properties.newPoolStage,
  onLoadPoolStages: properties.onLoadPoolStages,
  onPoolStageNumberChange: properties.onPoolStageNumberChange,
  onPoolStageNameChange: properties.onPoolStageNameChange,
  onPoolStagePoolCountChange: properties.onPoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange: properties.onPoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange: properties.onPoolStageAdvanceCountChange,
  onPoolStageLosersAdvanceChange: properties.onPoolStageLosersAdvanceChange,
  onPoolStageStatusChange: properties.onPoolStageStatusChange,
  onOpenPoolStageAssignments: properties.onOpenPoolStageAssignments,
  onSavePoolStage: properties.onSavePoolStage,
  onRemovePoolStage: properties.onRemovePoolStage,
  onStartAddPoolStage: properties.onStartAddPoolStage,
  onCancelAddPoolStage: properties.onCancelAddPoolStage,
  onNewPoolStageStageNumberChange: properties.onNewPoolStageStageNumberChange,
  onNewPoolStageNameChange: properties.onNewPoolStageNameChange,
  onNewPoolStagePoolCountChange: properties.onNewPoolStagePoolCountChange,
  onNewPoolStagePlayersPerPoolChange: properties.onNewPoolStagePlayersPerPoolChange,
  onNewPoolStageAdvanceCountChange: properties.onNewPoolStageAdvanceCountChange,
  onNewPoolStageLosersAdvanceChange: properties.onNewPoolStageLosersAdvanceChange,
  onAddPoolStage: properties.onAddPoolStage,
  getStatusLabel: properties.getStatusLabel,
  normalizeStageStatus: properties.normalizeStageStatus,
});

const getBracketsProperties = (properties: TournamentEditContentProperties) => ({
  t: properties.t,
  brackets: properties.brackets,
  bracketsError: properties.bracketsError,
  isAddingBracket: properties.isAddingBracket,
  newBracket: properties.newBracket,
  onLoadBrackets: properties.onLoadBrackets,
  onBracketNameChange: properties.onBracketNameChange,
  onBracketTypeChange: properties.onBracketTypeChange,
  onBracketRoundsChange: properties.onBracketRoundsChange,
  onBracketStatusChange: properties.onBracketStatusChange,
  onSaveBracket: properties.onSaveBracket,
  onRemoveBracket: properties.onRemoveBracket,
  onStartAddBracket: properties.onStartAddBracket,
  onCancelAddBracket: properties.onCancelAddBracket,
  onNewBracketNameChange: properties.onNewBracketNameChange,
  onNewBracketTypeChange: properties.onNewBracketTypeChange,
  onNewBracketRoundsChange: properties.onNewBracketRoundsChange,
  onAddBracket: properties.onAddBracket,
  getStatusLabel: properties.getStatusLabel,
});

const getStatusSectionProperties = (properties: TournamentEditContentProperties) => ({
  t: properties.t,
  normalizedStatus: properties.normalizedStatus,
  editingTournament: properties.editingTournament,
  players: properties.players,
  playersLoading: properties.playersLoading,
  playersError: properties.playersError,
  playerForm: properties.playerForm,
  editingPlayerId: properties.editingPlayerId,
  checkingInPlayerId: properties.checkingInPlayerId,
  playerActionLabel: properties.playerActionLabel,
  isRegisteringPlayer: properties.isRegisteringPlayer,
  isAutoFillingPlayers: properties.isAutoFillingPlayers,
  isConfirmingAll: properties.isConfirmingAll,
  skillLevelOptions: properties.skillLevelOptions,
  onPlayerFormChange: properties.onPlayerFormChange,
  onStartEditPlayer: properties.onStartEditPlayer,
  onCancelEditPlayer: properties.onCancelEditPlayer,
  onSubmitPlayer: properties.onSubmitPlayer,
  onAutoFillPlayers: properties.onAutoFillPlayers,
  onRemovePlayer: properties.onRemovePlayer,
  onFetchPlayers: properties.onFetchPlayers,
  onConfirmAllPlayers: properties.onConfirmAllPlayers,
  onTogglePlayerCheckIn: properties.onTogglePlayerCheckIn,
});

const TournamentEditContent = (properties: TournamentEditContentProperties) => (
  <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
    <TournamentEditForm {...getFormProperties(properties)} />
    <PoolStagesEditor {...getPoolStagesProperties(properties)} />
    <BracketsEditor {...getBracketsProperties(properties)} />
    <TournamentStatusSections {...getStatusSectionProperties(properties)} />
  </div>
);

export default TournamentEditContent;
