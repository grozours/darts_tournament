import { useEffect, useState } from 'react';
import type {
  LiveViewMatch,
  LiveViewPool,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import { buildPoolLeaderboard } from './pool-leaderboard';
import MatchScoreInputs from './match-score-inputs';
import MatchTargetSelector from './match-target-selector';

type PoolStageCardProperties = {
  t: Translator;
  tournamentId: string;
  stage: LiveViewPoolStage;
  isPoolStagesReadonly: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  editingMatchId?: string | undefined;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onEditStage: (stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, value: string) => void;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
};

const PoolStageCard = ({
  t,
  tournamentId,
  stage,
  isPoolStagesReadonly,
  getStatusLabel,
  getMatchTargetLabel,
  getTargetLabel,
  matchScores,
  matchTargetSelections,
  updatingMatchId,
  editingMatchId,
  availableTargetsByTournament,
  getMatchKey,
  getTargetIdForSelection,
  onTargetSelectionChange,
  onScoreChange,
  onStartMatch,
  onCompleteMatch,
  onEditMatch,
  onUpdateCompletedMatch,
  onCancelMatchEdit,
  onEditStage,
  onCancelEditStage,
  onUpdateStage,
  onCompleteStageWithScores,
  onDeleteStage,
  onStagePoolCountChange,
  onStagePlayersPerPoolChange,
  onStageStatusChange,
  editingStageId,
  updatingStageId,
  stageStatusDrafts,
  stagePoolCountDrafts,
  stagePlayersPerPoolDrafts,
}: PoolStageCardProperties) => {
  const [showMatches, setShowMatches] = useState(!isPoolStagesReadonly);

  useEffect(() => {
    setShowMatches(!isPoolStagesReadonly);
  }, [isPoolStagesReadonly]);

  const renderStageControls = (stageTournamentId: string) => {
    if (isPoolStagesReadonly) {
      return;
    }
    const isEditing = editingStageId === stage.id;
    if (!isEditing) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {stage.status === 'IN_PROGRESS' && (
            <button
              onClick={() => onCompleteStageWithScores(stageTournamentId, stage)}
              disabled={updatingStageId === stage.id}
              className="rounded-full border border-amber-500/70 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-300 disabled:opacity-60"
            >
              {updatingStageId === stage.id ? t('live.completingStage') : t('live.completeStage')}
            </button>
          )}
          <button
            onClick={() => onEditStage(stage)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('live.editStage')}
          </button>
          <button
            onClick={() => onDeleteStage(stageTournamentId, stage)}
            disabled={updatingStageId === stage.id}
            className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
          >
            {t('common.delete')}
          </button>
        </div>
      );
    }

    return (
      <>
        <label className="text-xs text-slate-400">
          {t('live.poolCount')}
          <input
            type="number"
            min={1}
            value={stagePoolCountDrafts[stage.id] ?? ''}
            onChange={(event_) => onStagePoolCountChange(stage.id, event_.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('live.playersPerPool')}
          <input
            type="number"
            min={1}
            value={stagePlayersPerPoolDrafts[stage.id] ?? ''}
            onChange={(event_) => onStagePlayersPerPoolChange(stage.id, event_.target.value)}
            className="mt-1 w-20 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <select
          value={stageStatusDrafts[stage.id] || stage.status}
          onChange={(event_) => onStageStatusChange(stage.id, event_.target.value)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
        >
          {['NOT_STARTED', 'EDITION', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
            <option key={status} value={status}>
              {getStatusLabel('stage', status)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onUpdateStage(stageTournamentId, stage)}
          disabled={updatingStageId === stage.id}
          className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
        >
          {updatingStageId === stage.id ? t('live.updatingStage') : t('live.updateStage')}
        </button>
        <button
          onClick={onCancelEditStage}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
      </>
    );
  };

  const renderPoolAssignments = (pool: LiveViewPool) => {
    if (pool.assignments && pool.assignments.length > 0) {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {pool.assignments.map((assignment) => (
            <span
              key={assignment.id}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
            >
              {assignment.player.firstName} {assignment.player.lastName}
            </span>
          ))}
        </div>
      );
    }

    return <span className="text-xs text-slate-400">{t('live.noAssignments')}</span>;
  };

  const renderPoolLeaderboard = (pool: LiveViewPool) => {
    const leaderboard = buildPoolLeaderboard(pool);
    if (leaderboard.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noStandings')}</p>;
    }

    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-800/60">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-2 py-2 text-center font-semibold">{t('live.position')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('common.player')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsWon')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('live.legsLost')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leaderboard.map((row) => (
              <tr key={row.playerId} className="text-slate-200">
                <td className="px-2 py-2 text-center font-semibold text-slate-300">#{row.position}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-right">{row.legsWon}</td>
                <td className="px-3 py-2 text-right">{row.legsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };


  const renderMatchStatusSection = (matchTournamentId: string, match: LiveViewMatch) => {
    if (isPoolStagesReadonly) {
      return;
    }
    switch (match.status) {
      case 'SCHEDULED': {
        const matchKey = getMatchKey(matchTournamentId, match.id);
        const availableTargets = availableTargetsByTournament.get(matchTournamentId) || [];
        const selectedTargetNumber = matchTargetSelections[matchKey] || '';
        const selectedTargetId = getTargetIdForSelection(matchTournamentId, selectedTargetNumber);
        return (
          <MatchTargetSelector
            t={t}
            matchTournamentId={matchTournamentId}
            matchId={match.id}
            matchKey={matchKey}
            availableTargets={availableTargets}
            selectedTargetNumber={selectedTargetNumber}
            selectedTargetId={selectedTargetId}
            updatingMatchId={updatingMatchId}
            getTargetLabel={getTargetLabel}
            onTargetSelectionChange={onTargetSelectionChange}
            onStartMatch={onStartMatch}
            containerClassName="mt-2 flex flex-wrap items-center gap-2"
          />
        );
      }
      case 'IN_PROGRESS': {
        return (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.finalScore')}</p>
            <MatchScoreInputs
              matchTournamentId={matchTournamentId}
              match={match}
              matchScores={matchScores}
              getMatchKey={getMatchKey}
              onScoreChange={onScoreChange}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onCompleteMatch(matchTournamentId, match)}
                disabled={updatingMatchId === getMatchKey(matchTournamentId, match.id)}
                className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
              >
                {updatingMatchId === getMatchKey(matchTournamentId, match.id) ? t('live.savingMatch') : t('live.completeMatch')}
              </button>
            </div>
          </div>
        );
      }
      case 'COMPLETED': {
        const matchKey = getMatchKey(matchTournamentId, match.id);
        const isEditing = editingMatchId === matchKey;
        if (!isEditing) {
          return (
            <button
              onClick={() => onEditMatch(matchTournamentId, match)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              {t('live.editScore')}
            </button>
          );
        }

        return (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.editScore')}</p>
            <MatchScoreInputs
              matchTournamentId={matchTournamentId}
              match={match}
              matchScores={matchScores}
              getMatchKey={getMatchKey}
              onScoreChange={onScoreChange}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onUpdateCompletedMatch(matchTournamentId, match)}
                disabled={updatingMatchId === matchKey}
                className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
              >
                {updatingMatchId === matchKey ? t('live.savingMatch') : t('live.saveScores')}
              </button>
              <button
                onClick={onCancelMatchEdit}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        );
      }
      default: {
        return;
      }
    }
  };

  const renderMatchPlayers = (match: LiveViewMatch) => {
    if (match.playerMatches && match.playerMatches.length > 0) {
      return match.playerMatches.map((playerMatch) => (
        <span key={`${match.id}-${playerMatch.playerPosition}`}>
          {playerMatch.player?.firstName} {playerMatch.player?.lastName}
        </span>
      ));
    }

    return <span>No players assigned yet.</span>;
  };

  const renderPoolMatches = (matchTournamentId: string, pool: LiveViewPool) => {
    if (!pool.matches || pool.matches.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }

    return (
      <div className="mt-2 space-y-2">
        {pool.matches.map((match) => (
          <div key={match.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-200">Match {match.matchNumber} · Round {match.roundNumber}</span>
              <span className="text-xs text-slate-400">{getStatusLabel('match', match.status)}</span>
            </div>
            {match.status === 'IN_PROGRESS' && getMatchTargetLabel(match.target) && (
              <p className="mt-1 text-xs text-slate-400">
                {t('live.queue.targetLabel')}: {getMatchTargetLabel(match.target)}
              </p>
            )}
            {renderMatchStatusSection(matchTournamentId, match)}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {renderMatchPlayers(match)}
            </div>
            {match.status === 'COMPLETED' && (match.playerMatches?.length ?? 0) > 0 && (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  {t('live.finalScore')}
                </p>
                <div className="mt-2 grid gap-1 text-xs">
                  {[...(match.playerMatches ?? [])]
                    .sort((first, second) => first.playerPosition - second.playerPosition)
                    .map((playerMatch) => (
                      <div
                        key={`${match.id}-${playerMatch.playerPosition}-score`}
                        className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 px-2 py-1"
                      >
                        <span
                          className={
                            playerMatch.player?.id === match.winner?.id
                              ? 'font-semibold text-emerald-200'
                              : 'text-slate-300'
                          }
                        >
                          {playerMatch.player?.firstName} {playerMatch.player?.lastName}
                        </span>
                        <span className="text-slate-200">
                          {playerMatch.scoreTotal ?? playerMatch.legsWon ?? '-'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {match.winner && (
              <p className="mt-2 text-xs text-emerald-300">
                {t('live.winner')}: {match.winner.firstName} {match.winner.lastName}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-white">{t('live.stage')} {stage.stageNumber}: {stage.name}</h4>
          <p className="text-sm text-slate-400">{t('common.status')}: {getStatusLabel('stage', stage.status)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stage.pools?.length || 0} pools · {stage.playersPerPool ?? 'n/a'} per pool
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderStageControls(tournamentId)}
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            {stage.pools?.length || 0} pools
          </span>
        </div>
      </div>

      {(!stage.pools || stage.pools.length === 0) ? (
        <p className="mt-5 text-xs text-slate-400">{t('live.noPools')}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {stage.pools?.map((pool) => (
            <div key={pool.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-base font-semibold text-slate-100">
                  Pool {pool.poolNumber} of {stage.pools?.length || 0}: {pool.name}
                </h5>
                <span className="text-xs text-slate-400">{getStatusLabel('pool', pool.status)}</span>
              </div>

              <div className="mt-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.participants')}</p>
                {renderPoolAssignments(pool)}
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.leaderboard')}</p>
                {renderPoolLeaderboard(pool)}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
                  {isPoolStagesReadonly && (
                    <button
                      onClick={() => setShowMatches((previous) => !previous)}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      {showMatches ? t('live.hideMatches') : t('live.showMatches')}
                    </button>
                  )}
                </div>
                {(!isPoolStagesReadonly || showMatches) && renderPoolMatches(tournamentId, pool)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PoolStageCard;
