import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TournamentController from '../../src/controllers/tournament-controller';
import { AppError } from '../../src/middleware/error-handler';
import { MatchStatus } from '../../../shared/src/types';

type MockFn = ReturnType<typeof jest.fn>;

type MockService = {
  getOrphanParticipants: MockFn;
  createPoolStage: MockFn;
  updatePoolStage: MockFn;
  updatePoolAssignments: MockFn;
  updateMatchStatus: MockFn;
  completeMatch: MockFn;
  saveMatchScores: MockFn;
  completeBracketRoundWithRandomScores: MockFn;
  getBrackets: MockFn;
  createBracket: MockFn;
  updateBracketTargets: MockFn;
  deleteBracket: MockFn;
  getTournamentTargets: MockFn;
  openTournamentRegistration: MockFn;
  startTournament: MockFn;
  completeTournament: MockFn;
  getOverallTournamentStats: MockFn;
};

let mockService: MockService;

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

  beforeEach(() => {
    mockService = {
      getOrphanParticipants: jest.fn(),
      createPoolStage: jest.fn(),
      updatePoolStage: jest.fn(),
      updatePoolAssignments: jest.fn(),
      updateMatchStatus: jest.fn(),
      completeMatch: jest.fn(),
      saveMatchScores: jest.fn(),
      completeBracketRoundWithRandomScores: jest.fn(),
      getBrackets: jest.fn(),
      createBracket: jest.fn(),
      updateBracketTargets: jest.fn(),
      deleteBracket: jest.fn(),
      getTournamentTargets: jest.fn(),
      openTournamentRegistration: jest.fn(),
      startTournament: jest.fn(),
      completeTournament: jest.fn(),
      getOverallTournamentStats: jest.fn(),
    };
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

    expect(mockService.updateMatchStatus).toHaveBeenCalledWith(TOURNAMENT_ID, MATCH_ID, MatchStatus.IN_PROGRESS, 'target-1');
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
});
