import { BracketStatus, MatchStatus, StageStatus, TournamentStatus, TargetStatus } from '../../../shared/src/types';
import { createMatchHandlers } from '../../src/services/tournament-service/match-handlers';
import { getWebSocketService } from '../../src/websocket/server';

jest.mock('../../src/websocket/server', () => ({
  getWebSocketService: jest.fn(),
}));

type ModelMock = {
  findById: jest.Mock;
  getMatchById: jest.Mock;
  getMatchWithPlayerMatches: jest.Mock;
  getBracketById: jest.Mock;
  getBracketEntryCount: jest.Mock;
  getBracketMatchesByRound: jest.Mock;
  getBracketMatchesByRoundWithPlayers: jest.Mock;
  setBracketMatchPlayerPosition: jest.Mock;
  createBracketMatchWithSlots: jest.Mock;
  setBracketMatchPlayers: jest.Mock;
  createBracketMatches: jest.Mock;
  updateBracket: jest.Mock;
  updateMatchStatus: jest.Mock;
  updatePoolStage: jest.Mock;
  resetMatchToScheduled: jest.Mock;
  finishMatchAndReleaseTarget: jest.Mock;
  updateInProgressMatchScores: jest.Mock;
  updateMatchScores: jest.Mock;
  getTargetById: jest.Mock;
  getBracketTargetIds: jest.Mock;
  setTargetAvailable: jest.Mock;
  startMatchWithTarget: jest.Mock;
  getMatchPoolStageId: jest.Mock;
  getPoolStageById: jest.Mock;
  getPoolStages: jest.Mock;
  getBrackets: jest.Mock;
  completeMatch: jest.Mock;
  findLiveView: jest.Mock;
  getMatchDetailsForNotification: jest.Mock;
};

const buildModel = (): ModelMock => ({
  findById: jest.fn(),
  getMatchById: jest.fn(),
  getMatchWithPlayerMatches: jest.fn(),
  getBracketById: jest.fn(),
  getBracketEntryCount: jest.fn().mockResolvedValue(2),
  getBracketMatchesByRound: jest.fn().mockResolvedValue([]),
  getBracketMatchesByRoundWithPlayers: jest.fn().mockResolvedValue([]),
  setBracketMatchPlayerPosition: jest.fn().mockResolvedValue(undefined),
  createBracketMatchWithSlots: jest.fn().mockResolvedValue(undefined),
  setBracketMatchPlayers: jest.fn().mockResolvedValue(undefined),
  createBracketMatches: jest.fn().mockResolvedValue(undefined),
  updateBracket: jest.fn().mockResolvedValue(undefined),
  updateMatchStatus: jest.fn().mockResolvedValue(undefined),
  updatePoolStage: jest.fn().mockResolvedValue(undefined),
  resetMatchToScheduled: jest.fn().mockResolvedValue(undefined),
  finishMatchAndReleaseTarget: jest.fn().mockResolvedValue(undefined),
  updateInProgressMatchScores: jest.fn().mockResolvedValue(undefined),
  updateMatchScores: jest.fn().mockResolvedValue(undefined),
  getTargetById: jest.fn(),
  getBracketTargetIds: jest.fn().mockResolvedValue([]),
  setTargetAvailable: jest.fn().mockResolvedValue(undefined),
  startMatchWithTarget: jest.fn().mockResolvedValue(undefined),
  getMatchPoolStageId: jest.fn().mockResolvedValue(undefined),
  getPoolStageById: jest.fn().mockResolvedValue(undefined),
  getPoolStages: jest.fn().mockResolvedValue([]),
  getBrackets: jest.fn().mockResolvedValue([]),
  completeMatch: jest.fn().mockResolvedValue(undefined),
  findLiveView: jest.fn().mockResolvedValue({ poolStages: [], brackets: [] }),
  getMatchDetailsForNotification: jest.fn().mockResolvedValue(undefined),
});

describe('match handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWebSocketService as jest.Mock).mockReturnValue(undefined);
  });

  it('rejects update status when tournament is missing', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue(null);
    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.SCHEDULED))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects update status when match is outside tournament', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getMatchById.mockResolvedValue({ id: 'match-1', tournamentId: 'another' });
    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.SCHEDULED))
      .rejects.toThrow('Match not found');
  });

  it('resets to scheduled with target release when target is assigned', async () => {
    const nowMatch = {
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      targetId: 'target-1',
    };
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue(nowMatch);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.SCHEDULED);

    expect(model.resetMatchToScheduled).toHaveBeenCalledWith('match-1', 'target-1', expect.any(Date));
  });

  it('blocks bracket start when tournament is not live', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      bracketId: 'bracket-1',
      targetId: null,
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('Bracket matches can only start when the tournament is live');
  });

  it('saves in-progress match scores through updateInProgressMatchScores', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.saveMatchScores('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.updateInProgressMatchScores).toHaveBeenCalledWith('match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);
    expect(model.updateMatchScores).not.toHaveBeenCalled();
  });

  it('saves completed match scores and releases target if still attached', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.COMPLETED,
      targetId: 'target-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      status: TargetStatus.IN_USE,
      currentMatchId: 'match-1',
    });
    model.getMatchById.mockResolvedValue({ id: 'match-1', bracketId: null });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.saveMatchScores('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 4 },
      { playerId: 'p2', scoreTotal: 2 },
    ]);

    expect(model.updateMatchScores).toHaveBeenCalledWith(
      'match-1',
      [
        { playerId: 'p1', scoreTotal: 4, isWinner: true },
        { playerId: 'p2', scoreTotal: 2, isWinner: false },
      ],
      'p1'
    );
    expect(model.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      'match-1',
      'target-1',
      MatchStatus.COMPLETED,
      { completedAt: expect.any(Date) }
    );
  });

  it('rejects score edits for non editable status', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.saveMatchScores('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 1 },
      { playerId: 'p2', scoreTotal: 0 },
    ])).rejects.toThrow('Match must be in progress or completed to edit scores');
  });

  it('rejects completeMatch when match is not in progress', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ])).rejects.toThrow('Match must be in progress to complete');
  });

  it('blocks match start when a player is already in another in-progress match', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: 'pool-1',
      targetId: null,
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: 'pool-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [
        {
          id: 'stage-1',
          pools: [
            {
              id: 'pool-1',
              matches: [
                {
                  id: 'other-match',
                  status: MatchStatus.IN_PROGRESS,
                  playerMatches: [{ playerId: 'p1' }],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('A player is already in progress in another match');
  });

  it('blocks pool match start when concurrent match limit is reached', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: 'pool-1',
      targetId: null,
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: 'pool-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [
        {
          id: 'stage-1',
          pools: [
            {
              id: 'pool-1',
              assignments: [
                { player: { id: 'p1' } },
                { player: { id: 'p2' } },
              ],
              matches: [
                { id: 'other-1', status: MatchStatus.IN_PROGRESS, playerMatches: [] },
              ],
            },
          ],
        },
      ],
      brackets: [],
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('Pool concurrent match limit reached');
  });

  it('auto-sets pool stage to in progress when starting a pool match', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: 'pool-1',
      targetId: null,
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: 'pool-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [
        {
          id: 'stage-1',
          pools: [
            {
              id: 'pool-1',
              assignments: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
              matches: [],
            },
          ],
        },
      ],
      brackets: [],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-1');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-1', status: StageStatus.NOT_STARTED });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1');

    expect(model.updatePoolStage).toHaveBeenCalledWith('stage-1', { status: StageStatus.IN_PROGRESS });
    expect(model.startMatchWithTarget).toHaveBeenCalledWith('match-1', 'target-1', expect.any(Date));
  });

  it('blocks bracket match start when source pool stages are not completed', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      bracketId: 'bracket-1',
      targetId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([
      {
        id: 'stage-1',
        status: StageStatus.IN_PROGRESS,
        rankingDestinations: [{ destinationType: 'BRACKET', bracketId: 'bracket-1' }],
      },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('Bracket matches cannot start before source pool stages are completed');
  });

  it('rejects invalid match status transitions', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.CANCELLED,
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.SCHEDULED))
      .rejects.toThrow('Invalid match status transition');
  });

  it('advances winner to next bracket round by filling existing scheduled slot', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 2: 'BO3' },
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm2', matchNumber: 2, status: MatchStatus.SCHEDULED }]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      { id: 'next-1', matchNumber: 1, status: MatchStatus.SCHEDULED, playerMatches: [{ playerId: 'existing' }] },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayerPosition).toHaveBeenCalledWith('next-1', 'p1', 1);
    expect(model.createBracketMatchWithSlots).not.toHaveBeenCalled();
  });

  it('advances pair winners to next round and finishes tournament when final round is complete', async () => {
    const model = buildModel();
    const transitionTournamentStatus = jest.fn().mockResolvedValue(undefined);
    model.findById
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.LIVE,
        format: 'SINGLE',
        doubleStageEnabled: false,
      })
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.LIVE,
        format: 'SINGLE',
      });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED }]);
    model.getPoolStages.mockResolvedValue([{ id: 'stage-1', status: StageStatus.COMPLETED }]);
    model.getBrackets.mockResolvedValue([{ id: 'bracket-1', status: StageStatus.COMPLETED }]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', expect.objectContaining({ status: 'COMPLETED' }));
    expect(transitionTournamentStatus).toHaveBeenCalledWith('tournament-1', TournamentStatus.FINISHED);
  });

  it('recomputes double-stage progression when enabled and stage <= 3', async () => {
    const model = buildModel();
    const recomputeDoubleStageProgression = jest.fn().mockResolvedValue(undefined);
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'DOUBLE',
      doubleStageEnabled: true,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({ id: 'match-1', tournamentId: 'tournament-1' });
    model.getMatchPoolStageId.mockResolvedValue('stage-2');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-2', stageNumber: 2 });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
      recomputeDoubleStageProgression,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 4 },
      { playerId: 'p2', scoreTotal: 2 },
    ]);

    expect(recomputeDoubleStageProgression).toHaveBeenCalledWith('tournament-1', 'stage-2');
  });

  it('creates next round bracket match when sibling is not yet completed and no next match exists', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 2: 'BO5' },
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm2', matchNumber: 2, status: MatchStatus.SCHEDULED }]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(model.createBracketMatchWithSlots).toHaveBeenCalledWith(
      'tournament-1',
      'bracket-1',
      2,
      1,
      [{ playerId: 'p1', playerPosition: 1 }],
      'BO5'
    );
  });

  it('creates pair next-round match when sibling completed and next match does not exist', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 2: 'BO3' },
    });
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.createBracketMatches).toHaveBeenCalledWith(
      'tournament-1',
      'bracket-1',
      [{ roundNumber: 2, matchNumber: 1, playerIds: ['p1', 'p2'] }],
      'BO3'
    );
  });

  it('does not transition tournament when pools or brackets are not fully completed', async () => {
    const model = buildModel();
    const transitionTournamentStatus = jest.fn().mockResolvedValue(undefined);
    model.findById
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.LIVE,
        format: 'SINGLE',
        doubleStageEnabled: false,
      })
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.LIVE,
      });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED }]);
    model.getPoolStages.mockResolvedValue([{ id: 'stage-1', status: StageStatus.IN_PROGRESS }]);
    model.getBrackets.mockResolvedValue([{ id: 'bracket-1', status: BracketStatus.COMPLETED }]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 2 },
    ]);

    expect(transitionTournamentStatus).not.toHaveBeenCalled();
  });

  it('saves completed scores without releasing target when target is not in use by match', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.COMPLETED,
      targetId: 'target-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({ id: 'match-1', bracketId: null });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.saveMatchScores('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 4 },
      { playerId: 'p2', scoreTotal: 3 },
    ]);

    expect(model.updateMatchScores).toHaveBeenCalled();
    expect(model.finishMatchAndReleaseTarget).not.toHaveBeenCalledWith(
      'match-1',
      'target-1',
      MatchStatus.COMPLETED,
      expect.anything()
    );
  });

  it('does not overwrite existing next-round pair match when it already has two players', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 2: 'BO3' },
    });
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      {
        id: 'next-round-match',
        roundNumber: 2,
        matchNumber: 1,
        status: MatchStatus.SCHEDULED,
        playerMatches: [{ playerId: 'existing-1' }, { playerId: 'existing-2' }],
      },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(model.setBracketMatchPlayers).not.toHaveBeenCalled();
    expect(model.createBracketMatches).not.toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', { status: BracketStatus.IN_PROGRESS });
  });

  it('does not overwrite existing next-round single-slot match when it is not scheduled', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 2: 'BO5' },
    });
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.SCHEDULED, winnerId: null },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      {
        id: 'next-round-match',
        roundNumber: 2,
        matchNumber: 1,
        status: MatchStatus.IN_PROGRESS,
        playerMatches: [{ playerId: 'existing-1' }],
      },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayerPosition).not.toHaveBeenCalled();
    expect(model.createBracketMatchWithSlots).not.toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', { status: BracketStatus.IN_PROGRESS });
  });

  it('does not finish tournament when tournament is no longer live during finalization check', async () => {
    const model = buildModel();
    const transitionTournamentStatus = jest.fn().mockResolvedValue(undefined);
    model.findById
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.LIVE,
        format: 'SINGLE',
        doubleStageEnabled: false,
      })
      .mockResolvedValueOnce({
        id: 'tournament-1',
        status: TournamentStatus.OPEN,
      });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED }]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(transitionTournamentStatus).not.toHaveBeenCalled();
  });

  it('does not complete bracket when final round still has non-completed matches', async () => {
    const model = buildModel();
    const transitionTournamentStatus = jest.fn().mockResolvedValue(undefined);
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.SCHEDULED, winnerId: null },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(model.updateBracket).not.toHaveBeenCalledWith(
      'bracket-1',
      expect.objectContaining({ status: BracketStatus.COMPLETED })
    );
    expect(transitionTournamentStatus).not.toHaveBeenCalled();
  });

  it('recomputes bracket total rounds from entry count when missing', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getBracketEntryCount.mockResolvedValue(8);
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 0,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([{ id: 'm2', matchNumber: 2, status: MatchStatus.SCHEDULED }]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', { totalRounds: 3 });
  });

  it('does not recompute double-stage progression when no double stages exist', async () => {
    const model = buildModel();
    const recomputeDoubleStageProgression = jest.fn().mockResolvedValue(undefined);
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'DOUBLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: null,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({ id: 'match-1', bracketId: null });
    model.getMatchPoolStageId.mockResolvedValue('stage-1');
    model.getPoolStages.mockResolvedValue([{ id: 'stage-1', stageNumber: 1 }]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
      recomputeDoubleStageProgression,
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(recomputeDoubleStageProgression).not.toHaveBeenCalled();
  });

  it('stops bracket advancement when persisted winner is missing after completion', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: null,
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(model.getBracketMatchesByRoundWithPlayers).not.toHaveBeenCalled();
    expect(model.createBracketMatchWithSlots).not.toHaveBeenCalled();
    expect(model.createBracketMatches).not.toHaveBeenCalled();
  });

  it('does not overwrite pair next-round match when existing match is not scheduled', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: 'SINGLE',
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      bracketId: 'bracket-1',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: {},
    });
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      { id: 'next-round', matchNumber: 1, roundNumber: 2, status: MatchStatus.IN_PROGRESS, playerMatches: [] },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.completeMatch('tournament-1', 'match-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 0 },
    ]);

    expect(model.setBracketMatchPlayers).not.toHaveBeenCalled();
    expect(model.createBracketMatches).not.toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', { status: BracketStatus.IN_PROGRESS });
  });

  it('resets to scheduled without target release when no target is assigned', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.IN_PROGRESS,
      targetId: null,
      bracketId: null,
    });

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.SCHEDULED);

    expect(model.resetMatchToScheduled).toHaveBeenCalledWith('match-1', undefined, expect.any(Date));
  });

  it('rejects match start when live view is missing for player availability checks', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: 'pool-1',
      targetId: null,
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: 'pool-1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue(undefined);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects bracket start when source pool stages are not completed', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: null,
      targetId: null,
      bracketId: 'bracket-1',
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: null,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([
      {
        id: 'stage-1',
        status: StageStatus.IN_PROGRESS,
        rankingDestinations: [{ destinationType: 'BRACKET', bracketId: 'bracket-1' }],
      },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await expect(handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1'))
      .rejects.toThrow('Bracket matches cannot start before source pool stages are completed');
  });

  it('starts bracket match when no source pool stage references the bracket', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getMatchById.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: MatchStatus.SCHEDULED,
      poolId: null,
      targetId: null,
      bracketId: 'bracket-1',
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-1',
      tournamentId: 'tournament-1',
      poolId: null,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([
      {
        id: 'stage-1',
        status: StageStatus.NOT_STARTED,
        rankingDestinations: [{ destinationType: 'POOL', poolStageId: 'other' }],
      },
    ]);

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    });

    await handlers.updateMatchStatus('tournament-1', 'match-1', MatchStatus.IN_PROGRESS, 'target-1');

    expect(model.startMatchWithTarget).toHaveBeenCalledWith('match-1', 'target-1', expect.any(Date));
  });
});
