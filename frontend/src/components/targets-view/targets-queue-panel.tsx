import type { MatchQueueItem, Translator } from './types';
import { formatParticipantsLabel, formatTargetLabel, getMatchStatusLabel } from './target-labels';

type TargetsQueuePanelProperties = {
  t: Translator;
  queueItems: MatchQueueItem[];
  queuePreview: MatchQueueItem[];
};

const TargetsQueuePanel = ({ t, queueItems, queuePreview }: TargetsQueuePanelProperties) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-white">{t('live.queue.title')}</h3>
      <span className="text-xs text-slate-400">{queueItems.length}</span>
    </div>
    {queueItems.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        {t('live.queue.empty')}
      </div>
    ) : (
      <div className="space-y-2">
        {queuePreview.map((item) => (
          <div key={`${item.source}-${item.tournamentId}-${item.matchId}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
              {item.source === 'pool' ? (
                <span>
                  {t('live.queue.stageLabel')} {item.stageNumber}: {item.stageName} · {t('live.queue.poolLabel')} {item.poolNumber}
                </span>
              ) : (
                <span>
                  {t('targets.bracketLabel')} {item.bracketName ?? ''}
                </span>
              )}
              <span className="text-xs text-slate-400">{getMatchStatusLabel(item.status, t)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{item.tournamentName}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{t('live.queue.matchLabel')} {item.matchNumber}</span>
              <span>·</span>
              <span>{t('live.queue.roundLabel')} {item.roundNumber}</span>
              {(item.targetCode || item.targetNumber) && (
                <>
                  <span>·</span>
                  <span>
                    {t('live.queue.targetLabel')} {formatTargetLabel(item.targetCode ?? `#${item.targetNumber}`, t)}
                  </span>
                </>
              )}
            </div>
            {item.players.length > 0 && (
              <div className="mt-2 text-xs text-slate-300">
                {formatParticipantsLabel(item.players, t('targets.unknownPlayers'))}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default TargetsQueuePanel;
