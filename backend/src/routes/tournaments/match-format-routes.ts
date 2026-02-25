import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import {
  createMatchFormatPresetSchema,
  matchFormatPresetUuidSchema,
  updateMatchFormatPresetSchema,
} from './schemas';

export const registerTournamentMatchFormatRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get('/match-formats', tournamentController.getMatchFormatPresets);

  router.post(
    '/match-formats',
    requireAuth,
    requireAdmin,
    validate(createMatchFormatPresetSchema),
    tournamentController.createMatchFormatPreset
  );

  router.patch(
    '/match-formats/:formatId',
    requireAuth,
    requireAdmin,
    validate(matchFormatPresetUuidSchema),
    validate(updateMatchFormatPresetSchema),
    tournamentController.updateMatchFormatPreset
  );

  router.delete(
    '/match-formats/:formatId',
    requireAuth,
    requireAdmin,
    validate(matchFormatPresetUuidSchema),
    tournamentController.deleteMatchFormatPreset
  );
};
