import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createMatchHandlers } from '../../src/services/tournament-service/match-handlers';
import { BracketStatus, MatchStatus, StageStatus, TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { getWebSocketService } from '../../src/websocket/server';

jest.mock('../../src/websocket/server', () => ({
  getWebSocketService: jest.fn(),
}));

type MatchHandlersModelMock = {
  findById: ReturnType<typeof jest.fn>;
  findLiveView: ReturnType<typeof jest.fn>;
  getMatchWithPlayerMatches: ReturnType<typeof jest.fn>;
  getMatchById: ReturnType<typeof jest.fn>;
  getMatchPoolStageId: ReturnType<typeof jest.fn>;
  getPoolStageById: ReturnType<typeof jest.fn>;
  getBracketTargetIds: ReturnType<typeof jest.fn>;
  setTargetAvailable: ReturnType<typeof jest.fn>;
  startMatchWithTarget: ReturnType<typeof jest.fn>;
  resetMatchToScheduled: ReturnType<typeof jest.fn>;
  updateMatchStatus: ReturnType<typeof jest.fn>;
  getMatchDetailsForNotification: ReturnType<typeof jest.fn>;
  completeMatch: ReturnType<typeof jest.fn>;
  finishMatchAndReleaseTarget: ReturnType<typeof jest.fn>;
  updateInProgressMatchScores: ReturnType<typeof jest.fn>;
  updateMatchScores: ReturnType<typeof jest.fn>;
  getTargetById: ReturnType<typeof jest.fn>;
  getBracketById: ReturnType<typeof jest.fn>;
  getBracketEntryCount: ReturnType<typeof jest.fn>;
  updateBracket: ReturnType<typeof jest.fn>;
  getBracketMatchesByRound: ReturnType<typeof jest.fn>;
  getBracketMatchesByRoundWithPlayers: ReturnType<typeof jest.fn>;
  setBracketMatchPlayerPosition: ReturnType<typeof jest.fn>;
  createBracketMatchWithSlots: ReturnType<typeof jest.fn>;
  setBracketMatchPlayers: ReturnType<typeof jest.fn>;
  createBracketMatches: ReturnType<typeof jest.fn>;
  getPoolStages: ReturnType<typeof jest.fn>;
  getBrackets: ReturnType<typeof jest.fn>;
};

const build = () => {
  const model: MatchHandlersModelMock = {
    findById: jest.fn(),
    findLiveView: jest.fn(),
    getMatchWithPlayerMatches: jest.fn(),
    getMatchById: jest.fn(),
    getMatchPoolStageId: jest.fn(),
    getPoolStageById: jest.fn(),
    getBracketTargetIds: jest.fn(async () => []),
    setTargetAvailable: jest.fn(),
    startMatchWithTarget: jest.fn(),
    resetMatchToScheduled: jest.fn(),
    updateMatchStatus: jest.fn(),
    getMatchDetailsForNotification: jest.fn(),
    completeMatch: jest.fn(),
    finishMatchAndReleaseTarget: jest.fn(),
    updateInProgressMatchScores: jest.fn(),
    updateMatchScores: jest.fn(),
    getTargetById: jest.fn(),
    getBracketById: jest.fn(),
    getBracketEntryCount: jest.fn(),
    updateBracket: jest.fn(),
    getBracketMatchesByRound: jest.fn(),
    getBracketMatchesByRoundWithPlayers: jest.fn(),
    setBracketMatchPlayerPosition: jest.fn(),
    createBracketMatchWithSlots: jest.fn(),
    setBracketMatchPlayers: jest.fn(),
    createBracketMatches: jest.fn(),
    getPoolStages: jest.fn(),
    getBrackets: jest.fn(),
  };

  const transitionTournamentStatus = jest.fn(async (_tournamentId: string, _newStatus: TournamentStatus) => ({}) as never);
  const recomputeDoubleStageProgression = jest.fn(async (_tournamentId: string, _stageId: string) => undefined);
  const handlers = createMatchHandlers({
    tournamentModel: model as never,
    validateUUID: jest.fn(),
    transitionTournamentStatus,
    recomputeDoubleStageProgression,
  });

  return { model, handlers, transitionTournamentStatus, recomputeDoubleStageProgression };
};

describe('match handlers branch coverage', () => {
  beforeEach(() => {
    (getWebSocketService as jest.Mock).mockReturnValue(undefined);
  });

  it('completes final bracket round and finishes tournament', async () => {
    const { model, handlers, transitionTournamentStatus } = build();

    model.findById.mockResolvedValue({ id: 't-1', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-1',
      tournamentId: 't-1',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-1',
      roundNumber: 2,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-1',
      tournamentId: 't-1',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-1',
      roundNumber: 2,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-1', tournamentId: 't-1', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([{ status: MatchStatus.COMPLETED }]);
    model.getPoolStages.mockResolvedValue([]);
    model.getBrackets.mockResolvedValue([{ id: 'b-1', status: BracketStatus.COMPLETED }]);

    await handlers.completeMatch('t-1', 'm-1', [
      { playerId: 'p-1', scoreTotal: 4 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.updateBracket).toHaveBeenCalledWith('b-1', expect.objectContaining({ status: BracketStatus.COMPLETED }));
    expect(transitionTournamentStatus).toHaveBeenCalledWith('t-1', TournamentStatus.FINISHED);
  });

  it('updates in-progress scores without completion for saveMatchScores', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-2', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-2',
      tournamentId: 't-2',
      status: MatchStatus.IN_PROGRESS,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });

    await handlers.saveMatchScores('t-2', 'm-2', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 2 },
    ]);

    expect(model.updateInProgressMatchScores).toHaveBeenCalledWith('m-2', expect.any(Array));
    expect(model.updateMatchScores).not.toHaveBeenCalled();
  });

  it('advances single winner to existing scheduled next-round slot', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-3', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-3',
      tournamentId: 't-3',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-3',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-3',
      tournamentId: 't-3',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-3',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-3', tournamentId: 't-3', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound
      .mockResolvedValueOnce([{ status: MatchStatus.COMPLETED }])
      .mockResolvedValueOnce([{ matchNumber: 2, status: MatchStatus.SCHEDULED }]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      { id: 'next-1', matchNumber: 1, status: MatchStatus.SCHEDULED, playerMatches: [] },
    ]);

    await handlers.completeMatch('t-3', 'm-3', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayerPosition).toHaveBeenCalledWith('next-1', 'p-1', 1);
    expect(model.updateBracket).toHaveBeenCalledWith('b-3', { status: BracketStatus.IN_PROGRESS });
  });

  it('advances winners to next round when next match is missing', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-4', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-4',
      tournamentId: 't-4',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-4',
      roundNumber: 1,
      matchNumber: 2,
      playerMatches: [{ playerId: 'p-3' }, { playerId: 'p-4' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-4',
      tournamentId: 't-4',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-4',
      roundNumber: 1,
      matchNumber: 2,
      winnerId: 'p-3',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-4', tournamentId: 't-4', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound
      .mockResolvedValueOnce([{ status: MatchStatus.COMPLETED }])
      .mockResolvedValueOnce([
        { matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p-1' },
        { matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p-3' },
      ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([]);

    await handlers.completeMatch('t-4', 'm-4', [
      { playerId: 'p-3', scoreTotal: 3 },
      { playerId: 'p-4', scoreTotal: 0 },
    ]);

    expect(
      model.createBracketMatches.mock.calls.length + model.createBracketMatchWithSlots.mock.calls.length
    ).toBeGreaterThan(0);
  });

  it('handles random completion no-op branches and active completion branch', async () => {
    const { model, handlers } = build();
    const now = new Date();

    await handlers.completeMatchWithRandomScores({ id: 'mx', status: MatchStatus.CANCELLED }, now, {
      shouldAdvance: false,
    });

    await handlers.completeMatchWithRandomScores({
      id: 'my',
      status: MatchStatus.SCHEDULED,
      playerMatches: [{ playerId: 'p-1' }],
    }, now, {
      shouldAdvance: false,
    });

    await handlers.completeMatchWithRandomScores({
      id: 'mz',
      status: MatchStatus.SCHEDULED,
      targetId: 'tz',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    }, now, {
      shouldAdvance: false,
    });

    expect(model.completeMatch).toHaveBeenCalledWith('mz', expect.any(Array), expect.any(String), expect.objectContaining({ completedAt: now }));
    expect(model.finishMatchAndReleaseTarget).toHaveBeenCalledWith('mz', 'tz', MatchStatus.COMPLETED, expect.objectContaining({ completedAt: now }));
  });

  it('resets a match to SCHEDULED with and without target', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-5', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-5a', tournamentId: 't-5', status: MatchStatus.IN_PROGRESS, targetId: 'tg-1' })
      .mockResolvedValueOnce({ id: 'm-5b', tournamentId: 't-5', status: MatchStatus.IN_PROGRESS });

    await handlers.updateMatchStatus('t-5', 'm-5a', MatchStatus.SCHEDULED);
    await handlers.updateMatchStatus('t-5', 'm-5b', MatchStatus.SCHEDULED);

    expect(model.resetMatchToScheduled).toHaveBeenCalledWith('m-5a', 'tg-1', expect.any(Date));
    expect(model.resetMatchToScheduled).toHaveBeenCalledWith('m-5b', undefined, expect.any(Date));
  });

  it('blocks start when a player is already in progress elsewhere', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-6', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-6',
      tournamentId: 't-6',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-6',
      poolId: 'pool-6',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-6', tournamentId: 't-6', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-6',
      tournamentId: 't-6',
      poolId: 'pool-6',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [
        {
          pools: [
            {
              id: 'pool-6',
              matches: [{ id: 'other', status: MatchStatus.IN_PROGRESS, playerMatches: [{ playerId: 'p-1' }] }],
            },
          ],
        },
      ],
      brackets: [],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-6');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-6', status: StageStatus.IN_PROGRESS });

    await expect(
      handlers.updateMatchStatus('t-6', 'm-6', MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'PLAYER_ALREADY_IN_PROGRESS' });
  });

  it('blocks start when pool concurrent limit is reached', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-7', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-7',
      tournamentId: 't-7',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-7',
      poolId: 'pool-7',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-7', tournamentId: 't-7', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-7',
      tournamentId: 't-7',
      poolId: 'pool-7',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [
        {
          pools: [
            {
              id: 'pool-7',
              assignments: [{ player: { id: 'p-1' } }, { player: { id: 'p-2' } }],
              matches: [{ id: 'other', status: MatchStatus.IN_PROGRESS, playerMatches: [{ playerId: 'x' }, { playerId: 'y' }] }],
            },
          ],
        },
      ],
      brackets: [],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-7');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-7', status: StageStatus.IN_PROGRESS });

    await expect(
      handlers.updateMatchStatus('t-7', 'm-7', MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'POOL_MAX_CONCURRENT_MATCHES_REACHED' });
  });

  it('blocks bracket start when source pool stages are not completed', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-8', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-8',
      tournamentId: 't-8',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-8',
      bracketId: 'b-8',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-8', tournamentId: 't-8', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-8', tournamentId: 't-8', playerMatches: [] });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([
      {
        id: 'stage-8',
        status: StageStatus.IN_PROGRESS,
        rankingDestinations: [{ destinationType: 'BRACKET', bracketId: 'b-8' }],
      },
    ]);

    await expect(
      handlers.updateMatchStatus('t-8', 'm-8', MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'BRACKET_PREREQUISITES_NOT_COMPLETED' });
  });

  it('rejects bracket match start when target is not assigned to bracket', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-9', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-9',
      tournamentId: 't-9',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-9',
      bracketId: 'b-9',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-9', tournamentId: 't-9', status: 'AVAILABLE' });
    model.getBracketTargetIds.mockResolvedValue(['tg-other']);

    await expect(
      handlers.updateMatchStatus('t-9', 'm-9', MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'TARGET_NOT_ASSIGNED_TO_BRACKET' });
  });

  it('releases stale IN_USE target from completed match before starting', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-10', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-10', tournamentId: 't-10', status: MatchStatus.SCHEDULED, targetId: 'tg-10' })
      .mockResolvedValueOnce({ id: 'old-10', status: MatchStatus.COMPLETED, completedAt: new Date('2026-01-01T10:00:00.000Z') });
    model.getTargetById.mockResolvedValue({
      id: 'tg-10',
      tournamentId: 't-10',
      status: 'IN_USE',
      currentMatchId: 'old-10',
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-10', playerMatches: [] });

    await handlers.updateMatchStatus('t-10', 'm-10', MatchStatus.IN_PROGRESS);

    expect(model.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      'old-10',
      'tg-10',
      MatchStatus.COMPLETED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
    expect(model.startMatchWithTarget).toHaveBeenCalledWith('m-10', 'tg-10', expect.any(Date));
  });

  it('rejects start when IN_USE target is still used by in-progress match', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-11', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-11', tournamentId: 't-11', status: MatchStatus.SCHEDULED, targetId: 'tg-11' })
      .mockResolvedValueOnce({ id: 'old-11', status: MatchStatus.IN_PROGRESS });
    model.getTargetById.mockResolvedValue({
      id: 'tg-11',
      tournamentId: 't-11',
      status: 'IN_USE',
      currentMatchId: 'old-11',
    });

    await expect(
      handlers.updateMatchStatus('t-11', 'm-11', MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'TARGET_NOT_AVAILABLE' });
  });

  it('updates status directly when cancelling match without assigned target', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-12', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-12',
      tournamentId: 't-12',
      status: MatchStatus.IN_PROGRESS,
    });

    await handlers.updateMatchStatus('t-12', 'm-12', MatchStatus.CANCELLED);

    expect(model.updateMatchStatus).toHaveBeenCalledWith(
      'm-12',
      MatchStatus.CANCELLED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
  });

  it('emits match started notification when websocket service and details are available', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async (_payload: unknown) => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({
      id: 't-n1',
      name: 'Notif Cup',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-n1',
      tournamentId: 't-n1',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-n1',
      poolId: 'pool-1',
      roundNumber: 1,
      matchNumber: 1,
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-n1', tournamentId: 't-n1', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-n1', playerMatches: [] });
    model.getMatchPoolStageId.mockResolvedValue('stage-n1');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-n1', status: StageStatus.IN_PROGRESS });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-n1',
      matchNumber: 1,
      roundNumber: 1,
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      pool: { id: 'pool-1', poolNumber: 1, poolStage: { stageNumber: 1 } },
      target: { id: 'tg-n1', targetNumber: 1, targetCode: 'T1', name: 'Target 1' },
      playerMatches: [
        { playerId: 'p1', player: { id: 'p1', firstName: 'A', lastName: 'One' } },
        { playerId: 'p2', player: { id: 'p2', firstName: 'B', lastName: 'Two' } },
      ],
    });

    await handlers.updateMatchStatus('t-n1', 'm-n1', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchId: 'm-n1',
      tournamentId: 't-n1',
      players: expect.any(Array),
    }));
  });

  it('emits match finished notification for completed and cancelled statuses', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFinished });

    model.findById
      .mockResolvedValueOnce({ id: 't-n3', name: 'Notif Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-n3', name: 'Notif Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-n3', name: 'Notif Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-n3', name: 'Notif Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-n3c', tournamentId: 't-n3', status: MatchStatus.IN_PROGRESS, targetId: 'tg-c' })
      .mockResolvedValueOnce({ id: 'm-n3x', tournamentId: 't-n3', status: MatchStatus.IN_PROGRESS });
    model.getMatchDetailsForNotification
      .mockResolvedValueOnce({
        id: 'm-n3c',
        matchNumber: 1,
        roundNumber: 1,
        bracket: { name: 'Main' },
        target: { id: 'tg-c', targetNumber: 5, name: null },
        playerMatches: [
          { playerId: 'p1', isWinner: true, scoreTotal: 3, player: { id: 'p1', firstName: 'A', lastName: 'One' } },
          { playerId: 'p2', isWinner: false, scoreTotal: 1, player: { id: 'p2', firstName: 'B', lastName: 'Two' } },
        ],
      })
      .mockResolvedValueOnce({
        id: 'm-n3x',
        matchNumber: 2,
        roundNumber: 1,
        pool: { id: 'pool-x', poolNumber: 2, poolStage: { stageNumber: 1 } },
        playerMatches: [{ playerId: 'p3', isWinner: null }],
        winner: { id: 'p3', firstName: 'C', lastName: 'Three' },
      });

    await handlers.updateMatchStatus('t-n3', 'm-n3c', MatchStatus.COMPLETED);
    await handlers.updateMatchStatus('t-n3', 'm-n3x', MatchStatus.CANCELLED);

    expect(emitMatchFinished).toHaveBeenCalledTimes(2);
    expect(emitMatchFinished).toHaveBeenNthCalledWith(1, expect.objectContaining({ event: 'completed', matchId: 'm-n3c' }));
    expect(emitMatchFinished).toHaveBeenNthCalledWith(2, expect.objectContaining({ event: 'cancelled', matchId: 'm-n3x' }));
  });

  it('fails match start when match with players is missing or tournament live view is missing', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-e1', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({ id: 'm-e1', tournamentId: 't-e1', status: MatchStatus.SCHEDULED, targetId: 'tg-e1' });
    model.getTargetById.mockResolvedValue({ id: 'tg-e1', tournamentId: 't-e1', status: 'AVAILABLE' });

    model.getMatchWithPlayerMatches.mockResolvedValueOnce(undefined);
    await expect(handlers.updateMatchStatus('t-e1', 'm-e1', MatchStatus.IN_PROGRESS)).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND' });

    model.getMatchWithPlayerMatches.mockResolvedValueOnce({
      id: 'm-e1',
      tournamentId: 't-e1',
      poolId: 'pool-e1',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValueOnce(undefined);
    await expect(handlers.updateMatchStatus('t-e1', 'm-e1', MatchStatus.IN_PROGRESS)).rejects.toMatchObject({ code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('uses pool match players fallback when assignments are missing to enforce concurrent limit', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-fb', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-fb',
      tournamentId: 't-fb',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-fb',
      poolId: 'pool-fb',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-fb', tournamentId: 't-fb', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-fb',
      tournamentId: 't-fb',
      poolId: 'pool-fb',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [{
        pools: [{
          id: 'pool-fb',
          assignments: [],
          matches: [
            {
              id: 'other-fb',
              status: MatchStatus.IN_PROGRESS,
              playerMatches: [
                { playerId: 'x1' },
                { player: { id: 'x2' } },
              ],
            },
          ],
        }],
      }],
      brackets: [],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-fb');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-fb', status: StageStatus.IN_PROGRESS });

    await expect(handlers.updateMatchStatus('t-fb', 'm-fb', MatchStatus.IN_PROGRESS)).rejects.toMatchObject({
      code: 'POOL_MAX_CONCURRENT_MATCHES_REACHED',
    });
  });

  it('emits bracket-started notification payload without target or startedAt', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-n4', name: 'Notif Bracket', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-n4',
      tournamentId: 't-n4',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-n4',
      bracketId: 'b-n4',
      roundNumber: 1,
      matchNumber: 3,
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-n4', tournamentId: 't-n4', status: 'AVAILABLE' });
    model.getBracketTargetIds.mockResolvedValue(['tg-n4']);
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-n4', tournamentId: 't-n4', playerMatches: [] });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([]);
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-n4',
      matchNumber: 3,
      roundNumber: 1,
      bracket: { name: null },
      playerMatches: [
        { playerId: 'p1', player: { id: 'p1', firstName: 'Alpha', lastName: 'One', surname: 'A1', teamName: 'Team A' } },
      ],
    });

    await handlers.updateMatchStatus('t-n4', 'm-n4', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      match: expect.objectContaining({ source: 'bracket', bracketName: null }),
    }));
    expect(emitMatchStarted).toHaveBeenCalledWith(expect.not.objectContaining({
      target: expect.anything(),
    }));
  });

  it('handles complete/save not-found branches and skips recompute when double stage is unavailable', async () => {
    const { model, handlers, recomputeDoubleStageProgression } = build();

    model.findById.mockResolvedValueOnce(undefined);
    await expect(handlers.completeMatch('t-x', 'm-x', [])).rejects.toMatchObject({ code: 'TOURNAMENT_NOT_FOUND' });

    model.findById.mockResolvedValueOnce({ id: 't-x', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValueOnce({ id: 'm-x', tournamentId: 'other', status: MatchStatus.IN_PROGRESS });
    await expect(handlers.completeMatch('t-x', 'm-x', [])).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND' });

    model.findById.mockResolvedValueOnce(undefined);
    await expect(handlers.saveMatchScores('t-y', 'm-y', [])).rejects.toMatchObject({ code: 'TOURNAMENT_NOT_FOUND' });

    model.findById.mockResolvedValueOnce({ id: 't-y', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValueOnce({ id: 'm-y', tournamentId: 'other', status: MatchStatus.COMPLETED });
    await expect(handlers.saveMatchScores('t-y', 'm-y', [])).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND' });

    model.findById.mockResolvedValueOnce({
      id: 't-double',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValueOnce({
      id: 'm-double',
      tournamentId: 't-double',
      status: MatchStatus.IN_PROGRESS,
      poolId: 'pool-double',
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchPoolStageId.mockResolvedValueOnce('stage-double');
    model.getPoolStageById.mockResolvedValueOnce({ id: 'stage-double', stageNumber: 2 });
    model.getPoolStages.mockResolvedValueOnce([{ id: 'stage-1', stageNumber: 1 }]);
    model.getMatchById.mockResolvedValueOnce({
      id: 'm-double',
      tournamentId: 't-double',
      status: MatchStatus.COMPLETED,
      poolId: 'pool-double',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p1',
    });

    await handlers.completeMatch('t-double', 'm-double', [
      { playerId: 'p1', scoreTotal: 3 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(recomputeDoubleStageProgression).not.toHaveBeenCalled();
  });
});
