import type { BracketConfig, CreatePlayerPayload, PoolStageConfig, TournamentPlayer, TournamentTarget } from '../../services/tournament-service';
import type { EditFormState, Translator } from './types';
import TournamentEditForm from './tournament-edit-form';
import PoolStagesEditor from './pool-stages-editor';
import BracketsEditor from './brackets-editor';
import TournamentStatusSections from './tournament-status-sections';

export type TournamentEditContentProperties = {
  t: Translator;
  isAdmin: boolean;
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
    rankingDestinations?: Array<{
      position: number;
      destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED';
      bracketId?: string;
      poolStageId?: string;
    }>;
  };
  brackets: BracketConfig[];
  bracketsError?: string | undefined;
  targets: TournamentTarget[];
  targetsError?: string | undefined;
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
  isApplyingPreset: boolean;
  normalizedStatus: string;
  onEditFormChange: (next: EditFormState) => void;
  onLogoFileChange: (file: File | undefined) => void;
  onUploadLogo: () => void;
  onApplySinglePoolPreset: () => void;
  onApplyDoublePoolPreset: () => void;
  onLoadPoolStages: () => void;
  onPoolStageNumberChange: (id: string, value: number) => void;
  onPoolStageNameChange: (id: string, value: string) => void;
  onPoolStagePoolCountChange: (id: string, value: number) => void;
  onPoolStagePlayersPerPoolChange: (id: string, value: number) => void;
  onPoolStageAdvanceCountChange: (id: string, value: number) => void;
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
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onNewPoolStageRankingDestinationChange: (
    position: number,
    destination: { destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED'; bracketId?: string; poolStageId?: string }
  ) => void;
  onAddPoolStage: () => Promise<boolean>;
  onLoadBrackets: () => void;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onBracketTargetToggle: (bracketId: string, targetId: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onSaveBracketTargets: (bracket: BracketConfig) => void;
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

const TournamentEditContent = (properties: TournamentEditContentProperties) => {
  const {
    t,
    isAdmin,
    editForm,
    editingTournament,
    formatOptions,
    durationOptions,
    logoFile,
    isUploadingLogo,
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
    players,
    playersLoading,
    playersError,
    playerForm,
    editingPlayerId,
    checkingInPlayerId,
    playerActionLabel,
    isRegisteringPlayer,
    isAutoFillingPlayers,
    isConfirmingAll,
    isApplyingPreset,
    normalizedStatus,
    onEditFormChange,
    onLogoFileChange,
    onUploadLogo,
    onApplySinglePoolPreset,
    onApplyDoublePoolPreset,
    onLoadPoolStages,
    onPoolStageNumberChange,
    onPoolStageNameChange,
    onPoolStagePoolCountChange,
    onPoolStagePlayersPerPoolChange,
    onPoolStageAdvanceCountChange,
    onPoolStageLosersAdvanceChange,
    onPoolStageRankingDestinationChange,
    onPoolStageStatusChange,
    onOpenPoolStageAssignments,
    onSavePoolStage,
    onRemovePoolStage,
    onStartAddPoolStage,
    onCancelAddPoolStage,
    onNewPoolStageStageNumberChange,
    onNewPoolStageNameChange,
    onNewPoolStagePoolCountChange,
    onNewPoolStagePlayersPerPoolChange,
    onNewPoolStageAdvanceCountChange,
    onNewPoolStageLosersAdvanceChange,
    onNewPoolStageRankingDestinationChange,
    onAddPoolStage,
    onLoadBrackets,
    onBracketNameChange,
    onBracketTypeChange,
    onBracketRoundsChange,
    onBracketStatusChange,
    onBracketTargetToggle,
    onSaveBracket,
    onSaveBracketTargets,
    onRemoveBracket,
    onStartAddBracket,
    onCancelAddBracket,
    onNewBracketNameChange,
    onNewBracketTypeChange,
    onNewBracketRoundsChange,
    onAddBracket,
    getStatusLabel,
    normalizeStageStatus,
    onPlayerFormChange,
    onStartEditPlayer,
    onCancelEditPlayer,
    onSubmitPlayer,
    onAutoFillPlayers,
    onRemovePlayer,
    onFetchPlayers,
    onConfirmAllPlayers,
    onTogglePlayerCheckIn,
    skillLevelOptions,
  } = properties;
  const hasStartedBracketMatches = brackets.some((bracket) => bracket.hasStartedMatches);
  const canEditBrackets = isAdmin;
  const canAddBrackets = isAdmin && !hasStartedBracketMatches;

  return (
    <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
      <TournamentEditForm
        t={t}
        editForm={editForm}
        editingTournament={editingTournament}
        formatOptions={formatOptions}
        durationOptions={durationOptions}
        logoFile={logoFile}
        isUploadingLogo={isUploadingLogo}
        onEditFormChange={onEditFormChange}
        onLogoFileChange={onLogoFileChange}
        onUploadLogo={onUploadLogo}
      />
      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-white">{t('edit.quickStructureTitle')}</h4>
            <p className="mt-1 text-xs text-slate-400">{t('edit.quickStructureHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onApplySinglePoolPreset}
              disabled={isApplyingPreset || normalizedStatus === 'LIVE'}
              className="rounded-full border border-cyan-500/70 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
            >
              {isApplyingPreset ? t('edit.quickStructureApplying') : t('edit.quickStructureSingle')}
            </button>
            <button
              onClick={onApplyDoublePoolPreset}
              disabled={isApplyingPreset || normalizedStatus === 'LIVE'}
              className="rounded-full border border-sky-500/70 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:border-sky-300 disabled:opacity-60"
            >
              {isApplyingPreset ? t('edit.quickStructureApplying') : t('edit.quickStructureDouble')}
            </button>
          </div>
        </div>
        {normalizedStatus === 'LIVE' && (
          <p className="mt-3 text-xs text-rose-300">{t('edit.quickStructureDisabledLive')}</p>
        )}
      </section>
      <PoolStagesEditor
        t={t}
        poolStages={poolStages}
        brackets={brackets}
        isTournamentLive={normalizedStatus === 'LIVE'}
        poolStagesError={poolStagesError}
        isAddingPoolStage={isAddingPoolStage}
        newPoolStage={newPoolStage}
        onLoadPoolStages={onLoadPoolStages}
        onPoolStageNumberChange={onPoolStageNumberChange}
        onPoolStageNameChange={onPoolStageNameChange}
        onPoolStagePoolCountChange={onPoolStagePoolCountChange}
        onPoolStagePlayersPerPoolChange={onPoolStagePlayersPerPoolChange}
        onPoolStageAdvanceCountChange={onPoolStageAdvanceCountChange}
        onPoolStageLosersAdvanceChange={onPoolStageLosersAdvanceChange}
        onPoolStageRankingDestinationChange={onPoolStageRankingDestinationChange}
        onPoolStageStatusChange={onPoolStageStatusChange}
        onOpenPoolStageAssignments={onOpenPoolStageAssignments}
        onSavePoolStage={onSavePoolStage}
        onRemovePoolStage={onRemovePoolStage}
        onStartAddPoolStage={onStartAddPoolStage}
        onCancelAddPoolStage={onCancelAddPoolStage}
        onNewPoolStageStageNumberChange={onNewPoolStageStageNumberChange}
        onNewPoolStageNameChange={onNewPoolStageNameChange}
        onNewPoolStagePoolCountChange={onNewPoolStagePoolCountChange}
        onNewPoolStagePlayersPerPoolChange={onNewPoolStagePlayersPerPoolChange}
        onNewPoolStageAdvanceCountChange={onNewPoolStageAdvanceCountChange}
        onNewPoolStageLosersAdvanceChange={onNewPoolStageLosersAdvanceChange}
        onNewPoolStageRankingDestinationChange={onNewPoolStageRankingDestinationChange}
        onAddPoolStage={onAddPoolStage}
        getStatusLabel={getStatusLabel}
        normalizeStageStatus={normalizeStageStatus}
      />
      <BracketsEditor
        t={t}
        canEditBrackets={canEditBrackets}
        canAddBrackets={canAddBrackets}
        brackets={brackets}
        bracketsError={bracketsError}
        targets={targets}
        targetsError={targetsError}
        isAddingBracket={isAddingBracket}
        newBracket={newBracket}
        onLoadBrackets={onLoadBrackets}
        onBracketNameChange={onBracketNameChange}
        onBracketTypeChange={onBracketTypeChange}
        onBracketRoundsChange={onBracketRoundsChange}
        onBracketStatusChange={onBracketStatusChange}
        onBracketTargetToggle={onBracketTargetToggle}
        onSaveBracket={onSaveBracket}
        onSaveBracketTargets={onSaveBracketTargets}
        onRemoveBracket={onRemoveBracket}
        onStartAddBracket={onStartAddBracket}
        onCancelAddBracket={onCancelAddBracket}
        onNewBracketNameChange={onNewBracketNameChange}
        onNewBracketTypeChange={onNewBracketTypeChange}
        onNewBracketRoundsChange={onNewBracketRoundsChange}
        onAddBracket={onAddBracket}
        getStatusLabel={getStatusLabel}
      />
      <TournamentStatusSections
        t={t}
        normalizedStatus={normalizedStatus}
        editingTournament={editingTournament}
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
        skillLevelOptions={skillLevelOptions}
        onPlayerFormChange={onPlayerFormChange}
        onStartEditPlayer={onStartEditPlayer}
        onCancelEditPlayer={onCancelEditPlayer}
        onSubmitPlayer={onSubmitPlayer}
        onAutoFillPlayers={onAutoFillPlayers}
        onRemovePlayer={onRemovePlayer}
        onFetchPlayers={onFetchPlayers}
        onConfirmAllPlayers={onConfirmAllPlayers}
        onTogglePlayerCheckIn={onTogglePlayerCheckIn}
      />
    </div>
  );
};

export default TournamentEditContent;
