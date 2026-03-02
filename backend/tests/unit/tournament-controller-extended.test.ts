import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TournamentController from '../../src/controllers/tournament-controller';
import { AppError } from '../../src/middleware/error-handler';
import { MatchStatus } from '../../../shared/src/types';
import { isAdmin } from '../../src/middleware/auth';

type MockFn = ReturnType<typeof jest.fn>;

let mockService: any;

jest.mock('../../src/services/tournament-service', () => ({
  TournamentService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../src/middleware/auth', () => ({
  isAdmin: jest.fn(() => true),
}));

const buildResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  send: jest.fn(),
});

const buildRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  body: {},
  params: {},
  query: {},
  ...overrides,
});

const TOURNAMENT_ID = 't-1';
const STAGE_ID = 's-1';
const MATCH_ID = 'm-1';
const BRACKET_ID = 'b-1';

const buildTournamentRequest = (
  params: Record<string, unknown> = {},
  body: Record<string, unknown> = {}
) => buildRequest({ params: { id: TOURNAMENT_ID, ...params }, body });

describe('tournament-controller extended handlers', () => {
  let controller: TournamentController;
  const isAdminMock = isAdmin as unknown as MockFn;

  const buildDefaultService = () => ({
    registerPlayer: jest.fn(async () => undefined),
    registerPlayerDetails: jest.fn(async () => ({ id: 'player-1' })),
    unregisterPlayer: jest.fn(async () => undefined),
    getPlayerById: jest.fn(async () => ({ id: 'player-1', tournamentId: TOURNAMENT_ID, email: 'player@example.com' })),
    getTournamentParticipants: jest.fn(async () => []),
    getOrphanParticipants: jest.fn(async () => []),
    listDoublettes: jest.fn(async () => []),
    createDoublette: jest.fn(async () => ({ id: 'd-1' })),
    updateDoublette: jest.fn(async () => ({ id: 'd-1' })),
    joinDoublette: jest.fn(async () => ({ id: 'd-1' })),
    addDoubletteMember: jest.fn(async () => ({ id: 'd-1' })),
    removeDoubletteMember: jest.fn(async () => ({ id: 'd-1' })),
    leaveDoublette: jest.fn(async () => ({})),
    registerDoublette: jest.fn(async () => ({})),
    deleteDoublette: jest.fn(async () => undefined),
    updateDoublettePassword: jest.fn(async () => undefined),
    listEquipes: jest.fn(async () => []),
    createEquipe: jest.fn(async () => ({ id: 'e-1' })),
    updateEquipe: jest.fn(async () => ({ id: 'e-1' })),
    joinEquipe: jest.fn(async () => ({ id: 'e-1' })),
    addEquipeMember: jest.fn(async () => ({ id: 'e-1' })),
    removeEquipeMember: jest.fn(async () => ({ id: 'e-1' })),
    leaveEquipe: jest.fn(async () => ({})),
    registerEquipe: jest.fn(async () => ({})),
    deleteEquipe: jest.fn(async () => undefined),
    updateEquipePassword: jest.fn(async () => undefined),
    searchGroupPlayers: jest.fn(async () => []),
    getPoolStages: jest.fn(async () => []),
    createPoolStage: jest.fn(async () => ({ id: 'stage-1' })),
    updatePoolStage: jest.fn(async () => ({ id: STAGE_ID })),
    recomputeDoubleStageProgression: jest.fn(async () => undefined),
    populateBracketFromPools: jest.fn(async () => undefined),
    completePoolStageWithRandomScores: jest.fn(async () => undefined),
    deletePoolStage: jest.fn(async () => undefined),
    getPoolStagePools: jest.fn(async () => []),
    resetPoolMatches: jest.fn(async () => undefined),
    updatePoolAssignments: jest.fn(async () => undefined),
    updateMatchStatus: jest.fn(async () => undefined),
    completeMatch: jest.fn(async () => undefined),
    saveMatchScores: jest.fn(async () => undefined),
    completeBracketRoundWithRandomScores: jest.fn(async () => undefined),
    resetBracketMatches: jest.fn(async () => undefined),
    getBrackets: jest.fn(async () => []),
    createBracket: jest.fn(async () => ({ id: BRACKET_ID })),
    updateBracket: jest.fn(async () => ({ id: BRACKET_ID })),
    updateBracketTargets: jest.fn(async () => ({ id: BRACKET_ID })),
    deleteBracket: jest.fn(async () => undefined),
    getTournamentTargets: jest.fn(async () => []),
    updateTournamentPlayer: jest.fn(async () => ({ id: 'player-1' })),
    updateTournamentPlayerCheckIn: jest.fn(async () => ({ id: 'player-1', checkedIn: true })),
    validateRegistrationConstraints: jest.fn(async () => ({ canRegister: true, reasons: [] })),
    transitionTournamentStatus: jest.fn(async () => ({ id: TOURNAMENT_ID, status: 'LIVE' })),
    openTournamentRegistration: jest.fn(async () => ({ id: TOURNAMENT_ID, status: 'OPEN' })),
    startTournament: jest.fn(async () => ({ id: TOURNAMENT_ID, status: 'LIVE' })),
    completeTournament: jest.fn(async () => ({ id: TOURNAMENT_ID, status: 'FINISHED' })),
    getOverallTournamentStats: jest.fn(async () => ({ totalTournaments: 0 })),
  });

  beforeEach(() => {
    mockService = buildDefaultService();
    isAdminMock.mockReturnValue(true);
    controller = new TournamentController({} as never);
  });

  it('returns orphan players payload', async () => {
    const request = buildRequest();
    const response = buildResponse();
    mockService.getOrphanParticipants.mockResolvedValue([{ id: 'p-1' }]);

    await controller.getOrphanPlayers(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith({ players: [{ id: 'p-1' }], totalCount: 1 });
  });

  it('handles orphan players service errors', async () => {
    const request = buildRequest();
    const response = buildResponse();
    mockService.getOrphanParticipants.mockRejectedValue(new AppError('boom', 400, 'BAD_REQUEST'));

    await controller.getOrphanPlayers(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('creates a pool stage', async () => {
    const request = buildTournamentRequest({}, { name: 'Stage A' });
    const response = buildResponse();
    mockService.createPoolStage.mockResolvedValue({ id: 'stage-1' });

    await controller.createPoolStage(request as never, response as never);

    expect(mockService.createPoolStage).toHaveBeenCalledWith(TOURNAMENT_ID, { name: 'Stage A' });
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('updates a pool stage', async () => {
    const request = buildTournamentRequest({ stageId: STAGE_ID }, { name: 'Updated' });
    const response = buildResponse();
    mockService.updatePoolStage.mockResolvedValue({ id: STAGE_ID });

    await controller.updatePoolStage(request as never, response as never);

    expect(mockService.updatePoolStage).toHaveBeenCalledWith(TOURNAMENT_ID, STAGE_ID, { name: 'Updated' });
    expect(response.json).toHaveBeenCalledWith({ id: STAGE_ID });
  });

  it('updates pool stage assignments with empty fallback', async () => {
    const request = buildTournamentRequest({ stageId: STAGE_ID }, {});
    const response = buildResponse();

    await controller.updatePoolStageAssignments(request as never, response as never);

    expect(mockService.updatePoolAssignments).toHaveBeenCalledWith(TOURNAMENT_ID, STAGE_ID, []);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('updates match status with target id', async () => {
    const request = buildRequest({
      params: { id: TOURNAMENT_ID, matchId: MATCH_ID },
      body: { status: MatchStatus.IN_PROGRESS, targetId: 'target-1' },
    });
    const response = buildResponse();

    await controller.updateMatchStatus(request as never, response as never);

    expect(mockService.updateMatchStatus).toHaveBeenCalledWith(
      TOURNAMENT_ID,
      MATCH_ID,
      MatchStatus.IN_PROGRESS,
      'target-1',
      undefined
    );
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('completes match with empty scores fallback', async () => {
    const request = buildTournamentRequest({ matchId: MATCH_ID }, {});
    const response = buildResponse();

    await controller.completeMatch(request as never, response as never);

    expect(mockService.completeMatch).toHaveBeenCalledWith(TOURNAMENT_ID, MATCH_ID, []);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('saves match scores', async () => {
    const request = buildRequest({
      params: { id: TOURNAMENT_ID, matchId: MATCH_ID },
      body: { scores: [{ playerId: 'p-1', scoreTotal: 3 }] },
    });
    const response = buildResponse();

    await controller.saveMatchScores(request as never, response as never);

    expect(mockService.saveMatchScores).toHaveBeenCalledWith(TOURNAMENT_ID, MATCH_ID, [{ playerId: 'p-1', scoreTotal: 3 }]);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('completes bracket round with numeric round number', async () => {
    const request = buildTournamentRequest({ bracketId: BRACKET_ID, roundNumber: '2' });
    const response = buildResponse();

    await controller.completeBracketRoundWithScores(request as never, response as never);

    expect(mockService.completeBracketRoundWithRandomScores).toHaveBeenCalledWith(TOURNAMENT_ID, BRACKET_ID, 2);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('lists brackets', async () => {
    const request = buildTournamentRequest();
    const response = buildResponse();
    mockService.getBrackets.mockResolvedValue([{ id: BRACKET_ID }]);

    await controller.getBrackets(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith({ brackets: [{ id: BRACKET_ID }] });
  });

  it('creates bracket', async () => {
    const request = buildTournamentRequest({}, { name: 'Winners' });
    const response = buildResponse();
    mockService.createBracket.mockResolvedValue({ id: BRACKET_ID });

    await controller.createBracket(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ id: BRACKET_ID });
  });

  it('updates bracket targets', async () => {
    const request = buildRequest({
      params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID },
      body: { targetIds: ['t1', 't2'] },
    });
    const response = buildResponse();
    mockService.updateBracketTargets.mockResolvedValue({ id: BRACKET_ID, targetIds: ['t1', 't2'] });

    await controller.updateBracketTargets(request as never, response as never);

    expect(mockService.updateBracketTargets).toHaveBeenCalledWith(TOURNAMENT_ID, BRACKET_ID, { targetIds: ['t1', 't2'] });
    expect(response.json).toHaveBeenCalledWith({ id: BRACKET_ID, targetIds: ['t1', 't2'] });
  });

  it('deletes bracket', async () => {
    const request = buildTournamentRequest({ bracketId: BRACKET_ID });
    const response = buildResponse();

    await controller.deleteBracket(request as never, response as never);

    expect(mockService.deleteBracket).toHaveBeenCalledWith(TOURNAMENT_ID, BRACKET_ID);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('returns tournament targets', async () => {
    const request = buildTournamentRequest();
    const response = buildResponse();
    mockService.getTournamentTargets.mockResolvedValue([{ id: 'target-1' }]);

    await controller.getTournamentTargets(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith({ targets: [{ id: 'target-1' }] });
  });

  it('opens, starts and completes tournament', async () => {
    const responseOpen = buildResponse();
    const responseStart = buildResponse();
    const responseComplete = buildResponse();

    mockService.openTournamentRegistration.mockResolvedValue({ id: TOURNAMENT_ID, status: 'OPEN' });
    mockService.startTournament.mockResolvedValue({ id: TOURNAMENT_ID, status: 'LIVE' });
    mockService.completeTournament.mockResolvedValue({ id: TOURNAMENT_ID, status: 'FINISHED' });

    await controller.openTournamentRegistration(buildTournamentRequest() as never, responseOpen as never);
    await controller.startTournament(buildTournamentRequest() as never, responseStart as never);
    await controller.completeTournament(buildTournamentRequest() as never, responseComplete as never);

    expect(responseOpen.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('opened') }));
    expect(responseStart.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('started') }));
    expect(responseComplete.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('finished') }));
  });

  it('returns overall tournament stats', async () => {
    const request = buildRequest();
    const response = buildResponse();
    mockService.getOverallTournamentStats.mockResolvedValue({ totalTournaments: 12 });

    await controller.getOverallTournamentStats(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith({ totalTournaments: 12 });
  });

  it('covers trailing handler error branches', async () => {
    const responseUpdateStatus = buildResponse();
    const responseOpen = buildResponse();
    const responseStart = buildResponse();
    const responseComplete = buildResponse();
    const responseStats = buildResponse();

    mockService.transitionTournamentStatus.mockRejectedValueOnce(
      new AppError('status-failed', 409, 'STATUS_FAILED')
    );
    mockService.openTournamentRegistration.mockRejectedValueOnce(
      new AppError('open-failed', 400, 'OPEN_FAILED')
    );
    mockService.startTournament.mockRejectedValueOnce(
      new AppError('start-failed', 400, 'START_FAILED')
    );
    mockService.completeTournament.mockRejectedValueOnce(
      new AppError('complete-failed', 400, 'COMPLETE_FAILED')
    );
    mockService.getOverallTournamentStats.mockRejectedValueOnce(
      new AppError('stats-failed', 500, 'STATS_FAILED')
    );

    await controller.updateTournamentStatus(
      buildTournamentRequest({}, { status: 'LIVE' }) as never,
      responseUpdateStatus as never
    );
    await controller.openTournamentRegistration(buildTournamentRequest() as never, responseOpen as never);
    await controller.startTournament(buildTournamentRequest() as never, responseStart as never);
    await controller.completeTournament(buildTournamentRequest() as never, responseComplete as never);
    await controller.getOverallTournamentStats(buildRequest() as never, responseStats as never);

    expect(responseUpdateStatus.status).toHaveBeenCalledWith(409);
    expect(responseOpen.status).toHaveBeenCalledWith(400);
    expect(responseStart.status).toHaveBeenCalledWith(400);
    expect(responseComplete.status).toHaveBeenCalledWith(400);
    expect(responseStats.status).toHaveBeenCalledWith(500);
  });

  it('covers player maintenance handler error branches', async () => {
    const responseUpdatePlayer = buildResponse();
    const responseCheckIn = buildResponse();
    const responseDelete = buildResponse();
    const responseValidate = buildResponse();

    mockService.updateTournamentPlayer.mockRejectedValueOnce(
      new AppError('update-player-failed', 400, 'UPDATE_PLAYER_FAILED')
    );
    mockService.updateTournamentPlayerCheckIn.mockRejectedValueOnce(
      new AppError('checkin-failed', 400, 'CHECKIN_FAILED')
    );
    mockService.unregisterPlayer.mockRejectedValueOnce(
      new AppError('delete-player-failed', 400, 'DELETE_PLAYER_FAILED')
    );
    mockService.validateRegistrationConstraints.mockRejectedValueOnce(
      new AppError('validate-failed', 400, 'VALIDATE_FAILED')
    );

    await controller.updateTournamentPlayer(
      buildRequest({
        params: { id: TOURNAMENT_ID, playerId: 'player-1' },
        body: { name: 'updated' },
      }) as never,
      responseUpdatePlayer as never
    );

    await controller.updateTournamentPlayerCheckIn(
      buildRequest({
        params: { id: TOURNAMENT_ID, playerId: 'player-1' },
        body: { checkedIn: true },
      }) as never,
      responseCheckIn as never
    );

    await controller.deleteTournamentPlayer(
      buildRequest({ params: { id: TOURNAMENT_ID, playerId: 'player-1' } }) as never,
      responseDelete as never
    );

    await controller.validateRegistration(
      buildRequest({ params: { id: TOURNAMENT_ID, playerId: 'player-1' } }) as never,
      responseValidate as never
    );

    expect(responseUpdatePlayer.status).toHaveBeenCalledWith(400);
    expect(responseCheckIn.status).toHaveBeenCalledWith(400);
    expect(responseDelete.status).toHaveBeenCalledWith(400);
    expect(responseValidate.status).toHaveBeenCalledWith(400);
  });

  it('covers bracket and target handler error branches and status default force', async () => {
    const responseCreateBracket = buildResponse();
    const responseUpdateBracket = buildResponse();
    const responseDeleteBracket = buildResponse();
    const responseTargets = buildResponse();
    const responseUpdateStatus = buildResponse();

    mockService.createBracket.mockRejectedValueOnce(
      new AppError('create-bracket-failed', 400, 'CREATE_BRACKET_FAILED')
    );
    mockService.updateBracket.mockRejectedValueOnce(
      new AppError('update-bracket-failed', 400, 'UPDATE_BRACKET_FAILED')
    );
    mockService.deleteBracket.mockRejectedValueOnce(
      new AppError('delete-bracket-failed', 400, 'DELETE_BRACKET_FAILED')
    );
    mockService.getTournamentTargets.mockRejectedValueOnce(
      new AppError('targets-failed', 400, 'TARGETS_FAILED')
    );

    await controller.createBracket(
      buildRequest({ params: { id: TOURNAMENT_ID }, body: { name: 'B' } }) as never,
      responseCreateBracket as never
    );

    await controller.updateBracket(
      buildRequest({ params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID }, body: { name: 'U' } }) as never,
      responseUpdateBracket as never
    );

    await controller.deleteBracket(
      buildRequest({ params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID } }) as never,
      responseDeleteBracket as never
    );

    await controller.getTournamentTargets(
      buildRequest({ params: { id: TOURNAMENT_ID } }) as never,
      responseTargets as never
    );

    await controller.updateTournamentStatus(
      buildTournamentRequest({}, { status: 'OPEN' }) as never,
      responseUpdateStatus as never
    );

    expect(responseCreateBracket.status).toHaveBeenCalledWith(400);
    expect(responseUpdateBracket.status).toHaveBeenCalledWith(400);
    expect(responseDeleteBracket.status).toHaveBeenCalledWith(400);
    expect(responseTargets.status).toHaveBeenCalledWith(400);
    expect(mockService.transitionTournamentStatus).toHaveBeenCalledWith(TOURNAMENT_ID, 'OPEN', false);
  });

  it('covers match and bracket middle handler error branches', async () => {
    const responseUpdateMatchStatus = buildResponse();
    const responseCompleteMatch = buildResponse();
    const responseSaveMatchScores = buildResponse();
    const responseCompleteRound = buildResponse();
    const responseResetBracket = buildResponse();
    const responseGetBrackets = buildResponse();
    const responseUpdateTargets = buildResponse();

    mockService.updateMatchStatus.mockRejectedValueOnce(
      new AppError('update-match-status-failed', 400, 'UPDATE_MATCH_STATUS_FAILED')
    );
    mockService.completeMatch.mockRejectedValueOnce(
      new AppError('complete-match-failed', 400, 'COMPLETE_MATCH_FAILED')
    );
    mockService.saveMatchScores.mockRejectedValueOnce(
      new AppError('save-scores-failed', 400, 'SAVE_SCORES_FAILED')
    );
    mockService.completeBracketRoundWithRandomScores.mockRejectedValueOnce(
      new AppError('complete-round-failed', 400, 'COMPLETE_ROUND_FAILED')
    );
    mockService.resetBracketMatches.mockRejectedValueOnce(
      new AppError('reset-bracket-failed', 400, 'RESET_BRACKET_FAILED')
    );
    mockService.getBrackets.mockRejectedValueOnce(
      new AppError('get-brackets-failed', 400, 'GET_BRACKETS_FAILED')
    );
    mockService.updateBracketTargets.mockRejectedValueOnce(
      new AppError('update-targets-failed', 400, 'UPDATE_TARGETS_FAILED')
    );

    await controller.updateMatchStatus(
      buildRequest({
        params: { id: TOURNAMENT_ID, matchId: MATCH_ID },
        body: { status: MatchStatus.IN_PROGRESS },
      }) as never,
      responseUpdateMatchStatus as never
    );

    await controller.completeMatch(
      buildRequest({ params: { id: TOURNAMENT_ID, matchId: MATCH_ID }, body: { scores: [] } }) as never,
      responseCompleteMatch as never
    );

    await controller.saveMatchScores(
      buildRequest({ params: { id: TOURNAMENT_ID, matchId: MATCH_ID }, body: { scores: [] } }) as never,
      responseSaveMatchScores as never
    );

    await controller.completeBracketRoundWithScores(
      buildRequest({ params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID, roundNumber: '1' } }) as never,
      responseCompleteRound as never
    );

    await controller.resetBracketMatches(
      buildRequest({ params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID } }) as never,
      responseResetBracket as never
    );

    await controller.getBrackets(
      buildRequest({ params: { id: TOURNAMENT_ID } }) as never,
      responseGetBrackets as never
    );

    await controller.updateBracketTargets(
      buildRequest({
        params: { id: TOURNAMENT_ID, bracketId: BRACKET_ID },
        body: { targetIds: ['target-1'] },
      }) as never,
      responseUpdateTargets as never
    );

    expect(responseUpdateMatchStatus.status).toHaveBeenCalledWith(400);
    expect(responseCompleteMatch.status).toHaveBeenCalledWith(400);
    expect(responseSaveMatchScores.status).toHaveBeenCalledWith(400);
    expect(responseCompleteRound.status).toHaveBeenCalledWith(400);
    expect(responseResetBracket.status).toHaveBeenCalledWith(400);
    expect(responseGetBrackets.status).toHaveBeenCalledWith(400);
    expect(responseUpdateTargets.status).toHaveBeenCalledWith(400);
  });

  it('covers pool-stage maintenance error branches', async () => {
    const responseDeletePoolStage = buildResponse();
    const responseGetPoolStagePools = buildResponse();
    const responseResetPoolMatches = buildResponse();
    const responseUpdateAssignments = buildResponse();

    mockService.deletePoolStage.mockRejectedValueOnce(
      new AppError('delete-pool-stage-failed', 400, 'DELETE_POOL_STAGE_FAILED')
    );
    mockService.getPoolStagePools.mockRejectedValueOnce(
      new AppError('get-pool-stage-pools-failed', 400, 'GET_POOL_STAGE_POOLS_FAILED')
    );
    mockService.resetPoolMatches.mockRejectedValueOnce(
      new AppError('reset-pool-matches-failed', 400, 'RESET_POOL_MATCHES_FAILED')
    );
    mockService.updatePoolAssignments.mockRejectedValueOnce(
      new AppError('update-assignments-failed', 400, 'UPDATE_ASSIGNMENTS_FAILED')
    );

    await controller.deletePoolStage(
      buildRequest({ params: { id: TOURNAMENT_ID, stageId: STAGE_ID } }) as never,
      responseDeletePoolStage as never
    );

    await controller.getPoolStagePools(
      buildRequest({ params: { id: TOURNAMENT_ID, stageId: STAGE_ID } }) as never,
      responseGetPoolStagePools as never
    );

    await controller.resetPoolMatches(
      buildRequest({ params: { id: TOURNAMENT_ID, stageId: STAGE_ID, poolId: 'pool-1' } }) as never,
      responseResetPoolMatches as never
    );

    await controller.updatePoolStageAssignments(
      buildRequest({ params: { id: TOURNAMENT_ID, stageId: STAGE_ID }, body: { assignments: [] } }) as never,
      responseUpdateAssignments as never
    );

    expect(responseDeletePoolStage.status).toHaveBeenCalledWith(400);
    expect(responseGetPoolStagePools.status).toHaveBeenCalledWith(400);
    expect(responseResetPoolMatches.status).toHaveBeenCalledWith(400);
    expect(responseUpdateAssignments.status).toHaveBeenCalledWith(400);
  });

  it('covers query parsing branches and non-string searches', async () => {
    const responseSearchString = buildResponse();
    const responseSearchNoString = buildResponse();
    const responseDoublettes = buildResponse();
    const responseEquipes = buildResponse();

    await controller.searchGroupPlayers(
      buildRequest({
        params: { id: TOURNAMENT_ID },
        query: { query: 'direct-query' },
      }) as never,
      responseSearchString as never
    );

    await controller.searchGroupPlayers(
      buildRequest({
        params: { id: TOURNAMENT_ID },
        query: { query: [123, false] },
      }) as never,
      responseSearchNoString as never
    );

    await controller.listDoublettes(
      buildRequest({ params: { id: TOURNAMENT_ID }, query: { search: 42 } }) as never,
      responseDoublettes as never
    );

    await controller.listEquipes(
      buildRequest({ params: { id: TOURNAMENT_ID }, query: { search: { value: 'x' } } }) as never,
      responseEquipes as never
    );

    expect(mockService.searchGroupPlayers).toHaveBeenCalledWith(TOURNAMENT_ID, 'direct-query');
    expect(mockService.searchGroupPlayers).toHaveBeenCalledWith(TOURNAMENT_ID, '');
    expect(mockService.listDoublettes).toHaveBeenCalledWith(TOURNAMENT_ID, undefined);
    expect(mockService.listEquipes).toHaveBeenCalledWith(TOURNAMENT_ID, undefined);
  });

  it('covers unregister admin short-circuit and non-error catch metadata branches', async () => {
    isAdminMock.mockReturnValue(true);
    const adminResponse = buildResponse();

    await controller.unregisterPlayer(
      buildRequest({ params: { id: TOURNAMENT_ID, playerId: 'player-1' } }) as never,
      adminResponse as never
    );

    expect(mockService.getPlayerById).not.toHaveBeenCalled();
    expect(mockService.unregisterPlayer).toHaveBeenCalledWith(TOURNAMENT_ID, 'player-1');

    const failingResponse = buildResponse();
    mockService.unregisterPlayer.mockRejectedValueOnce('plain-string-error');

    await controller.unregisterPlayer(
      buildRequest({ params: { id: TOURNAMENT_ID, playerId: 'player-2' } }) as never,
      failingResponse as never
    );

    expect(failingResponse.status).toHaveBeenCalledWith(500);
  });

  it('covers saveMatchScores fallback and pool stage creation/update/get error catches', async () => {
    const responseSaveScores = buildResponse();
    await controller.saveMatchScores(
      buildRequest({ params: { id: TOURNAMENT_ID, matchId: MATCH_ID }, body: {} }) as never,
      responseSaveScores as never
    );
    expect(mockService.saveMatchScores).toHaveBeenCalledWith(TOURNAMENT_ID, MATCH_ID, []);

    const responseGetPoolStages = buildResponse();
    const responseCreatePoolStage = buildResponse();
    const responseUpdatePoolStage = buildResponse();

    mockService.getPoolStages.mockRejectedValueOnce(
      new AppError('get-pool-stages-failed', 400, 'GET_POOL_STAGES_FAILED')
    );
    mockService.createPoolStage.mockRejectedValueOnce(
      new AppError('create-pool-stage-failed', 400, 'CREATE_POOL_STAGE_FAILED')
    );
    mockService.updatePoolStage.mockRejectedValueOnce(
      new AppError('update-pool-stage-failed', 400, 'UPDATE_POOL_STAGE_FAILED')
    );

    await controller.getPoolStages(
      buildRequest({ params: { id: TOURNAMENT_ID } }) as never,
      responseGetPoolStages as never
    );
    await controller.createPoolStage(
      buildRequest({ params: { id: TOURNAMENT_ID }, body: { name: 'pool' } }) as never,
      responseCreatePoolStage as never
    );
    await controller.updatePoolStage(
      buildRequest({ params: { id: TOURNAMENT_ID, stageId: STAGE_ID }, body: { name: 'pool2' } }) as never,
      responseUpdatePoolStage as never
    );

    expect(responseGetPoolStages.status).toHaveBeenCalledWith(400);
    expect(responseCreatePoolStage.status).toHaveBeenCalledWith(400);
    expect(responseUpdatePoolStage.status).toHaveBeenCalledWith(400);
  });

  it('covers remaining extended handlers with success flows', async () => {
    const transientCredential = `test-${Date.now().toString(36)}`;
    const request = buildRequest({
      params: {
        id: TOURNAMENT_ID,
        stageId: STAGE_ID,
        matchId: MATCH_ID,
        bracketId: BRACKET_ID,
        playerId: 'player-1',
        doubletteId: 'd-1',
        equipeId: 'e-1',
        roundNumber: '1',
        poolId: 'pool-1',
      },
      body: {
        playerId: 'player-1',
        name: 'Name',
        password: transientCredential,
        checkedIn: true,
        stageId: STAGE_ID,
        role: 'WINNER',
        status: 'LIVE',
        force: true,
        assignments: [{ poolId: 'pool-1', playerId: 'player-1', assignmentType: 'SEEDED' }],
        targetIds: ['target-1'],
      },
      query: {
        search: 'alpha',
        query: ['group-query'],
      },
    });
    const response = buildResponse();

    await controller.registerPlayer(request as never, response as never);
    await controller.registerPlayerDetails(request as never, response as never);
    await controller.getTournamentParticipants(request as never, response as never);
    await controller.getTournamentPlayers(request as never, response as never);
    await controller.listDoublettes(request as never, response as never);
    await controller.createDoublette(request as never, response as never);
    await controller.updateDoublette(request as never, response as never);
    await controller.joinDoublette(request as never, response as never);
    await controller.addDoubletteMember(request as never, response as never);
    await controller.removeDoubletteMember(request as never, response as never);
    await controller.leaveDoublette(request as never, response as never);
    await controller.registerDoublette(request as never, response as never);
    await controller.deleteDoublette(request as never, response as never);
    await controller.updateDoublettePassword(request as never, response as never);
    await controller.listEquipes(request as never, response as never);
    await controller.createEquipe(request as never, response as never);
    await controller.updateEquipe(request as never, response as never);
    await controller.joinEquipe(request as never, response as never);
    await controller.addEquipeMember(request as never, response as never);
    await controller.removeEquipeMember(request as never, response as never);
    await controller.leaveEquipe(request as never, response as never);
    await controller.registerEquipe(request as never, response as never);
    await controller.deleteEquipe(request as never, response as never);
    await controller.updateEquipePassword(request as never, response as never);
    await controller.searchGroupPlayers(request as never, response as never);
    await controller.getPoolStages(request as never, response as never);
    await controller.recomputeDoubleStageProgression(request as never, response as never);
    await controller.populateBracketFromPools(request as never, response as never);
    await controller.completePoolStageWithScores(request as never, response as never);
    await controller.deletePoolStage(request as never, response as never);
    await controller.getPoolStagePools(request as never, response as never);
    await controller.resetPoolMatches(request as never, response as never);
    await controller.resetBracketMatches(request as never, response as never);
    await controller.updateBracket(request as never, response as never);
    await controller.updateTournamentPlayer(request as never, response as never);
    await controller.updateTournamentPlayerCheckIn(request as never, response as never);
    await controller.deleteTournamentPlayer(request as never, response as never);
    await controller.validateRegistration(request as never, response as never);
    await controller.updateTournamentStatus(request as never, response as never);

    expect(mockService.registerPlayer).toHaveBeenCalled();
    expect(mockService.searchGroupPlayers).toHaveBeenCalledWith(TOURNAMENT_ID, 'group-query');
    expect(mockService.transitionTournamentStatus).toHaveBeenCalledWith(TOURNAMENT_ID, 'LIVE', true);
  });

  it('enforces unregister player authorization branches', async () => {
    const baseRequest = buildRequest({
      params: { id: TOURNAMENT_ID, playerId: 'player-1' },
    });

    isAdminMock.mockReturnValue(false);

    const notFoundResponse = buildResponse();
    mockService.getPlayerById.mockResolvedValueOnce(undefined);
    await controller.unregisterPlayer(baseRequest as never, notFoundResponse as never);
    expect(notFoundResponse.status).toHaveBeenCalledWith(404);

    const noIdentityResponse = buildResponse();
    mockService.getPlayerById.mockResolvedValueOnce({ tournamentId: TOURNAMENT_ID, email: 'player@example.com' });
    await controller.unregisterPlayer(baseRequest as never, noIdentityResponse as never);
    expect(noIdentityResponse.status).toHaveBeenCalledWith(403);

    const wrongUserResponse = buildResponse();
    mockService.getPlayerById.mockResolvedValueOnce({ tournamentId: TOURNAMENT_ID, email: 'player@example.com' });
    await controller.unregisterPlayer(
      buildRequest({
        params: { id: TOURNAMENT_ID, playerId: 'player-1' },
        auth: { payload: { email: 'someoneelse@example.com' } },
      }) as never,
      wrongUserResponse as never
    );
    expect(wrongUserResponse.status).toHaveBeenCalledWith(403);

    const successResponse = buildResponse();
    mockService.getPlayerById.mockResolvedValueOnce({ tournamentId: TOURNAMENT_ID, email: 'player@example.com' });
    await controller.unregisterPlayer(
      buildRequest({
        params: { id: TOURNAMENT_ID, playerId: 'player-1' },
        auth: { payload: { email: 'player@example.com' } },
      }) as never,
      successResponse as never
    );
    expect(mockService.unregisterPlayer).toHaveBeenCalledWith(TOURNAMENT_ID, 'player-1');
  });
});
