import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import {
  createTournamentPresetSchema,
  presetUuidSchema,
  updateTournamentPresetSchema,
} from './schemas';

export const registerTournamentPresetRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get('/presets', requireAuth, requireAdmin, tournamentController.getTournamentPresets);

  router.post(
    '/presets',
    requireAuth,
    requireAdmin,
    validate(createTournamentPresetSchema),
    tournamentController.createTournamentPreset
  );

  router.patch(
    '/presets/:presetId',
    requireAuth,
    requireAdmin,
    validate(presetUuidSchema),
    validate(updateTournamentPresetSchema),
    tournamentController.updateTournamentPreset
  );

  router.delete(
    '/presets/:presetId',
    requireAuth,
    requireAdmin,
    validate(presetUuidSchema),
    tournamentController.deleteTournamentPreset
  );
};
