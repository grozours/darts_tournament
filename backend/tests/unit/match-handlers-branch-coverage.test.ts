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
  getMatchFormatPresetByKey: ReturnType<typeof jest.fn>;
  updatePoolStage: ReturnType<typeof jest.fn>;
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
    getMatchFormatPresetByKey: jest.fn(),
    updatePoolStage: jest.fn(),
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

  it('emits match started notification with dynamic match-format tooltip', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({
      emitMatchStarted,
      emitMatchFinished: jest.fn(async () => undefined),
    });

    model.findById.mockResolvedValue({ id: 't-notif', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-notif',
      tournamentId: 't-notif',
      status: MatchStatus.SCHEDULED,
      poolId: 'pool-notif',
      targetId: 'target-notif',
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({
      id: 'target-notif',
      tournamentId: 't-notif',
      status: 'AVAILABLE',
      currentMatchId: null,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-notif',
      tournamentId: 't-notif',
      poolId: 'pool-notif',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.findLiveView.mockResolvedValue({
      poolStages: [{
        pools: [{
          id: 'pool-notif',
          assignments: [{ player: { id: 'p-1' } }, { player: { id: 'p-2' } }],
          matches: [],
        }],
      }],
      brackets: [],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-notif');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-notif', status: StageStatus.NOT_STARTED });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-notif',
      startedAt: new Date('2026-03-12T10:00:00.000Z'),
      matchNumber: 3,
      roundNumber: 1,
      matchFormatKey: 'CUSTOM_FMT',
      playerMatches: [
        { playerId: 'p-1', player: { id: 'p-1', firstName: 'Alice', lastName: 'A' } },
        { playerId: 'p-2', player: { id: 'p-2', firstName: 'Bob', lastName: 'B' } },
      ],
      pool: { id: 'pool-notif', poolNumber: 1, poolStage: { stageNumber: 1, matchFormatKey: null } },
      bracket: null,
      target: { id: 'target-notif', targetNumber: 7, targetCode: 'T7', name: 'Target 7' },
    });
    model.getMatchFormatPresetByKey.mockResolvedValue({
      segments: [{ game: '501_DO', targetCount: 5 }],
    });

    await handlers.updateMatchStatus('t-notif', 'm-notif', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: 'm-notif',
        matchFormatKey: 'CUSTOM_FMT',
        matchFormatTooltip: expect.any(String),
      })
    );
  });

  it('falls back to static tooltip when preset segments are not an array', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-seg1', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-seg1',
      tournamentId: 't-seg1',
      status: MatchStatus.SCHEDULED,
      targetId: 'target-seg1',
      bracketId: null,
      poolId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'target-seg1', tournamentId: 't-seg1', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-seg1', tournamentId: 't-seg1', playerMatches: [] });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-seg1',
      matchNumber: 1,
      roundNumber: 1,
      matchFormatKey: 'CUSTOM_INVALID_1',
      playerMatches: [],
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      target: null,
    });
    model.getMatchFormatPresetByKey.mockResolvedValue({ segments: 'not-an-array' });

    await handlers.updateMatchStatus('t-seg1', 'm-seg1', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchFormatKey: 'CUSTOM_INVALID_1',
      matchFormatTooltip: 'CUSTOM_INVALID_1',
    }));
  });

  it('falls back to static tooltip when preset segment item is invalid', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-seg2', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-seg2',
      tournamentId: 't-seg2',
      status: MatchStatus.SCHEDULED,
      targetId: 'target-seg2',
      bracketId: null,
      poolId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'target-seg2', tournamentId: 't-seg2', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-seg2', tournamentId: 't-seg2', playerMatches: [] });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-seg2',
      matchNumber: 1,
      roundNumber: 1,
      matchFormatKey: 'CUSTOM_INVALID_2',
      playerMatches: [],
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      target: null,
    });
    model.getMatchFormatPresetByKey.mockResolvedValue({ segments: [null] });

    await handlers.updateMatchStatus('t-seg2', 'm-seg2', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchFormatKey: 'CUSTOM_INVALID_2',
      matchFormatTooltip: 'CUSTOM_INVALID_2',
    }));
  });

  it('falls back to static tooltip when preset segment fields are invalid', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-seg3', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-seg3',
      tournamentId: 't-seg3',
      status: MatchStatus.SCHEDULED,
      targetId: 'target-seg3',
      bracketId: null,
      poolId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'target-seg3', tournamentId: 't-seg3', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-seg3', tournamentId: 't-seg3', playerMatches: [] });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-seg3',
      matchNumber: 1,
      roundNumber: 1,
      matchFormatKey: 'CUSTOM_INVALID_3',
      playerMatches: [],
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      target: null,
    });
    model.getMatchFormatPresetByKey.mockResolvedValue({ segments: [{ game: '501_DO', targetCount: 'x' }] });

    await handlers.updateMatchStatus('t-seg3', 'm-seg3', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchFormatKey: 'CUSTOM_INVALID_3',
      matchFormatTooltip: 'CUSTOM_INVALID_3',
    }));
  });

  it('emits cancelled notification when notifyCancelled is enabled', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({
      emitMatchStarted: jest.fn(async () => undefined),
      emitMatchFinished,
    });

    model.findById.mockResolvedValue({ id: 't-cancel', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-cancel',
      tournamentId: 't-cancel',
      status: MatchStatus.IN_PROGRESS,
      targetId: 'target-cancel',
      bracketId: null,
    });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-cancel',
      matchNumber: 1,
      roundNumber: 1,
      playerMatches: [{ playerId: 'p-1', scoreTotal: 0 }, { playerId: 'p-2', scoreTotal: 0 }],
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      winner: null,
      target: null,
    });

    await handlers.updateMatchStatus('t-cancel', 'm-cancel', MatchStatus.SCHEDULED, undefined, {
      notifyCancelled: true,
    });

    expect(emitMatchFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cancelled',
        tournamentId: 't-cancel',
      })
    );
  });

  it('uses winner fallback from matchDetails.winner when no player is flagged winner', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({
      emitMatchStarted: jest.fn(async () => undefined),
      emitMatchFinished,
    });

    model.findById
      .mockResolvedValueOnce({ id: 't-finish', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-finish', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-finish',
      tournamentId: 't-finish',
      status: MatchStatus.IN_PROGRESS,
      targetId: null,
      bracketId: null,
      startedAt: null,
    });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-finish',
      matchNumber: 2,
      roundNumber: 1,
      playerMatches: [
        { playerId: 'p-1', player: { id: 'p-1', firstName: 'A', lastName: 'One' }, scoreTotal: 4 },
        { playerId: 'p-2', player: { id: 'p-2', firstName: 'B', lastName: 'Two' }, scoreTotal: 2 },
      ],
      winner: { id: 'p-1', firstName: 'A', lastName: 'One' },
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      target: null,
    });

    await handlers.updateMatchStatus('t-finish', 'm-finish', MatchStatus.COMPLETED);

    expect(emitMatchFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'completed',
        winner: expect.objectContaining({ id: 'p-1' }),
      })
    );
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

  it('returns early in random completion when second player id is missing', async () => {
    const { model, handlers } = build();
    const now = new Date();

    await handlers.completeMatchWithRandomScores({
      id: 'm-missing-second',
      status: MatchStatus.SCHEDULED,
      playerMatches: [{ playerId: 'p-1' }, { playerId: null }],
    }, now, {
      shouldAdvance: true,
      tournamentId: 't-random',
    });

    expect(model.completeMatch).not.toHaveBeenCalled();
    expect(model.finishMatchAndReleaseTarget).not.toHaveBeenCalled();
  });

  it('stops bracket advancement when bracket belongs to another tournament', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-other', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-other',
      tournamentId: 't-other',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-other',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-other',
      tournamentId: 't-other',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-other',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-other', tournamentId: 't-different', totalRounds: 2 });

    await handlers.completeMatch('t-other', 'm-other', [
      { playerId: 'p-1', scoreTotal: 2 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.getBracketMatchesByRound).not.toHaveBeenCalled();
    expect(model.setBracketMatchPlayerPosition).not.toHaveBeenCalled();
  });

  it('stops bracket advancement when completed match has no winner id', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-nowinner', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-nowinner',
      tournamentId: 't-nowinner',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-nowinner',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-nowinner',
      tournamentId: 't-nowinner',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-nowinner',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: null,
    });
    model.getBracketById.mockResolvedValue({ id: 'b-nowinner', tournamentId: 't-nowinner', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);

    await handlers.completeMatch('t-nowinner', 'm-nowinner', [
      { playerId: 'p-1', scoreTotal: 2 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.getBracketMatchesByRound).not.toHaveBeenCalled();
    expect(model.setBracketMatchPlayerPosition).not.toHaveBeenCalled();
    expect(model.createBracketMatches).not.toHaveBeenCalled();
  });

  it('returns early on final round when not all round matches are completed', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-final', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-final',
      tournamentId: 't-final',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-final',
      roundNumber: 2,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-final',
      tournamentId: 't-final',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-final',
      roundNumber: 2,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-final', tournamentId: 't-final', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([{ status: MatchStatus.SCHEDULED }]);

    await handlers.completeMatch('t-final', 'm-final', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.updateBracket).not.toHaveBeenCalledWith('b-final', expect.objectContaining({ status: BracketStatus.COMPLETED }));
    expect(model.setBracketMatchPlayerPosition).not.toHaveBeenCalled();
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

  it('skips double-stage recompute when pool stage id is missing or stage number is above 3', async () => {
    const { model, handlers, recomputeDoubleStageProgression } = build();

    model.findById.mockResolvedValue({
      id: 't-double-skip',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: true,
    });
    model.getMatchWithPlayerMatches
      .mockResolvedValueOnce({
        id: 'm-skip-1',
        tournamentId: 't-double-skip',
        status: MatchStatus.IN_PROGRESS,
        playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
      })
      .mockResolvedValueOnce({
        id: 'm-skip-2',
        tournamentId: 't-double-skip',
        status: MatchStatus.IN_PROGRESS,
        playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
      });
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-skip-1', tournamentId: 't-double-skip', status: MatchStatus.COMPLETED, winnerId: 'p1' })
      .mockResolvedValueOnce({ id: 'm-skip-2', tournamentId: 't-double-skip', status: MatchStatus.COMPLETED, winnerId: 'p1' });
    model.getMatchPoolStageId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('stage-4');
    model.getPoolStageById.mockResolvedValueOnce({ id: 'stage-4', stageNumber: 4 });

    await handlers.completeMatch('t-double-skip', 'm-skip-1', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);
    await handlers.completeMatch('t-double-skip', 'm-skip-2', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(recomputeDoubleStageProgression).not.toHaveBeenCalled();
  });

  it('recomputes double-stage progression when stage 2/3 exists', async () => {
    const { model, handlers, recomputeDoubleStageProgression } = build();

    model.findById.mockResolvedValue({
      id: 't-double-recompute',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-recompute',
      tournamentId: 't-double-recompute',
      status: MatchStatus.IN_PROGRESS,
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-recompute',
      tournamentId: 't-double-recompute',
      status: MatchStatus.COMPLETED,
      winnerId: 'p1',
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-2');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-2', stageNumber: 2 });
    model.getPoolStages.mockResolvedValue([{ id: 'stage-2', stageNumber: 2 }]);

    await handlers.completeMatch('t-double-recompute', 'm-recompute', [
      { playerId: 'p1', scoreTotal: 2 },
      { playerId: 'p2', scoreTotal: 1 },
    ]);

    expect(recomputeDoubleStageProgression).toHaveBeenCalledWith('t-double-recompute', 'stage-2');
  });

  it('returns early from finished notification when details or tournament are missing', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFinished });

    model.findById
      .mockResolvedValueOnce({ id: 't-miss', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-miss', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce(undefined);
    model.getMatchById
      .mockResolvedValueOnce({ id: 'm-miss-1', tournamentId: 't-miss', status: MatchStatus.IN_PROGRESS })
      .mockResolvedValueOnce({ id: 'm-miss-2', tournamentId: 't-miss', status: MatchStatus.IN_PROGRESS });
    model.getMatchDetailsForNotification
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'm-miss-2',
        matchNumber: 1,
        roundNumber: 1,
        playerMatches: [{ playerId: 'p1', isWinner: true }],
      });

    await handlers.updateMatchStatus('t-miss', 'm-miss-1', MatchStatus.CANCELLED);
    await handlers.updateMatchStatus('t-miss', 'm-miss-2', MatchStatus.CANCELLED);

    expect(emitMatchFinished).not.toHaveBeenCalled();
  });

  it('starts match using cached live view and tolerates sparse in-progress player rows', async () => {
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
      getMatchFormatPresetByKey: jest.fn(),
      updatePoolStage: jest.fn(),
    };

    const handlers = createMatchHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus: jest.fn(async () => ({}) as never),
      recomputeDoubleStageProgression: jest.fn(async () => undefined),
      getCachedTournamentLiveView: jest.fn(async () => ({
        players: [],
        targets: [],
        poolStages: [{
          pools: [{
            id: 'pool-cached',
            assignments: [],
            matches: [
              { id: 'm-cached', status: MatchStatus.SCHEDULED, playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }] },
              { id: 'other-in-progress', status: MatchStatus.IN_PROGRESS, playerMatches: undefined },
              {
                id: 'other-scheduled',
                status: MatchStatus.SCHEDULED,
                playerMatches: [{ playerId: null, player: { id: 'x-4' } }, { playerId: 'x-5' }],
              },
            ],
          }],
        }],
        brackets: [{
          matches: [
            { id: 'b-scheduled', status: MatchStatus.SCHEDULED, playerMatches: [{ playerId: 'bp-1' }] },
            { id: 'b-in-progress', status: MatchStatus.IN_PROGRESS, playerMatches: [{ player: { id: 'bp-2' } }] },
          ],
        }],
      })) as never,
    });

    model.findById.mockResolvedValue({ id: 't-cached', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-cached',
      tournamentId: 't-cached',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-cached',
      poolId: 'pool-cached',
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-cached', tournamentId: 't-cached', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-cached',
      tournamentId: 't-cached',
      poolId: 'pool-cached',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchPoolStageId.mockResolvedValue('stage-cached');
    model.getPoolStageById.mockResolvedValue({ id: 'stage-cached', status: StageStatus.IN_PROGRESS });
    model.getMatchDetailsForNotification.mockResolvedValue(null);

    await handlers.updateMatchStatus('t-cached', 'm-cached', MatchStatus.IN_PROGRESS);

    expect(model.findLiveView).not.toHaveBeenCalled();
    expect(model.startMatchWithTarget).toHaveBeenCalledWith('m-cached', 'tg-cached', expect.any(Date));
  });

  it('starts bracket match when ranking destinations are not an array', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-arr', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-arr',
      tournamentId: 't-arr',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-arr',
      bracketId: 'b-arr',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-arr', tournamentId: 't-arr', status: 'AVAILABLE' });
    model.getBracketTargetIds.mockResolvedValue(['tg-arr']);
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-arr',
      tournamentId: 't-arr',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([
      { id: 'stage-arr', status: StageStatus.IN_PROGRESS, rankingDestinations: { destinationType: 'BRACKET', bracketId: 'b-arr' } },
    ]);
    model.getMatchDetailsForNotification.mockResolvedValue(null);

    await handlers.updateMatchStatus('t-arr', 'm-arr', MatchStatus.IN_PROGRESS);

    expect(model.startMatchWithTarget).toHaveBeenCalledWith('m-arr', 'tg-arr', expect.any(Date));
  });

  it('emits started notification using pool-stage format and target without targetCode', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-fmt-pool', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-fmt-pool',
      tournamentId: 't-fmt-pool',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-fmt-pool',
      poolId: 'pool-fmt',
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-fmt-pool', tournamentId: 't-fmt-pool', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-fmt-pool', tournamentId: 't-fmt-pool', playerMatches: [] });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-fmt-pool',
      matchNumber: 1,
      roundNumber: 1,
      matchFormatKey: '   ',
      pool: { id: 'pool-fmt', poolNumber: 1, poolStage: { stageNumber: 1, matchFormatKey: 'BO3' } },
      target: { id: 'tg-fmt-pool', targetNumber: 3, name: null },
      playerMatches: [{ playerId: 'p-1', player: { firstName: 'A' } }, { player: {} }],
    });

    await handlers.updateMatchStatus('t-fmt-pool', 'm-fmt-pool', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchFormatKey: 'BO3',
      target: expect.objectContaining({ id: 'tg-fmt-pool', name: null }),
    }));
    expect(emitMatchStarted).toHaveBeenCalledWith(expect.not.objectContaining({
      target: expect.objectContaining({ targetCode: expect.any(String) }),
    }));
  });

  it('emits started notification using bracket round format key fallback', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-fmt-br', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-fmt-br',
      tournamentId: 't-fmt-br',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-fmt-br',
      poolId: null,
      bracketId: 'b-fmt-br',
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-fmt-br', tournamentId: 't-fmt-br', status: 'AVAILABLE' });
    model.getBracketTargetIds.mockResolvedValue(['tg-fmt-br']);
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-fmt-br', tournamentId: 't-fmt-br', playerMatches: [] });
    model.findLiveView.mockResolvedValue({ poolStages: [], brackets: [] });
    model.getPoolStages.mockResolvedValue([]);
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-fmt-br',
      matchNumber: 2,
      roundNumber: 2,
      matchFormatKey: '',
      pool: null,
      bracket: { id: 'b-fmt-br', name: 'Main', roundMatchFormats: { 2: 'BO5' } },
      playerMatches: [{ playerId: 'p-1' }],
    });

    await handlers.updateMatchStatus('t-fmt-br', 'm-fmt-br', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).toHaveBeenCalledWith(expect.objectContaining({
      matchFormatKey: 'BO5',
    }));
  });

  it('emits finished notification with null winner when no winner can be resolved', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFinished });

    model.findById
      .mockResolvedValueOnce({ id: 't-win-null', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-win-null', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-win-null',
      tournamentId: 't-win-null',
      status: MatchStatus.IN_PROGRESS,
      targetId: null,
    });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-win-null',
      matchNumber: 1,
      roundNumber: 1,
      pool: null,
      bracket: { id: 'b-1', name: 'Main' },
      target: null,
      playerMatches: [
        { playerId: null, player: { firstName: 'A', lastName: 'One', surname: '', teamName: '' }, isWinner: null, scoreTotal: 2 },
        { player: {}, isWinner: null, scoreTotal: 1 },
      ],
      winner: null,
    });

    await handlers.updateMatchStatus('t-win-null', 'm-win-null', MatchStatus.CANCELLED);

    expect(emitMatchFinished).toHaveBeenCalledWith(expect.objectContaining({
      winner: null,
      event: 'cancelled',
    }));
  });

  it('skips setBracketMatchPlayers when existing next match already has two players', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-pair-full', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-pair-full',
      tournamentId: 't-pair-full',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-pair-full',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-pair-full',
      tournamentId: 't-pair-full',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-pair-full',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-pair-full', tournamentId: 't-pair-full', totalRounds: 2, roundMatchFormats: { 2: 'BO3' } });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p-1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p-2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      {
        id: 'next-full',
        matchNumber: 1,
        status: MatchStatus.SCHEDULED,
        playerMatches: [{ playerId: 'p-a' }, { playerId: 'p-b' }],
      },
    ]);

    await handlers.completeMatch('t-pair-full', 'm-pair-full', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayers).not.toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalledWith('b-pair-full', { status: BracketStatus.IN_PROGRESS });
  });

  it('completes match and releases target when completed match still has a target', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-target-finish', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-target-finish',
      tournamentId: 't-target-finish',
      status: MatchStatus.IN_PROGRESS,
      targetId: 'tg-target-finish',
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-target-finish',
      tournamentId: 't-target-finish',
      status: MatchStatus.COMPLETED,
      winnerId: 'p-1',
      targetId: 'tg-target-finish',
    });

    await handlers.completeMatch('t-target-finish', 'm-target-finish', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      'm-target-finish',
      'tg-target-finish',
      MatchStatus.COMPLETED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
  });

  it('does not release target in saveMatchScores when target is not IN_USE', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({
      id: 't-save-target',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
      doubleStageEnabled: false,
    });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-save-target',
      tournamentId: 't-save-target',
      status: MatchStatus.COMPLETED,
      targetId: 'tg-save-target',
      playerMatches: [{ playerId: null }, { playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getTargetById.mockResolvedValue({
      id: 'tg-save-target',
      currentMatchId: 'm-save-target',
      status: 'AVAILABLE',
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-save-target',
      tournamentId: 't-save-target',
      status: MatchStatus.COMPLETED,
      winnerId: 'p-1',
    });

    await handlers.saveMatchScores('t-save-target', 'm-save-target', [
      { playerId: 'p-1', scoreTotal: 2 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.updateMatchScores).toHaveBeenCalled();
    expect(model.finishMatchAndReleaseTarget).not.toHaveBeenCalledWith(
      'm-save-target',
      'tg-save-target',
      MatchStatus.COMPLETED,
      expect.any(Object)
    );
  });

  it('emits finished pool notification with surname and teamName fields', async () => {
    const { model, handlers } = build();
    const emitMatchFinished = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFinished });

    model.findById
      .mockResolvedValueOnce({ id: 't-pool-finish', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE })
      .mockResolvedValueOnce({ id: 't-pool-finish', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-pool-finish',
      tournamentId: 't-pool-finish',
      status: MatchStatus.IN_PROGRESS,
    });
    model.getMatchDetailsForNotification.mockResolvedValue({
      id: 'm-pool-finish',
      matchNumber: 4,
      roundNumber: 1,
      pool: { id: 'pool-finish', poolNumber: 2, poolStage: { stageNumber: 1 } },
      bracket: null,
      target: null,
      playerMatches: [
        {
          playerId: 'p-1',
          isWinner: true,
          scoreTotal: 3,
          player: { id: 'p-1', firstName: 'A', lastName: 'One', surname: 'Alias', teamName: 'Team A' },
        },
        {
          isWinner: false,
          scoreTotal: 1,
          player: { firstName: 'B', lastName: 'Two' },
        },
      ],
    });

    await handlers.updateMatchStatus('t-pool-finish', 'm-pool-finish', MatchStatus.COMPLETED);

    expect(emitMatchFinished).toHaveBeenCalledWith(expect.objectContaining({
      match: expect.objectContaining({ source: 'pool', poolId: 'pool-finish' }),
      players: expect.arrayContaining([
        expect.objectContaining({ id: 'p-1', surname: 'Alias', teamName: 'Team A' }),
      ]),
    }));
  });

  it('skips pair player assignment when existing next round match is not scheduled', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-pair-in-progress', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-pair-in-progress',
      tournamentId: 't-pair-in-progress',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-pair-in-progress',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-pair-in-progress',
      tournamentId: 't-pair-in-progress',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-pair-in-progress',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-pair-in-progress', tournamentId: 't-pair-in-progress', totalRounds: 2, roundMatchFormats: { 2: 'BO3' } });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p-1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p-2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      {
        id: 'next-in-progress',
        matchNumber: 1,
        status: MatchStatus.IN_PROGRESS,
        playerMatches: [{ playerId: 'p-a' }],
      },
    ]);

    await handlers.completeMatch('t-pair-in-progress', 'm-pair-in-progress', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayers).not.toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalledWith('b-pair-in-progress', { status: BracketStatus.IN_PROGRESS });
  });

  it('returns before pair advance when current match is sibling #2 and sibling winner is missing', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-sibling-missing', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-sibling-missing',
      tournamentId: 't-sibling-missing',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-sibling-missing',
      roundNumber: 1,
      matchNumber: 2,
      playerMatches: [{ playerId: 'p-3' }, { playerId: 'p-4' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-sibling-missing',
      tournamentId: 't-sibling-missing',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-sibling-missing',
      roundNumber: 1,
      matchNumber: 2,
      winnerId: 'p-3',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-sibling-missing', tournamentId: 't-sibling-missing', totalRounds: 2 });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm-1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: null },
      { id: 'm-2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p-3' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([]);

    await handlers.completeMatch('t-sibling-missing', 'm-sibling-missing', [
      { playerId: 'p-3', scoreTotal: 3 },
      { playerId: 'p-4', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayers).not.toHaveBeenCalled();
    expect(model.createBracketMatches).not.toHaveBeenCalled();
    expect(model.createBracketMatchWithSlots).toHaveBeenCalledWith(
      't-sibling-missing',
      'b-sibling-missing',
      2,
      1,
      [{ playerId: 'p-3', playerPosition: 2 }],
      undefined
    );
  });

  it('advances random completion when shouldAdvance and tournamentId are provided', async () => {
    const { model, handlers } = build();
    const now = new Date();
    model.getMatchById.mockResolvedValue(undefined);

    await handlers.completeMatchWithRandomScores({
      id: 'm-random-advance',
      status: MatchStatus.SCHEDULED,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    }, now, {
      shouldAdvance: true,
      tournamentId: 't-random-advance',
    });

    expect(model.completeMatch).toHaveBeenCalledWith(
      'm-random-advance',
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ completedAt: now })
    );
  });

  it('returns early for started notification when match details are missing', async () => {
    const { model, handlers } = build();
    const emitMatchStarted = jest.fn(async () => undefined);
    (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchStarted });

    model.findById.mockResolvedValue({ id: 't-start-miss', name: 'Cup', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchById.mockResolvedValue({
      id: 'm-start-miss',
      tournamentId: 't-start-miss',
      status: MatchStatus.SCHEDULED,
      targetId: 'tg-start-miss',
      bracketId: null,
    });
    model.getTargetById.mockResolvedValue({ id: 'tg-start-miss', tournamentId: 't-start-miss', status: 'AVAILABLE' });
    model.getMatchWithPlayerMatches.mockResolvedValue({ id: 'm-start-miss', tournamentId: 't-start-miss', playerMatches: [] });
    model.getMatchDetailsForNotification.mockResolvedValue(undefined);

    await handlers.updateMatchStatus('t-start-miss', 'm-start-miss', MatchStatus.IN_PROGRESS);

    expect(emitMatchStarted).not.toHaveBeenCalled();
  });

  it('sets pair players on existing scheduled next-round match with one slot filled', async () => {
    const { model, handlers } = build();

    model.findById.mockResolvedValue({ id: 't-pair-fill', status: TournamentStatus.LIVE, format: TournamentFormat.SINGLE });
    model.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'm-pair-fill',
      tournamentId: 't-pair-fill',
      status: MatchStatus.IN_PROGRESS,
      bracketId: 'b-pair-fill',
      roundNumber: 1,
      matchNumber: 1,
      playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }],
    });
    model.getMatchById.mockResolvedValue({
      id: 'm-pair-fill',
      tournamentId: 't-pair-fill',
      status: MatchStatus.COMPLETED,
      bracketId: 'b-pair-fill',
      roundNumber: 1,
      matchNumber: 1,
      winnerId: 'p-1',
    });
    model.getBracketById.mockResolvedValue({ id: 'b-pair-fill', tournamentId: 't-pair-fill', totalRounds: 2, roundMatchFormats: { 2: 'BO3' } });
    model.getBracketEntryCount.mockResolvedValue(4);
    model.getBracketMatchesByRound.mockResolvedValue([
      { id: 'm1', matchNumber: 1, status: MatchStatus.COMPLETED, winnerId: 'p-1' },
      { id: 'm2', matchNumber: 2, status: MatchStatus.COMPLETED, winnerId: 'p-2' },
    ]);
    model.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      {
        id: 'next-fill',
        matchNumber: 1,
        status: MatchStatus.SCHEDULED,
        playerMatches: [{ playerId: 'p-existing' }],
      },
    ]);

    await handlers.completeMatch('t-pair-fill', 'm-pair-fill', [
      { playerId: 'p-1', scoreTotal: 3 },
      { playerId: 'p-2', scoreTotal: 1 },
    ]);

    expect(model.setBracketMatchPlayers).toHaveBeenCalledWith('next-fill', ['p-1', 'p-2']);
  });
});
