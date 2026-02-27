import type { Router } from 'express';
import type TournamentController from '../../controllers/tournament-controller';
import { optionalAuth, requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import {
  addGroupMemberSchema,
  createGroupSchema,
  doubletteRouteSchema,
  groupPlayerSearchSchema,
  equipeRouteSchema,
  groupListSchema,
  joinDoubletteSchema,
  joinEquipeSchema,
  removeDoubletteMemberSchema,
  removeEquipeMemberSchema,
  updateGroupSchema,
  updateGroupPasswordSchema,
} from './schemas';

export const registerTournamentGroupRoutes = (
  router: Router,
  tournamentController: TournamentController
) => {
  router.get(
    '/:id/doublettes',
    optionalAuth,
    validate(groupListSchema),
    tournamentController.listDoublettes
  );

  router.post(
    '/:id/doublettes',
    requireAuth,
    validate(createGroupSchema),
    tournamentController.createDoublette
  );

  router.post(
    '/:id/doublettes/:doubletteId/join',
    requireAuth,
    validate(joinDoubletteSchema),
    tournamentController.joinDoublette
  );

  router.post(
    '/:id/doublettes/:doubletteId/leave',
    requireAuth,
    validate(doubletteRouteSchema),
    tournamentController.leaveDoublette
  );

  router.post(
    '/:id/doublettes/:doubletteId/register',
    requireAuth,
    validate(doubletteRouteSchema),
    tournamentController.registerDoublette
  );

  router.patch(
    '/:id/doublettes/:doubletteId',
    requireAuth,
    validate({ ...doubletteRouteSchema, ...updateGroupSchema }),
    tournamentController.updateDoublette
  );

  router.patch(
    '/:id/doublettes/:doubletteId/password',
    requireAuth,
    validate({ ...doubletteRouteSchema, ...updateGroupPasswordSchema }),
    tournamentController.updateDoublettePassword
  );

  router.post(
    '/:id/doublettes/:doubletteId/members',
    requireAuth,
    validate({ ...doubletteRouteSchema, ...addGroupMemberSchema }),
    tournamentController.addDoubletteMember
  );

  router.delete(
    '/:id/doublettes/:doubletteId/members/:playerId',
    requireAuth,
    validate(removeDoubletteMemberSchema),
    tournamentController.removeDoubletteMember
  );

  router.delete(
    '/:id/doublettes/:doubletteId',
    requireAuth,
    validate(doubletteRouteSchema),
    tournamentController.deleteDoublette
  );

  router.get(
    '/:id/equipes',
    optionalAuth,
    validate(groupListSchema),
    tournamentController.listEquipes
  );

  router.post(
    '/:id/equipes',
    requireAuth,
    validate(createGroupSchema),
    tournamentController.createEquipe
  );

  router.post(
    '/:id/equipes/:equipeId/join',
    requireAuth,
    validate(joinEquipeSchema),
    tournamentController.joinEquipe
  );

  router.post(
    '/:id/equipes/:equipeId/leave',
    requireAuth,
    validate(equipeRouteSchema),
    tournamentController.leaveEquipe
  );

  router.post(
    '/:id/equipes/:equipeId/register',
    requireAuth,
    validate(equipeRouteSchema),
    tournamentController.registerEquipe
  );

  router.patch(
    '/:id/equipes/:equipeId',
    requireAuth,
    validate({ ...equipeRouteSchema, ...updateGroupSchema }),
    tournamentController.updateEquipe
  );

  router.patch(
    '/:id/equipes/:equipeId/password',
    requireAuth,
    validate({ ...equipeRouteSchema, ...updateGroupPasswordSchema }),
    tournamentController.updateEquipePassword
  );

  router.post(
    '/:id/equipes/:equipeId/members',
    requireAuth,
    validate({ ...equipeRouteSchema, ...addGroupMemberSchema }),
    tournamentController.addEquipeMember
  );

  router.delete(
    '/:id/equipes/:equipeId/members/:playerId',
    requireAuth,
    validate(removeEquipeMemberSchema),
    tournamentController.removeEquipeMember
  );

  router.delete(
    '/:id/equipes/:equipeId',
    requireAuth,
    validate(equipeRouteSchema),
    tournamentController.deleteEquipe
  );

  router.get(
    '/:id/group-players/search',
    requireAuth,
    requireAdmin,
    validate(groupPlayerSearchSchema),
    tournamentController.searchGroupPlayers
  );
};
