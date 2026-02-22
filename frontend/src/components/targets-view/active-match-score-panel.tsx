import type { LiveViewMatch, Translator } from '../live-tournament/types';

type ActiveMatchScorePanelProperties = {
  match: LiveViewMatch;
  matchScores: Record<string, Record<string, string>>;
  updatingMatchId: string | undefined;
  t: Translator;
  onScoreChange: (matchId: string, playerId: string, value: string) => void;
  onCompleteMatch: (match: LiveViewMatch) => void;
};

const ActiveMatchScorePanel = ({
  match,
  matchScores,
  updatingMatchId,
  t,
  onScoreChange,
  onCompleteMatch,
}: ActiveMatchScorePanelProperties) => (
  <div className="mt-3 space-y-2">
    <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.finalScore')}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {(match.playerMatches ?? []).map((playerMatch) => (
        <label key={`${match.id}-${playerMatch.playerPosition ?? playerMatch.player?.id}`} className="text-xs text-slate-300">
          <span className="block text-slate-400">
            {playerMatch.player?.firstName} {playerMatch.player?.lastName}
          </span>
          <input
            type="number"
            min={0}
            value={matchScores[match.id]?.[playerMatch.player?.id || ''] || ''}
            onChange={(event_) => onScoreChange(match.id, playerMatch.player?.id || '', event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
      ))}
    </div>
    <button
      onClick={() => onCompleteMatch(match)}
      disabled={updatingMatchId === match.id}
      className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
    >
      {updatingMatchId === match.id ? t('live.savingMatch') : t('live.completeMatch')}
    </button>
  </div>
);

export default ActiveMatchScorePanel;
