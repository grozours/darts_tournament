import type {
  BracketConfig,
  CreatePlayerPayload,
  PoolStageConfig,
  TournamentPlayer,
} from '../../services/tournament-service';
import type { EditFormState, Translator } from './types';
import TournamentEditHeader from './tournament-edit-header';
import TournamentEditContent from './tournament-edit-content';
import TournamentEditFooter from './tournament-edit-footer';

export type TournamentEditPanelProperties = {
  t: Translator;
  isEditPage: boolean;
  editForm: EditFormState;
  editingTournament: {
    id: string;
    name: string;
    logoUrl?: string | undefined;
    format: string;
    totalParticipants: number;
    status: string;
    createdAt?: string | undefined;
    completedAt?: string | undefined;
    historicalFlag?: boolean | undefined;
  };
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  skillLevelOptions: Array<{ value: string; label: string }>;
  editError?: string | undefined;
  isSaving: boolean;
  isUploadingLogo: boolean;
  logoFile?: File | undefined;
  normalizedStatus: string;
  onClose: () => void;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
  poolStages: PoolStageConfig[];
  poolStagesError?: string | undefined;
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
  isAddingPoolStage: boolean;
  newPoolStage: {
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket: boolean;
  };
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onAddPoolStage: () => void;
  brackets: BracketConfig[];
  bracketsError?: string | undefined;
  onLoadBrackets: () => void;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  isAddingBracket: boolean;
  newBracket: {
    name: string;
    bracketType: string;
    totalRounds: number;
  };
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onAddBracket: () => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
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
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
  onConfirmAllPlayers: () => void;
  onTogglePlayerCheckIn: (player: TournamentPlayer) => void;
  onMoveToSignature: () => void;
  onMoveToLive: () => void;
  onOpenRegistration: () => void;
  onSaveEdit: () => void;
};

const getPanelClassNames = (isEditPage: boolean) => ({
  containerClassName: isEditPage
    ? 'rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6',
  panelClassName: isEditPage
    ? 'flex w-full max-w-5xl flex-col'
    : 'flex w-full max-w-2xl max-h-[85vh] flex-col rounded-3xl border border-slate-800/70 bg-slate-900 p-6',
});

const getContentProperties = (properties: TournamentEditPanelProperties) => ({
  t: properties.t,
  editForm: properties.editForm,
  editingTournament: properties.editingTournament,
  formatOptions: properties.formatOptions,
  durationOptions: properties.durationOptions,
  skillLevelOptions: properties.skillLevelOptions,
  logoFile: properties.logoFile,
  isUploadingLogo: properties.isUploadingLogo,
  poolStages: properties.poolStages,
  poolStagesError: properties.poolStagesError,
  isAddingPoolStage: properties.isAddingPoolStage,
  newPoolStage: properties.newPoolStage,
  brackets: properties.brackets,
  bracketsError: properties.bracketsError,
  isAddingBracket: properties.isAddingBracket,
  newBracket: properties.newBracket,
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
  normalizedStatus: properties.normalizedStatus,
  onEditFormChange: properties.onEditFormChange,
  onLogoFileChange: properties.onLogoFileChange,
  onUploadLogo: properties.onUploadLogo,
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
  normalizeStageStatus: properties.normalizeStageStatus,
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

const getFooterProperties = (properties: TournamentEditPanelProperties) => ({
  t: properties.t,
  normalizedStatus: properties.normalizedStatus,
  isSaving: properties.isSaving,
  players: properties.players,
  onClose: properties.onClose,
  onMoveToSignature: properties.onMoveToSignature,
  onMoveToLive: properties.onMoveToLive,
  onOpenRegistration: properties.onOpenRegistration,
  onSaveEdit: properties.onSaveEdit,
});

const TournamentEditPanel = (properties: TournamentEditPanelProperties) => {
  const { containerClassName, panelClassName } = getPanelClassNames(properties.isEditPage);

  return (
    <div className={containerClassName}>
      <div className={panelClassName}>
        <TournamentEditHeader t={properties.t} onClose={properties.onClose} />

        <TournamentEditContent {...getContentProperties(properties)} />

        {properties.editError && (
          <p className="mt-4 text-sm text-rose-300">{properties.editError}</p>
        )}

        <TournamentEditFooter {...getFooterProperties(properties)} />
      </div>
    </div>
  );
};

export default TournamentEditPanel;
