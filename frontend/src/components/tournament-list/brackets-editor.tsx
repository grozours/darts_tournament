import { BracketStatus, BracketType } from '@shared/types';
import type { BracketConfig } from '../../services/tournament-service';
import type { Translator } from './types';

type BracketDraft = {
  name: string;
  bracketType: string;
  totalRounds: number;
};

type BracketsEditorProperties = {
  t: Translator;
  brackets: BracketConfig[];
  bracketsError?: string | undefined;
  isAddingBracket: boolean;
  newBracket: BracketDraft;
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
};

type BracketsListProperties = {
  t: Translator;
  brackets: BracketConfig[];
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
};

type BracketItemProperties = {
  t: Translator;
  bracket: BracketConfig;
  onBracketNameChange: (id: string, value: string) => void;
  onBracketTypeChange: (id: string, value: string) => void;
  onBracketRoundsChange: (id: string, value: number) => void;
  onBracketStatusChange: (id: string, value: string) => void;
  onSaveBracket: (bracket: BracketConfig) => void;
  onRemoveBracket: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
};

type NewBracketFormProperties = {
  t: Translator;
  isAddingBracket: boolean;
  newBracket: BracketDraft;
  onStartAddBracket: () => void;
  onCancelAddBracket: () => void;
  onNewBracketNameChange: (value: string) => void;
  onNewBracketTypeChange: (value: string) => void;
  onNewBracketRoundsChange: (value: number) => void;
  onAddBracket: () => void;
};

const BracketItem = ({
  t,
  bracket,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketStatusChange,
  onSaveBracket,
  onRemoveBracket,
  getStatusLabel,
}: BracketItemProperties) => (
  <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
    <div className="grid gap-3 md:grid-cols-4">
      <label className="text-xs text-slate-400 md:col-span-2">
        {t('edit.name')}
        <input
          type="text"
          value={bracket.name}
          onChange={(event_) => onBracketNameChange(bracket.id, event_.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.type')}
        <select
          value={bracket.bracketType}
          onChange={(event_) => onBracketTypeChange(bracket.id, event_.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        >
          {Object.values(BracketType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        {t('edit.rounds')}
        <input
          type="number"
          value={bracket.totalRounds}
          onChange={(event_) => onBracketRoundsChange(bracket.id, Number(event_.target.value))}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
        />
      </label>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      <select
        value={bracket.status}
        onChange={(event_) => onBracketStatusChange(bracket.id, event_.target.value)}
        className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
      >
        {Object.values(BracketStatus).map((status) => (
          <option key={status} value={status}>
            {getStatusLabel('bracket', status)}
          </option>
        ))}
      </select>
      <button
        onClick={() => onSaveBracket(bracket)}
        className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-300"
      >
        {t('common.save')}
      </button>
      <button
        onClick={() => onRemoveBracket(bracket.id)}
        className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
      >
        {t('common.delete')}
      </button>
    </div>
  </div>
);

const BracketsList = ({
  t,
  brackets,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketStatusChange,
  onSaveBracket,
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
          bracket={bracket}
          onBracketNameChange={onBracketNameChange}
          onBracketTypeChange={onBracketTypeChange}
          onBracketRoundsChange={onBracketRoundsChange}
          onBracketStatusChange={onBracketStatusChange}
          onSaveBracket={onSaveBracket}
          onRemoveBracket={onRemoveBracket}
          getStatusLabel={getStatusLabel}
        />
      ))
    )}
  </div>
);

const NewBracketForm = ({
  t,
  isAddingBracket,
  newBracket,
  onStartAddBracket,
  onCancelAddBracket,
  onNewBracketNameChange,
  onNewBracketTypeChange,
  onNewBracketRoundsChange,
  onAddBracket,
}: NewBracketFormProperties) => {
  if (!isAddingBracket) {
    return (
      <div className="mt-5 flex justify-end">
        <button
          onClick={onStartAddBracket}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          {t('edit.addBracket')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <label className="text-xs text-slate-400 md:col-span-2">
          {t('edit.name')}
          <input
            type="text"
            value={newBracket.name}
            onChange={(event_) => onNewBracketNameChange(event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.type')}
          <select
            value={newBracket.bracketType}
            onChange={(event_) => onNewBracketTypeChange(event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            {Object.values(BracketType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.rounds')}
          <input
            type="number"
            value={newBracket.totalRounds}
            onChange={(event_) => onNewBracketRoundsChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
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
          disabled={!newBracket.name.trim()}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          {t('edit.addBracket')}
        </button>
      </div>
    </>
  );
};

const BracketsEditor = ({
  t,
  brackets,
  bracketsError,
  isAddingBracket,
  newBracket,
  onLoadBrackets,
  onBracketNameChange,
  onBracketTypeChange,
  onBracketRoundsChange,
  onBracketStatusChange,
  onSaveBracket,
  onRemoveBracket,
  onStartAddBracket,
  onCancelAddBracket,
  onNewBracketNameChange,
  onNewBracketTypeChange,
  onNewBracketRoundsChange,
  onAddBracket,
  getStatusLabel,
}: BracketsEditorProperties) => (
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
    <BracketsList
      t={t}
      brackets={brackets}
      onBracketNameChange={onBracketNameChange}
      onBracketTypeChange={onBracketTypeChange}
      onBracketRoundsChange={onBracketRoundsChange}
      onBracketStatusChange={onBracketStatusChange}
      onSaveBracket={onSaveBracket}
      onRemoveBracket={onRemoveBracket}
      getStatusLabel={getStatusLabel}
    />

    <NewBracketForm
      t={t}
      isAddingBracket={isAddingBracket}
      newBracket={newBracket}
      onStartAddBracket={onStartAddBracket}
      onCancelAddBracket={onCancelAddBracket}
      onNewBracketNameChange={onNewBracketNameChange}
      onNewBracketTypeChange={onNewBracketTypeChange}
      onNewBracketRoundsChange={onNewBracketRoundsChange}
      onAddBracket={onAddBracket}
    />
  </div>
);

export default BracketsEditor;
