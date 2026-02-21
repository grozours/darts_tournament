import type { TournamentModel } from '../../models/tournament-model';
import { AppError } from '../../middleware/error-handler';
import {
  BracketStatus,
  BracketType,
  TournamentStatus,
} from '../../../../shared/src/types';

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
    data: { name: string; bracketType: BracketType; totalRounds: number }
  ) => {
    validateUUID(tournamentId);
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    await ensureBracketsEditable(tournamentId, tournament.status);

    return await tournamentModel.createBracket(tournamentId, data);
  };

  const updateBracket = async (
    tournamentId: string,
    bracketId: string,
    data: BracketUpdateData
  ) => {
    validateUUID(tournamentId);
    validateUUID(bracketId);
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    await ensureBracketsEditable(tournamentId, tournament.status, bracketId);

    return await tournamentModel.updateBracket(bracketId, data);
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
