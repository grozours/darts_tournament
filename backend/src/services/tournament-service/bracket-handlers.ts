import type { Prisma } from '@prisma/client';
import type { TournamentModel } from '../../models/tournament-model';
import { AppError } from '../../middleware/error-handler';
import {
  BracketStatus,
  BracketType,
  MatchStatus,
  TournamentStatus,
} from '../../../../shared/src/types';
import { normalizeMatchFormatKey } from './match-format-presets';
import { emitMatchFormatChangedNotifications } from './match-format-change-notifications';

type MatchForCompletion = {
  id: string;
  status?: string | null;
  playerMatches?: Array<{ playerId?: string | null }> | null;
  targetId?: string | null;
  startedAt?: Date | null;
};

type BracketUpdateData = Partial<{
  name: string;
  bracketType: BracketType;
  totalRounds: number;
  roundMatchFormats: Record<string, unknown>;
  inParallelWith: string[];
  status: BracketStatus;
}>;

type BracketTargetsUpdateData = {
  targetIds: string[];
};

export type BracketHandlerContext = {
  tournamentModel: TournamentModel;
  validateUUID: (id: string) => void;
  completeMatchWithRandomScores: (
    match: MatchForCompletion,
    now: Date,
    options: { shouldAdvance: boolean; tournamentId?: string }
  ) => Promise<void>;
};

export const createBracketHandlers = (context: BracketHandlerContext) => {
  const { tournamentModel, validateUUID, completeMatchWithRandomScores } = context;

  const buildEmptyBracketMatches = (totalRounds: number) => {
    const matches: Array<{ roundNumber: number; matchNumber: number }> = [];
    for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
      const matchesInRound = 2 ** (totalRounds - roundNumber);
      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
        matches.push({ roundNumber, matchNumber: matchIndex + 1 });
      }
    }
    return matches;
  };

  const buildRoundMatchFormatMap = (
    roundMatchFormats: unknown,
    totalRounds: number
  ): Record<number, string> => {
    const formatMap: Record<number, string> = {};
    if (!roundMatchFormats || typeof roundMatchFormats !== 'object') {
      return formatMap;
    }

    for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
      const value = (roundMatchFormats as Record<string, unknown>)[String(roundNumber)];
      if (typeof value === 'string' && value.trim()) {
        formatMap[roundNumber] = value;
      }
    }

    return formatMap;
  };

  const collectChangedRounds = (
    previousByRound: Record<number, string>,
    nextByRound: Record<number, string>
  ): number[] => {
    const allRounds = new Set<number>([
      ...Object.keys(previousByRound).map(Number),
      ...Object.keys(nextByRound).map(Number),
    ]);
    return [...allRounds].filter((roundNumber) => previousByRound[roundNumber] !== nextByRound[roundNumber]);
  };

  const buildAffectedMatchesForRoundFormatChange = async (
    bracketId: string,
    changedRounds: number[],
    previousRoundFormatByRound: Record<number, string>,
    nextRoundFormatByRound: Record<number, string>
  ): Promise<Array<{ matchId: string; matchFormatKey: string }>> => {
    const affectedMatches: Array<{ matchId: string; matchFormatKey: string }> = [];

    for (const roundNumber of changedRounds) {
      const roundMatches = await tournamentModel.getBracketMatchesByRound(bracketId, roundNumber);
      for (const match of roundMatches) {
        if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.IN_PROGRESS) {
          continue;
        }
        const oldEffectiveKey = match.matchFormatKey ?? previousRoundFormatByRound[roundNumber];
        const newEffectiveKey = match.matchFormatKey ?? nextRoundFormatByRound[roundNumber];
        if (oldEffectiveKey === newEffectiveKey || !newEffectiveKey) {
          continue;
        }
        affectedMatches.push({ matchId: match.id, matchFormatKey: newEffectiveKey });
      }
    }

    return affectedMatches;
  };

  const notifyBracketRoundFormatChanges = async (
    tournamentId: string,
    bracketId: string,
    previousRoundFormatByRound: Record<number, string>,
    nextRoundFormatByRound: Record<number, string>
  ): Promise<void> => {
    const changedRounds = collectChangedRounds(previousRoundFormatByRound, nextRoundFormatByRound);
    const affectedMatches = await buildAffectedMatchesForRoundFormatChange(
      bracketId,
      changedRounds,
      previousRoundFormatByRound,
      nextRoundFormatByRound
    );

    await emitMatchFormatChangedNotifications(
      {
        findById: (id) => tournamentModel.findById(id),
        getMatchDetailsForNotification: (matchId) => tournamentModel.getMatchDetailsForNotification(matchId),
      },
      tournamentId,
      affectedMatches
    );
  };

  const normalizeRoundMatchFormats = (
    roundMatchFormats: unknown,
    errorCode: string
  ): Prisma.InputJsonValue | undefined => {
    if (roundMatchFormats === undefined || roundMatchFormats === null) {
      return undefined;
    }
    if (typeof roundMatchFormats !== 'object' || Array.isArray(roundMatchFormats)) {
      throw new AppError('Invalid bracket round match formats', 400, errorCode);
    }

    const normalized: Record<string, string> = {};
    for (const [roundNumber, matchFormatKey] of Object.entries(roundMatchFormats as Record<string, unknown>)) {
      const parsedRound = Number(roundNumber);
      if (!Number.isInteger(parsedRound) || parsedRound < 1) {
        throw new AppError('Invalid bracket round number', 400, errorCode);
      }
      const normalizedKey = normalizeMatchFormatKey(matchFormatKey);
      if (!normalizedKey) {
        throw new AppError('Invalid match format key', 400, errorCode);
      }
      normalized[String(parsedRound)] = normalizedKey;
    }

    return normalized as Prisma.InputJsonValue;
  };

  const normalizeParallelReferences = (
    value: unknown,
    errorCode: string
  ): Prisma.InputJsonValue | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new AppError('Invalid inParallelWith value', 400, errorCode);
    }

    const references = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    for (const reference of references) {
      if (!/^(stage:\d+|bracket:.+)$/i.test(reference)) {
        throw new AppError('Invalid inParallelWith reference', 400, errorCode);
      }
    }

    return [...new Set(references)] as Prisma.InputJsonValue;
  };

  const ensureBracketsEditable = async (
    tournamentId: string,
    status: TournamentStatus,
    bracketId?: string
  ): Promise<void> => {
    if (status === TournamentStatus.FINISHED) {
      throw new AppError(
        'Brackets cannot be modified for finished tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    const startedMatchCount = await tournamentModel.getStartedBracketMatchCount(tournamentId, bracketId);
    if (startedMatchCount > 0) {
      throw new AppError(
        'Brackets cannot be modified once bracket matches have started',
        400,
        'BRACKET_MATCHES_STARTED'
      );
    }
  };

  const completeBracketRoundWithRandomScores = async (
    tournamentId: string,
    bracketId: string,
    roundNumber: number
  ): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(bracketId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const bracket = await tournamentModel.getBracketById(bracketId);
    if (bracket?.tournamentId !== tournamentId) {
      throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
    }

    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
      throw new AppError('Invalid round number', 400, 'BRACKET_ROUND_INVALID');
    }

    const matches = await tournamentModel.getBracketMatchesByRoundWithPlayers(
      bracketId,
      roundNumber
    ) as MatchForCompletion[];
    if (matches.length === 0) {
      throw new AppError('Bracket round not found', 404, 'BRACKET_ROUND_NOT_FOUND');
    }

    const invalidMatch = matches.find((match) => (match.playerMatches?.length ?? 0) < 2);
    if (invalidMatch) {
      throw new AppError(
        'Bracket round has matches without two players',
        400,
        'BRACKET_ROUND_MATCH_INCOMPLETE'
      );
    }

    const now = new Date();
    for (const match of matches) {
      await completeMatchWithRandomScores(match, now, { shouldAdvance: true, tournamentId });
    }
  };

  const getBrackets = async (tournamentId: string) => {
    validateUUID(tournamentId);
    return await tournamentModel.getBrackets(tournamentId);
  };

  const createBracket = async (
    tournamentId: string,
    data: {
      name: string;
      bracketType: BracketType;
      totalRounds: number;
      roundMatchFormats?: Record<string, unknown>;
      inParallelWith?: string[];
    }
  ) => {
    validateUUID(tournamentId);
    const roundMatchFormats = normalizeRoundMatchFormats(
      data.roundMatchFormats,
      'BRACKET_ROUND_MATCH_FORMAT_INVALID'
    );
    const inParallelWith = normalizeParallelReferences(
      data.inParallelWith,
      'BRACKET_IN_PARALLEL_WITH_INVALID'
    );
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    await ensureBracketsEditable(tournamentId, tournament.status);

    const { roundMatchFormats: _roundMatchFormats, ...rest } = data;
    const bracket = await tournamentModel.createBracket(tournamentId, {
      ...rest,
      ...(roundMatchFormats === undefined ? {} : { roundMatchFormats }),
      ...(inParallelWith === undefined ? {} : { inParallelWith }),
    });

    if (bracket.totalRounds > 0) {
      const emptyMatches = buildEmptyBracketMatches(bracket.totalRounds);
      const matchFormatByRound = buildRoundMatchFormatMap(
        bracket.roundMatchFormats,
        bracket.totalRounds
      );
      await tournamentModel.createEmptyBracketMatches(
        tournamentId,
        bracket.id,
        emptyMatches,
        matchFormatByRound
      );
    }

    return bracket;
  };

  const updateBracket = async (
    tournamentId: string,
    bracketId: string,
    data: BracketUpdateData
  ) => {
    validateUUID(tournamentId);
    validateUUID(bracketId);
    const roundMatchFormats = normalizeRoundMatchFormats(
      data.roundMatchFormats,
      'BRACKET_ROUND_MATCH_FORMAT_INVALID'
    );
    const inParallelWith = data.inParallelWith === undefined
      ? undefined
      : normalizeParallelReferences(data.inParallelWith, 'BRACKET_IN_PARALLEL_WITH_INVALID');
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    const currentBracket = await tournamentModel.getBracketById(bracketId);
    if (currentBracket?.tournamentId !== tournamentId) {
      throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
    }
    const previousRoundFormatByRound = buildRoundMatchFormatMap(
      currentBracket.roundMatchFormats,
      currentBracket.totalRounds
    );

    await ensureBracketsEditable(tournamentId, tournament.status, bracketId);

    const { roundMatchFormats: _roundMatchFormats, ...rest } = data;
    const updatedBracket = await tournamentModel.updateBracket(bracketId, {
      ...rest,
      ...(data.roundMatchFormats === undefined ? {} : { roundMatchFormats: roundMatchFormats! }),
      ...(data.inParallelWith === undefined ? {} : { inParallelWith: inParallelWith ?? [] }),
    });

    if (data.roundMatchFormats !== undefined) {
      const nextRoundFormatByRound = buildRoundMatchFormatMap(
        updatedBracket.roundMatchFormats,
        updatedBracket.totalRounds
      );
      await notifyBracketRoundFormatChanges(
        tournamentId,
        bracketId,
        previousRoundFormatByRound,
        nextRoundFormatByRound
      );
    }

    return updatedBracket;
  };

  const deleteBracket = async (tournamentId: string, bracketId: string): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(bracketId);
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    await ensureBracketsEditable(tournamentId, tournament.status);

    await tournamentModel.deleteBracket(bracketId);
  };

  const updateBracketTargets = async (
    tournamentId: string,
    bracketId: string,
    data: BracketTargetsUpdateData
  ) => {
    validateUUID(tournamentId);
    validateUUID(bracketId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new AppError(
        'Bracket targets can only be updated for draft, open, signature, or live tournaments',
        400,
        'BRACKET_TARGETS_NOT_EDITABLE'
      );
    }

    const bracket = await tournamentModel.getBracketById(bracketId);
    if (bracket?.tournamentId !== tournamentId) {
      throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
    }

    const targetIds = Array.from(new Set(data.targetIds || [])).filter(Boolean);

    const tournamentTargets = await tournamentModel.getTargetsForTournament(tournamentId);
    const allowedTargets = new Set(tournamentTargets.map((target) => target.id));
    const invalidTargets = targetIds.filter((targetId) => !allowedTargets.has(targetId));
    if (invalidTargets.length > 0) {
      throw new AppError(
        'Targets must belong to the tournament',
        400,
        'BRACKET_TARGETS_INVALID',
        { invalidTargets }
      );
    }

    const conflicts = await tournamentModel.getBracketTargetConflicts(targetIds, bracketId);
    if (conflicts.length > 0) {
      throw new AppError(
        'Targets already assigned to another bracket',
        400,
        'BRACKET_TARGETS_CONFLICT',
        { conflicts }
      );
    }

    await tournamentModel.setBracketTargets(bracketId, targetIds);
    return await tournamentModel.getBracketById(bracketId);
  };

  const resetBracketMatches = async (tournamentId: string, bracketId: string): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(bracketId);

    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be reset for draft, open, signature, or live tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    const bracket = await tournamentModel.getBracketById(bracketId);
    if (bracket?.tournamentId !== tournamentId) {
      throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
    }

    await tournamentModel.resetBracketMatches(bracketId);
    await tournamentModel.updateBracket(bracketId, {
      status: BracketStatus.NOT_STARTED,
      // eslint-disable-next-line unicorn/no-null
      completedAt: null,
    });
  };

  return {
    completeBracketRoundWithRandomScores,
    getBrackets,
    createBracket,
    updateBracket,
    deleteBracket,
    updateBracketTargets,
    resetBracketMatches,
  };
};
