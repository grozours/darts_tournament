import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';
import { uuidSchema } from './schemas';

export const registerTournamentStatusRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.patch(
    '/:id/status',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
      }),
      body: z.object({
        status: z.enum(['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED']),
        force: z.boolean().optional(),
      }),
    }),
    tournamentController.updateTournamentStatus
  );

  router.post(
    '/:id/open-registration',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    tournamentController.openTournamentRegistration
  );

  router.post(
    '/:id/start',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    tournamentController.startTournament
  );

  router.post(
    '/:id/complete',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    tournamentController.completeTournament
  );
};
