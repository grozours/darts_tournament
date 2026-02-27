import type {
  LiveViewBracket,
  LiveViewMatch,
  LiveViewTarget,
  Translator,
} from './types';
import {
  buildBracketRounds,
  getBracketPlayerLabel,
  getBracketRoundLabel,
  getBracketTone,
  type BracketMatchSlot,
  type BracketTone,
} from './bracket-utilities';
import MatchScoreInputs from './match-score-inputs';
import MatchTargetSelector from './match-target-selector';
import { getMatchFormatTooltip } from '../../utils/match-format-presets';

type BracketRound = {
  roundNumber: number;
  matches: BracketMatchSlot[];
};

type LiveParticipant = {
  id?: string;
  firstName?: string;
  lastName?: string;
};

const getInitialActionLabel = (label: string) => {
  const trimmedLabel = label.trim();
  return trimmedLabel.charAt(0).toUpperCase();
};

type CompactActionButtonProperties = {
  label: string;
  disabled?: boolean;
  className: string;
  onClick: () => void;
};

const CompactActionButton = ({
  label,
  disabled,
  className,
  onClick,
}: CompactActionButtonProperties) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={className}
  >
    {getInitialActionLabel(label)}
  </button>
);

const getRoundLeftOffset = (roundNumber: number) => {
  if (roundNumber > 2) return -40;
  if (roundNumber > 1) return -22;
  return 0;
};

const getRoundPositions = (roundNumber: number, matchCount: number, baseStep: number) => {
  const roundIndex = Math.max(1, roundNumber);
  return Array.from({ length: matchCount }, (_, matchIndex) => (
    (Math.pow(2, roundIndex) * matchIndex + (Math.pow(2, roundIndex - 1) - 1)) * baseStep
  ));
};

const getBracketLayout = (bracket: LiveViewBracket, rounds: BracketRound[], screenMode = false) => {
  const totalRounds = rounds.length;
  const finalRound = rounds.at(-1);
  const earlyRounds = rounds.slice(0, -1);
  const bracketGap = screenMode ? 12 : 40;
  const bracketCardHeight = screenMode ? 150 : 220;
  const baseStep = (bracketCardHeight + bracketGap) / 2;
  const columnHeight = (Math.pow(2, totalRounds) - 2) * baseStep + bracketCardHeight;
  const showWinnerColumn = (finalRound?.matches?.length ?? 0) === 1;
  const finalLeftOffset = /loser/i.test(bracket.name) ? -60 : -80;
  const roundsToRender = showWinnerColumn ? earlyRounds : rounds;

  return {
    totalRounds,
    finalRound,
    roundsToRender,
    bracketCardHeight,
    baseStep,
    columnHeight,
    showWinnerColumn,
    finalLeftOffset,
  };
};

const renderRoundLines = (
  positions: number[],
  roundNumber: number,
  connectorX: number,
  connectorGap: number,
  bracketCardHeight: number
) => positions.map((top) => (
  <div
    key={`line-${roundNumber}-${top}`}
    className="absolute h-px bg-slate-600"
    style={{
      left: connectorX,
      top: top + bracketCardHeight / 2,
      width: connectorGap,
    }}
  />
));

const renderRoundPairConnectors = (
  positions: number[],
  roundNumber: number,
  connectorX: number,
  connectorGap: number,
  connectorToNext: number,
  bracketCardHeight: number
) => positions
  .map((top, matchIndex) => {
    if (matchIndex % 2 !== 0) return;
    const nextTop = positions.at(matchIndex + 1);
    if (nextTop === undefined) return;
    const startY = top + bracketCardHeight / 2;
    const endY = nextTop + bracketCardHeight / 2;
    const midY = (startY + endY) / 2;
    return (
      <div key={`pair-${roundNumber}-${top}-${nextTop}`}>
        <div
          className="absolute w-px bg-slate-600"
          style={{
            left: connectorX + connectorGap,
            top: startY,
            height: Math.max(2, endY - startY),
          }}
        />
        <div
          className="absolute h-px bg-slate-600"
          style={{
            left: connectorX + connectorGap,
            top: midY,
            width: connectorToNext,
          }}
        />
      </div>
    );
  })
  .filter(Boolean);

type BracketMatchesProperties = {
  t: Translator;
  tournamentId: string;
  bracket: LiveViewBracket;
  roundStartTimeByRound?: Map<number, string>;
  screenMode?: boolean;
  isBracketsReadonly: boolean;
  updatingMatchId: string | undefined;
  editingMatchId: string | undefined;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  reservedTargetIds: string[];
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onSaveMatchScores: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  getParticipantLabel?: (player: LiveParticipant | undefined) => string;
};


const BracketMatches = ({
  t,
  tournamentId,
  bracket,
  roundStartTimeByRound,
  screenMode = false,
  isBracketsReadonly,
  updatingMatchId,
  editingMatchId,
  matchScores,
  matchTargetSelections,
  availableTargetsByTournament,
  reservedTargetIds,
  getStatusLabel,
  getMatchKey,
  getTargetIdForSelection,
  getTargetLabel,
  onTargetSelectionChange,
  onStartMatch,
  onCompleteMatch,
  onEditMatch,
  onSaveMatchScores,
  onCancelMatch,
  onCancelMatchEdit,
  onScoreChange,
  getParticipantLabel,
}: BracketMatchesProperties) => {

  const renderScheduledActions = (matchTournamentId: string, match: BracketMatchSlot, matchKey: string) => {
    if (!match.playerMatches || match.playerMatches.length < 2) {
      return;
    }
    const assignedTargetIds = bracket.targetIds
      ?? bracket.bracketTargets?.map((target) => target.targetId)
      ?? [];
    const availableTargets = (availableTargetsByTournament.get(matchTournamentId) || []).filter((target) =>
      assignedTargetIds.length > 0
        ? assignedTargetIds.includes(target.id)
        : !reservedTargetIds.includes(target.id)
    );
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
      />
    );
  };

  const renderInProgressActions = (matchTournamentId: string, match: BracketMatchSlot, matchKey: string) => (
    <div className="mt-3 space-y-2">
      <MatchScoreInputs
        matchTournamentId={matchTournamentId}
        match={match}
        matchScores={matchScores}
        getMatchKey={getMatchKey}
        onScoreChange={onScoreChange}
        {...(getParticipantLabel ? { getParticipantLabel } : {})}
      />
      <div className="flex flex-wrap gap-2">
        <CompactActionButton
          onClick={() => onSaveMatchScores(matchTournamentId, match)}
          disabled={updatingMatchId === matchKey}
          className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
          label={updatingMatchId === matchKey ? t('live.savingMatch') : t('live.saveScores')}
        />
        <CompactActionButton
          onClick={() => onCompleteMatch(matchTournamentId, match)}
          disabled={updatingMatchId === matchKey}
          className="rounded-full border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
          label={updatingMatchId === matchKey ? t('live.savingMatch') : t('live.completeMatch')}
        />
        <CompactActionButton
          onClick={() => {
            if (!globalThis.window?.confirm(t('targets.cancelMatchConfirm'))) {
              return;
            }
            onCancelMatch(matchTournamentId, match);
          }}
          disabled={updatingMatchId === matchKey}
          className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 disabled:opacity-60"
          label={updatingMatchId === matchKey ? t('common.loading') : t('targets.cancelMatch')}
        />
      </div>
    </div>
  );

  const renderCompletedActions = (matchTournamentId: string, match: BracketMatchSlot, matchKey: string) => {
    const targetNumberValue = match.target?.targetNumber === undefined
      ? undefined
      : String(match.target.targetNumber);
    const reopenTargetId = targetNumberValue
      ? getTargetIdForSelection(matchTournamentId, targetNumberValue)
      : undefined;
    const isEditing = editingMatchId === matchKey;
    if (!isEditing) {
      return (
        <div className="mt-3 flex flex-wrap gap-2">
          <CompactActionButton
            onClick={() => onEditMatch(matchTournamentId, match)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            label={t('live.editScore')}
          />
          <CompactActionButton
            onClick={() => {
              if (!reopenTargetId) {
                return;
              }
              if (!globalThis.window?.confirm(t('live.reopenMatchConfirm'))) {
                return;
              }
              onStartMatch(matchTournamentId, match.id, reopenTargetId);
            }}
            disabled={!reopenTargetId || updatingMatchId === matchKey}
            className="rounded-full border border-amber-500/70 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-300 disabled:opacity-60"
            label={updatingMatchId === matchKey ? t('common.loading') : t('live.reopenMatch')}
          />
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        <MatchScoreInputs
          matchTournamentId={matchTournamentId}
          match={match}
          matchScores={matchScores}
          getMatchKey={getMatchKey}
          onScoreChange={onScoreChange}
          {...(getParticipantLabel ? { getParticipantLabel } : {})}
        />
        <div className="flex flex-wrap gap-2">
          <CompactActionButton
            onClick={() => onSaveMatchScores(matchTournamentId, match)}
            disabled={updatingMatchId === matchKey}
            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
            label={updatingMatchId === matchKey ? t('live.savingMatch') : t('live.saveScores')}
          />
          <CompactActionButton
            onClick={onCancelMatchEdit}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            label={t('common.cancel')}
          />
        </div>
      </div>
    );
  };

  const renderBracketMatchActions = (matchTournamentId: string, match: BracketMatchSlot) => {
    if (isBracketsReadonly) {
      return;
    }
    if (match.isPlaceholder) {
      return;
    }
    const matchKey = getMatchKey(matchTournamentId, match.id);
    switch (match.status) {
      case 'SCHEDULED': {
        return renderScheduledActions(matchTournamentId, match, matchKey);
      }
      case 'IN_PROGRESS': {
        return renderInProgressActions(matchTournamentId, match, matchKey);
      }
      case 'COMPLETED': {
        return renderCompletedActions(matchTournamentId, match, matchKey);
      }
      default: {
        return;
      }
    }
  };

  const renderBracketCard = (
    matchTournamentId: string,
    match: BracketMatchSlot,
    options: {
      showConnector: boolean;
      connectorSide: 'left' | 'right';
      tone: BracketTone;
      isFinal?: boolean;
    }
  ) => (
    <div className="relative">
      <div
        className={`rounded-xl border text-xs shadow-[0_12px_24px_-16px_rgba(0,0,0,0.6)] ${options.tone.card} ${screenMode ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
        style={{ minHeight: screenMode ? 150 : 220, width: 200 }}
      >
        {(() => {
          const resolvedMatchFormat = match.matchFormatKey
            ?? bracket.roundMatchFormats?.[String(match.roundNumber)];
          const tooltip = getMatchFormatTooltip(resolvedMatchFormat);
          return resolvedMatchFormat ? (
            <div className="mb-2 text-[10px] text-cyan-200" title={tooltip}>
              {resolvedMatchFormat}
            </div>
          ) : null;
        })()}
        <div className={`flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.3em] ${options.tone.accent}`}>
          <span>{t('live.queue.matchLabel')} {match.matchNumber}</span>
          <span>{getStatusLabel('match', match.status)}</span>
        </div>
        <div className={screenMode ? 'mt-1.5 space-y-1' : 'mt-3 space-y-2'}>
          {[1, 2].map((position) => {
            const playerMatch = match.playerMatches?.find((item) => item.playerPosition === position) || { playerPosition: position };
            return (
              <div
                key={`${match.id}-${position}`}
                className={`flex items-center justify-between rounded-lg border ${screenMode ? 'px-2 py-1' : 'px-3 py-2'} ${options.tone.row}`}
              >
                <span className={playerMatch.player?.id === match.winner?.id ? options.tone.winner : options.tone.accent}>
                  {getBracketPlayerLabel(playerMatch, getParticipantLabel)}
                  {options.isFinal && match.status === 'COMPLETED' && playerMatch.player?.id === match.winner?.id && (
                    <span className="ml-1">🏆</span>
                  )}
                  {!options.isFinal && match.status === 'COMPLETED' && playerMatch.player?.id === match.winner?.id && (
                    <span className="ml-2 text-[10px] font-semibold text-emerald-300">
                      {t('live.winnerShort')}
                    </span>
                  )}
                </span>
                <span className={options.tone.accent}>
                  {playerMatch.scoreTotal ?? playerMatch.legsWon ?? '-'}
                </span>
              </div>
            );
          })}
        </div>
        {renderBracketMatchActions(matchTournamentId, match)}
      </div>
      {options.showConnector && (
        <div
          className={`absolute top-1/2 h-px w-6 -translate-y-1/2 bg-slate-600 ${
            options.connectorSide === 'right' ? 'right-[-16px]' : 'left-[-16px]'
          }`}
        />
      )}
    </div>
  );

  const renderBracketMatches = (matchTournamentId: string) => {
    const rounds = buildBracketRounds(bracket);
    if (rounds.length === 0) {
      return <p className="mt-2 text-xs text-slate-400">{t('live.noMatches')}</p>;
    }

    const {
      totalRounds,
      finalRound,
      roundsToRender,
      bracketCardHeight,
      baseStep,
      columnHeight,
      showWinnerColumn,
      finalLeftOffset,
    } = getBracketLayout(bracket, rounds, screenMode);

    const renderRoundColumn = (round: { roundNumber: number; matches: BracketMatchSlot[] }, index: number) => {
      const tone = getBracketTone(index, totalRounds);
      const cardWidth = 200;
      const connectorGap = 18;
      const leftOffset = getRoundLeftOffset(round.roundNumber);
      const connectorX = cardWidth + 6 + leftOffset;
      const connectorToNext = connectorGap + 8;
      const positions = getRoundPositions(round.roundNumber, round.matches.length, baseStep);
      return (
        <div key={`${bracket.id}-round-${round.roundNumber}`} className={screenMode ? 'min-w-[208px]' : 'min-w-[220px]'}>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            {getBracketRoundLabel(round.roundNumber, totalRounds, t)}
          </p>
          {roundStartTimeByRound?.get(round.roundNumber) && (
            <p className="mt-1 text-[10px] text-slate-400">
              {t('live.matchStartTime')}: {roundStartTimeByRound.get(round.roundNumber)}
            </p>
          )}
          <div className="relative mt-5" style={{ height: Math.max(screenMode ? 180 : 260, columnHeight) }}>
            {round.matches.map((match, matchIndex) => {
              const top = positions[matchIndex] ?? 0;
              return (
                <div key={match.id} className="absolute" style={{ top, left: leftOffset }}>
                  {renderBracketCard(matchTournamentId, match, {
                    showConnector: true,
                    connectorSide: 'right',
                    tone,
                    isFinal: round.roundNumber === totalRounds,
                  })}
                </div>
              );
            })}
            {renderRoundLines(positions, round.roundNumber, connectorX, connectorGap, bracketCardHeight)}
            {renderRoundPairConnectors(
              positions,
              round.roundNumber,
              connectorX,
              connectorGap,
              connectorToNext,
              bracketCardHeight
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="mt-6 overflow-x-auto pb-6">
        <div className={`flex items-start ${screenMode ? 'min-w-[820px] gap-6' : 'min-w-[960px] gap-12'}`}>
          <div className={`flex ${screenMode ? 'gap-6' : 'gap-12'}`}>
            {roundsToRender.map((round, index) => renderRoundColumn(round, index))}
          </div>
          {showWinnerColumn && (
            <div className={`flex flex-col items-center gap-3 ${screenMode ? 'min-w-[208px] pt-3' : 'min-w-[220px] pt-6'}`}>
              <div className="flex items-center gap-2 text-amber-300" style={{ marginLeft: finalLeftOffset }}>
                <span className="text-[11px] uppercase tracking-[0.4em]">
                  {getBracketRoundLabel(totalRounds, totalRounds, t)}
                </span>
                <span aria-hidden="true">🏆</span>
              </div>
              {roundStartTimeByRound?.get(totalRounds) && (
                <p className="text-[10px] text-slate-400" style={{ marginLeft: finalLeftOffset }}>
                  {t('live.matchStartTime')}: {roundStartTimeByRound.get(totalRounds)}
                </p>
              )}
              {finalRound?.matches?.[0] && (
                <div className="relative min-w-[200px]" style={{ height: Math.max(screenMode ? 180 : 260, columnHeight) }}>
                  <div
                    className="absolute"
                    style={{
                      top: (Math.max(screenMode ? 180 : 260, columnHeight) - bracketCardHeight) / 2,
                      left: finalLeftOffset,
                    }}
                  >
                    {renderBracketCard(matchTournamentId, finalRound.matches[0], {
                      showConnector: false,
                      connectorSide: 'right',
                      tone: getBracketTone(totalRounds - 1, totalRounds),
                      isFinal: true,
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return renderBracketMatches(tournamentId);
};

export default BracketMatches;
