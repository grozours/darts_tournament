import { BracketStatus } from '@shared/types';
import type { BracketConfig } from '../../services/tournament-service';
import type { Translator } from './types';
import { getMatchFormatPresets } from '../../utils/match-format-presets';

type BracketDraft = {
  name: string;
  bracketType: string;
  totalRounds: number;
  roundMatchFormats?: Record<string, string>;
};

type BracketsEditorProperties = {
  t: Translator;
  canEditBrackets: boolean;
  canAddBrackets: boolean;
  showBracketStatusControl?: boolean;
  showSaveTargetsButton?: boolean;
  brackets: BracketConfig[];
  bracketsError: string | undefined;
  targets: Array<{ id: string; targetNumber: number }>;
  targetsError: string | undefined;
  isAddingBracket: boolean;
  newBracket: BracketDraft;
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
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onNewBracketRoundMatchFormatChange: (roundNumber: number, value: string | undefined) => void;
  onAddBracket: () => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
};

type BracketsListProperties = {
  t: Translator;
  canEditBrackets: boolean;
  showBracketStatusControl?: boolean;
  showSaveTargetsButton?: boolean;
  brackets: BracketConfig[];
  targets: Array<{ id: string; targetNumber: number }>;
  targetOwners: Map<string, string>;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketRoundMatchFormatChange: (id: string, roundNumber: number, value: string | undefined) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onBracketTargetToggle: (bracketId: string, targetId: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onSaveBracketTargets: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
};

type BracketItemProperties = {
  t: Translator;
  canEditBrackets: boolean;
  showBracketStatusControl?: boolean;
  showSaveTargetsButton?: boolean;
  bracket: BracketConfig;
  targets: Array<{ id: string; targetNumber: number }>;
  targetOwners: Map<string, string>;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketRoundMatchFormatChange: (id: string, roundNumber: number, value: string | undefined) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onBracketTargetToggle: (bracketId: string, targetId: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onSaveBracketTargets: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
};

type NewBracketFormProperties = {
  t: Translator;
  canEditBrackets: boolean;
  isAddingBracket: boolean;
  newBracket: BracketDraft;
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onNewBracketRoundMatchFormatChange: (roundNumber: number, value: string | undefined) => void;
  onAddBracket: () => void;
};

const BracketItem = ({
  t,
  canEditBrackets,
  showBracketStatusControl = true,
  showSaveTargetsButton = true,
  bracket,
  targets,
  targetOwners,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketRoundMatchFormatChange,
  onBracketStatusChange,
  onBracketTargetToggle,
  onSaveBracket,
  onSaveBracketTargets,
  onRemoveBracket,
  getStatusLabel,
}: BracketItemProperties) => {
  const isBracketLocked = !canEditBrackets || Boolean(bracket.hasStartedMatches);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
      <div className="grid gap-3 md:grid-cols-4">
      <label className="text-xs text-slate-400 md:col-span-2">
        {t('edit.name')}
        <input
          type="text"
          value={bracket.name}
          onChange={(event_) => onBracketNameChange(bracket.id, event_.target.value)}
            disabled={isBracketLocked}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
        />
      </label>
      <label className="text-xs text-slate-400">
        <span>Type</span>
        <select
          value={bracket.bracketType}
          onChange={(event_) => onBracketTypeChange(bracket.id, event_.target.value)}
          disabled={isBracketLocked}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          <option value="SINGLE_ELIMINATION">Single</option>
          <option value="DOUBLE_ELIMINATION">Double</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.rounds')}
        <input
          type="number"
          value={bracket.totalRounds}
          onChange={(event_) => onBracketRoundsChange(bracket.id, Number(event_.target.value))}
            disabled={isBracketLocked}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
        />
      </label>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      {Array.from({ length: Math.max(1, bracket.totalRounds) }, (_, index) => {
        const roundNumber = index + 1;
        const value = bracket.roundMatchFormats?.[String(roundNumber)] ?? '';
        return (
          <label key={`${bracket.id}-round-${roundNumber}`} className="text-xs text-slate-400">
            Round {roundNumber}
            <select
              value={value}
              onChange={(event_) => onBracketRoundMatchFormatChange(bracket.id, roundNumber, event_.target.value || undefined)}
              disabled={isBracketLocked}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
            >
              <option value="">-</option>
              {getMatchFormatPresets().map((preset) => (
                <option key={preset.key} value={preset.key}>{preset.key}</option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
        {t('edit.bracketTargets')}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {targets.length === 0 ? (
          <span className="text-xs text-slate-500">{t('edit.noTargets')}</span>
        ) : (
          targets.map((target) => {
            const isSelected = (bracket.targetIds ?? []).includes(target.id);
            const owner = targetOwners.get(target.id);
            const isOwnedByOther = Boolean(owner && owner !== bracket.id);
            return (
              <label
                key={target.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                  isOwnedByOther
                    ? 'border-slate-800 text-slate-500'
                    : 'border-slate-700 text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isBracketLocked || isOwnedByOther}
                  onChange={() => onBracketTargetToggle(bracket.id, target.id)}
                  className="h-3.5 w-3.5 rounded border border-slate-700 bg-slate-950/60"
                />
                {t('targets.target')} {target.targetNumber}
              </label>
            );
          })
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      {showBracketStatusControl && (
        <select
          value={bracket.status}
          onChange={(event_) => onBracketStatusChange(bracket.id, event_.target.value)}
          disabled={isBracketLocked}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200 disabled:opacity-60"
        >
          {Object.values(BracketStatus).map((status) => (
            <option key={status} value={status}>
              {getStatusLabel('bracket', status)}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => onSaveBracket(bracket)}
        disabled={isBracketLocked}
        className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
      >
        {t('common.save')}
      </button>
      {showSaveTargetsButton && (
        <button
          onClick={() => onSaveBracketTargets(bracket)}
          disabled={isBracketLocked}
          className="rounded-full border border-sky-500/60 px-3 py-1 text-xs text-sky-200 hover:border-sky-300 disabled:opacity-60"
        >
          {t('edit.saveTargets')}
        </button>
      )}
      <button
        onClick={() => onRemoveBracket(bracket.id)}
        disabled={isBracketLocked}
        className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
      >
        {t('common.delete')}
      </button>
    </div>
    </div>
  );
};

const BracketsList = ({
  t,
  canEditBrackets,
  showBracketStatusControl = true,
  showSaveTargetsButton = true,
  brackets,
  targets,
  targetOwners,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketRoundMatchFormatChange,
  onBracketStatusChange,
  onBracketTargetToggle,
  onSaveBracket,
  onSaveBracketTargets,
  onRemoveBracket,
  getStatusLabel,
}: BracketsListProperties) => (
  <div className="mt-4 space-y-3">
    {brackets.length === 0 ? (
      <p className="text-sm text-slate-400">{t('edit.noBrackets')}</p>
    ) : (
      brackets.map((bracket) => (
        <BracketItem
          key={bracket.id}
          t={t}
          canEditBrackets={canEditBrackets}
          showBracketStatusControl={showBracketStatusControl}
          showSaveTargetsButton={showSaveTargetsButton}
          bracket={bracket}
          targets={targets}
          targetOwners={targetOwners}
          onBracketNameChange={onBracketNameChange}
          onBracketTypeChange={onBracketTypeChange}
          onBracketRoundsChange={onBracketRoundsChange}
          onBracketRoundMatchFormatChange={onBracketRoundMatchFormatChange}
          onBracketStatusChange={onBracketStatusChange}
          onBracketTargetToggle={onBracketTargetToggle}
          onSaveBracket={onSaveBracket}
          onSaveBracketTargets={onSaveBracketTargets}
          onRemoveBracket={onRemoveBracket}
          getStatusLabel={getStatusLabel}
        />
      ))
    )}
  </div>
);

const NewBracketForm = ({
  t,
  canEditBrackets,
  isAddingBracket,
  newBracket,
  onStartAddBracket,
  onCancelAddBracket,
  onNewBracketNameChange,
  onNewBracketTypeChange,
  onNewBracketRoundsChange,
  onNewBracketRoundMatchFormatChange,
  onAddBracket,
}: NewBracketFormProperties) => {
  if (!isAddingBracket) {
    return (
      <div className="mt-5 flex justify-end">
        <button
          onClick={onStartAddBracket}
          disabled={!canEditBrackets}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {t('edit.addBracket')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-400 md:col-span-2">
          {t('edit.name')}
          <input
            type="text"
            value={newBracket.name}
            onChange={(event_) => onNewBracketNameChange(event_.target.value)}
            disabled={!canEditBrackets}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.rounds')}
          <input
            type="number"
            value={newBracket.totalRounds}
            onChange={(event_) => onNewBracketRoundsChange(Number(event_.target.value))}
            disabled={!canEditBrackets}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
          />
        </label>
        <label className="text-xs text-slate-400">
          <span>Type</span>
          <select
            value={newBracket.bracketType}
            onChange={(event_) => onNewBracketTypeChange(event_.target.value)}
            disabled={!canEditBrackets}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
          >
            <option value="SINGLE_ELIMINATION">Single</option>
            <option value="DOUBLE_ELIMINATION">Double</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {Array.from({ length: Math.max(1, newBracket.totalRounds) }, (_, index) => {
          const roundNumber = index + 1;
          const value = newBracket.roundMatchFormats?.[String(roundNumber)] ?? '';
          return (
            <label key={`new-round-${roundNumber}`} className="text-xs text-slate-400">
              Round {roundNumber}
              <select
                value={value}
                onChange={(event_) => onNewBracketRoundMatchFormatChange(roundNumber, event_.target.value || undefined)}
                disabled={!canEditBrackets}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white disabled:opacity-60"
              >
                <option value="">-</option>
                {getMatchFormatPresets().map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.key}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          onClick={onCancelAddBracket}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={onAddBracket}
          disabled={!canEditBrackets || !newBracket.name.trim()}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {t('edit.addBracket')}
        </button>
      </div>
    </>
  );
};

const BracketsEditor = ({
  t,
  canEditBrackets,
  canAddBrackets,
  showBracketStatusControl = true,
  showSaveTargetsButton = true,
  brackets,
  bracketsError,
  targets,
  targetsError,
  isAddingBracket,
  newBracket,
  onLoadBrackets,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketRoundMatchFormatChange,
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
  onNewBracketRoundMatchFormatChange,
  onAddBracket,
  getStatusLabel,
}: BracketsEditorProperties) => {
  const targetOwners = new Map<string, string>();
  for (const bracket of brackets) {
    for (const targetId of bracket.targetIds ?? []) {
      targetOwners.set(targetId, bracket.id);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="text-base font-semibold text-white">{t('edit.brackets')}</h4>
      <button
        onClick={onLoadBrackets}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
      >
        {t('common.refresh')}
      </button>
    </div>
    {bracketsError && (
      <p className="mt-3 text-sm text-rose-300">{bracketsError}</p>
    )}
    {targetsError && (
      <p className="mt-3 text-sm text-rose-300">{targetsError}</p>
    )}
    <BracketsList
      t={t}
      canEditBrackets={canEditBrackets}
        showBracketStatusControl={showBracketStatusControl}
        showSaveTargetsButton={showSaveTargetsButton}
      brackets={brackets}
      targets={targets}
      targetOwners={targetOwners}
      onBracketNameChange={onBracketNameChange}
      onBracketTypeChange={onBracketTypeChange}
      onBracketRoundsChange={onBracketRoundsChange}
      onBracketRoundMatchFormatChange={onBracketRoundMatchFormatChange}
      onBracketStatusChange={onBracketStatusChange}
      onBracketTargetToggle={onBracketTargetToggle}
      onSaveBracket={onSaveBracket}
      onSaveBracketTargets={onSaveBracketTargets}
      onRemoveBracket={onRemoveBracket}
      getStatusLabel={getStatusLabel}
    />

    <NewBracketForm
      t={t}
      canEditBrackets={canAddBrackets}
      isAddingBracket={isAddingBracket}
      newBracket={newBracket}
      onStartAddBracket={onStartAddBracket}
      onCancelAddBracket={onCancelAddBracket}
      onNewBracketNameChange={onNewBracketNameChange}
      onNewBracketTypeChange={onNewBracketTypeChange}
      onNewBracketRoundsChange={onNewBracketRoundsChange}
      onNewBracketRoundMatchFormatChange={onNewBracketRoundMatchFormatChange}
      onAddBracket={onAddBracket}
    />
    </div>
  );
};

export default BracketsEditor;
