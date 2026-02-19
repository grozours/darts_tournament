import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';
import { MatchStatus } from '../../../../shared/src/types';

export const registerTournamentMatchRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.patch(
    '/:id/matches/:matchId/status',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        matchId: z.string().uuid('Invalid match ID'),
      }),
      body: z.object({
        status: z.nativeEnum(MatchStatus, {
          errorMap: () => ({ message: 'Invalid match status' }),
        }),
        targetId: z.string().uuid('Invalid target ID').optional(),
      }),
    }),
    tournamentController.updateMatchStatus
  );

  router.patch(
    '/:id/matches/:matchId/complete',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        matchId: z.string().uuid('Invalid match ID'),
      }),
      body: z.object({
        scores: z
          .array(
            z.object({
              playerId: z.string().uuid('Invalid player ID'),
              scoreTotal: z.number().int().min(0, 'Score must be non-negative'),
            })
          )
          .min(2, 'At least two scores are required'),
      }),
    }),
    tournamentController.completeMatch
  );

  router.patch(
    '/:id/matches/:matchId/scores',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        matchId: z.string().uuid('Invalid match ID'),
      }),
      body: z.object({
        scores: z
          .array(
            z.object({
              playerId: z.string().uuid('Invalid player ID'),
              scoreTotal: z.number().int().min(0, 'Score must be non-negative'),
            })
          )
          .min(2, 'At least two scores are required'),
      }),
    }),
    tournamentController.updateMatchScores
  );
};
