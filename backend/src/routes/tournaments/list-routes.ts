import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { validate } from '../../middleware/validation';
import { dateRangeSchema, getLiveSummarySchema, getTournamentsSchema } from './schemas';

export const registerTournamentListRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get('/', validate(getTournamentsSchema), tournamentController.getTournaments);

  router.get('/live-summary', validate(getLiveSummarySchema), tournamentController.getLiveSummary);

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
