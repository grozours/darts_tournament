import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { uploadTournamentLogo } from '../../middleware/upload';
import { validate } from '../../middleware/validation';
import {
  createTournamentSchema,
  updateTournamentSchema,
  uuidSchema,
} from './schemas';

export const registerTournamentCrudRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.post(
    '/',
    requireAuth,
    requireAdmin,
    validate(createTournamentSchema),
    tournamentController.createTournament
  );

  router.get('/:id', validate(uuidSchema), tournamentController.getTournament);

  router.get(
    '/:id/live',
    validate(uuidSchema),
    tournamentController.getTournamentLiveView
  );

  router.put(
    '/:id',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    validate(updateTournamentSchema),
    tournamentController.updateTournament
  );

  router.delete(
    '/:id',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    tournamentController.deleteTournament
  );

  router.post(
    '/:id/logo',
    requireAuth,
    requireAdmin,
    validate(uuidSchema),
    uploadTournamentLogo,
    tournamentController.uploadTournamentLogo
  );

  router.get(
    '/:id/stats',
    validate(uuidSchema),
    tournamentController.getTournamentStats
  );
};
