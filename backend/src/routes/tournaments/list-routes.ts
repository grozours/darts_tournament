import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { validate } from '../../middleware/validation';
import { dateRangeSchema, getTournamentsSchema } from './schemas';

export const registerTournamentListRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get('/', validate(getTournamentsSchema), tournamentController.getTournaments);

  router.get(
    '/date-range',
    validate(dateRangeSchema),
    tournamentController.getTournamentsByDateRange
  );

  router.get(
    '/check-name/:name',
    tournamentController.checkTournamentNameAvailability
  );

  router.get('/stats', tournamentController.getOverallTournamentStats);
};
