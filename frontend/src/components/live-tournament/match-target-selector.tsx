import type { LiveViewTarget, Translator } from './types';

type MatchTargetSelectorProperties = {
  t: Translator;
  matchTournamentId: string;
  matchId: string;
  matchKey: string;
  availableTargets: LiveViewTarget[];
  selectedTargetNumber: string;
  selectedTargetId: string | undefined;
  updatingMatchId: string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  containerClassName?: string;
};

const MatchTargetSelector = ({
  t,
  matchTournamentId,
  matchId,
  matchKey,
  availableTargets,
  selectedTargetNumber,
  selectedTargetId,
  updatingMatchId,
  getTargetLabel,
  onTargetSelectionChange,
  onStartMatch,
  containerClassName,
}: MatchTargetSelectorProperties) => {
  const canStart = Boolean(selectedTargetId) && updatingMatchId !== matchKey;
  return (
    <div className={containerClassName ?? 'mt-3 flex flex-wrap items-center gap-2'}>
      <select
        value={selectedTargetNumber}
        onChange={(event_) => onTargetSelectionChange(matchKey, event_.target.value)}
        className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
      >
        <option value="">{t('live.queue.targetLabel')}</option>
        {availableTargets.map((target) => (
          <option key={target.id} value={String(target.targetNumber)}>
            {getTargetLabel(target)}
          </option>
        ))}
      </select>
      <button
        onClick={() => selectedTargetId && onStartMatch(matchTournamentId, matchId, selectedTargetId)}
        disabled={!canStart}
        className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
      >
        {updatingMatchId === matchKey ? t('live.startingMatch') : t('live.startMatch')}
      </button>
    </div>
  );
};

export default MatchTargetSelector;
