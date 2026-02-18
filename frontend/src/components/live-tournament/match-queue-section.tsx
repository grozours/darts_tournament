import type { LiveViewTarget, MatchQueueItem, Translator } from './types';

type MatchQueueSectionProperties = {
  t: Translator;
  queue: MatchQueueItem[];
  showTournamentName: boolean;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  isPoolStagesReadonly: boolean;
  getMatchKey: (tournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (tournamentId: string, matchId: string, targetId: string) => void;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  formatTargetLabel: (value: string) => string;
  getTargetLabel: (target: LiveViewTarget) => string;
};

const MatchQueueSection = ({
  t,
  queue,
  showTournamentName,
  availableTargetsByTournament,
  matchTargetSelections,
  updatingMatchId,
  isPoolStagesReadonly,
  getMatchKey,
  getTargetIdForSelection,
  onTargetSelectionChange,
  onStartMatch,
  getStatusLabel,
  formatTargetLabel,
  getTargetLabel,
}: MatchQueueSectionProperties) => {
  const maxQueueItems = 3;
  const visibleQueue = queue.slice(0, maxQueueItems);
  const queueCountLabel = `${visibleQueue.length}/${queue.length}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{t('live.queue.title')}</h3>
        <span className="text-xs text-slate-400">{queueCountLabel}</span>
      </div>
      {visibleQueue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('live.queue.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleQueue.map((item) => {
            const matchKey = getMatchKey(item.tournamentId, item.matchId);
            const availableTargets = availableTargetsByTournament.get(item.tournamentId) || [];
            const selectedTargetNumber = matchTargetSelections[matchKey] || '';
            const selectedTargetId = getTargetIdForSelection(item.tournamentId, selectedTargetNumber);
            const canStart = item.status === 'SCHEDULED' && Boolean(selectedTargetId) && updatingMatchId !== matchKey;
            return (
              <div key={`${item.tournamentId}-${item.matchId}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">
                    {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                  </div>
                  <span className="text-xs text-slate-400">{getStatusLabel('match', item.status)}</span>
                </div>
                {showTournamentName && (
                  <div className="mt-1 text-xs text-slate-500">{item.tournamentName}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    {t('live.queue.matchLabel')} {item.matchNumber}
                  </span>
                  <span>·</span>
                  <span>
                    {t('live.queue.roundLabel')} {item.roundNumber}
                  </span>
                  {(item.targetCode || item.targetNumber) && (
                    <>
                      <span>·</span>
                      <span>
                        {t('live.queue.targetLabel')} {formatTargetLabel(item.targetCode ?? `#${item.targetNumber}`)}
                      </span>
                    </>
                  )}
                </div>
                {item.players.length > 0 && (
                  <div className="mt-2 text-xs text-slate-300">{item.players.join(' · ')}</div>
                )}
                {item.status === 'SCHEDULED' && !isPoolStagesReadonly && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
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
                      onClick={() => selectedTargetId && onStartMatch(item.tournamentId, item.matchId, selectedTargetId)}
                      disabled={!canStart}
                      className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                    >
                      {updatingMatchId === matchKey ? t('live.startingMatch') : t('live.startMatch')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchQueueSection;
