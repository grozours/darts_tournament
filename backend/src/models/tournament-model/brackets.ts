import type { PrismaClient } from '@prisma/client';
import { BracketStatus, BracketType, MatchStatus, TargetStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError } from './helpers';

export const createTournamentModelBrackets = (prisma: PrismaClient) => ({
  createBracketEntries: async (entries: Array<{ bracketId: string; playerId: string; seedNumber: number; currentRound: number }>) => {
    if (entries.length === 0) return;
    await prisma.bracketEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });
  },

  deleteBracketEntriesForBracket: async (bracketId: string) => {
    await prisma.bracketEntry.deleteMany({
      where: { bracketId },
    });
  },

  getMatchCountForBracket: async (bracketId: string): Promise<number> => {
    try {
      return await prisma.match.count({
        where: { bracketId },
      });
    } catch (error) {
      logModelError('getMatchCountForBracket', error);
      return 0;
    }
  },

  getBracketMatches: async (bracketId: string) => {
    try {
      return await prisma.match.findMany({
        where: { bracketId },
        select: { id: true, roundNumber: true, targetId: true },
      });
    } catch (error) {
      logModelError('getBracketMatches', error);
      throw new AppError('Failed to fetch bracket matches', 500, 'BRACKET_MATCH_FETCH_FAILED');
    }
  },

  resetBracketMatches: async (bracketId: string): Promise<void> => {
    try {
      const matches = await prisma.match.findMany({
        where: { bracketId },
        select: { id: true, roundNumber: true, targetId: true },
      });
      const matchIds = matches.map((match) => match.id);
      const roundOneMatchIds = matches
        .filter((match) => match.roundNumber === 1)
        .map((match) => match.id);
      const laterMatchIds = matches
        .filter((match) => (match.roundNumber ?? 1) > 1)
        .map((match) => match.id);
      const targetIds = matches
        .map((match) => match.targetId)
        .filter((targetId): targetId is string => Boolean(targetId));

      await prisma.$transaction([
        ...(targetIds.length > 0
          ? [
            prisma.target.updateMany({
              where: { id: { in: targetIds } },
              data: {
                status: TargetStatus.AVAILABLE,
                // eslint-disable-next-line unicorn/no-null
                currentMatchId: null,
              },
            }),
          ]
          : []),
        ...(matchIds.length > 0
          ? [
            prisma.score.deleteMany({
              where: { matchId: { in: matchIds } },
            }),
          ]
          : []),
        ...(roundOneMatchIds.length > 0
          ? [
            prisma.playerMatch.updateMany({
              where: { matchId: { in: roundOneMatchIds } },
              data: {
                scoreTotal: 0,
                legsWon: 0,
                setsWon: 0,
                isWinner: false,
              },
            }),
          ]
          : []),
        ...(laterMatchIds.length > 0
          ? [
            prisma.playerMatch.deleteMany({
              where: { matchId: { in: laterMatchIds } },
            }),
          ]
          : []),
        ...(matchIds.length > 0
          ? [
            prisma.match.updateMany({
              where: { id: { in: matchIds } },
              data: {
                status: MatchStatus.SCHEDULED,
                // eslint-disable-next-line unicorn/no-null
                startedAt: null,
                // eslint-disable-next-line unicorn/no-null
                completedAt: null,
                // eslint-disable-next-line unicorn/no-null
                winnerId: null,
                // eslint-disable-next-line unicorn/no-null
                targetId: null,
              },
            }),
          ]
          : []),
      ]);
    } catch (error) {
      logModelError('resetBracketMatches', error);
      throw new AppError('Failed to reset bracket matches', 500, 'BRACKET_MATCH_RESET_FAILED');
    }
  },

  deleteMatchesForBracket: async (bracketId: string) => {
    await prisma.match.deleteMany({
      where: { bracketId },
    });
  },

  createBracketMatches: async (
    tournamentId: string,
    bracketId: string,
    matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>
  ): Promise<void> => {
    if (matches.length === 0) return;

    await prisma.$transaction(
      matches.map((match) =>
        prisma.match.create({
          data: {
            tournamentId,
            bracketId,
            roundNumber: match.roundNumber,
            matchNumber: match.matchNumber,
            playerMatches: {
              create: [
                {
                  playerId: match.playerIds[0],
                  playerPosition: 1,
                },
                {
                  playerId: match.playerIds[1],
                  playerPosition: 2,
                },
              ],
            },
          },
        })
      )
    );
  },

  createBracketMatchWithSlots: async (
    tournamentId: string,
    bracketId: string,
    roundNumber: number,
    matchNumber: number,
    players: Array<{ playerId: string; playerPosition: number }>
  ): Promise<void> => {
    if (players.length === 0) return;
    try {
      await prisma.match.create({
        data: {
          tournamentId,
          bracketId,
          roundNumber,
          matchNumber,
          playerMatches: {
            create: players.map((player) => ({
              playerId: player.playerId,
              playerPosition: player.playerPosition,
            })),
          },
        },
      });
    } catch (error) {
      logModelError('createBracketMatchWithSlots', error);
      throw new AppError('Failed to create bracket match', 500, 'BRACKET_MATCH_CREATE_FAILED');
    }
  },

  getBracketById: async (bracketId: string) => {
    try {
      return await prisma.bracket.findUnique({
        where: { id: bracketId },
      });
    } catch (error) {
      logModelError('getBracketById', error);
      throw new AppError('Failed to fetch bracket', 500, 'BRACKET_FETCH_FAILED');
    }
  },

  getBracketMatchesByRound: async (bracketId: string, roundNumber: number) => {
    try {
      return await prisma.match.findMany({
        where: { bracketId, roundNumber },
        orderBy: { matchNumber: 'asc' },
      });
    } catch (error) {
      logModelError('getBracketMatchesByRound', error);
      throw new AppError('Failed to fetch bracket matches', 500, 'BRACKET_MATCH_FETCH_FAILED');
    }
  },

  getBracketMatchesByRoundWithPlayers: async (bracketId: string, roundNumber: number) => {
    try {
      return await prisma.match.findMany({
        where: { bracketId, roundNumber },
        orderBy: { matchNumber: 'asc' },
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getBracketMatchesByRoundWithPlayers', error);
      throw new AppError('Failed to fetch bracket matches', 500, 'BRACKET_MATCH_FETCH_FAILED');
    }
  },

  getBracketMatchCountByRound: async (bracketId: string, roundNumber: number): Promise<number> => {
    try {
      return await prisma.match.count({
        where: { bracketId, roundNumber },
      });
    } catch (error) {
      logModelError('getBracketMatchCountByRound', error);
      return 0;
    }
  },

  getBracketEntryCount: async (bracketId: string): Promise<number> => {
    try {
      return await prisma.bracketEntry.count({
        where: { bracketId },
      });
    } catch (error) {
      logModelError('getBracketEntryCount', error);
      return 0;
    }
  },

  setBracketMatchPlayers: async (matchId: string, playerIds: [string, string]) => {
    try {
      await prisma.$transaction([
        prisma.playerMatch.deleteMany({
          where: { matchId },
        }),
        prisma.playerMatch.createMany({
          data: [
            {
              matchId,
              playerId: playerIds[0],
              playerPosition: 1,
            },
            {
              matchId,
              playerId: playerIds[1],
              playerPosition: 2,
            },
          ],
        }),
      ]);
    } catch (error) {
      logModelError('setBracketMatchPlayers', error);
      throw new AppError('Failed to seed bracket match players', 500, 'BRACKET_MATCH_SEED_FAILED');
    }
  },

  setBracketMatchPlayerPosition: async (matchId: string, playerId: string, playerPosition: number) => {
    try {
      await prisma.$transaction([
        prisma.playerMatch.deleteMany({
          where: {
            matchId,
            OR: [
              { playerPosition },
              { playerId },
            ],
          },
        }),
        prisma.playerMatch.create({
          data: {
            matchId,
            playerId,
            playerPosition,
          },
        }),
      ]);
    } catch (error) {
      logModelError('setBracketMatchPlayerPosition', error);
      throw new AppError('Failed to seed bracket match player', 500, 'BRACKET_MATCH_SEED_FAILED');
    }
  },

  getBrackets: async (tournamentId: string) => {
    try {
      return await prisma.bracket.findMany({
        where: { tournamentId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logModelError('getBrackets', error);
      throw new AppError('Failed to fetch brackets', 500, 'BRACKET_FETCH_FAILED');
    }
  },

  createBracket: async (tournamentId: string, data: {
    name: string;
    bracketType: BracketType;
    totalRounds: number;
  }) => {
    try {
      return await prisma.bracket.create({
        data: {
          tournamentId,
          name: data.name,
          bracketType: data.bracketType,
          totalRounds: data.totalRounds,
        },
      });
    } catch (error) {
      logModelError('createBracket', error);
      throw new AppError('Failed to create bracket', 500, 'BRACKET_CREATE_FAILED');
    }
  },

  updateBracket: async (
    bracketId: string,
    data: Partial<{
      name: string;
      bracketType: BracketType;
      totalRounds: number;
      status: BracketStatus;
      // eslint-disable-next-line unicorn/no-null
      completedAt: Date | null;
    }>
  ) => {
    try {
      return await prisma.bracket.update({
        where: { id: bracketId },
        data,
      });
    } catch (error) {
      logModelError('updateBracket', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
      }
      throw new AppError('Failed to update bracket', 500, 'BRACKET_UPDATE_FAILED');
    }
  },

  deleteBracket: async (bracketId: string) => {
    try {
      await prisma.bracket.delete({
        where: { id: bracketId },
      });
    } catch (error) {
      logModelError('deleteBracket', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
      }
      throw new AppError('Failed to delete bracket', 500, 'BRACKET_DELETE_FAILED');
    }
  },
});

export type TournamentModelBracketHandlers = ReturnType<typeof createTournamentModelBrackets>;
