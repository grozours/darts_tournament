import { randomInt } from 'node:crypto';

import type { TournamentModel } from '../../models/tournament-model';
import type { TournamentLiveView } from '../../models/tournament-model/helpers';
import { AppError } from '../../middleware/error-handler';
import { getWebSocketService } from '../../websocket/server';
import {
  BracketStatus,
  MatchStatus,
  StageStatus,
  TargetStatus,
  TournamentFormat,
  TournamentStatus,
} from '../../../../shared/src/types';
import type { Tournament } from '../../../../shared/src/types';
import { nextPowerOfTwo } from './number-helpers';
import { getBracketRoundMatchFormatKey } from './match-format-presets';
import { getMatchFormatTooltip } from './match-format-change-notifications';
import { normalizeMatchScores, resolveWinnerAndResultScores } from './match-score-policy';
import { assertValidMatchTransition, ensureTargetForMatchStart } from './target-lifecycle';

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
  recomputeDoubleStageProgression?: (tournamentId: string, stageId: string) => Promise<void>;
  getCachedTournamentLiveView?: (tournamentId: string) => Promise<TournamentLiveView | undefined>;
};

const randomIntInclusive = (min: number, max: number): number =>
  randomInt(min, max + 1);

export const createMatchHandlers = (context: MatchHandlerContext) => {
  const {
    tournamentModel,
    validateUUID,
    transitionTournamentStatus,
    recomputeDoubleStageProgression,
    getCachedTournamentLiveView,
  } = context;

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

  const resetMatchToScheduled = async (
    matchId: string,
    match: NonNullable<Awaited<ReturnType<TournamentModel['getMatchById']>>>,
    now: Date
  ): Promise<void> => {
    if (match.targetId) {
      await tournamentModel.resetMatchToScheduled(matchId, match.targetId, now);
      return;
    }
    await tournamentModel.resetMatchToScheduled(matchId, undefined, now);
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

    assertValidMatchTransition(match.status as MatchStatus, status);

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
      await finalizeMatchStatus(tournamentId, matchId, match, status, now);
      return;
    }

    if (status === MatchStatus.SCHEDULED) {
      await resetMatchToScheduled(matchId, match, now);
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
    const targetToUse = await ensureTargetForMatchStart(match, targetId, tournamentId, {
      getTargetById: (candidateTargetId) => tournamentModel.getTargetById(candidateTargetId),
      getBracketTargetIds: (bracketId) => tournamentModel.getBracketTargetIds(bracketId),
      getMatchById: (candidateMatchId) => tournamentModel.getMatchById(candidateMatchId),
      setTargetAvailable: (candidateTargetId) => tournamentModel.setTargetAvailable(candidateTargetId),
      finishMatchAndReleaseTarget: (candidateMatchId, candidateTargetId, status_, timestamps) =>
        tournamentModel.finishMatchAndReleaseTarget(candidateMatchId, candidateTargetId, status_, timestamps),
    });
    await ensurePlayersAvailableForMatchStart(tournamentId, matchId);

    if (match.poolId) {
      await ensurePoolStageInProgress(matchId);
    }

    if (match.bracketId) {
      await ensureBracketPrerequisitesCompleted(tournamentId, match.bracketId);
    }

    await tournamentModel.startMatchWithTarget(matchId, targetToUse, now);
    await emitMatchStartedNotification(tournament, matchId);
  };

  const ensurePlayersAvailableForMatchStart = async (
    tournamentId: string,
    matchId: string
  ): Promise<void> => {
    const matchWithPlayers = await tournamentModel.getMatchWithPlayerMatches(matchId);
    if (!matchWithPlayers) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    const playerIds = getMatchPlayerIds(matchWithPlayers);
    if (playerIds.length === 0) {
      return;
    }

    const liveView = getCachedTournamentLiveView
      ? await getCachedTournamentLiveView(tournamentId)
      : await tournamentModel.findLiveView(tournamentId);
    if (!liveView) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    type LiveViewPoolLike = {
      id: string;
      assignments?: Array<{ player?: { id?: string } }>;
      matches?: Array<{
        id: string;
        status: string;
        playerMatches?: Array<{ playerId?: string | null; player?: { id?: string } }>;
      }>;
    };

    const collectActivePlayersFromMatches = (
      candidateMatches: Array<{
        id: string;
        status: string;
        playerMatches?: Array<{ playerId?: string | null; player?: { id?: string } }>;
      }> | undefined,
      activePlayerIds: Set<string>
    ) => {
      for (const candidateMatch of candidateMatches ?? []) {
        if (candidateMatch.id === matchId || candidateMatch.status !== MatchStatus.IN_PROGRESS) {
          continue;
        }
        for (const playerMatch of candidateMatch.playerMatches ?? []) {
          const playerId = playerMatch.playerId ?? playerMatch.player?.id;
          if (playerId) {
            activePlayerIds.add(playerId);
          }
        }
      }
    };

    const collectLiveViewActivePlayersAndTargetPool = () => {
      const activePlayerIds = new Set<string>();
      let targetPool: LiveViewPoolLike | undefined;

      for (const stage of liveView.poolStages ?? []) {
        for (const pool of stage.pools ?? []) {
          if (!targetPool && pool.id === matchWithPlayers.poolId) {
            targetPool = pool as LiveViewPoolLike;
          }
          collectActivePlayersFromMatches(pool.matches, activePlayerIds);
        }
      }

      for (const bracket of liveView.brackets ?? []) {
        collectActivePlayersFromMatches(bracket.matches, activePlayerIds);
      }

      return { activePlayerIds, targetPool };
    };

    const getPoolPlayerIds = (pool: LiveViewPoolLike) => {
      const assignmentPlayerIds = new Set(
        (pool.assignments ?? [])
          .map((assignment) => assignment.player?.id)
          .filter((playerId): playerId is string => Boolean(playerId))
      );

      if (assignmentPlayerIds.size > 0) {
        return assignmentPlayerIds;
      }

      return new Set(
        (pool.matches ?? [])
          .flatMap((candidateMatch) => candidateMatch.playerMatches ?? [])
          .map((playerMatch) => playerMatch.playerId ?? playerMatch.player?.id)
          .filter((playerId): playerId is string => Boolean(playerId))
      );
    };

    const ensurePoolConcurrentLimitNotReached = (pool: LiveViewPoolLike) => {
      const poolPlayerIds = getPoolPlayerIds(pool);
      const maxConcurrentMatches = Math.floor(poolPlayerIds.size / 2);
      const inProgressMatchesInPool = (pool.matches ?? []).filter((candidateMatch) => (
        candidateMatch.id !== matchId && candidateMatch.status === MatchStatus.IN_PROGRESS
      )).length;

      if (maxConcurrentMatches > 0 && inProgressMatchesInPool >= maxConcurrentMatches) {
        throw new AppError(
          `Pool concurrent match limit reached (${maxConcurrentMatches})`,
          400,
          'POOL_MAX_CONCURRENT_MATCHES_REACHED'
        );
      }
    };

    const { activePlayerIds, targetPool } = collectLiveViewActivePlayersAndTargetPool();

    const conflictingPlayer = playerIds.find((playerId) => activePlayerIds.has(playerId));
    if (conflictingPlayer) {
      throw new AppError(
        'A player is already in progress in another match',
        400,
        'PLAYER_ALREADY_IN_PROGRESS'
      );
    }

    if (targetPool) {
      ensurePoolConcurrentLimitNotReached(targetPool);
    }
  };

  const ensureBracketPrerequisitesCompleted = async (
    tournamentId: string,
    bracketId: string
  ): Promise<void> => {
    const poolStages = await tournamentModel.getPoolStages(tournamentId);
    const sourceStages = poolStages.filter((stage) => {
      const destinations = Array.isArray(stage.rankingDestinations)
        ? stage.rankingDestinations as Array<{ destinationType?: string; bracketId?: string }>
        : [];

      return destinations.some((destination) => (
        destination.destinationType === 'BRACKET' && destination.bracketId === bracketId
      ));
    });

    if (sourceStages.length === 0) {
      return;
    }

    const allSourcesCompleted = sourceStages.every((stage) => stage.status === StageStatus.COMPLETED);
    if (!allSourcesCompleted) {
      throw new AppError(
        'Bracket matches cannot start before source pool stages are completed',
        400,
        'BRACKET_PREREQUISITES_NOT_COMPLETED'
      );
    }
  };

  const finalizeMatchStatus = async (
    tournamentId: string,
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
    } else {
      await tournamentModel.updateMatchStatus(matchId, status, timestamps);
    }

    await emitMatchFinishedNotification(tournamentId, matchId, status, timestamps.completedAt ?? now);
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

  const emitMatchStartedNotification = async (tournament: Tournament, matchId: string): Promise<void> => {
    const webSocketService = getWebSocketService();
    if (!webSocketService) {
      return;
    }

    const matchDetails = await tournamentModel.getMatchDetailsForNotification(matchId);
    if (!matchDetails) {
      return;
    }

    type PlayerMatchRow = {
      playerId?: string | null;
      player?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        surname?: string | null;
        teamName?: string | null;
      };
    };
    const players = (matchDetails.playerMatches ?? []).map((pm: PlayerMatchRow) => {
      const summary: { id?: string; firstName?: string; lastName?: string; surname?: string; teamName?: string } = {};
      const playerId = pm.player?.id ?? pm.playerId ?? undefined;
      if (playerId !== undefined) {
        summary.id = playerId;
      }
      if (pm.player?.firstName !== undefined) {
        summary.firstName = pm.player.firstName;
      }
      if (pm.player?.lastName !== undefined) {
        summary.lastName = pm.player.lastName;
      }
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
          poolId: matchDetails.pool.id,
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

    const matchFormatKey = typeof matchDetails.matchFormatKey === 'string' && matchDetails.matchFormatKey.trim()
      ? matchDetails.matchFormatKey
      : undefined;

    await webSocketService.emitMatchStarted({
      matchId,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      ...(matchDetails.startedAt ? { startedAt: matchDetails.startedAt.toISOString() } : {}),
      ...(matchFormatKey
        ? {
            matchFormatKey,
            matchFormatTooltip: getMatchFormatTooltip(matchFormatKey),
          }
        : {}),
      ...(target ? { target } : {}),
      match: matchPayload,
      players,
    });
  };

  const emitMatchFinishedNotification = async (
    tournamentId: string,
    matchId: string,
    status: MatchStatus,
    finishedAt: Date
  ): Promise<void> => {
    if (status !== MatchStatus.COMPLETED && status !== MatchStatus.CANCELLED) {
      return;
    }

    const webSocketService = getWebSocketService();
    if (!webSocketService) {
      return;
    }

    const matchDetails = await tournamentModel.getMatchDetailsForNotification(matchId);
    if (!matchDetails) {
      return;
    }

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      return;
    }

    type PlayerMatchRow = {
      playerId?: string | null;
      player?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        surname?: string | null;
        teamName?: string | null;
      };
      scoreTotal?: number | null;
      legsWon?: number | null;
      setsWon?: number | null;
      isWinner?: boolean | null;
    };
    const players = (matchDetails.playerMatches ?? []).map((pm: PlayerMatchRow) => {
      const summary: {
        id?: string;
        firstName?: string;
        lastName?: string;
        surname?: string;
        teamName?: string;
        scoreTotal?: number | null;
        legsWon?: number | null;
        setsWon?: number | null;
        isWinner?: boolean | null;
      } = {
        scoreTotal: pm.scoreTotal ?? null,
        legsWon: pm.legsWon ?? null,
        setsWon: pm.setsWon ?? null,
        isWinner: pm.isWinner ?? null,
      };
      const playerId = pm.player?.id ?? pm.playerId ?? undefined;
      if (playerId !== undefined) {
        summary.id = playerId;
      }
      if (pm.player?.firstName !== undefined) {
        summary.firstName = pm.player.firstName;
      }
      if (pm.player?.lastName !== undefined) {
        summary.lastName = pm.player.lastName;
      }
      if (pm.player?.surname) {
        summary.surname = pm.player.surname;
      }
      if (pm.player?.teamName) {
        summary.teamName = pm.player.teamName;
      }
      return summary;
    });

    const winner = players.find((player) => player.isWinner)
      ?? (matchDetails.winner
        ? {
            id: matchDetails.winner.id,
            firstName: matchDetails.winner.firstName,
            lastName: matchDetails.winner.lastName,
          }
        : null);

    const matchPayload = matchDetails.pool
      ? {
          source: 'pool' as const,
          matchNumber: matchDetails.matchNumber,
          roundNumber: matchDetails.roundNumber,
          stageNumber: matchDetails.pool.poolStage?.stageNumber,
          poolNumber: matchDetails.pool.poolNumber,
          poolId: matchDetails.pool.id,
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

    await webSocketService.emitMatchFinished({
      event: status === MatchStatus.COMPLETED ? 'completed' : 'cancelled',
      matchId,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      finishedAt: finishedAt.toISOString(),
      ...(target ? { target } : {}),
      match: matchPayload,
      players,
      winner,
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

  const recomputeDoubleStageIfNeeded = async (tournament: Tournament, matchId: string): Promise<void> => {
    if (!recomputeDoubleStageProgression) {
      return;
    }
    if (tournament.format !== TournamentFormat.DOUBLE) {
      return;
    }

    const poolStageId = await tournamentModel.getMatchPoolStageId(matchId);
    if (!poolStageId) {
      return;
    }

    const stage = await tournamentModel.getPoolStageById(poolStageId);
    if (!stage || stage.stageNumber > 3) {
      return;
    }

    if (!tournament.doubleStageEnabled) {
      const stages = await tournamentModel.getPoolStages(tournament.id);
      const hasDoubleStages = stages.some((item) => item.stageNumber === 2 || item.stageNumber === 3);
      if (!hasDoubleStages) {
        return;
      }
    }

    await recomputeDoubleStageProgression(tournament.id, poolStageId);
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

    const normalizedScores = normalizeMatchScores(match, scores);
    const { winnerId, resultScores } = resolveWinnerAndResultScores(normalizedScores);

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
    await recomputeDoubleStageIfNeeded(tournament, matchId);
  };

  const saveMatchScores = async (
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

    const canUpdateScores = match.status === MatchStatus.COMPLETED || match.status === MatchStatus.IN_PROGRESS;
    if (!canUpdateScores) {
      throw new AppError('Match must be in progress or completed to edit scores', 400, 'MATCH_STATUS_NOT_EDITABLE');
    }

    const normalizedScores = normalizeMatchScores(match, scores);

    if (match.status === MatchStatus.IN_PROGRESS) {
      await tournamentModel.updateInProgressMatchScores(matchId, normalizedScores);
      return;
    }

    const { winnerId, resultScores } = resolveWinnerAndResultScores(normalizedScores);

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
    await recomputeDoubleStageIfNeeded(tournament, matchId);
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
        bracket,
        tournamentId,
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
      bracket,
      tournamentId,
      existingNextMatch,
      nextRound,
      nextRoundMatchNumber,
      [firstMatch.winnerId, secondMatch.winnerId]
    );
  };

  const applySingleWinnerAdvance = async (
    bracket: NonNullable<Awaited<ReturnType<TournamentModel['getBracketById']>>>,
    tournamentId: string,
    existingNextMatch: Awaited<ReturnType<TournamentModel['getBracketMatchesByRoundWithPlayers']>>[number] | undefined,
    nextRound: number,
    nextRoundMatchNumber: number,
    winnerId: string,
    playerPosition: number
  ): Promise<void> => {
    const matchFormatKey = getBracketRoundMatchFormatKey(bracket.roundMatchFormats, nextRound);

    if (existingNextMatch) {
      if (existingNextMatch.status === MatchStatus.SCHEDULED) {
        await tournamentModel.setBracketMatchPlayerPosition(existingNextMatch.id, winnerId, playerPosition);
      }
      await setBracketInProgress(bracket.id);
      return;
    }

    await tournamentModel.createBracketMatchWithSlots(
      tournamentId,
      bracket.id,
      nextRound,
      nextRoundMatchNumber,
      [{ playerId: winnerId, playerPosition }],
      matchFormatKey
    );
    await setBracketInProgress(bracket.id);
  };

  const applyPairAdvance = async (
    bracket: NonNullable<Awaited<ReturnType<TournamentModel['getBracketById']>>>,
    tournamentId: string,
    existingNextMatch: Awaited<ReturnType<TournamentModel['getBracketMatchesByRoundWithPlayers']>>[number] | undefined,
    nextRound: number,
    nextRoundMatchNumber: number,
    playerIds: [string, string]
  ): Promise<void> => {
    const matchFormatKey = getBracketRoundMatchFormatKey(bracket.roundMatchFormats, nextRound);

    if (existingNextMatch) {
      if (existingNextMatch.status === MatchStatus.SCHEDULED && (existingNextMatch.playerMatches?.length ?? 0) < 2) {
        await tournamentModel.setBracketMatchPlayers(existingNextMatch.id, playerIds);
      }
      await setBracketInProgress(bracket.id);
      return;
    }

    await tournamentModel.createBracketMatches(tournamentId, bracket.id, [
      {
        roundNumber: nextRound,
        matchNumber: nextRoundMatchNumber,
        playerIds,
      },
    ], matchFormatKey);
    await setBracketInProgress(bracket.id);
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
    saveMatchScores,
  };
};
