import type { PoolStageConfig } from '../../services/tournament-service';
import type { Translator } from './types';
import { PoolStagesList, NewPoolStageForm } from './pool-stages-editor-components';

type PoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
};

type PoolStagesEditorProperties = {
  t: Translator;
  poolStages: PoolStageConfig[];
  poolStagesError?: string | undefined;
  isAddingPoolStage: boolean;
  newPoolStage: PoolStageDraft;
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
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
};


const PoolStagesEditor = ({
  t,
  poolStages,
  poolStagesError,
  isAddingPoolStage,
  newPoolStage,
  onLoadPoolStages,
  onPoolStageNumberChange,
  onPoolStageNameChange,
  onPoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange,
  onPoolStageLosersAdvanceChange,
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
  onAddPoolStage,
  getStatusLabel,
  normalizeStageStatus,
}: PoolStagesEditorProperties) => (
  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="text-base font-semibold text-white">{t('edit.poolStages')}</h4>
      <button
        onClick={onLoadPoolStages}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
      >
        {t('common.refresh')}
      </button>
    </div>
    {poolStagesError && (
      <p className="mt-3 text-sm text-rose-300">{poolStagesError}</p>
    )}
    <PoolStagesList
      t={t}
      poolStages={poolStages}
      onPoolStageNumberChange={onPoolStageNumberChange}
      onPoolStageNameChange={onPoolStageNameChange}
      onPoolStagePoolCountChange={onPoolStagePoolCountChange}
      onPoolStagePlayersPerPoolChange={onPoolStagePlayersPerPoolChange}
      onPoolStageAdvanceCountChange={onPoolStageAdvanceCountChange}
      onPoolStageLosersAdvanceChange={onPoolStageLosersAdvanceChange}
      onPoolStageStatusChange={onPoolStageStatusChange}
      onOpenPoolStageAssignments={onOpenPoolStageAssignments}
      onSavePoolStage={onSavePoolStage}
      onRemovePoolStage={onRemovePoolStage}
      getStatusLabel={getStatusLabel}
      normalizeStageStatus={normalizeStageStatus}
    />

    <NewPoolStageForm
      t={t}
      isAddingPoolStage={isAddingPoolStage}
      newPoolStage={newPoolStage}
      onStartAddPoolStage={onStartAddPoolStage}
      onCancelAddPoolStage={onCancelAddPoolStage}
      onNewPoolStageStageNumberChange={onNewPoolStageStageNumberChange}
      onNewPoolStageNameChange={onNewPoolStageNameChange}
      onNewPoolStagePoolCountChange={onNewPoolStagePoolCountChange}
      onNewPoolStagePlayersPerPoolChange={onNewPoolStagePlayersPerPoolChange}
      onNewPoolStageAdvanceCountChange={onNewPoolStageAdvanceCountChange}
      onNewPoolStageLosersAdvanceChange={onNewPoolStageLosersAdvanceChange}
      onAddPoolStage={onAddPoolStage}
    />
  </div>
);

export default PoolStagesEditor;
