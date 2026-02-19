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

    const matches = await tournamentModel.getBracketMatchesByRoundWithPlayers(bracketId, roundNumber);
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

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

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

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    return await tournamentModel.updateBracket(bracketId, data);
  };

  const deleteBracket = async (tournamentId: string, bracketId: string): Promise<void> => {
    validateUUID(tournamentId);
    validateUUID(bracketId);
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (![TournamentStatus.DRAFT, TournamentStatus.OPEN, TournamentStatus.SIGNATURE].includes(tournament.status)) {
      throw new AppError(
        'Brackets can only be modified for draft, open, or signature tournaments',
        400,
        'BRACKET_NOT_EDITABLE'
      );
    }

    await tournamentModel.deleteBracket(bracketId);
  };

  return {
    completeBracketRoundWithRandomScores,
    getBrackets,
    createBracket,
    updateBracket,
    deleteBracket,
  };
};
