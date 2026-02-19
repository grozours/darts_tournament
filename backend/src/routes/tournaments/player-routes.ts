import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { z } from 'zod';
import { createPlayerSchema, updatePlayerSchema, uuidSchema } from './schemas';

export const registerTournamentPlayerRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get('/players/orphans', tournamentController.getOrphanPlayers);

  router.get(
    '/:id/participants',
    validate(uuidSchema),
    tournamentController.getTournamentParticipants
  );

  router.get(
    '/:id/players',
    validate(uuidSchema),
    tournamentController.getTournamentPlayers
  );

  router.post(
    '/:id/players',
    validate(createPlayerSchema),
    tournamentController.registerPlayerDetails
  );

  router.patch(
    '/:id/players/:playerId',
    validate(updatePlayerSchema),
    tournamentController.updateTournamentPlayer
  );

  router.patch(
    '/:id/players/:playerId/check-in',
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        playerId: z.string().uuid('Invalid player ID'),
      }),
      body: z.object({
        checkedIn: z.boolean({ required_error: 'checkedIn is required' }),
      }),
    }),
    tournamentController.updateTournamentPlayerCheckIn
  );

  router.delete(
    '/:id/players/:playerId',
    requireAuth,
    requireAdmin,
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        playerId: z.string().uuid('Invalid player ID'),
      }),
    }),
    tournamentController.deleteTournamentPlayer
  );

  router.get(
    '/:id/registration-validation/:playerId',
    validate({
      params: z.object({
        id: z.string().uuid('Invalid tournament ID'),
        playerId: z.string().uuid('Invalid player ID'),
      }),
    }),
    tournamentController.validateRegistration
  );
};
