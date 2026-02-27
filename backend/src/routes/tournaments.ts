import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import TournamentController from '../controllers/tournament-controller';
import { config } from '../config/environment';
import { registerTournamentBracketRoutes } from './tournaments/bracket-routes';
import { registerTournamentCrudRoutes } from './tournaments/tournament-crud-routes';
import { registerTournamentListRoutes } from './tournaments/list-routes';
import { registerTournamentMatchRoutes } from './tournaments/match-routes';
import { registerTournamentMatchFormatRoutes } from './tournaments/match-format-routes';
import { registerTournamentPresetRoutes } from './tournaments/preset-routes';
import { registerTournamentPlayerRoutes } from './tournaments/player-routes';
import { registerTournamentPoolStageRoutes } from './tournaments/pool-stage-routes';
import { registerTournamentRegistrationRoutes } from './tournaments/registration-routes';
import { registerTournamentStatusRoutes } from './tournaments/status-routes';
import { registerTournamentGroupRoutes } from './tournaments/group-routes';

const prisma = new PrismaClient({
	datasources: {
		db: {
			url: config.database.prismaUrl,
		},
	},
});
const tournamentController = new TournamentController(prisma);

const router = Router();

registerTournamentListRoutes(router, tournamentController);
registerTournamentPresetRoutes(router, tournamentController);
registerTournamentMatchFormatRoutes(router, tournamentController);
registerTournamentRegistrationRoutes(router, tournamentController);
registerTournamentPlayerRoutes(router, tournamentController);
registerTournamentGroupRoutes(router, tournamentController);
registerTournamentPoolStageRoutes(router, tournamentController);
registerTournamentBracketRoutes(router, tournamentController);
registerTournamentMatchRoutes(router, tournamentController);
registerTournamentStatusRoutes(router, tournamentController);
registerTournamentCrudRoutes(router, tournamentController);

export default router;