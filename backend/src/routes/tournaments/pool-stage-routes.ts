import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';
import { uuidSchema } from './schemas';

export const registerTournamentPoolStageRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get(
    '/:id/pool-stages',
    validate(uuidSchema),
    tournamentController.getPoolStages
  );

  router.post(
    '/:id/pool-stages',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({ id: z.string().uuid('Invalid tournament ID') }),
      body: z.object({
        stageNumber: z.number().int().min(1),
        name: z.string().min(1).max(100),
        poolCount: z.number().int().min(1).max(16),
        playersPerPool: z.number().int().min(2).max(16),
        advanceCount: z.number().int().min(1).max(16),
        losersAdvanceToBracket: z.boolean().optional(),
      }),
    }),
    tournamentController.createPoolStage
  );

  router.patch(
    '/:id/pool-stages/:stageId',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        stageId: z.string().uuid('Invalid pool stage ID'),
      }),
      body: z.object({
        stageNumber: z.number().int().min(1).optional(),
        name: z.string().min(1).max(100).optional(),
        poolCount: z.number().int().min(1).max(16).optional(),
        playersPerPool: z.number().int().min(2).max(16).optional(),
        advanceCount: z.number().int().min(1).max(16).optional(),
        losersAdvanceToBracket: z.boolean().optional(),
        status: z.enum(['NOT_STARTED', 'EDITION', 'IN_PROGRESS', 'COMPLETED']).optional(),
      }),
    }),
    tournamentController.updatePoolStage
  );

  router.post(
    '/:id/pool-stages/:stageId/complete',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        stageId: z.string().uuid('Invalid pool stage ID'),
      }),
    }),
    tournamentController.completePoolStageWithScores
  );

  router.delete(
    '/:id/pool-stages/:stageId',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        stageId: z.string().uuid('Invalid pool stage ID'),
      }),
    }),
    tournamentController.deletePoolStage
  );

  router.get(
    '/:id/pool-stages/:stageId/pools',
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        stageId: z.string().uuid('Invalid pool stage ID'),
      }),
    }),
    tournamentController.getPoolStagePools
  );

  router.put(
    '/:id/pool-stages/:stageId/assignments',
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        stageId: z.string().uuid('Invalid pool stage ID'),
      }),
      body: z.object({
        assignments: z.array(
          z.object({
            poolId: z.string().uuid('Invalid pool ID'),
            playerId: z.string().uuid('Invalid player ID'),
            assignmentType: z.enum(['SEEDED', 'RANDOM', 'BYE']),
            seedNumber: z.number().int().min(1).optional(),
          })
        ),
      }),
    }),
    tournamentController.updatePoolStageAssignments
  );
};
