import { StageStatus } from '@shared/types';
import type { PoolStageConfig } from '../../services/tournament-service';
import type { Translator } from './types';

type PoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
};

type PoolStagesListProperties = {
  t: Translator;
  poolStages: PoolStageConfig[];
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
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
};

type PoolStageItemProperties = {
  t: Translator;
  stage: PoolStageConfig;
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
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
};

type NewPoolStageFormProperties = {
  t: Translator;
  isAddingPoolStage: boolean;
  newPoolStage: PoolStageDraft;
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onAddPoolStage: () => void;
};

export const PoolStageItem = ({
  t,
  stage,
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
  getStatusLabel,
  normalizeStageStatus,
}: PoolStageItemProperties) => (
  <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
    <div className="grid gap-3 md:grid-cols-6">
      <label className="text-xs text-slate-400">
        {t('edit.stageNumber')}
        <input
          type="number"
          value={stage.stageNumber}
          onChange={(event_) => onPoolStageNumberChange(stage.id, Number(event_.target.value))}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        {t('edit.name')}
        <input
          type="text"
          value={stage.name}
          onChange={(event_) => onPoolStageNameChange(stage.id, event_.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.pools')}
        <input
          type="number"
          value={stage.poolCount}
          onChange={(event_) => onPoolStagePoolCountChange(stage.id, Number(event_.target.value))}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.perPool')}
        <input
          type="number"
          value={stage.playersPerPool}
          onChange={(event_) => onPoolStagePlayersPerPoolChange(stage.id, Number(event_.target.value))}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.advance')}
        <input
          type="number"
          value={stage.advanceCount}
          onChange={(event_) => onPoolStageAdvanceCountChange(stage.id, Number(event_.target.value))}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.losers')}
        <select
          value={stage.losersAdvanceToBracket ? 'bracket' : 'out'}
          onChange={(event_) => onPoolStageLosersAdvanceChange(stage.id, event_.target.value === 'bracket')}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        >
          <option value="out">{t('edit.losersOut')}</option>
          <option value="bracket">{t('edit.losersToBracket')}</option>
        </select>
      </label>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      <select
        value={stage.status}
        onChange={(event_) => onPoolStageStatusChange(stage, event_.target.value)}
        className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
      >
        {Object.values(StageStatus).map((status) => (
          <option key={status} value={status}>
            {getStatusLabel('stage', status)}
          </option>
        ))}
      </select>
      <button
        onClick={() => onOpenPoolStageAssignments(stage)}
        disabled={normalizeStageStatus(stage.status) !== StageStatus.EDITION}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('edit.editPlayers')}
      </button>
      <button
        onClick={() => onSavePoolStage(stage)}
        className="rounded-full border border-cyan-500/60 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
      >
        {t('common.save')}
      </button>
      <button
        onClick={() => onRemovePoolStage(stage.id)}
        className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
      >
        {t('common.delete')}
      </button>
    </div>
  </div>
);

export const PoolStagesList = ({
  t,
  poolStages,
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
  getStatusLabel,
  normalizeStageStatus,
}: PoolStagesListProperties) => (
  <div className="mt-4 space-y-3">
    {poolStages.length === 0 ? (
      <p className="text-sm text-slate-400">{t('edit.noPoolStages')}</p>
    ) : (
      poolStages.map((stage) => (
        <PoolStageItem
          key={stage.id}
          t={t}
          stage={stage}
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
      ))
    )}
  </div>
);

export const NewPoolStageForm = ({
  t,
  isAddingPoolStage,
  newPoolStage,
  onStartAddPoolStage,
  onCancelAddPoolStage,
  onNewPoolStageStageNumberChange,
  onNewPoolStageNameChange,
  onNewPoolStagePoolCountChange,
  onNewPoolStagePlayersPerPoolChange,
  onNewPoolStageAdvanceCountChange,
  onNewPoolStageLosersAdvanceChange,
  onAddPoolStage,
}: NewPoolStageFormProperties) => {
  if (!isAddingPoolStage) {
    return (
      <div className="mt-5 flex justify-end">
        <button
          onClick={onStartAddPoolStage}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
        >
          {t('edit.addStage')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <label className="text-xs text-slate-400">
          {t('edit.stageNumber')}
          <input
            type="number"
            value={newPoolStage.stageNumber}
            onChange={(event_) => onNewPoolStageStageNumberChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400 md:col-span-2">
          {t('edit.name')}
          <input
            type="text"
            value={newPoolStage.name}
            onChange={(event_) => onNewPoolStageNameChange(event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.pools')}
          <input
            type="number"
            value={newPoolStage.poolCount}
            onChange={(event_) => onNewPoolStagePoolCountChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.perPool')}
          <input
            type="number"
            value={newPoolStage.playersPerPool}
            onChange={(event_) => onNewPoolStagePlayersPerPoolChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.advance')}
          <input
            type="number"
            value={newPoolStage.advanceCount}
            onChange={(event_) => onNewPoolStageAdvanceCountChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.losers')}
          <select
            value={newPoolStage.losersAdvanceToBracket ? 'bracket' : 'out'}
            onChange={(event_) => onNewPoolStageLosersAdvanceChange(event_.target.value === 'bracket')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            <option value="out">{t('edit.losersOut')}</option>
            <option value="bracket">{t('edit.losersToBracket')}</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          onClick={onCancelAddPoolStage}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={onAddPoolStage}
          disabled={!newPoolStage.name.trim()}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
        >
          {t('edit.addStage')}
        </button>
      </div>
    </>
  );
};
