import { TournamentModel } from '../models/tournament-model';
import { PrismaClient } from '@prisma/client';
import TournamentLogger from '../utils/tournament-logger';
import { Request } from 'express';
import { AppError } from '../middleware/error-handler';
import { isAdmin } from '../middleware/auth';
import { createBracketHandlers } from './tournament-service/bracket-handlers';
import { createPlayerHandlers } from './tournament-service/player-handlers';
import { createPoolStageHandlers } from './tournament-service/pool-stage-handlers';
import { createMatchHandlers } from './tournament-service/match-handlers';
import { createStatusHandlers } from './tournament-service/status-handlers';
import { createGroupHandlers } from './tournament-service/group-handlers';
import {
  deleteTournamentSnapshot,
  saveTournamentSnapshot,
} from './tournament-service/autosave';
import {
  createTournamentCoreHandlers,
  type TournamentCoreHandlers,
} from './tournament-service/core-handlers';
import { liveComputationCache } from './live-computation-cache';
import { config } from '../config/environment';
import { redis } from '../config/redis';

export type { CreateTournamentData, TournamentFilters } from './tournament-service/core-handlers';

type BracketHandlers = ReturnType<typeof createBracketHandlers>;
type PlayerHandlers = ReturnType<typeof createPlayerHandlers>;
type PoolStageHandlers = ReturnType<typeof createPoolStageHandlers>;
type MatchHandlers = ReturnType<typeof createMatchHandlers>;
type StatusHandlers = ReturnType<typeof createStatusHandlers>;
type GroupHandlers = ReturnType<typeof createGroupHandlers>;

const extractTournamentId = <TArguments extends [string, ...unknown[]]>(...arguments_: TArguments): string =>
  arguments_[0];

export class TournamentService {
  private readonly tournamentModel: TournamentModel;
  private readonly logger: TournamentLogger;
  private readonly actorId?: string;
  private readonly actorEmail?: string;
  private readonly isAdminActionContext: boolean;
  private readonly recomputeDoubleStageProgressionReference?: (tournamentId: string, stageId: string) => Promise<void>;

  public createTournament!: TournamentCoreHandlers['createTournament'];
  public getTournamentById!: TournamentCoreHandlers['getTournamentById'];
  public listTournamentLogos!: TournamentCoreHandlers['listTournamentLogos'];
  public getTournamentLiveView!: TournamentCoreHandlers['getTournamentLiveView'];
  public getTournaments!: TournamentCoreHandlers['getTournaments'];
  public updateTournament!: TournamentCoreHandlers['updateTournament'];
  public deleteTournament!: TournamentCoreHandlers['deleteTournament'];
  public uploadTournamentLogo!: TournamentCoreHandlers['uploadTournamentLogo'];
  public deleteTournamentLogo!: TournamentCoreHandlers['deleteTournamentLogo'];
  public getTournamentsByDateRange!: TournamentCoreHandlers['getTournamentsByDateRange'];
  public isTournamentNameAvailable!: TournamentCoreHandlers['isTournamentNameAvailable'];
  public getTournamentStats!: TournamentCoreHandlers['getTournamentStats'];
  public getTournamentTargets!: TournamentCoreHandlers['getTournamentTargets'];
  public validateRegistrationConstraints!: TournamentCoreHandlers['validateRegistrationConstraints'];
  public getOverallTournamentStats!: TournamentCoreHandlers['getOverallTournamentStats'];

  public transitionTournamentStatus!: StatusHandlers['transitionTournamentStatus'];
  public openTournamentRegistration!: StatusHandlers['openTournamentRegistration'];
  public startTournament!: StatusHandlers['startTournament'];
  public completeTournament!: StatusHandlers['completeTournament'];

  public updateMatchStatus!: MatchHandlers['updateMatchStatus'];
  public completeMatch!: MatchHandlers['completeMatch'];
  public saveMatchScores!: MatchHandlers['saveMatchScores'];
  public completeMatchWithRandomScores!: MatchHandlers['completeMatchWithRandomScores'];

  public getBrackets!: BracketHandlers['getBrackets'];
  public createBracket!: BracketHandlers['createBracket'];
  public updateBracket!: BracketHandlers['updateBracket'];
  public deleteBracket!: BracketHandlers['deleteBracket'];
  public updateBracketTargets!: BracketHandlers['updateBracketTargets'];
  public completeBracketRoundWithRandomScores!: BracketHandlers['completeBracketRoundWithRandomScores'];
  public resetBracketMatches!: BracketHandlers['resetBracketMatches'];

  public registerPlayer!: PlayerHandlers['registerPlayer'];
  public registerPlayerDetails!: PlayerHandlers['registerPlayerDetails'];
  public unregisterPlayer!: PlayerHandlers['unregisterPlayer'];
  public getPlayerById!: PlayerHandlers['getPlayerById'];
  public updateTournamentPlayer!: PlayerHandlers['updateTournamentPlayer'];
  public updateTournamentPlayerCheckIn!: PlayerHandlers['updateTournamentPlayerCheckIn'];
  public getTournamentParticipants!: PlayerHandlers['getTournamentParticipants'];
  public getOrphanParticipants!: PlayerHandlers['getOrphanParticipants'];
  public deleteOrphanParticipants!: PlayerHandlers['deleteOrphanParticipants'];

  public listDoublettes!: GroupHandlers['listDoublettes'];
  public createDoublette!: GroupHandlers['createDoublette'];
  public updateDoublette!: GroupHandlers['updateDoublette'];
  public joinDoublette!: GroupHandlers['joinDoublette'];
  public addDoubletteMember!: GroupHandlers['addDoubletteMember'];
  public removeDoubletteMember!: GroupHandlers['removeDoubletteMember'];
  public leaveDoublette!: GroupHandlers['leaveDoublette'];
  public registerDoublette!: GroupHandlers['registerDoublette'];
  public unregisterDoublette!: GroupHandlers['unregisterDoublette'];
  public deleteDoublette!: GroupHandlers['deleteDoublette'];
  public updateDoublettePassword!: GroupHandlers['updateDoublettePassword'];

  public listEquipes!: GroupHandlers['listEquipes'];
  public createEquipe!: GroupHandlers['createEquipe'];
  public updateEquipe!: GroupHandlers['updateEquipe'];
  public joinEquipe!: GroupHandlers['joinEquipe'];
  public addEquipeMember!: GroupHandlers['addEquipeMember'];
  public removeEquipeMember!: GroupHandlers['removeEquipeMember'];
  public leaveEquipe!: GroupHandlers['leaveEquipe'];
  public registerEquipe!: GroupHandlers['registerEquipe'];
  public unregisterEquipe!: GroupHandlers['unregisterEquipe'];
  public deleteEquipe!: GroupHandlers['deleteEquipe'];
  public updateEquipePassword!: GroupHandlers['updateEquipePassword'];
  public searchGroupPlayers!: GroupHandlers['searchGroupPlayers'];

  public getPoolStages!: PoolStageHandlers['getPoolStages'];
  public createPoolStage!: PoolStageHandlers['createPoolStage'];
  public updatePoolStage!: PoolStageHandlers['updatePoolStage'];
  public recomputeDoubleStageProgression!: PoolStageHandlers['recomputeDoubleStageProgression'];
  public completePoolStageWithRandomScores!: PoolStageHandlers['completePoolStageWithRandomScores'];
  public populateBracketFromPools!: PoolStageHandlers['populateBracketFromPools'];
  public deletePoolStage!: PoolStageHandlers['deletePoolStage'];
  public getPoolStagePools!: PoolStageHandlers['getPoolStagePools'];
  public resetPoolMatches!: PoolStageHandlers['resetPoolMatches'];
  public updatePoolAssignments!: PoolStageHandlers['updatePoolAssignments'];

  constructor(prisma: PrismaClient, request?: Request) {
    this.tournamentModel = new TournamentModel(prisma);
    this.logger = new TournamentLogger(request);
    const actorContext = this.resolveActorContext(request);
    this.isAdminActionContext = actorContext.isAdminRequest;
    if (actorContext.actorId) {
      this.actorId = actorContext.actorId;
    }
    if (actorContext.actorEmail) {
      this.actorEmail = actorContext.actorEmail;
    }
    const loggerProxy: TournamentLogger = new Proxy(this.logger, {
      get: (_target, property, receiver) => Reflect.get(this.logger, property, receiver),
    });

    const statusHandlers = createStatusHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
    });
        const recomputeReference: {
          current: ((tournamentId: string, stageId: string) => Promise<void>) | undefined;
        } = { current: undefined };

        const matchHandlers = createMatchHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
          transitionTournamentStatus: this.delegateTransitionTournamentStatus.bind(this),
        getCachedTournamentLiveView: this.getCachedTournamentLiveView.bind(this),
        recomputeDoubleStageProgression: this.delegateRecomputeDoubleStageProgression.bind(this),
    });
    const playerHandlers = createPlayerHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
      transitionTournamentStatus: this.delegateTransitionTournamentStatus.bind(this),
      isAdminAction: this.isAdminAction.bind(this),
    });
    const groupHandlers = createGroupHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
      getActorEmail: this.getActorEmailForAction.bind(this),
      isAdminAction: this.isAdminAction.bind(this),
    });
    const poolStageHandlers = createPoolStageHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
      completeMatchWithRandomScores: matchHandlers.completeMatchWithRandomScores,
    });
      recomputeReference.current = poolStageHandlers.recomputeDoubleStageProgression;
      this.recomputeDoubleStageProgressionReference = poolStageHandlers.recomputeDoubleStageProgression;
    const bracketHandlers = createBracketHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
      completeMatchWithRandomScores: matchHandlers.completeMatchWithRandomScores,
    });
    const coreHandlers = createTournamentCoreHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
      registerPlayer: this.delegateRegisterPlayer.bind(this),
      canViewDraftLive: this.canViewDraftLive.bind(this),
      liveViewCacheTtlMs: config.performance.liveEndpointCacheTtlSeconds * 1000,
    });

    Object.assign(
      this,
      matchHandlers,
      statusHandlers,
      bracketHandlers,
      playerHandlers,
      groupHandlers,
      poolStageHandlers,
      coreHandlers
    );

    this.initializeAutosaveHooks();
  }

  private initializeAutosaveHooks(): void {
    this.initializeTournamentAutosaveHooks();
    this.initializeMatchAutosaveHooks();
    this.initializeBracketAutosaveHooks();
    this.initializePlayerAutosaveHooks();
    this.initializeDoubletteAutosaveHooks();
    this.initializeEquipeAutosaveHooks();
    this.initializePoolStageAutosaveHooks();
    this.deleteTournament = this.wrapDeleteWithAutosaveCleanup(this.deleteTournament);
  }

  private initializeTournamentAutosaveHooks(): void {
    this.createTournament = this.wrapCreateWithAutosave(this.createTournament, 'CREATE_TOURNAMENT');
    this.updateTournament = this.wrapMutationWithAutosave(this.updateTournament, extractTournamentId, 'UPDATE_TOURNAMENT');
    this.uploadTournamentLogo = this.wrapMutationWithAutosave(this.uploadTournamentLogo, extractTournamentId, 'UPLOAD_TOURNAMENT_LOGO');
    this.deleteTournamentLogo = this.wrapMutationWithAutosave(this.deleteTournamentLogo, extractTournamentId, 'DELETE_TOURNAMENT_LOGO');
    this.transitionTournamentStatus = this.wrapMutationWithAutosave(this.transitionTournamentStatus, extractTournamentId, 'TRANSITION_TOURNAMENT_STATUS');
    this.openTournamentRegistration = this.wrapMutationWithAutosave(this.openTournamentRegistration, extractTournamentId, 'OPEN_TOURNAMENT_REGISTRATION');
    this.startTournament = this.wrapMutationWithAutosave(this.startTournament, extractTournamentId, 'START_TOURNAMENT');
    this.completeTournament = this.wrapMutationWithAutosave(this.completeTournament, extractTournamentId, 'COMPLETE_TOURNAMENT');
  }

  private initializeMatchAutosaveHooks(): void {
    this.updateMatchStatus = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(
      this.updateMatchStatus,
      extractTournamentId,
      'UPDATE_MATCH_STATUS'
    );
    this.completeMatch = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(
      this.completeMatch,
      extractTournamentId,
      'COMPLETE_MATCH'
    );
    this.saveMatchScores = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(
      this.saveMatchScores,
      extractTournamentId,
      'SAVE_MATCH_SCORES'
    );
  }

  private wrapMutationWithAutosaveAndLiveCacheInvalidation<TArguments extends unknown[], TResult>(
    method: (...arguments_: TArguments) => Promise<TResult>,
    getTournamentId: (...arguments_: TArguments) => string,
    action: string
  ): (...arguments_: TArguments) => Promise<TResult> {
    const wrapped = this.wrapMutationWithAutosave(method, getTournamentId, action);

    return async (...arguments_: TArguments): Promise<TResult> => {
      const result = await wrapped(...arguments_);
      const tournamentId = getTournamentId(...arguments_);
      await this.invalidateLiveCachesForTournament(tournamentId);
      return result;
    };
  }

  private async invalidateLiveCachesForTournament(tournamentId: string): Promise<void> {
    liveComputationCache.invalidateTournament(tournamentId);

    if (config.env === 'test') {
      return;
    }

    try {
      const client = redis.getClient();
      const cacheKeys = new Set<string>([
        `tournaments:live:${tournamentId}:admin`,
        `tournaments:live:${tournamentId}:public`,
      ]);

      const summaryKeys = await client.keys('tournaments:live-summary:*');
      const listKeys = await client.keys('tournaments:list:*');
      const poolStageKeys = await client.keys('tournaments:pool-stages:*');
      const poolStagePoolsKeys = await client.keys('tournaments:pool-stage-pools:*');

      for (const key of [...summaryKeys, ...listKeys, ...poolStageKeys, ...poolStagePoolsKeys]) {
        cacheKeys.add(key);
      }

      if (cacheKeys.size > 0) {
        await client.del([...cacheKeys]);
      }
    } catch (error) {
      this.logger.error('Failed to invalidate live caches', tournamentId, error);
    }
  }

  private initializeBracketAutosaveHooks(): void {
    this.createBracket = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.createBracket, extractTournamentId, 'CREATE_BRACKET');
    this.updateBracket = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.updateBracket, extractTournamentId, 'UPDATE_BRACKET');
    this.deleteBracket = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.deleteBracket, extractTournamentId, 'DELETE_BRACKET');
    this.updateBracketTargets = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.updateBracketTargets, extractTournamentId, 'UPDATE_BRACKET_TARGETS');
    this.completeBracketRoundWithRandomScores = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.completeBracketRoundWithRandomScores, extractTournamentId, 'COMPLETE_BRACKET_ROUND');
    this.resetBracketMatches = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.resetBracketMatches, extractTournamentId, 'RESET_BRACKET_MATCHES');
  }

  private initializePlayerAutosaveHooks(): void {
    this.registerPlayer = this.wrapMutationWithAutosave(this.registerPlayer, extractTournamentId, 'REGISTER_PLAYER');
    this.registerPlayerDetails = this.wrapMutationWithAutosave(this.registerPlayerDetails, extractTournamentId, 'REGISTER_PLAYER_DETAILS');
    this.unregisterPlayer = this.wrapMutationWithAutosave(this.unregisterPlayer, extractTournamentId, 'UNREGISTER_PLAYER');
    this.updateTournamentPlayer = this.wrapMutationWithAutosave(this.updateTournamentPlayer, extractTournamentId, 'UPDATE_TOURNAMENT_PLAYER');
    this.updateTournamentPlayerCheckIn = this.wrapMutationWithAutosave(this.updateTournamentPlayerCheckIn, extractTournamentId, 'UPDATE_PLAYER_CHECKIN');
  }

  private initializeDoubletteAutosaveHooks(): void {
    this.createDoublette = this.wrapMutationWithAutosave(this.createDoublette, extractTournamentId, 'CREATE_DOUBLETTE');
    this.updateDoublette = this.wrapMutationWithAutosave(this.updateDoublette, extractTournamentId, 'UPDATE_DOUBLETTE');
    this.joinDoublette = this.wrapMutationWithAutosave(this.joinDoublette, extractTournamentId, 'JOIN_DOUBLETTE');
    this.addDoubletteMember = this.wrapMutationWithAutosave(this.addDoubletteMember, extractTournamentId, 'ADD_DOUBLETTE_MEMBER');
    this.removeDoubletteMember = this.wrapMutationWithAutosave(this.removeDoubletteMember, extractTournamentId, 'REMOVE_DOUBLETTE_MEMBER');
    this.leaveDoublette = this.wrapMutationWithAutosave(this.leaveDoublette, extractTournamentId, 'LEAVE_DOUBLETTE');
    this.registerDoublette = this.wrapMutationWithAutosave(this.registerDoublette, extractTournamentId, 'REGISTER_DOUBLETTE');
    this.unregisterDoublette = this.wrapMutationWithAutosave(this.unregisterDoublette, extractTournamentId, 'UNREGISTER_DOUBLETTE');
    this.deleteDoublette = this.wrapMutationWithAutosave(this.deleteDoublette, extractTournamentId, 'DELETE_DOUBLETTE');
    this.updateDoublettePassword = this.wrapMutationWithAutosave(this.updateDoublettePassword, extractTournamentId, 'UPDATE_DOUBLETTE_PASSWORD');
  }

  private initializeEquipeAutosaveHooks(): void {
    this.createEquipe = this.wrapMutationWithAutosave(this.createEquipe, extractTournamentId, 'CREATE_EQUIPE');
    this.updateEquipe = this.wrapMutationWithAutosave(this.updateEquipe, extractTournamentId, 'UPDATE_EQUIPE');
    this.joinEquipe = this.wrapMutationWithAutosave(this.joinEquipe, extractTournamentId, 'JOIN_EQUIPE');
    this.addEquipeMember = this.wrapMutationWithAutosave(this.addEquipeMember, extractTournamentId, 'ADD_EQUIPE_MEMBER');
    this.removeEquipeMember = this.wrapMutationWithAutosave(this.removeEquipeMember, extractTournamentId, 'REMOVE_EQUIPE_MEMBER');
    this.leaveEquipe = this.wrapMutationWithAutosave(this.leaveEquipe, extractTournamentId, 'LEAVE_EQUIPE');
    this.registerEquipe = this.wrapMutationWithAutosave(this.registerEquipe, extractTournamentId, 'REGISTER_EQUIPE');
    this.unregisterEquipe = this.wrapMutationWithAutosave(this.unregisterEquipe, extractTournamentId, 'UNREGISTER_EQUIPE');
    this.deleteEquipe = this.wrapMutationWithAutosave(this.deleteEquipe, extractTournamentId, 'DELETE_EQUIPE');
    this.updateEquipePassword = this.wrapMutationWithAutosave(this.updateEquipePassword, extractTournamentId, 'UPDATE_EQUIPE_PASSWORD');
  }

  private initializePoolStageAutosaveHooks(): void {
    this.createPoolStage = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.createPoolStage, extractTournamentId, 'CREATE_POOL_STAGE');
    this.updatePoolStage = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.updatePoolStage, extractTournamentId, 'UPDATE_POOL_STAGE');
    this.recomputeDoubleStageProgression = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.recomputeDoubleStageProgression, extractTournamentId, 'RECOMPUTE_DOUBLE_STAGE');
    this.completePoolStageWithRandomScores = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.completePoolStageWithRandomScores, extractTournamentId, 'COMPLETE_POOL_STAGE');
    this.populateBracketFromPools = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.populateBracketFromPools, extractTournamentId, 'POPULATE_BRACKET_FROM_POOLS');
    this.deletePoolStage = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.deletePoolStage, extractTournamentId, 'DELETE_POOL_STAGE');
    this.resetPoolMatches = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.resetPoolMatches, extractTournamentId, 'RESET_POOL_MATCHES');
    this.updatePoolAssignments = this.wrapMutationWithAutosaveAndLiveCacheInvalidation(this.updatePoolAssignments, extractTournamentId, 'UPDATE_POOL_ASSIGNMENTS');
  }

  private async getCachedTournamentLiveView(tournamentId: string) {
    return liveComputationCache.getOrLoadLiveView(
      tournamentId,
      () => this.tournamentModel.findLiveView(tournamentId),
      config.performance.liveEndpointCacheTtlSeconds * 1000
    );
  }

  private isAdminAction(): boolean {
    return this.isAdminActionContext;
  }

  private getActorEmailForAction(): string | undefined {
    return this.actorEmail;
  }

  private canViewDraftLive(): boolean {
    return this.isAdminActionContext;
  }

  private async delegateRecomputeDoubleStageProgression(tournamentId: string, stageId: string): Promise<void> {
    await (this.recomputeDoubleStageProgressionReference?.(tournamentId, stageId));
  }

  private delegateTransitionTournamentStatus(
    tournamentId: Parameters<StatusHandlers['transitionTournamentStatus']>[0],
    status: Parameters<StatusHandlers['transitionTournamentStatus']>[1]
  ): ReturnType<StatusHandlers['transitionTournamentStatus']> {
    return this.transitionTournamentStatus(tournamentId, status);
  }

  private delegateRegisterPlayer(
    tournamentId: Parameters<PlayerHandlers['registerPlayer']>[0],
    playerId: Parameters<PlayerHandlers['registerPlayer']>[1]
  ): ReturnType<PlayerHandlers['registerPlayer']> {
    return this.registerPlayer(tournamentId, playerId);
  }

  private resolveActorContext(request?: Request): {
    isAdminRequest: boolean;
    actorId?: string;
    actorEmail?: string;
  } {
    const isAdminRequest = request ? isAdmin(request) : false;
    const actorId = this.extractActorId(request);
    const actorEmail = this.extractActorEmail(request);

    return {
      isAdminRequest,
      ...(actorId ? { actorId } : {}),
      ...(actorEmail ? { actorEmail } : {}),
    };
  }

  private extractActorId(request?: Request): string | undefined {
    const requestWithUser = request as (Request & { user?: { id?: string } }) | undefined;
    return requestWithUser?.user?.id;
  }

  private extractActorEmail(request?: Request): string | undefined {
    const rawPayload = request?.auth?.payload;
    if (!rawPayload || typeof rawPayload !== 'object') {
      return undefined;
    }

    const authPayload = rawPayload as Record<string, unknown>;
    const emailValue =
      authPayload.email
      ?? authPayload['https://darts-tournament.app/email']
      ?? authPayload['https://your-domain.com/email'];
    return typeof emailValue === 'string' && emailValue ? emailValue : undefined;
  }

  private wrapMutationWithAutosave<TArguments extends unknown[], TResult>(
    method: (...arguments_: TArguments) => Promise<TResult>,
    getTournamentId: (...arguments_: TArguments) => string,
    action: string
  ): (...arguments_: TArguments) => Promise<TResult> {
    return async (...arguments_: TArguments): Promise<TResult> => {
      const result = await method(...arguments_);
      const tournamentId = getTournamentId(...arguments_);
      await this.persistTournamentSnapshotSafe(tournamentId, action);
      return result;
    };
  }

  private wrapCreateWithAutosave<TArguments extends unknown[], TResult extends { id: string }>(
    method: (...arguments_: TArguments) => Promise<TResult>,
    action: string
  ): (...arguments_: TArguments) => Promise<TResult> {
    return async (...arguments_: TArguments): Promise<TResult> => {
      const result = await method(...arguments_);
      await this.persistTournamentSnapshotSafe(result.id, action);
      return result;
    };
  }

  private wrapDeleteWithAutosaveCleanup<TArguments extends [string, ...unknown[]], TResult>(
    method: (...arguments_: TArguments) => Promise<TResult>
  ): (...arguments_: TArguments) => Promise<TResult> {
    return async (...arguments_: TArguments): Promise<TResult> => {
      const result = await method(...arguments_);
      await this.deleteTournamentSnapshotSafe(arguments_[0]);
      return result;
    };
  }

  private async persistTournamentSnapshotSafe(tournamentId: string, action: string): Promise<void> {
    try {
      await saveTournamentSnapshot(this.tournamentModel, tournamentId, {
        action,
        ...(this.actorId ? { actorId: this.actorId } : {}),
        ...(this.actorEmail ? { actorEmail: this.actorEmail } : {}),
        trigger: this.isAdminActionContext ? 'admin' : 'system',
      });
    } catch (error) {
      this.logger.error('Failed to persist tournament autosave snapshot', tournamentId, error);
    }
  }

  private async deleteTournamentSnapshotSafe(tournamentId: string): Promise<void> {
    try {
      await deleteTournamentSnapshot(tournamentId);
    } catch (error) {
      this.logger.error('Failed to delete tournament autosave snapshot', tournamentId, error);
    }
  }

  private validateUUID(id: string): void {
    const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('Invalid tournament ID format', 400, 'INVALID_TOURNAMENT_ID');
    }
  }
}

export default TournamentService;
