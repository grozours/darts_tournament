import type { PrismaClient } from '@prisma/client';
import { MatchStatus, TargetStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';
import { getPrismaErrorCode, logModelError } from './helpers';

export const createTournamentModelMatches = (prisma: PrismaClient) => ({
  getMatchFormatPresetByKey: async (key: string) => {
    try {
      return await prisma.matchFormatPreset.findUnique({
        where: { key },
      });
    } catch (error) {
      logModelError('getMatchFormatPresetByKey', error);
      throw new AppError('Failed to fetch match format preset', 500, 'MATCH_FORMAT_PRESET_FETCH_FAILED');
    }
  },

  getMatchById: async (matchId: string) => {
    try {
      return await prisma.match.findUnique({
        where: { id: matchId },
      });
    } catch (error) {
      logModelError('getMatchById', error);
      throw new AppError('Failed to fetch match', 500, 'MATCH_FETCH_FAILED');
    }
  },

  getTargetById: async (targetId: string) => {
    try {
      return await prisma.target.findUnique({
        where: { id: targetId },
      });
    } catch (error) {
      logModelError('getTargetById', error);
      throw new AppError('Failed to fetch target', 500, 'TARGET_FETCH_FAILED');
    }
  },

  getMatchPoolStageId: async (matchId: string): Promise<string | undefined> => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { pool: { select: { poolStageId: true } } },
      });
      return match?.pool?.poolStageId ?? undefined;
    } catch (error) {
      logModelError('getMatchPoolStageId', error);
      return undefined;
    }
  },

  updateMatchStatus: async (
    matchId: string,
    status: MatchStatus,
    timestamps?: { startedAt?: Date; completedAt?: Date }
  ) => {
    try {
      return await prisma.match.update({
        where: { id: matchId },
        data: {
          status,
          ...(timestamps?.startedAt !== undefined && { startedAt: timestamps.startedAt }),
          ...(timestamps?.completedAt !== undefined && { completedAt: timestamps.completedAt }),
        },
      });
    } catch (error) {
      logModelError('updateMatchStatus', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError('Failed to update match status', 500, 'MATCH_STATUS_UPDATE_FAILED');
    }
  },

  startMatchWithTarget: async (matchId: string, targetId: string, startedAt: Date) => {
    try {
      return await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.IN_PROGRESS,
            startedAt,
            targetId,
            // eslint-disable-next-line unicorn/no-null
            completedAt: null,
            // eslint-disable-next-line unicorn/no-null
            winnerId: null,
          },
        }),
        prisma.target.update({
          where: { id: targetId },
          data: {
            status: TargetStatus.IN_USE,
            currentMatchId: matchId,
            lastUsedAt: startedAt,
          },
        }),
      ]);
    } catch (error) {
      logModelError('startMatchWithTarget', error);
      throw new AppError('Failed to start match', 500, 'MATCH_START_FAILED');
    }
  },

  finishMatchAndReleaseTarget: async (
    matchId: string,
    targetId: string,
    status: MatchStatus,
    timestamps: { startedAt?: Date; completedAt?: Date }
  ) => {
    try {
      return await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: {
            status,
            ...(timestamps.startedAt !== undefined && { startedAt: timestamps.startedAt }),
            ...(timestamps.completedAt !== undefined && { completedAt: timestamps.completedAt }),
          },
        }),
        prisma.target.update({
          where: { id: targetId },
          data: {
            status: TargetStatus.AVAILABLE,
            // eslint-disable-next-line unicorn/no-null
            currentMatchId: null,
            lastUsedAt: timestamps.completedAt ?? new Date(),
          },
        }),
      ]);
    } catch (error) {
      logModelError('finishMatchAndReleaseTarget', error);
      throw new AppError('Failed to finish match', 500, 'MATCH_FINISH_FAILED');
    }
  },

  resetMatchToScheduled: async (matchId: string, targetId?: string | null, completedAt?: Date) => {
    try {
      const targetUpdate = targetId
        ? [
            prisma.target.update({
              where: { id: targetId },
              data: {
                status: TargetStatus.AVAILABLE,
                // eslint-disable-next-line unicorn/no-null
                currentMatchId: null,
                lastUsedAt: completedAt ?? new Date(),
              },
            }),
          ]
        : [];

      return await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.SCHEDULED,
            // eslint-disable-next-line unicorn/no-null
            targetId: null,
            // eslint-disable-next-line unicorn/no-null
            startedAt: null,
            // eslint-disable-next-line unicorn/no-null
            completedAt: null,
            // eslint-disable-next-line unicorn/no-null
            winnerId: null,
          },
        }),
        ...targetUpdate,
      ]);
    } catch (error) {
      logModelError('resetMatchToScheduled', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError('Failed to reset match', 500, 'MATCH_RESET_FAILED');
    }
  },

  setTargetAvailable: async (targetId: string, completedAt?: Date) => {
    try {
      return await prisma.target.update({
        where: { id: targetId },
        data: {
          status: TargetStatus.AVAILABLE,
          // eslint-disable-next-line unicorn/no-null
          currentMatchId: null,
          lastUsedAt: completedAt ?? new Date(),
        },
      });
    } catch (error) {
      logModelError('setTargetAvailable', error);
      throw new AppError('Failed to update target', 500, 'TARGET_UPDATE_FAILED');
    }
  },

  getMatchWithPlayerMatches: async (matchId: string) => {
    try {
      return await prisma.match.findUnique({
        where: { id: matchId },
        include: { playerMatches: true },
      });
    } catch (error) {
      logModelError('getMatchWithPlayerMatches', error);
      throw new AppError('Failed to fetch match', 500, 'MATCH_FETCH_FAILED');
    }
  },

  getMatchDetailsForNotification: async (matchId: string) => {
    try {
      return await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          target: true,
          pool: { include: { poolStage: true } },
          bracket: true,
          winner: true,
          playerMatches: { include: { player: true } },
        },
      });
    } catch (error) {
      logModelError('getMatchDetailsForNotification', error);
      throw new AppError('Failed to fetch match details', 500, 'MATCH_DETAILS_FETCH_FAILED');
    }
  },

  completeMatch: async (
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number; isWinner: boolean }>,
    winnerId: string,
    timestamps: { startedAt?: Date; completedAt?: Date }
  ) => {
    try {
      await prisma.$transaction([
        ...scores.map((score) =>
          prisma.playerMatch.update({
            where: { matchId_playerId: { matchId, playerId: score.playerId } },
            data: {
              scoreTotal: score.scoreTotal,
              legsWon: score.scoreTotal,
              isWinner: score.isWinner,
            },
          })
        ),
        prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            winnerId,
            ...(timestamps.startedAt !== undefined && { startedAt: timestamps.startedAt }),
            ...(timestamps.completedAt !== undefined && { completedAt: timestamps.completedAt }),
          },
        }),
      ]);
    } catch (error) {
      logModelError('completeMatch', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError('Failed to complete match', 500, 'MATCH_COMPLETE_FAILED');
    }
  },

  updateMatchScores: async (
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number; isWinner: boolean }>,
    winnerId: string
  ) => {
    try {
      await prisma.$transaction([
        ...scores.map((score) =>
          prisma.playerMatch.update({
            where: { matchId_playerId: { matchId, playerId: score.playerId } },
            data: {
              scoreTotal: score.scoreTotal,
              legsWon: score.scoreTotal,
              isWinner: score.isWinner,
            },
          })
        ),
        prisma.match.update({
          where: { id: matchId },
          data: {
            winnerId,
            completedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      logModelError('updateMatchScores', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError('Failed to update match scores', 500, 'MATCH_SCORE_UPDATE_FAILED');
    }
  },

  updateInProgressMatchScores: async (
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ) => {
    try {
      await prisma.$transaction([
        ...scores.map((score) =>
          prisma.playerMatch.update({
            where: { matchId_playerId: { matchId, playerId: score.playerId } },
            data: {
              scoreTotal: score.scoreTotal,
              legsWon: score.scoreTotal,
              isWinner: false,
            },
          })
        ),
        prisma.match.update({
          where: { id: matchId },
          data: {
            // eslint-disable-next-line unicorn/no-null
            winnerId: null,
            // eslint-disable-next-line unicorn/no-null
            completedAt: null,
          },
        }),
      ]);
    } catch (error) {
      logModelError('updateInProgressMatchScores', error);
      if (getPrismaErrorCode(error) === 'P2025') {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }
      throw new AppError('Failed to update in-progress match scores', 500, 'MATCH_SCORE_UPDATE_FAILED');
    }
  },
});

export type TournamentModelMatchHandlers = ReturnType<typeof createTournamentModelMatches>;
