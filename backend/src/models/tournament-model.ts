import { PrismaClient } from '@prisma/client';
import { createTournamentModelCore, type TournamentModelCoreHandlers } from './tournament-model/tournaments';
import {
  createTournamentModelPlayers,
  type TournamentModelPlayerHandlers,
} from './tournament-model/players';
import {
  createTournamentModelPoolStages,
  type TournamentModelPoolStageHandlers,
} from './tournament-model/pool-stages';
import {
  createTournamentModelBrackets,
  type TournamentModelBracketHandlers,
} from './tournament-model/brackets';
import {
  createTournamentModelMatches,
  type TournamentModelMatchHandlers,
} from './tournament-model/matches';
import {
  createTournamentModelStats,
  type TournamentModelStatsHandlers,
} from './tournament-model/stats';

export class TournamentModel {
  public findById!: TournamentModelCoreHandlers['findById'];
  public findLiveView!: TournamentModelCoreHandlers['findLiveView'];
  public findAll!: TournamentModelCoreHandlers['findAll'];
  public create!: TournamentModelCoreHandlers['create'];
  public getMaxTargetNumber!: TournamentModelCoreHandlers['getMaxTargetNumber'];
  public createTargetsForTournament!: TournamentModelCoreHandlers['createTargetsForTournament'];
  public update!: TournamentModelCoreHandlers['update'];
  public delete!: TournamentModelCoreHandlers['delete'];
  public updateLogo!: TournamentModelCoreHandlers['updateLogo'];
  public findByDateRange!: TournamentModelCoreHandlers['findByDateRange'];
  public isEditable!: TournamentModelCoreHandlers['isEditable'];
  public updateStatus!: TournamentModelCoreHandlers['updateStatus'];

  public findPersonByEmailAndPhone!: TournamentModelPlayerHandlers['findPersonByEmailAndPhone'];
  public createPerson!: TournamentModelPlayerHandlers['createPerson'];
  public updatePerson!: TournamentModelPlayerHandlers['updatePerson'];
  public getPlayerById!: TournamentModelPlayerHandlers['getPlayerById'];
  public registerPlayer!: TournamentModelPlayerHandlers['registerPlayer'];
  public createPlayer!: TournamentModelPlayerHandlers['createPlayer'];
  public unregisterPlayer!: TournamentModelPlayerHandlers['unregisterPlayer'];
  public isPlayerRegistered!: TournamentModelPlayerHandlers['isPlayerRegistered'];
  public getParticipantCount!: TournamentModelPlayerHandlers['getParticipantCount'];
  public getCheckedInCount!: TournamentModelPlayerHandlers['getCheckedInCount'];
  public getParticipants!: TournamentModelPlayerHandlers['getParticipants'];
  public getOrphanParticipants!: TournamentModelPlayerHandlers['getOrphanParticipants'];
  public updatePlayerCheckIn!: TournamentModelPlayerHandlers['updatePlayerCheckIn'];
  public updatePlayer!: TournamentModelPlayerHandlers['updatePlayer'];
  public findPlayerBySurname!: TournamentModelPlayerHandlers['findPlayerBySurname'];
  public findPlayerByTeamName!: TournamentModelPlayerHandlers['findPlayerByTeamName'];

  public getPoolStages!: TournamentModelPoolStageHandlers['getPoolStages'];
  public createPoolStage!: TournamentModelPoolStageHandlers['createPoolStage'];
  public updatePoolStage!: TournamentModelPoolStageHandlers['updatePoolStage'];
  public getPoolStageById!: TournamentModelPoolStageHandlers['getPoolStageById'];
  public getPoolCountForStage!: TournamentModelPoolStageHandlers['getPoolCountForStage'];
  public getPoolsForStage!: TournamentModelPoolStageHandlers['getPoolsForStage'];
  public getPoolsWithAssignmentsForStage!: TournamentModelPoolStageHandlers['getPoolsWithAssignmentsForStage'];
  public getPoolsWithMatchesForStage!: TournamentModelPoolStageHandlers['getPoolsWithMatchesForStage'];
  public getMatchesForPoolStage!: TournamentModelPoolStageHandlers['getMatchesForPoolStage'];
  public getPoolAssignmentCountForStage!: TournamentModelPoolStageHandlers['getPoolAssignmentCountForStage'];
  public getOpponentPairsBeforeStage!: TournamentModelPoolStageHandlers['getOpponentPairsBeforeStage'];
  public getActivePlayersForTournament!: TournamentModelPoolStageHandlers['getActivePlayersForTournament'];
  public createPoolAssignments!: TournamentModelPoolStageHandlers['createPoolAssignments'];
  public deletePoolAssignmentsForStage!: TournamentModelPoolStageHandlers['deletePoolAssignmentsForStage'];
  public getMatchCountForPool!: TournamentModelPoolStageHandlers['getMatchCountForPool'];
  public createPoolMatches!: TournamentModelPoolStageHandlers['createPoolMatches'];
  public createPoolsForStage!: TournamentModelPoolStageHandlers['createPoolsForStage'];
  public deletePoolStage!: TournamentModelPoolStageHandlers['deletePoolStage'];
  public updatePoolStatuses!: TournamentModelPoolStageHandlers['updatePoolStatuses'];
  public completePoolsForStage!: TournamentModelPoolStageHandlers['completePoolsForStage'];
  public completeMatchesForStage!: TournamentModelPoolStageHandlers['completeMatchesForStage'];

  public createBracketEntries!: TournamentModelBracketHandlers['createBracketEntries'];
  public deleteBracketEntriesForBracket!: TournamentModelBracketHandlers['deleteBracketEntriesForBracket'];
  public getMatchCountForBracket!: TournamentModelBracketHandlers['getMatchCountForBracket'];
  public deleteMatchesForBracket!: TournamentModelBracketHandlers['deleteMatchesForBracket'];
  public createBracketMatches!: TournamentModelBracketHandlers['createBracketMatches'];
  public createBracketMatchWithSlots!: TournamentModelBracketHandlers['createBracketMatchWithSlots'];
  public getBracketById!: TournamentModelBracketHandlers['getBracketById'];
  public getBracketMatchesByRound!: TournamentModelBracketHandlers['getBracketMatchesByRound'];
  public getBracketMatchesByRoundWithPlayers!: TournamentModelBracketHandlers['getBracketMatchesByRoundWithPlayers'];
  public getBracketMatchCountByRound!: TournamentModelBracketHandlers['getBracketMatchCountByRound'];
  public getBracketEntryCount!: TournamentModelBracketHandlers['getBracketEntryCount'];
  public setBracketMatchPlayers!: TournamentModelBracketHandlers['setBracketMatchPlayers'];
  public setBracketMatchPlayerPosition!: TournamentModelBracketHandlers['setBracketMatchPlayerPosition'];
  public getBrackets!: TournamentModelBracketHandlers['getBrackets'];
  public createBracket!: TournamentModelBracketHandlers['createBracket'];
  public updateBracket!: TournamentModelBracketHandlers['updateBracket'];
  public deleteBracket!: TournamentModelBracketHandlers['deleteBracket'];

  public getMatchById!: TournamentModelMatchHandlers['getMatchById'];
  public getTargetById!: TournamentModelMatchHandlers['getTargetById'];
  public getMatchPoolStageId!: TournamentModelMatchHandlers['getMatchPoolStageId'];
  public updateMatchStatus!: TournamentModelMatchHandlers['updateMatchStatus'];
  public startMatchWithTarget!: TournamentModelMatchHandlers['startMatchWithTarget'];
  public finishMatchAndReleaseTarget!: TournamentModelMatchHandlers['finishMatchAndReleaseTarget'];
  public setTargetAvailable!: TournamentModelMatchHandlers['setTargetAvailable'];
  public getMatchWithPlayerMatches!: TournamentModelMatchHandlers['getMatchWithPlayerMatches'];
  public getMatchDetailsForNotification!: TournamentModelMatchHandlers['getMatchDetailsForNotification'];
  public completeMatch!: TournamentModelMatchHandlers['completeMatch'];
  public updateMatchScores!: TournamentModelMatchHandlers['updateMatchScores'];

  public getOverallStats!: TournamentModelStatsHandlers['getOverallStats'];

  constructor(prisma: PrismaClient) {
    Object.assign(
      this,
      createTournamentModelCore(prisma),
      createTournamentModelPlayers(prisma),
      createTournamentModelPoolStages(prisma),
      createTournamentModelBrackets(prisma),
      createTournamentModelMatches(prisma),
      createTournamentModelStats(prisma)
    );
  }
}

export default TournamentModel;
