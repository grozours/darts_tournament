import ActiveMatchScorePanel from './active-match-score-panel';
import { getSurnameList } from './target-labels';
import type { LiveViewMatch, MatchQueueItem, SharedTarget, Translator } from './types';

type TargetsGridCardProperties = {
  t: Translator;
  isAdmin: boolean;
  target: SharedTarget;
  matchDetailsById: Map<string, LiveViewMatch>;
  matchSelectionByTarget: Record<string, string>;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | undefined;
  startingMatchId: string | undefined;
  cancellingMatchId: string | undefined;
  queueItems: MatchQueueItem[];
  onQueueSelectionChange: (targetKey: string, matchId: string) => void;
  onStartMatch: (matchId: string, targetNumber: number) => void;
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
  onCancelMatch: (match: LiveViewMatch) => void;
};

const TargetsGridCard = ({
  t,
  isAdmin,
  target,
  matchDetailsById,
  matchSelectionByTarget,
  matchScores,
  updatingMatchId,
  startingMatchId,
  cancellingMatchId,
  queueItems,
  onQueueSelectionChange,
  onStartMatch,
  onScoreChange,
  onCompleteMatch,
  onCancelMatch,
}: TargetsGridCardProperties) => {
  const targetKey = String(target.targetNumber);
  const matchInfo = target.activeMatchInfo;
  const isInUse = target.isInUse;
  const activeMatchId = matchInfo?.matchId;
  const activeMatch = activeMatchId ? matchDetailsById.get(activeMatchId) : undefined;
  const selectedMatchId = matchSelectionByTarget[targetKey] || '';
  const canStart = !isInUse && selectedMatchId.length > 0 && startingMatchId !== selectedMatchId;

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">{target.label}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
          isInUse ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
        }`}>
          {isInUse ? t('targets.inUse') : t('targets.free')}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{t('targets.number')}: {target.targetNumber}</p>
      {matchInfo?.tournamentName && (
        <p className="mt-1 text-xs text-slate-500">{matchInfo.tournamentName}</p>
      )}
      {isInUse ? (
        <div className="mt-3 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t('targets.matchRunning')}</p>
          {matchInfo ? (
            <>
              <p className="mt-1">{matchInfo.label}</p>
              {matchInfo.players.length > 0 && (
                <div className="mt-1 text-sm font-semibold text-blue-200 space-y-1">
                  {matchInfo.players.map((player) => (
                    <p key={player}>{player}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              {t('targets.unknownPlayers')}
            </p>
          )}
          {activeMatch?.status === 'IN_PROGRESS' && isAdmin && (
            <ActiveMatchScorePanel
              match={activeMatch}
              matchScores={matchScores}
              updatingMatchId={updatingMatchId}
              t={t}
              onScoreChange={onScoreChange}
              onCompleteMatch={onCompleteMatch}
            />
          )}
          {activeMatch && isAdmin && activeMatch.status !== 'COMPLETED' && activeMatch.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => {
                if (!globalThis.window?.confirm(t('targets.cancelMatchConfirm'))) {
                  return;
                }
                onCancelMatch(activeMatch);
              }}
              disabled={cancellingMatchId === activeMatch.id}
              className="mt-3 rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
            >
              {cancellingMatchId === activeMatch.id ? t('common.loading') : t('targets.cancelMatch')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-400">{t('targets.noMatch')}</p>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMatchId}
                onChange={(event_) => onQueueSelectionChange(targetKey, event_.target.value)}
                className="w-full rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200 sm:flex-1 sm:min-w-0"
              >
                <option value="">{t('targets.selectMatch')}</option>
                {queueItems.map((item) => (
                  <option key={item.matchId} value={item.matchId}>
                    {item.tournamentName} · {item.source === 'pool'
                      ? `${t('live.queue.stageLabel')} ${item.stageNumber} · ${t('live.queue.poolLabel')} ${item.poolNumber}`
                      : `${t('targets.bracketLabel')} ${item.bracketName ?? ''}`}
                    {` · ${getSurnameList(item.players) || t('targets.unknownPlayers')}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onStartMatch(selectedMatchId, target.targetNumber)}
                disabled={!canStart}
                className="shrink-0 rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
              >
                {startingMatchId === selectedMatchId ? t('live.startingMatch') : t('live.startMatch')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TargetsGridCard;
