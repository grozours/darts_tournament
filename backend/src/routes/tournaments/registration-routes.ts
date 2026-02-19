import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';

export const registerTournamentRegistrationRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.post(
    '/:id/register',
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
      }),
      body: z.object({
        playerId: z.string().uuid('Invalid player ID'),
      }),
    }),
    tournamentController.registerPlayer
  );

  router.delete(
    '/:id/register/:playerId',
    requireAuth,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        playerId: z.string().uuid('Invalid player ID'),
      }),
    }),
    tournamentController.unregisterPlayer
  );
};
