import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';
import { uuidSchema } from './schemas';

export const registerTournamentBracketRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get(
    '/:id/brackets',
    validate(uuidSchema),
    tournamentController.getBrackets
  );

  router.post(
    '/:id/brackets',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({ id: z.string().uuid('Invalid tournament ID') }),
      body: z.object({
        name: z.string().min(1).max(100),
        bracketType: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']),
        totalRounds: z.number().int().min(1).max(10),
      }),
    }),
    tournamentController.createBracket
  );

  router.patch(
    '/:id/brackets/:bracketId',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        bracketId: z.string().uuid('Invalid bracket ID'),
      }),
      body: z.object({
        name: z.string().min(1).max(100).optional(),
        bracketType: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']).optional(),
        totalRounds: z.number().int().min(1).max(10).optional(),
        status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
      }),
    }),
    tournamentController.updateBracket
  );

  router.delete(
    '/:id/brackets/:bracketId',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        bracketId: z.string().uuid('Invalid bracket ID'),
      }),
    }),
    tournamentController.deleteBracket
  );

  router.patch(
    '/:id/brackets/:bracketId/rounds/:roundNumber/complete',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        bracketId: z.string().uuid('Invalid bracket ID'),
        roundNumber: z.coerce.number().int().min(1, 'Round number must be at least 1'),
      }),
    }),
    tournamentController.completeBracketRoundWithScores
  );

  router.post(
    '/:id/brackets/:bracketId/reset-matches',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        bracketId: z.string().uuid('Invalid bracket ID'),
      }),
    }),
    tournamentController.resetBracketMatches
  );
};
