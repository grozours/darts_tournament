import { TournamentModel } from '../models/tournament-model';
import { PrismaClient } from '@prisma/client';
import TournamentLogger from '../utils/tournament-logger';
import { Request } from 'express';
import { AppError } from '../middleware/error-handler';
import { createBracketHandlers } from './tournament-service/bracket-handlers';
import { createPlayerHandlers } from './tournament-service/player-handlers';
import { createPoolStageHandlers } from './tournament-service/pool-stage-handlers';
import { createMatchHandlers } from './tournament-service/match-handlers';
import { createStatusHandlers } from './tournament-service/status-handlers';
import {
  createTournamentCoreHandlers,
  type TournamentCoreHandlers,
} from './tournament-service/core-handlers';

export type { CreateTournamentData, TournamentFilters } from './tournament-service/core-handlers';

type BracketHandlers = ReturnType<typeof createBracketHandlers>;
type PlayerHandlers = ReturnType<typeof createPlayerHandlers>;
type PoolStageHandlers = ReturnType<typeof createPoolStageHandlers>;
type MatchHandlers = ReturnType<typeof createMatchHandlers>;
type StatusHandlers = ReturnType<typeof createStatusHandlers>;

export class TournamentService {
  private readonly tournamentModel: TournamentModel;
  private readonly logger: TournamentLogger;

  public createTournament!: TournamentCoreHandlers['createTournament'];
  public getTournamentById!: TournamentCoreHandlers['getTournamentById'];
  public getTournamentLiveView!: TournamentCoreHandlers['getTournamentLiveView'];
  public getTournaments!: TournamentCoreHandlers['getTournaments'];
  public updateTournament!: TournamentCoreHandlers['updateTournament'];
  public deleteTournament!: TournamentCoreHandlers['deleteTournament'];
  public uploadTournamentLogo!: TournamentCoreHandlers['uploadTournamentLogo'];
  public getTournamentsByDateRange!: TournamentCoreHandlers['getTournamentsByDateRange'];
  public isTournamentNameAvailable!: TournamentCoreHandlers['isTournamentNameAvailable'];
  public getTournamentStats!: TournamentCoreHandlers['getTournamentStats'];
  public validateRegistrationConstraints!: TournamentCoreHandlers['validateRegistrationConstraints'];
  public getOverallTournamentStats!: TournamentCoreHandlers['getOverallTournamentStats'];

  public transitionTournamentStatus!: StatusHandlers['transitionTournamentStatus'];
  public openTournamentRegistration!: StatusHandlers['openTournamentRegistration'];
  public startTournament!: StatusHandlers['startTournament'];
  public completeTournament!: StatusHandlers['completeTournament'];

  public updateMatchStatus!: MatchHandlers['updateMatchStatus'];
  public completeMatch!: MatchHandlers['completeMatch'];
  public updateCompletedMatchScores!: MatchHandlers['updateCompletedMatchScores'];
  public completeMatchWithRandomScores!: MatchHandlers['completeMatchWithRandomScores'];

  public getBrackets!: BracketHandlers['getBrackets'];
  public createBracket!: BracketHandlers['createBracket'];
  public updateBracket!: BracketHandlers['updateBracket'];
  public deleteBracket!: BracketHandlers['deleteBracket'];
  public completeBracketRoundWithRandomScores!: BracketHandlers['completeBracketRoundWithRandomScores'];

  public registerPlayer!: PlayerHandlers['registerPlayer'];
  public registerPlayerDetails!: PlayerHandlers['registerPlayerDetails'];
  public unregisterPlayer!: PlayerHandlers['unregisterPlayer'];
  public getPlayerById!: PlayerHandlers['getPlayerById'];
  public updateTournamentPlayer!: PlayerHandlers['updateTournamentPlayer'];
  public updateTournamentPlayerCheckIn!: PlayerHandlers['updateTournamentPlayerCheckIn'];
  public getTournamentParticipants!: PlayerHandlers['getTournamentParticipants'];
  public getOrphanParticipants!: PlayerHandlers['getOrphanParticipants'];

  public getPoolStages!: PoolStageHandlers['getPoolStages'];
  public createPoolStage!: PoolStageHandlers['createPoolStage'];
  public updatePoolStage!: PoolStageHandlers['updatePoolStage'];
  public completePoolStageWithRandomScores!: PoolStageHandlers['completePoolStageWithRandomScores'];
  public deletePoolStage!: PoolStageHandlers['deletePoolStage'];
  public getPoolStagePools!: PoolStageHandlers['getPoolStagePools'];
  public updatePoolAssignments!: PoolStageHandlers['updatePoolAssignments'];

  constructor(prisma: PrismaClient, request?: Request) {
    this.tournamentModel = new TournamentModel(prisma);
    this.logger = new TournamentLogger(request);
    const loggerProxy = {
      accessError: (...args: Parameters<TournamentLogger['accessError']>) =>
        this.logger.accessError(...args),
      validationError: (...args: Parameters<TournamentLogger['validationError']>) =>
        this.logger.validationError(...args),
      tournamentCreated: (...args: Parameters<TournamentLogger['tournamentCreated']>) =>
        this.logger.tournamentCreated(...args),
      tournamentUpdated: (...args: Parameters<TournamentLogger['tournamentUpdated']>) =>
        this.logger.tournamentUpdated(...args),
      tournamentDeleted: (...args: Parameters<TournamentLogger['tournamentDeleted']>) =>
        this.logger.tournamentDeleted(...args),
      tournamentStatusChanged: (...args: Parameters<TournamentLogger['tournamentStatusChanged']>) =>
        this.logger.tournamentStatusChanged(...args),
      playerRegistered: (...args: Parameters<TournamentLogger['playerRegistered']>) =>
        this.logger.playerRegistered(...args),
      playerUnregistered: (...args: Parameters<TournamentLogger['playerUnregistered']>) =>
        this.logger.playerUnregistered(...args),
      logoUploaded: (...args: Parameters<TournamentLogger['logoUploaded']>) =>
        this.logger.logoUploaded(...args),
      logoDeleted: (...args: Parameters<TournamentLogger['logoDeleted']>) =>
        this.logger.logoDeleted(...args),
      error: (...args: Parameters<TournamentLogger['error']>) =>
        this.logger.error(...args),
    } as TournamentLogger;

    const statusHandlers = createStatusHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
    });
    const matchHandlers = createMatchHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
      transitionTournamentStatus: (tournamentId, status) =>
        this.transitionTournamentStatus(tournamentId, status),
    });
    const playerHandlers = createPlayerHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
      transitionTournamentStatus: (tournamentId, status) =>
        this.transitionTournamentStatus(tournamentId, status),
    });
    const poolStageHandlers = createPoolStageHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
      completeMatchWithRandomScores: matchHandlers.completeMatchWithRandomScores,
    });
    const bracketHandlers = createBracketHandlers({
      tournamentModel: this.tournamentModel,
      validateUUID: this.validateUUID.bind(this),
      completeMatchWithRandomScores: matchHandlers.completeMatchWithRandomScores,
    });
    const coreHandlers = createTournamentCoreHandlers({
      tournamentModel: this.tournamentModel,
      logger: loggerProxy,
      validateUUID: this.validateUUID.bind(this),
      registerPlayer: (tournamentId, playerId) => this.registerPlayer(tournamentId, playerId),
    });

    Object.assign(
      this,
      matchHandlers,
      statusHandlers,
      bracketHandlers,
      playerHandlers,
      poolStageHandlers,
      coreHandlers
    );
  }

  private validateUUID(id: string): void {
    const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('Invalid tournament ID format', 400, 'INVALID_TOURNAMENT_ID');
    }
  }
}

export default TournamentService;
