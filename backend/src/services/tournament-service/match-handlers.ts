import { randomInt } from 'node:crypto';

import type { TournamentModel } from '../../models/tournament-model';
import { AppError } from '../../middleware/error-handler';
import { getWebSocketService } from '../../websocket/server';
import {
  BracketStatus,
  MatchStatus,
  StageStatus,
  TargetStatus,
  TournamentStatus,
} from '../../../../shared/src/types';
import type { Tournament } from '../../../../shared/src/types';
import { nextPowerOfTwo } from './number-helpers';

type MatchForCompletion = {
  id: string;
  status?: string | null;
  playerMatches?: Array<{ playerId?: string | null }> | null;
  targetId?: string | null;
  startedAt?: Date | null;
};

export type MatchHandlerContext = {
  tournamentModel: TournamentModel;
  validateUUID: (id: string) => void;
  transitionTournamentStatus: (tournamentId: string, newStatus: TournamentStatus) => Promise<Tournament>;
};

const randomIntInclusive = (min: number, max: number): number =>
  randomInt(min, max + 1);

export const createMatchHandlers = (context: MatchHandlerContext) => {
  const { tournamentModel, validateUUID, transitionTournamentStatus } = context;

  const getMatchPlayerIds = (match: { playerMatches?: Array<{ playerId?: string | null }> | null }): string[] => {
    return (match.playerMatches || [])
      .map((pm) => pm.playerId)
      .filter(Boolean) as string[];
  };

  const buildRandomMatchScores = (firstId: string, secondId: string) => {
    const winnerFirst = randomInt(0, 2) === 0;
    const winnerId = winnerFirst ? firstId : secondId;
    const loserId = winnerFirst ? secondId : firstId;
    const winnerScore = randomIntInclusive(1, 5);
    const loserScore = randomIntInclusive(0, winnerScore - 1);

    const scores = [
      { playerId: winnerId, scoreTotal: winnerScore, isWinner: true },
      { playerId: loserId, scoreTotal: loserScore, isWinner: false },
    ];

    return { scores, winnerId };
  };

  const completeMatchWithRandomScores = async (
    match: MatchForCompletion,
    now: Date,
    options: { shouldAdvance: boolean; tournamentId?: string }
  ): Promise<void> => {
    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      return;
    }

    const playerIds = getMatchPlayerIds(match);
    if (playerIds.length < 2) {
      return;
    }

    const [firstId, secondId] = playerIds;
    if (!firstId || !secondId) {
      return;
    }

    const { scores, winnerId } = buildRandomMatchScores(firstId, secondId);
    const timestamps: { startedAt?: Date; completedAt?: Date } = {
      startedAt: match.startedAt ?? now,
      completedAt: now,
    };

    await tournamentModel.completeMatch(match.id, scores, winnerId, timestamps);

    if (match.targetId) {
      await tournamentModel.finishMatchAndReleaseTarget(
        match.id,
        match.targetId,
        MatchStatus.COMPLETED,
        timestamps
      );
    }

    if (options.shouldAdvance && options.tournamentId) {
      await advanceBracketIfReady(match.id, options.tournamentId);
    }
  };

  const updateMatchStatus = async (
    tournamentId: string,
    matchId: string,
    status: MatchStatus,
    targetId?: string
  ): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(matchId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await tournamentModel.getMatchById(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    ensureValidMatchTransition(match.status as MatchStatus, status);

    const now = new Date();
    if (status === MatchStatus.IN_PROGRESS) {
      if (match.bracketId && tournament.status !== TournamentStatus.LIVE) {
        throw new AppError(
          'Bracket matches can only start when the tournament is live',
          400,
          'BRACKET_MATCH_NOT_LIVE'
        );
      }
      await startMatchWithTarget(tournament, matchId, match, targetId, tournamentId, now);
      return;
    }

    if (status === MatchStatus.COMPLETED || status === MatchStatus.CANCELLED) {
      await finalizeMatchStatus(matchId, match, status, now);
      return;
    }

    await tournamentModel.updateMatchStatus(matchId, status, {});
  };

  const startMatchWithTarget = async (
    tournament: Tournament,
    matchId: string,
    match: NonNullable<Awaited<ReturnType<TournamentModel['getMatchById']>>>,
    targetId: string | undefined,
    tournamentId: string,
    now: Date
  ): Promise<void> => {
    const targetToUse = await ensureTargetForMatchStart(match, targetId, tournamentId);

    if (match.poolId) {
      await ensurePoolStageInProgress(matchId);
    }

    await tournamentModel.startMatchWithTarget(matchId, targetToUse, now);
    await emitMatchStartedNotification(tournament, matchId);
  };

  const finalizeMatchStatus = async (
    matchId: string,
    match: NonNullable<Awaited<ReturnType<TournamentModel['getMatchById']>>>,
    status: MatchStatus,
    now: Date
  ): Promise<void> => {
    const timestamps = buildMatchCompletionTimestamps(match, status, now);
    if (match.targetId) {
      await tournamentModel.finishMatchAndReleaseTarget(
        matchId,
        match.targetId,
        status,
        timestamps
      );
      return;
    }

    await tournamentModel.updateMatchStatus(matchId, status, timestamps);
  };

  const buildMatchCompletionTimestamps = (
    match: NonNullable<Awaited<ReturnType<TournamentModel['getMatchById']>>>,
    status: MatchStatus,
    now: Date
  ): { startedAt?: Date; completedAt?: Date } => {
    const timestamps: { startedAt?: Date; completedAt?: Date } = { completedAt: now };
    if (!match.startedAt && status === MatchStatus.COMPLETED) {
      timestamps.startedAt = now;
    }
    return timestamps;
  };

  const ensureValidMatchTransition = (currentStatus: MatchStatus, nextStatus: MatchStatus) => {
    const validTransitions: Record<MatchStatus, MatchStatus[]> = {
      [MatchStatus.SCHEDULED]: [MatchStatus.IN_PROGRESS, MatchStatus.CANCELLED],
      [MatchStatus.IN_PROGRESS]: [MatchStatus.COMPLETED, MatchStatus.CANCELLED],
      [MatchStatus.COMPLETED]: [],
      [MatchStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(nextStatus)) {
      throw new AppError(
        `Invalid match status transition from ${currentStatus} to ${nextStatus}`,
        400,
        'INVALID_MATCH_STATUS_TRANSITION'
      );
    }
  };

  const ensureTargetForMatchStart = async (
    match: Awaited<ReturnType<TournamentModel['getMatchById']>>,
    targetId: string | undefined,
    tournamentId: string
  ): Promise<string> => {
    const targetToUse = resolveTargetSelection(match, targetId);
    const target = await tournamentModel.getTargetById(targetToUse);
    ensureTargetExistsForTournament(target, tournamentId);
    await ensureTargetAvailability(target);
    return targetToUse;
  };

  const resolveTargetSelection = (
    match: Awaited<ReturnType<TournamentModel['getMatchById']>>,
    targetId: string | undefined
  ): string => {
    const targetToUse = match?.targetId ?? targetId;
    if (!targetToUse) {
      throw new AppError('Target must be selected before starting a match', 400, 'TARGET_REQUIRED');
    }
    return targetToUse;
  };

  const ensureTargetExistsForTournament = (
    target: Awaited<ReturnType<TournamentModel['getTargetById']>>,
    tournamentId: string
  ): void => {
    if (target?.tournamentId !== tournamentId) {
      throw new AppError('Target not found', 404, 'TARGET_NOT_FOUND');
    }
  };

  const ensureTargetAvailability = async (
    target: Awaited<ReturnType<TournamentModel['getTargetById']>>
  ): Promise<void> => {
    if (!target) {
      throw new AppError('Target not found', 404, 'TARGET_NOT_FOUND');
    }
    if (target.status === TargetStatus.IN_USE) {
      await releaseStaleTargetUsage(target);
      return;
    }
    if (target.status !== TargetStatus.AVAILABLE) {
      throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
    }
  };

  const releaseStaleTargetUsage = async (
    // eslint-disable-next-line unicorn/no-null
    target: { id: string; currentMatchId?: string | null }
  ): Promise<void> => {
    if (!target.currentMatchId) {
      await tournamentModel.setTargetAvailable(target.id);
      return;
    }

    const currentMatch = await tournamentModel.getMatchById(target.currentMatchId);
    if (currentMatch?.status === MatchStatus.IN_PROGRESS) {
      throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
    }

    if (currentMatch && (currentMatch.status === MatchStatus.COMPLETED || currentMatch.status === MatchStatus.CANCELLED)) {
      await tournamentModel.finishMatchAndReleaseTarget(
        target.currentMatchId,
        target.id,
        currentMatch.status as MatchStatus,
        { completedAt: currentMatch.completedAt ?? new Date() }
      );
      return;
    }

    await tournamentModel.setTargetAvailable(target.id);
  };

  const emitMatchStartedNotification = async (tournament: Tournament, matchId: string): Promise<void> => {
    const webSocketService = getWebSocketService();
    if (!webSocketService) {
      return;
    }

    const matchDetails = await tournamentModel.getMatchDetailsForNotification(matchId);
    if (!matchDetails) {
      return;
    }

    const players = (matchDetails.playerMatches ?? []).map((pm) => {
      const summary: { id?: string; firstName?: string; lastName?: string; surname?: string; teamName?: string } = {
        id: pm.player?.id ?? pm.playerId,
        firstName: pm.player?.firstName,
        lastName: pm.player?.lastName,
      };
      if (pm.player?.surname) {
        summary.surname = pm.player.surname;
      }
      if (pm.player?.teamName) {
        summary.teamName = pm.player.teamName;
      }
      return summary;
    });

    const matchPayload = matchDetails.pool
      ? {
          source: 'pool' as const,
          matchNumber: matchDetails.matchNumber,
          roundNumber: matchDetails.roundNumber,
          stageNumber: matchDetails.pool.poolStage?.stageNumber,
          poolNumber: matchDetails.pool.poolNumber,
        }
      : {
          source: 'bracket' as const,
          matchNumber: matchDetails.matchNumber,
          roundNumber: matchDetails.roundNumber,
          // eslint-disable-next-line unicorn/no-null
          bracketName: matchDetails.bracket?.name ?? null,
        };

    const target = matchDetails.target
      ? {
          id: matchDetails.target.id,
          targetNumber: matchDetails.target.targetNumber,
          ...(matchDetails.target.targetCode ? { targetCode: matchDetails.target.targetCode } : {}),
          // eslint-disable-next-line unicorn/no-null
          name: matchDetails.target.name ?? null,
        }
      : undefined;

    await webSocketService.emitMatchStarted({
      matchId,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      ...(matchDetails.startedAt ? { startedAt: matchDetails.startedAt.toISOString() } : {}),
      ...(target ? { target } : {}),
      match: matchPayload,
      players,
    });
  };

  const ensurePoolStageInProgress = async (matchId: string): Promise<void> => {
    const poolStageId = await tournamentModel.getMatchPoolStageId(matchId);
    if (!poolStageId) {
      return;
    }
    const poolStage = await tournamentModel.getPoolStageById(poolStageId);
    if (poolStage && poolStage.status !== StageStatus.IN_PROGRESS) {
      await tournamentModel.updatePoolStage(poolStageId, { status: StageStatus.IN_PROGRESS });
    }
  };

  const completeMatch = async (
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(matchId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await tournamentModel.getMatchWithPlayerMatches(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new AppError('Match must be in progress to complete', 400, 'MATCH_NOT_IN_PROGRESS');
    }

    const participantIds = new Set(match.playerMatches.map((pm) => pm.playerId));
    if (scores.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }

    const invalidScore = scores.find((score) => !participantIds.has(score.playerId));
    if (invalidScore) {
      throw new AppError('Invalid player score entry', 400, 'MATCH_SCORE_INVALID_PLAYER');
    }

    const normalizedScores = scores
      .filter((score) => participantIds.has(score.playerId))
      .map((score) => ({
        playerId: score.playerId,
        scoreTotal: score.scoreTotal,
      }));

    const sorted = [...normalizedScores].sort((a, b) => b.scoreTotal - a.scoreTotal);
    if (sorted.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    const [first, second] = sorted;
    if (!first || !second) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    if (first.scoreTotal === second.scoreTotal) {
      throw new AppError('Match cannot end in a tie', 400, 'MATCH_SCORE_TIED');
    }

    const winnerId = first.playerId;
    const resultScores = normalizedScores.map((score) => ({
      ...score,
      isWinner: score.playerId === winnerId,
    }));

    const now = new Date();
    const timestamps: { startedAt?: Date; completedAt?: Date } = {
      completedAt: now,
    };
    if (!match.startedAt) {
      timestamps.startedAt = now;
    }

    await tournamentModel.completeMatch(matchId, resultScores, winnerId, timestamps);

    if (match.targetId) {
      await tournamentModel.finishMatchAndReleaseTarget(
        matchId,
        match.targetId,
        MatchStatus.COMPLETED,
        timestamps
      );
    }

    await advanceBracketIfReady(matchId, tournamentId);
  };

  const updateCompletedMatchScores = async (
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(matchId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const match = await tournamentModel.getMatchWithPlayerMatches(matchId);
    if (match?.tournamentId !== tournamentId) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    if (match.status !== MatchStatus.COMPLETED) {
      throw new AppError('Match must be completed to edit scores', 400, 'MATCH_NOT_COMPLETED');
    }

    const participantIds = new Set(match.playerMatches.map((pm) => pm.playerId));
    if (scores.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }

    const invalidScore = scores.find((score) => !participantIds.has(score.playerId));
    if (invalidScore) {
      throw new AppError('Invalid player score entry', 400, 'MATCH_SCORE_INVALID_PLAYER');
    }

    const normalizedScores = scores
      .filter((score) => participantIds.has(score.playerId))
      .map((score) => ({
        playerId: score.playerId,
        scoreTotal: score.scoreTotal,
      }));

    const sorted = [...normalizedScores].sort((a, b) => b.scoreTotal - a.scoreTotal);
    if (sorted.length < 2) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    const [first, second] = sorted;
    if (!first || !second) {
      throw new AppError('Match requires two scores', 400, 'MATCH_SCORE_INCOMPLETE');
    }
    if (first.scoreTotal === second.scoreTotal) {
      throw new AppError('Match cannot end in a tie', 400, 'MATCH_SCORE_TIED');
    }

    const winnerId = first.playerId;
    const resultScores = normalizedScores.map((score) => ({
      ...score,
      isWinner: score.playerId === winnerId,
    }));

    await tournamentModel.updateMatchScores(matchId, resultScores, winnerId);

    if (match.targetId) {
      const target = await tournamentModel.getTargetById(match.targetId);
      if (target?.currentMatchId === matchId && target.status === TargetStatus.IN_USE) {
        await tournamentModel.finishMatchAndReleaseTarget(
          matchId,
          match.targetId,
          MatchStatus.COMPLETED,
          { completedAt: new Date() }
        );
      }
    }

    await advanceBracketIfReady(matchId, tournamentId);
  };

  const advanceBracketIfReady = async (matchId: string, tournamentId: string): Promise<void> => {
    const match = await tournamentModel.getMatchById(matchId);
    if (!match?.bracketId) {
      return;
    }

    const bracket = await tournamentModel.getBracketById(match.bracketId);
    if (bracket?.tournamentId !== tournamentId) {
      return;
    }

    const totalRounds = await ensureBracketTotalRounds(bracket);
    const roundNumber = match.roundNumber || 1;

    if (await tryCompleteFinalRound(bracket, roundNumber, totalRounds, tournamentId)) {
      return;
    }

    const winnerId = match.winnerId;
    if (!winnerId) {
      return;
    }

    await advanceWinnerToNextRound(bracket, match, winnerId, roundNumber, tournamentId);
  };

  const ensureBracketTotalRounds = async (
    bracket: NonNullable<Awaited<ReturnType<TournamentModel['getBracketById']>>>
  ) => {
    const entryCount = await tournamentModel.getBracketEntryCount(bracket.id);
    const bracketSize = Math.max(2, nextPowerOfTwo(entryCount));
    const computedRounds = Math.max(1, Math.log2(bracketSize));
    const totalRounds = Math.max(bracket.totalRounds || 0, computedRounds);
    if (totalRounds !== bracket.totalRounds) {
      await tournamentModel.updateBracket(bracket.id, { totalRounds });
    }
    return totalRounds;
  };

  const tryCompleteFinalRound = async (
    bracket: NonNullable<Awaited<ReturnType<TournamentModel['getBracketById']>>>,
    roundNumber: number,
    totalRounds: number,
    tournamentId: string
  ): Promise<boolean> => {
    if (roundNumber < totalRounds) {
      return false;
    }

    const roundMatches = await tournamentModel.getBracketMatchesByRound(bracket.id, roundNumber);
    const allCompleted = roundMatches.length > 0
      && roundMatches.every((item) => item.status === MatchStatus.COMPLETED);
    if (!allCompleted) {
      return true;
    }

    await tournamentModel.updateBracket(bracket.id, {
      status: BracketStatus.COMPLETED,
      completedAt: new Date(),
    });
    await tryFinishTournament(tournamentId);
    return true;
  };

  const advanceWinnerToNextRound = async (
    bracket: NonNullable<Awaited<ReturnType<TournamentModel['getBracketById']>>>,
    match: NonNullable<Awaited<ReturnType<TournamentModel['getMatchById']>>>,
    winnerId: string,
    roundNumber: number,
    tournamentId: string
  ): Promise<void> => {
    const nextRound = roundNumber + 1;
    const roundMatches = await tournamentModel.getBracketMatchesByRound(bracket.id, roundNumber);
    const siblingMatchNumber = match.matchNumber % 2 === 1
      ? match.matchNumber + 1
      : match.matchNumber - 1;
    const sibling = roundMatches.find((item) => item.matchNumber === siblingMatchNumber);

    const nextRoundMatchNumber = Math.ceil(match.matchNumber / 2);
    const nextRoundMatches = await tournamentModel.getBracketMatchesByRoundWithPlayers(bracket.id, nextRound);
    const existingNextMatch = nextRoundMatches.find((item) => item.matchNumber === nextRoundMatchNumber);
    const playerPosition = match.matchNumber % 2 === 1 ? 1 : 2;

    if (sibling?.status !== MatchStatus.COMPLETED || !sibling?.winnerId) {
      await applySingleWinnerAdvance(
        tournamentId,
        bracket.id,
        existingNextMatch,
        nextRound,
        nextRoundMatchNumber,
        winnerId,
        playerPosition
      );
      return;
    }

    const firstMatch = match.matchNumber < sibling.matchNumber ? match : sibling;
    const secondMatch = match.matchNumber < sibling.matchNumber ? sibling : match;
    if (!firstMatch.winnerId || !secondMatch.winnerId) {
      return;
    }

    await applyPairAdvance(
      tournamentId,
      bracket.id,
      existingNextMatch,
      nextRound,
      nextRoundMatchNumber,
      [firstMatch.winnerId, secondMatch.winnerId]
    );
  };

  const applySingleWinnerAdvance = async (
    tournamentId: string,
    bracketId: string,
    existingNextMatch: Awaited<ReturnType<TournamentModel['getBracketMatchesByRoundWithPlayers']>>[number] | undefined,
    nextRound: number,
    nextRoundMatchNumber: number,
    winnerId: string,
    playerPosition: number
  ): Promise<void> => {
    if (existingNextMatch) {
      if (existingNextMatch.status === MatchStatus.SCHEDULED) {
        await tournamentModel.setBracketMatchPlayerPosition(existingNextMatch.id, winnerId, playerPosition);
      }
      await setBracketInProgress(bracketId);
      return;
    }

    await tournamentModel.createBracketMatchWithSlots(
      tournamentId,
      bracketId,
      nextRound,
      nextRoundMatchNumber,
      [{ playerId: winnerId, playerPosition }]
    );
    await setBracketInProgress(bracketId);
  };

  const applyPairAdvance = async (
    tournamentId: string,
    bracketId: string,
    existingNextMatch: Awaited<ReturnType<TournamentModel['getBracketMatchesByRoundWithPlayers']>>[number] | undefined,
    nextRound: number,
    nextRoundMatchNumber: number,
    playerIds: [string, string]
  ): Promise<void> => {
    if (existingNextMatch) {
      if (existingNextMatch.status === MatchStatus.SCHEDULED && (existingNextMatch.playerMatches?.length ?? 0) < 2) {
        await tournamentModel.setBracketMatchPlayers(existingNextMatch.id, playerIds);
      }
      await setBracketInProgress(bracketId);
      return;
    }

    await tournamentModel.createBracketMatches(tournamentId, bracketId, [
      {
        roundNumber: nextRound,
        matchNumber: nextRoundMatchNumber,
        playerIds,
      },
    ]);
    await setBracketInProgress(bracketId);
  };

  const setBracketInProgress = async (bracketId: string): Promise<void> => {
    await tournamentModel.updateBracket(bracketId, { status: BracketStatus.IN_PROGRESS });
  };

  const tryFinishTournament = async (tournamentId: string): Promise<void> => {
    const tournament = await tournamentModel.findById(tournamentId);
    if (tournament?.status !== TournamentStatus.LIVE) {
      return;
    }

    const poolStages = await tournamentModel.getPoolStages(tournamentId);
    const brackets = await tournamentModel.getBrackets(tournamentId);

    const poolsComplete = poolStages.every((stage) => stage.status === StageStatus.COMPLETED);
    const bracketsComplete = brackets.every((bracket) => bracket.status === BracketStatus.COMPLETED);

    if (poolsComplete && bracketsComplete) {
      await transitionTournamentStatus(tournamentId, TournamentStatus.FINISHED);
    }
  };

  return {
    completeMatchWithRandomScores,
    updateMatchStatus,
    completeMatch,
    updateCompletedMatchScores,
  };
};
