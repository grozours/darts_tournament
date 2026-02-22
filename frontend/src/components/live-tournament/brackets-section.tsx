import type { LiveViewBracket, LiveViewMatch, LiveViewPoolStage, LiveViewTarget, Translator } from './types';
import BracketMatches from './bracket-matches';
import SectionEmptyState from './section-empty-state';
import { useState } from 'react';

type BracketsSectionProperties = {
  t: Translator;
  tournamentId: string;
  brackets: LiveViewBracket[];
  poolStages: LiveViewPoolStage[];
  hasLoserBracket: boolean;
  isAdmin: boolean;
  isBracketsReadonly: boolean;
  updatingMatchId: string | undefined;
  editingMatchId?: string | undefined;
  updatingRoundKey?: string | undefined;
  resettingBracketId?: string | undefined;
  populatingBracketId?: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onCompleteBracketRound: (tournamentId: string, bracket: LiveViewBracket) => void;
  onResetBracketMatches: (tournamentId: string, bracketId: string) => void;
  onPopulateBracketFromPools: (
    tournamentId: string,
    bracketId: string,
    stage: LiveViewPoolStage,
    role: 'WINNER' | 'LOSER'
  ) => void;
  onSelectBracket: (tournamentId: string, bracketId: string) => void;
  activeBracketId: string;
};

type BracketsHeaderProperties = {
  t: Translator;
  tournamentId: string;
  brackets: LiveViewBracket[];
  hasLoserBracket: boolean;
  isBracketsReadonly: boolean;
  activeBracketId: string;
  onSelectBracket: (tournamentId: string, bracketId: string) => void;
};

const BracketsHeader = ({
  t,
  tournamentId,
  brackets,
  hasLoserBracket,
  isBracketsReadonly,
  activeBracketId,
  onSelectBracket,
}: BracketsHeaderProperties) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-lg font-semibold text-white">{t('live.bracketStages')}</h3>
      <p className="text-xs text-slate-500">
        {t('live.loserBracket')}: {hasLoserBracket ? t('common.yes') : t('common.no')}
      </p>
    </div>
    {!isBracketsReadonly && (
      <div className="flex flex-wrap gap-2">
        {[...brackets].reverse().map((bracket) => (
          <button
            key={bracket.id}
            type="button"
            onClick={() => onSelectBracket(tournamentId, bracket.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              bracket.id === activeBracketId
                ? 'border-amber-400/80 text-amber-200'
                : 'border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            {bracket.name}
          </button>
        ))}
      </div>
    )}
  </div>
);

type BracketSummaryProperties = {
  t: Translator;
  tournamentId: string;
  bracket: LiveViewBracket;
  isBracketsReadonly: boolean;
  canManageBrackets: boolean;
  canPopulateFromPools: boolean;
  isPopulating: boolean;
  isUpdatingRound: boolean;
  isResettingBracket: boolean;
  populateStage?: LiveViewPoolStage | undefined;
  populateRole: 'WINNER' | 'LOSER';
  onPopulateRoleChange: (role: 'WINNER' | 'LOSER') => void;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  onCompleteBracketRound: (tournamentId: string, bracket: LiveViewBracket) => void;
  onResetBracketMatches: (tournamentId: string, bracketId: string) => void;
  onPopulateBracketFromPools: (
    tournamentId: string,
    bracketId: string,
    stage: LiveViewPoolStage,
    role: 'WINNER' | 'LOSER'
  ) => void;
};

const BracketSummaryHeader = ({
  t,
  tournamentId,
  bracket,
  isBracketsReadonly,
  canManageBrackets,
  canPopulateFromPools,
  isPopulating,
  isUpdatingRound,
  isResettingBracket,
  populateStage,
  populateRole,
  onPopulateRoleChange,
  getStatusLabel,
  onCompleteBracketRound,
  onResetBracketMatches,
  onPopulateBracketFromPools,
}: BracketSummaryProperties) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h4 className="text-lg font-semibold text-white">{bracket.name}</h4>
      <p className="text-sm text-slate-400">
        {bracket.bracketType} · {getStatusLabel('bracket', bracket.status)}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {canManageBrackets && !isBracketsReadonly && (
        <label className="flex items-center gap-2 text-xs text-slate-300">
          {t('live.populateBracketRole')}
          <select
            value={populateRole}
            onChange={(event_) => onPopulateRoleChange(event_.target.value as 'WINNER' | 'LOSER')}
            disabled={!canPopulateFromPools || isPopulating}
            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
          >
            <option value="WINNER">{t('live.populateBracketRoleWinner')}</option>
            <option value="LOSER">{t('live.populateBracketRoleLoser')}</option>
          </select>
        </label>
      )}
      {canManageBrackets && !isBracketsReadonly && (
        <button
          type="button"
          onClick={() =>
            populateStage && onPopulateBracketFromPools(tournamentId, bracket.id, populateStage, populateRole)}
          disabled={!canPopulateFromPools || isPopulating}
          className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
        >
          {isPopulating ? t('live.populatingBracket') : t('live.populateBracket')}
        </button>
      )}
      {canManageBrackets && !isBracketsReadonly && (
        <button
          type="button"
          onClick={() => onCompleteBracketRound(tournamentId, bracket)}
          disabled={isUpdatingRound}
          className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
        >
          {isUpdatingRound ? t('live.completingRound') : t('live.completeRound')}
        </button>
      )}
      {canManageBrackets && !isBracketsReadonly && (
        <button
          type="button"
          onClick={() => {
            if (!globalThis.window?.confirm(t('live.resetBracketConfirm'))) {
              return;
            }
            onResetBracketMatches(tournamentId, bracket.id);
          }}
          disabled={isResettingBracket}
          className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
        >
          {isResettingBracket ? t('common.loading') : t('live.resetBracket')}
        </button>
      )}
      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
        {bracket.entries?.length || 0} entries
      </span>
    </div>
  </div>
);

const BracketsSection = ({
  t,
  tournamentId,
  brackets,
  poolStages,
  hasLoserBracket,
  isAdmin,
  isBracketsReadonly,
  updatingMatchId,
  editingMatchId,
  updatingRoundKey,
  resettingBracketId,
  populatingBracketId,
  matchScores,
  matchTargetSelections,
  availableTargetsByTournament,
  getStatusLabel,
  getMatchKey,
  getTargetIdForSelection,
  getTargetLabel,
  onTargetSelectionChange,
  onStartMatch,
  onCompleteMatch,
  onEditMatch,
  onUpdateCompletedMatch,
  onCancelMatchEdit,
  onScoreChange,
  onCompleteBracketRound,
  onResetBracketMatches,
  onPopulateBracketFromPools,
  onSelectBracket,
  activeBracketId,
}: BracketsSectionProperties) => {
  const [populateRoleByBracket, setPopulateRoleByBracket] = useState<Record<string, 'WINNER' | 'LOSER'>>({});
  if (brackets.length === 0) {
    return <SectionEmptyState title={t('live.bracketStages')} message={t('live.noBrackets')} />;
  }

  const preferredBracket = brackets.find((bracket) => /winner/i.test(bracket.name)) ?? brackets[0];
  if (!preferredBracket) {
    return;
  }
  const activeBracket = brackets.find((bracket) => bracket.id === activeBracketId) ?? preferredBracket;
  const isUpdatingRound = updatingRoundKey?.startsWith(`${tournamentId}:${activeBracket.id}:`) ?? false;
  const isResettingBracket = resettingBracketId === activeBracket.id;
  const canManageBrackets = isAdmin;
  const completedStages = (poolStages || []).filter((stage) => stage.status === 'COMPLETED');
  const populateStage = completedStages.reduce<LiveViewPoolStage | undefined>((latest, stage) => {
    if (!latest || stage.stageNumber > latest.stageNumber) {
      return stage;
    }
    return latest;
  }, undefined);
  const activeBracketTargetIds = activeBracket.targetIds
    ?? activeBracket.bracketTargets?.map((target) => target.targetId)
    ?? [];
  const reservedTargetIds = Array.from(
    new Set(
      brackets
        .filter((bracket) => bracket.id !== activeBracket.id)
        .flatMap((bracket) => bracket.targetIds ?? bracket.bracketTargets?.map((target) => target.targetId) ?? [])
    )
  );
  const canPopulateFromPools = Boolean(populateStage);
  const isPopulating = populatingBracketId === activeBracket.id;
  const populateRole = populateRoleByBracket[activeBracket.id]
    ?? (/loser/i.test(activeBracket.name) ? 'LOSER' : 'WINNER');

  return (
    <div className="space-y-6">
      <BracketsHeader
        t={t}
        tournamentId={tournamentId}
        brackets={brackets}
        hasLoserBracket={hasLoserBracket}
        isBracketsReadonly={isBracketsReadonly}
        activeBracketId={activeBracket.id}
        onSelectBracket={onSelectBracket}
      />

      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
        <BracketSummaryHeader
          t={t}
          tournamentId={tournamentId}
          bracket={activeBracket}
          isBracketsReadonly={isBracketsReadonly}
          canManageBrackets={canManageBrackets}
          canPopulateFromPools={canPopulateFromPools}
          isPopulating={isPopulating}
          isUpdatingRound={isUpdatingRound}
          isResettingBracket={isResettingBracket}
          populateStage={populateStage}
          populateRole={populateRole}
          onPopulateRoleChange={(role) =>
            setPopulateRoleByBracket((current) => ({ ...current, [activeBracket.id]: role }))}
          getStatusLabel={getStatusLabel}
          onCompleteBracketRound={onCompleteBracketRound}
          onResetBracketMatches={onResetBracketMatches}
          onPopulateBracketFromPools={onPopulateBracketFromPools}
        />

        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t('live.matches')}</p>
          <BracketMatches
            t={t}
            tournamentId={tournamentId}
            bracket={activeBracket}
            isBracketsReadonly={isBracketsReadonly}
            updatingMatchId={updatingMatchId}
            editingMatchId={editingMatchId}
            matchScores={matchScores}
            matchTargetSelections={matchTargetSelections}
            availableTargetsByTournament={availableTargetsByTournament}
            reservedTargetIds={activeBracketTargetIds.length > 0 ? [] : reservedTargetIds}
            getStatusLabel={getStatusLabel}
            getMatchKey={getMatchKey}
            getTargetIdForSelection={getTargetIdForSelection}
            getTargetLabel={getTargetLabel}
            onTargetSelectionChange={onTargetSelectionChange}
            onStartMatch={onStartMatch}
            onCompleteMatch={onCompleteMatch}
            onEditMatch={onEditMatch}
            onUpdateCompletedMatch={onUpdateCompletedMatch}
            onCancelMatchEdit={onCancelMatchEdit}
            onScoreChange={onScoreChange}
          />
        </div>
      </div>
    </div>
  );
};

export default BracketsSection;
