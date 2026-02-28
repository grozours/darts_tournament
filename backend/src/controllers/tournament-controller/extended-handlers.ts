import type { Request, Response } from 'express';
import type { CreatePlayerRequest, Player } from '../../../../shared/src/types';
import {
  AssignmentType,
  BracketStatus,
  BracketType,
  MatchStatus,
  StageStatus,
  TournamentStatus,
} from '../../../../shared/src/types';
import logger from '../../utils/logger';
import { isAdmin } from '../../middleware/auth';

type TournamentServiceLike = {
  registerPlayer: (tournamentId: string, playerId: string) => Promise<void>;
  registerPlayerDetails: (tournamentId: string, playerData: CreatePlayerRequest) => Promise<Player>;
  unregisterPlayer: (tournamentId: string, playerId: string) => Promise<void>;
  getPlayerById: (playerId: string) => Promise<Player | undefined>;
  getTournamentParticipants: (tournamentId: string) => Promise<unknown[]>;
  getOrphanParticipants: () => Promise<unknown[]>;
  listDoublettes: (tournamentId: string, search?: string) => Promise<unknown[]>;
  createDoublette: (
    tournamentId: string,
    payload: { name: string; password: string; captainPlayerId?: string; memberPlayerIds?: string[] }
  ) => Promise<unknown>;
  updateDoublette: (tournamentId: string, doubletteId: string, payload: { name?: string }) => Promise<unknown>;
  joinDoublette: (tournamentId: string, doubletteId: string, payload: { password: string }) => Promise<unknown>;
  addDoubletteMember: (tournamentId: string, doubletteId: string, payload: { playerId: string }) => Promise<unknown>;
  removeDoubletteMember: (tournamentId: string, doubletteId: string, playerId: string) => Promise<unknown>;
  leaveDoublette: (tournamentId: string, doubletteId: string) => Promise<unknown>;
  registerDoublette: (tournamentId: string, doubletteId: string) => Promise<unknown>;
  unregisterDoublette: (tournamentId: string, doubletteId: string) => Promise<unknown>;
  deleteDoublette: (tournamentId: string, doubletteId: string) => Promise<void>;
  updateDoublettePassword: (tournamentId: string, doubletteId: string, payload: { password: string }) => Promise<void>;
  listEquipes: (tournamentId: string, search?: string) => Promise<unknown[]>;
  createEquipe: (
    tournamentId: string,
    payload: { name: string; password: string; captainPlayerId?: string; memberPlayerIds?: string[] }
  ) => Promise<unknown>;
  updateEquipe: (tournamentId: string, equipeId: string, payload: { name?: string }) => Promise<unknown>;
  joinEquipe: (tournamentId: string, equipeId: string, payload: { password: string }) => Promise<unknown>;
  addEquipeMember: (tournamentId: string, equipeId: string, payload: { playerId: string }) => Promise<unknown>;
  removeEquipeMember: (tournamentId: string, equipeId: string, playerId: string) => Promise<unknown>;
  leaveEquipe: (tournamentId: string, equipeId: string) => Promise<unknown>;
  registerEquipe: (tournamentId: string, equipeId: string) => Promise<unknown>;
  unregisterEquipe: (tournamentId: string, equipeId: string) => Promise<unknown>;
  deleteEquipe: (tournamentId: string, equipeId: string) => Promise<void>;
  updateEquipePassword: (tournamentId: string, equipeId: string, payload: { password: string }) => Promise<void>;
  searchGroupPlayers: (tournamentId: string, query: string) => Promise<unknown[]>;
  getPoolStages: (tournamentId: string) => Promise<unknown>;
  createPoolStage: (
    tournamentId: string,
    data: {
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      losersAdvanceToBracket?: boolean;
    }
  ) => Promise<unknown>;
  updatePoolStage: (
    tournamentId: string,
    stageId: string,
    data: Partial<{
      stageNumber: number;
      name: string;
      poolCount: number;
      playersPerPool: number;
      advanceCount: number;
      losersAdvanceToBracket: boolean;
      status: StageStatus;
      // eslint-disable-next-line unicorn/no-null
      completedAt: Date | null;
    }>
  ) => Promise<unknown>;
  recomputeDoubleStageProgression: (tournamentId: string, stageId: string) => Promise<void>;
  populateBracketFromPools: (
    tournamentId: string,
    stageId: string,
    bracketId: string,
    role?: 'WINNER' | 'LOSER'
  ) => Promise<void>;
  completePoolStageWithRandomScores: (tournamentId: string, stageId: string) => Promise<void>;
  deletePoolStage: (tournamentId: string, stageId: string) => Promise<void>;
  getPoolStagePools: (tournamentId: string, stageId: string) => Promise<unknown>;
  resetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => Promise<void>;
  updatePoolAssignments: (
    tournamentId: string,
    stageId: string,
    assignments: Array<{
      poolId: string;
      playerId: string;
      assignmentType: AssignmentType;
      seedNumber?: number;
    }>
  ) => Promise<void>;
  updateMatchStatus: (
    tournamentId: string,
    matchId: string,
    status: MatchStatus,
    targetId?: string
  ) => Promise<void>;
  completeMatch: (
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ) => Promise<void>;
  saveMatchScores: (
    tournamentId: string,
    matchId: string,
    scores: Array<{ playerId: string; scoreTotal: number }>
  ) => Promise<void>;
  completeBracketRoundWithRandomScores: (
    tournamentId: string,
    bracketId: string,
    roundNumber: number
  ) => Promise<void>;
  resetBracketMatches: (tournamentId: string, bracketId: string) => Promise<void>;
  getBrackets: (tournamentId: string) => Promise<unknown>;
  createBracket: (
    tournamentId: string,
    data: { name: string; bracketType: BracketType; totalRounds: number }
  ) => Promise<unknown>;
  updateBracket: (
    tournamentId: string,
    bracketId: string,
    data: Partial<{ name: string; bracketType: BracketType; totalRounds: number; status: BracketStatus }>
  ) => Promise<unknown>;
  updateBracketTargets: (
    tournamentId: string,
    bracketId: string,
    data: { targetIds: string[] }
  ) => Promise<unknown>;
  deleteBracket: (tournamentId: string, bracketId: string) => Promise<void>;
  getTournamentTargets: (tournamentId: string) => Promise<unknown>;
  updateTournamentPlayer: (tournamentId: string, playerId: string, data: CreatePlayerRequest) => Promise<Player>;
  updateTournamentPlayerCheckIn: (
    tournamentId: string,
    playerId: string,
    checkedIn: boolean
  ) => Promise<unknown>;
  validateRegistrationConstraints: (
    tournamentId: string,
    playerId: string
  ) => Promise<{ canRegister: boolean; reasons: string[] }>;
  transitionTournamentStatus: (
    tournamentId: string,
    newStatus: TournamentStatus,
    force?: boolean
  ) => Promise<unknown>;
  openTournamentRegistration: (tournamentId: string) => Promise<unknown>;
  startTournament: (tournamentId: string) => Promise<unknown>;
  completeTournament: (tournamentId: string) => Promise<unknown>;
  getOverallTournamentStats: () => Promise<unknown>;
};

type ExtendedHandlerContext = {
  getTournamentService: (request: Request) => TournamentServiceLike;
  handleError: (response: Response, error: unknown) => void;
};

const getAuthenticatedUserEmail = (request: Request): string | undefined => {
  const rawPayload = request.auth?.payload;
  const payload =
    rawPayload && typeof rawPayload === 'object'
      ? (rawPayload as Record<string, unknown>)
      : undefined;
  const email =
    payload?.email ??
    payload?.['https://darts-tournament.app/email'] ??
    payload?.['https://your-domain.com/email'];
  return typeof email === 'string' && email ? email : undefined;
};

const getSingleQueryParam = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const firstValue = value.find((item) => typeof item === 'string');
    return typeof firstValue === 'string' ? firstValue : '';
  }
  return '';
};

const canUnregisterPlayer = async (
  context: ExtendedHandlerContext,
  request: Request,
  response: Response,
  tournamentId: string,
  playerId: string
): Promise<boolean> => {
  if (isAdmin(request)) {
    return true;
  }

  const player = await context.getTournamentService(request).getPlayerById(playerId);
  if (player?.tournamentId !== tournamentId) {
    response.status(404).json({
      error: {
        message: 'Player not found for this tournament',
        code: 'PLAYER_NOT_FOUND',
      },
    });
    return false;
  }

  const userEmail = getAuthenticatedUserEmail(request);
  if (!userEmail) {
    response.status(403).json({
      error: {
        message: 'Cannot verify user identity',
        code: 'FORBIDDEN',
      },
    });
    return false;
  }

  const playerEmail = player.email?.toLowerCase();
  if (playerEmail !== userEmail.toLowerCase()) {
    response.status(403).json({
      error: {
        message: 'You can only unregister yourself from tournaments',
        code: 'FORBIDDEN',
      },
    });
    return false;
  }

  return true;
};

export const createExtendedHandlers = (context: ExtendedHandlerContext) => ({
  registerPlayer: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const { playerId } = request.body as { playerId: string };

      await context.getTournamentService(request).registerPlayer(id, playerId);

      response.status(201).json({
        message: 'Player registered successfully',
        tournamentId: id,
        playerId,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  registerPlayerDetails: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const player = await context
        .getTournamentService(request)
        .registerPlayerDetails(id, request.body);

      response.status(201).json(player);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  unregisterPlayer: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };

      const canUnregister = await canUnregisterPlayer(
        context,
        request,
        response,
        id,
        playerId
      );
      if (!canUnregister) {
        return;
      }

      await context.getTournamentService(request).unregisterPlayer(id, playerId);

      response.json({
        message: 'Player unregistered successfully',
        tournamentId: id,
        playerId,
      });
    } catch (error) {
      logger.error('Unregister player failed', {
        correlationId: (request as { correlationId?: string }).correlationId,
        tournamentId: request.params?.id,
        playerId: request.params?.playerId,
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      });
      context.handleError(response, error);
    }
  },

  getTournamentParticipants: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const participants = await context
        .getTournamentService(request)
        .getTournamentParticipants(id);

      response.json({
        tournamentId: id,
        participants,
        totalCount: participants.length,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getTournamentPlayers: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const participants = await context
        .getTournamentService(request)
        .getTournamentParticipants(id);

      response.json({
        tournamentId: id,
        players: participants,
        totalCount: participants.length,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getOrphanPlayers: async (request: Request, response: Response): Promise<void> => {
    try {
      const players = await context.getTournamentService(request).getOrphanParticipants();
      response.json({ players, totalCount: players.length });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  listDoublettes: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const search = typeof request.query.search === 'string' ? request.query.search : undefined;
      const doublettes = await context.getTournamentService(request).listDoublettes(id, search);
      response.json({ doublettes, totalCount: doublettes.length });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const doublette = await context.getTournamentService(request).createDoublette(id, request.body);
      response.status(201).json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const doublette = await context.getTournamentService(request).updateDoublette(id, doubletteId, request.body);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  joinDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const doublette = await context
        .getTournamentService(request)
        .joinDoublette(id, doubletteId, request.body);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  addDoubletteMember: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const doublette = await context
        .getTournamentService(request)
        .addDoubletteMember(id, doubletteId, request.body);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  removeDoubletteMember: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId, playerId } = request.params as { id: string; doubletteId: string; playerId: string };
      const doublette = await context
        .getTournamentService(request)
        .removeDoubletteMember(id, doubletteId, playerId);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  leaveDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const result = await context.getTournamentService(request).leaveDoublette(id, doubletteId);
      response.json(result);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  registerDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const doublette = await context.getTournamentService(request).registerDoublette(id, doubletteId);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  unregisterDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      const doublette = await context.getTournamentService(request).unregisterDoublette(id, doubletteId);
      response.json(doublette);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deleteDoublette: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      await context.getTournamentService(request).deleteDoublette(id, doubletteId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateDoublettePassword: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, doubletteId } = request.params as { id: string; doubletteId: string };
      await context
        .getTournamentService(request)
        .updateDoublettePassword(id, doubletteId, request.body);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  listEquipes: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const search = typeof request.query.search === 'string' ? request.query.search : undefined;
      const equipes = await context.getTournamentService(request).listEquipes(id, search);
      response.json({ equipes, totalCount: equipes.length });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const equipe = await context.getTournamentService(request).createEquipe(id, request.body);
      response.status(201).json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const equipe = await context.getTournamentService(request).updateEquipe(id, equipeId, request.body);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  joinEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const equipe = await context
        .getTournamentService(request)
        .joinEquipe(id, equipeId, request.body);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  addEquipeMember: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const equipe = await context
        .getTournamentService(request)
        .addEquipeMember(id, equipeId, request.body);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  removeEquipeMember: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId, playerId } = request.params as { id: string; equipeId: string; playerId: string };
      const equipe = await context
        .getTournamentService(request)
        .removeEquipeMember(id, equipeId, playerId);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  leaveEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const result = await context.getTournamentService(request).leaveEquipe(id, equipeId);
      response.json(result);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  registerEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const equipe = await context.getTournamentService(request).registerEquipe(id, equipeId);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  unregisterEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      const equipe = await context.getTournamentService(request).unregisterEquipe(id, equipeId);
      response.json(equipe);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deleteEquipe: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      await context.getTournamentService(request).deleteEquipe(id, equipeId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateEquipePassword: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, equipeId } = request.params as { id: string; equipeId: string };
      await context
        .getTournamentService(request)
        .updateEquipePassword(id, equipeId, request.body);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  searchGroupPlayers: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const query = getSingleQueryParam(request.query.query);
      const players = await context.getTournamentService(request).searchGroupPlayers(id, query);
      response.json({ players, totalCount: players.length });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getPoolStages: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const poolStages = await context.getTournamentService(request).getPoolStages(id);
      response.json({ poolStages });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createPoolStage: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const poolStage = await context
        .getTournamentService(request)
        .createPoolStage(id, request.body);
      response.status(201).json(poolStage);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updatePoolStage: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      const poolStage = await context
        .getTournamentService(request)
        .updatePoolStage(id, stageId, request.body);
      response.json(poolStage);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  recomputeDoubleStageProgression: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await context
        .getTournamentService(request)
        .recomputeDoubleStageProgression(id, stageId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  populateBracketFromPools: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const { stageId, role } = request.body as { stageId: string; role?: 'WINNER' | 'LOSER' };
      await context
        .getTournamentService(request)
        .populateBracketFromPools(id, stageId, bracketId, role);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  completePoolStageWithScores: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await context
        .getTournamentService(request)
        .completePoolStageWithRandomScores(id, stageId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deletePoolStage: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await context.getTournamentService(request).deletePoolStage(id, stageId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getPoolStagePools: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      const pools = await context.getTournamentService(request).getPoolStagePools(id, stageId);
      response.json({ pools });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  resetPoolMatches: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId, poolId } = request.params as { id: string; stageId: string; poolId: string };
      await context.getTournamentService(request).resetPoolMatches(id, stageId, poolId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updatePoolStageAssignments: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, stageId } = request.params as { id: string; stageId: string };
      await context
        .getTournamentService(request)
        .updatePoolAssignments(id, stageId, request.body.assignments || []);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateMatchStatus: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { status, targetId } = request.body as { status: string; targetId?: string };
      await context.getTournamentService(request).updateMatchStatus(
        id,
        matchId,
        status as MatchStatus,
        targetId
      );
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  completeMatch: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { scores } = request.body as {
        scores: Array<{ playerId: string; scoreTotal: number }>;
      };
      await context.getTournamentService(request).completeMatch(id, matchId, scores || []);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  saveMatchScores: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const { scores } = request.body as {
        scores: Array<{ playerId: string; scoreTotal: number }>;
      };
      await context
        .getTournamentService(request)
        .saveMatchScores(id, matchId, scores || []);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  completeBracketRoundWithScores: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const roundNumber = Number((request.params as { roundNumber?: string }).roundNumber);
      await context
        .getTournamentService(request)
        .completeBracketRoundWithRandomScores(id, bracketId, roundNumber);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  resetBracketMatches: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      await context.getTournamentService(request).resetBracketMatches(id, bracketId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getBrackets: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const brackets = await context.getTournamentService(request).getBrackets(id);
      response.json({ brackets });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateBracketTargets: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const { targetIds } = request.body as { targetIds: string[] };
      const bracket = await context
        .getTournamentService(request)
        .updateBracketTargets(id, bracketId, { targetIds });
      response.json(bracket);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  createBracket: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const bracket = await context
        .getTournamentService(request)
        .createBracket(id, request.body);
      response.status(201).json(bracket);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateBracket: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      const bracket = await context
        .getTournamentService(request)
        .updateBracket(id, bracketId, request.body);
      response.json(bracket);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deleteBracket: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, bracketId } = request.params as { id: string; bracketId: string };
      await context.getTournamentService(request).deleteBracket(id, bracketId);
      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getTournamentTargets: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const targets = await context.getTournamentService(request).getTournamentTargets(id);
      response.json({ targets });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateTournamentPlayer: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const player = await context
        .getTournamentService(request)
        .updateTournamentPlayer(id, playerId, request.body);

      response.json(player);
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateTournamentPlayerCheckIn: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const { checkedIn } = request.body as { checkedIn: boolean };

      const player = await context
        .getTournamentService(request)
        .updateTournamentPlayerCheckIn(id, playerId, checkedIn);

      response.json({
        message: 'Player check-in status updated',
        player,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  deleteTournamentPlayer: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      await context.getTournamentService(request).unregisterPlayer(id, playerId);

      response.status(204).send();
    } catch (error) {
      context.handleError(response, error);
    }
  },

  validateRegistration: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id, playerId } = request.params as { id: string; playerId: string };
      const validation = await context
        .getTournamentService(request)
        .validateRegistrationConstraints(id, playerId);

      response.json({
        tournamentId: id,
        playerId,
        ...validation,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  updateTournamentStatus: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };
      const { status, force = false } = request.body as { status: string; force?: boolean };

      const tournament = await context
        .getTournamentService(request)
        .transitionTournamentStatus(id, status as TournamentStatus, force);

      response.json({
        message: `Tournament status updated to ${status}`,
        tournament,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  openTournamentRegistration: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };

      const tournament = await context.getTournamentService(request).openTournamentRegistration(id);

      response.json({
        message: 'Tournament registration opened successfully',
        tournament,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  startTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };

      const tournament = await context.getTournamentService(request).startTournament(id);

      response.json({
        message: 'Tournament started successfully',
        tournament,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  completeTournament: async (request: Request, response: Response): Promise<void> => {
    try {
      const { id } = request.params as { id: string };

      const tournament = await context.getTournamentService(request).completeTournament(id);

      response.json({
        message: 'Tournament finished successfully',
        tournament,
      });
    } catch (error) {
      context.handleError(response, error);
    }
  },

  getOverallTournamentStats: async (request: Request, response: Response): Promise<void> => {
    try {
      const stats = await context.getTournamentService(request).getOverallTournamentStats();
      response.json(stats);
    } catch (error) {
      context.handleError(response, error);
    }
  },
});
