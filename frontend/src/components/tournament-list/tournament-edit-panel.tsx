import type {
  BracketConfig,
  CreatePlayerPayload,
  PoolStageConfig,
  TournamentPreset,
  TournamentPlayer,
  TournamentTarget,
} from '../../services/tournament-service';
import type { EditFormState, Translator } from './types';
import TournamentEditHeader from './tournament-edit-header';
import TournamentEditContent from './tournament-edit-content';
import TournamentEditFooter from './tournament-edit-footer';

export type TournamentEditPanelProperties = {
  t: Translator;
  isEditPage: boolean;
  isAdmin: boolean;
  editForm: EditFormState;
  editingTournament: {
    id: string;
    name: string;
    logoUrl?: string;
    logoUrls?: string[];
    format: string;
    totalParticipants: number;
    status: string;
    createdAt?: string;
    completedAt?: string;
    historicalFlag?: boolean;
  };
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  skillLevelOptions: Array<{ value: string; label: string }>;
  editError: string | undefined;
  isSaving: boolean;
  isUploadingLogo: boolean;
  logoFiles: File[];
  normalizedStatus: string;
  onClose: () => void;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFilesChange: (files: File[]) => void;
  onUploadLogo: () => void;
  onDeleteLogo: (logoUrl: string) => void;
  poolStages: PoolStageConfig[];
  poolStagesError: string | undefined;
  onLoadPoolStages: () => void;
  onPoolStageNumberChange: (id: string, value: number) => void;
  onPoolStageNameChange: (id: string, value: string) => void;
  onPoolStagePoolCountChange: (id: string, value: number) => void;
  onPoolStagePlayersPerPoolChange: (id: string, value: number) => void;
  onPoolStageAdvanceCountChange: (id: string, value: number) => void;
  onPoolStageMatchFormatChange: (id: string, value: string | undefined) => void;
  onPoolStageLosersAdvanceChange: (id: string, value: boolean) => void;
  onPoolStageRankingDestinationChange: (
    id: string,
    position: number,
    destination: { destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED'; bracketId?: string; poolStageId?: string }
  ) => void;
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
    matchFormatKey?: string;
    losersAdvanceToBracket: boolean;
    rankingDestinations?: Array<{
      position: number;
      destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED';
      bracketId?: string;
      poolStageId?: string;
    }>;
  };
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageMatchFormatChange: (value: string | undefined) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onNewPoolStageRankingDestinationChange: (
    position: number,
    destination: { destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED'; bracketId?: string; poolStageId?: string }
  ) => void;
  onAddPoolStage: () => Promise<boolean>;
  brackets: BracketConfig[];
  bracketsError: string | undefined;
  targets: TournamentTarget[];
  targetsError: string | undefined;
  onLoadBrackets: () => void;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketRoundMatchFormatChange: (id: string, roundNumber: number, value: string | undefined) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onBracketTargetToggle: (bracketId: string, targetId: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onSaveBracketTargets: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  isAddingBracket: boolean;
  newBracket: {
    name: string;
    bracketType: string;
    totalRounds: number;
    roundMatchFormats?: Record<string, string>;
  };
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onNewBracketRoundMatchFormatChange: (roundNumber: number, value: string | undefined) => void;
  onAddBracket: () => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId: string | undefined;
  checkingInPlayerId: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  isConfirmingAll: boolean;
  autoFillProgress: { current: number; total: number } | undefined;
  confirmAllProgress: { current: number; total: number } | undefined;
  isApplyingPreset: boolean;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
  onConfirmAllPlayers: () => void;
  onTogglePlayerCheckIn: (player: TournamentPlayer) => void;
  quickStructurePresets: TournamentPreset[];
  quickStructurePresetsLoading: boolean;
  onApplyStructurePreset: (preset: Pick<TournamentPreset, 'name' | 'presetType' | 'templateConfig'>) => void;
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
  isAdmin: properties.isAdmin,
  editForm: properties.editForm,
  editingTournament: properties.editingTournament,
  formatOptions: properties.formatOptions,
  durationOptions: properties.durationOptions,
  skillLevelOptions: properties.skillLevelOptions,
  logoFiles: properties.logoFiles,
  isUploadingLogo: properties.isUploadingLogo,
  poolStages: properties.poolStages,
  poolStagesError: properties.poolStagesError,
  isAddingPoolStage: properties.isAddingPoolStage,
  newPoolStage: properties.newPoolStage,
  brackets: properties.brackets,
  bracketsError: properties.bracketsError,
  targets: properties.targets,
  targetsError: properties.targetsError,
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
  autoFillProgress: properties.autoFillProgress,
  confirmAllProgress: properties.confirmAllProgress,
  isApplyingPreset: properties.isApplyingPreset,
  quickStructurePresets: properties.quickStructurePresets,
  quickStructurePresetsLoading: properties.quickStructurePresetsLoading,
  normalizedStatus: properties.normalizedStatus,
  onEditFormChange: properties.onEditFormChange,
  onLogoFilesChange: properties.onLogoFilesChange,
  onUploadLogo: properties.onUploadLogo,
  onDeleteLogo: properties.onDeleteLogo,
  onApplyStructurePreset: properties.onApplyStructurePreset,
  onLoadPoolStages: properties.onLoadPoolStages,
  onPoolStageNumberChange: properties.onPoolStageNumberChange,
  onPoolStageNameChange: properties.onPoolStageNameChange,
  onPoolStagePoolCountChange: properties.onPoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange: properties.onPoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange: properties.onPoolStageAdvanceCountChange,
  onPoolStageMatchFormatChange: properties.onPoolStageMatchFormatChange,
  onPoolStageLosersAdvanceChange: properties.onPoolStageLosersAdvanceChange,
  onPoolStageRankingDestinationChange: properties.onPoolStageRankingDestinationChange,
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
  onNewPoolStageMatchFormatChange: properties.onNewPoolStageMatchFormatChange,
  onNewPoolStageLosersAdvanceChange: properties.onNewPoolStageLosersAdvanceChange,
  onNewPoolStageRankingDestinationChange: properties.onNewPoolStageRankingDestinationChange,
  onAddPoolStage: properties.onAddPoolStage,
  onLoadBrackets: properties.onLoadBrackets,
  onBracketNameChange: properties.onBracketNameChange,
  onBracketTypeChange: properties.onBracketTypeChange,
  onBracketRoundsChange: properties.onBracketRoundsChange,
  onBracketRoundMatchFormatChange: properties.onBracketRoundMatchFormatChange,
  onBracketStatusChange: properties.onBracketStatusChange,
  onBracketTargetToggle: properties.onBracketTargetToggle,
  onSaveBracket: properties.onSaveBracket,
  onSaveBracketTargets: properties.onSaveBracketTargets,
  onRemoveBracket: properties.onRemoveBracket,
  onStartAddBracket: properties.onStartAddBracket,
  onCancelAddBracket: properties.onCancelAddBracket,
  onNewBracketNameChange: properties.onNewBracketNameChange,
  onNewBracketTypeChange: properties.onNewBracketTypeChange,
  onNewBracketRoundsChange: properties.onNewBracketRoundsChange,
  onNewBracketRoundMatchFormatChange: properties.onNewBracketRoundMatchFormatChange,
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
  canOpenRegistration: properties.players.length < properties.editingTournament.totalParticipants,
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
        <TournamentEditHeader
          t={properties.t}
          tournamentId={properties.editingTournament.id}
          tournamentFormat={properties.editingTournament.format}
          onClose={properties.onClose}
        />

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
