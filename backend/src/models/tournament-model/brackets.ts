import type { PrismaClient } from '@prisma/client';
import { BracketStatus, BracketType, MatchStatus, TargetStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError } from './helpers';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];
type BracketCreatePayload = {
  tournamentId: string;
  name: string;
  bracketType: BracketType;
  totalRounds: number;
  roundMatchFormats?: JsonValue;
  inParallelWith?: JsonValue;
};
type BracketUpdatePayload = Partial<{
  name: string;
  bracketType: BracketType;
  totalRounds: number;
  roundMatchFormats: JsonValue;
  inParallelWith: JsonValue;
  status: BracketStatus;
  completedAt: Date | null;
}>;

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

  getStartedBracketMatchCount: async (tournamentId: string, bracketId?: string): Promise<number> => {
    try {
      return await prisma.match.count({
        where: {
          tournamentId,
          ...(bracketId ? { bracketId } : { bracketId: { not: undefined } }),
          status: { not: MatchStatus.SCHEDULED },
        },
      });
    } catch (error) {
      logModelError('getStartedBracketMatchCount', error);
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
      const matchIds = matches.map((match: (typeof matches)[number]) => match.id);
      const roundOneMatchIds = matches
        .filter((match: (typeof matches)[number]) => match.roundNumber === 1)
        .map((match: (typeof matches)[number]) => match.id);
      const laterMatchIds = matches
        .filter((match: (typeof matches)[number]) => (match.roundNumber ?? 1) > 1)
        .map((match: (typeof matches)[number]) => match.id);
      const targetIds = matches
        .map((match: (typeof matches)[number]) => match.targetId)
        .filter(Boolean);

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
    matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>,
    matchFormatKey?: string
  ): Promise<void> => {
    if (matches.length === 0) return;

    await prisma.$transaction(
      matches.map((match) =>
        prisma.match.create({
          data: {
            tournamentId,
            bracketId,
            ...(matchFormatKey ? { matchFormatKey } : {}),
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

  createEmptyBracketMatches: async (
    tournamentId: string,
    bracketId: string,
    matches: Array<{ roundNumber: number; matchNumber: number }>,
    matchFormatKeyByRound?: Record<number, string>
  ): Promise<void> => {
    if (matches.length === 0) return;

    await prisma.$transaction(
      matches.map((match) =>
        prisma.match.create({
          data: {
            tournamentId,
            bracketId,
            ...(matchFormatKeyByRound?.[match.roundNumber]
              ? { matchFormatKey: matchFormatKeyByRound[match.roundNumber] }
              : {}),
            roundNumber: match.roundNumber,
            matchNumber: match.matchNumber,
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
    players: Array<{ playerId: string; playerPosition: number }>,
    matchFormatKey?: string
  ): Promise<void> => {
    if (players.length === 0) return;
    try {
      await prisma.match.create({
        data: {
          tournamentId,
          bracketId,
          ...(matchFormatKey ? { matchFormatKey } : {}),
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
      const brackets = await prisma.bracket.findMany({
        where: { tournamentId },
        orderBy: { createdAt: 'asc' },
        include: {
          bracketTargets: {
            select: { targetId: true },
          },
        },
      });
  const bracketIds = brackets.map((bracket: (typeof brackets)[number]) => bracket.id);
      const startedMatches = bracketIds.length > 0
        ? await prisma.match.groupBy({
          by: ['bracketId'],
          where: {
            bracketId: { in: bracketIds },
            status: { not: MatchStatus.SCHEDULED },
          },
          _count: { _all: true },
        })
        : [];
      const startedMatchesByBracket = new Map(
        startedMatches
          .filter((entry: (typeof startedMatches)[number]): entry is (typeof startedMatches)[number] & { bracketId: string } => Boolean(entry.bracketId))
          .map((entry: (typeof startedMatches)[number] & { bracketId: string }) => [entry.bracketId, entry._count._all] as const)
      );
      const getStartedMatchCount = (bracketId: string) => Number(startedMatchesByBracket.get(bracketId) ?? 0);
      return brackets.map((bracket: (typeof brackets)[number]) => ({
        ...bracket,
        targetIds: bracket.bracketTargets.map((target: (typeof bracket.bracketTargets)[number]) => target.targetId),
        hasStartedMatches: getStartedMatchCount(bracket.id) > 0,
      }));
    } catch (error) {
      logModelError('getBrackets', error);
      throw new AppError('Failed to fetch brackets', 500, 'BRACKET_FETCH_FAILED');
    }
  },

  getBracketTargetIds: async (bracketId: string): Promise<string[]> => {
    try {
      const targets = await prisma.bracketTarget.findMany({
        where: { bracketId },
        select: { targetId: true },
      });
  return targets.map((target: (typeof targets)[number]) => target.targetId);
    } catch (error) {
      logModelError('getBracketTargetIds', error);
      throw new AppError('Failed to fetch bracket targets', 500, 'BRACKET_TARGETS_FETCH_FAILED');
    }
  },

  getBracketTargetConflicts: async (
    targetIds: string[],
    bracketId?: string
  ): Promise<Array<{ bracketId: string; targetId: string }>> => {
    if (targetIds.length === 0) return [];
    try {
      return await prisma.bracketTarget.findMany({
        where: {
          targetId: { in: targetIds },
          ...(bracketId ? { bracketId: { not: bracketId } } : {}),
        },
        select: { bracketId: true, targetId: true },
      });
    } catch (error) {
      logModelError('getBracketTargetConflicts', error);
      throw new AppError('Failed to fetch bracket target conflicts', 500, 'BRACKET_TARGETS_FETCH_FAILED');
    }
  },

  setBracketTargets: async (bracketId: string, targetIds: string[]): Promise<void> => {
    try {
      const createTargets = targetIds.length > 0
        ? [
          prisma.bracketTarget.createMany({
            data: targetIds.map((targetId) => ({ bracketId, targetId })),
            skipDuplicates: true,
          }),
        ]
        : [];

      await prisma.$transaction([
        prisma.bracketTarget.deleteMany({ where: { bracketId } }),
        ...createTargets,
      ]);
    } catch (error) {
      logModelError('setBracketTargets', error);
      throw new AppError('Failed to update bracket targets', 500, 'BRACKET_TARGETS_UPDATE_FAILED');
    }
  },

  createBracket: async (tournamentId: string, data: {
    name: string;
    bracketType: BracketType;
    totalRounds: number;
    roundMatchFormats?: JsonValue;
    inParallelWith?: JsonValue;
  }) => {
    try {
      const payload: BracketCreatePayload = {
        tournamentId,
        name: data.name,
        bracketType: data.bracketType,
        totalRounds: data.totalRounds,
      };
      if (data.roundMatchFormats !== undefined) {
        payload.roundMatchFormats = data.roundMatchFormats;
      }
      if (data.inParallelWith !== undefined) {
        payload.inParallelWith = data.inParallelWith;
      }

      return await prisma.bracket.create({
        data: payload,
      });
    } catch (error) {
      logModelError('createBracket', error);
      throw new AppError('Failed to create bracket', 500, 'BRACKET_CREATE_FAILED');
    }
  },

  updateBracket: async (
    bracketId: string,
    data: BracketUpdatePayload
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
