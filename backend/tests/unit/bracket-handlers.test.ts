import { BracketStatus, MatchStatus, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../../src/middleware/error-handler';
import { createBracketHandlers } from '../../src/services/tournament-service/bracket-handlers';
import { emitMatchFormatChangedNotifications } from '../../src/services/tournament-service/match-format-change-notifications';

jest.mock('../../src/services/tournament-service/match-format-change-notifications', () => ({
  emitMatchFormatChangedNotifications: jest.fn(),
}));

type ModelMock = {
  findById: jest.Mock;
  getBracketById: jest.Mock;
  getStartedBracketMatchCount: jest.Mock;
  updateBracket: jest.Mock;
  getBracketMatchesByRound: jest.Mock;
  getBracketMatchesByRoundWithPlayers: jest.Mock;
  getTargetsForTournament: jest.Mock;
  getBracketTargetConflicts: jest.Mock;
  setBracketTargets: jest.Mock;
  resetBracketMatches: jest.Mock;
  getBrackets: jest.Mock;
  createBracket: jest.Mock;
  createEmptyBracketMatches: jest.Mock;
  deleteBracket: jest.Mock;
  getMatchDetailsForNotification: jest.Mock;
};

const buildModel = (): ModelMock => ({
  findById: jest.fn(),
  getBracketById: jest.fn(),
  getStartedBracketMatchCount: jest.fn().mockResolvedValue(0),
  updateBracket: jest.fn(),
  getBracketMatchesByRound: jest.fn().mockResolvedValue([]),
  getBracketMatchesByRoundWithPlayers: jest.fn().mockResolvedValue([]),
  getTargetsForTournament: jest.fn().mockResolvedValue([]),
  getBracketTargetConflicts: jest.fn().mockResolvedValue([]),
  setBracketTargets: jest.fn().mockResolvedValue(undefined),
  resetBracketMatches: jest.fn().mockResolvedValue(undefined),
  getBrackets: jest.fn().mockResolvedValue([]),
  createBracket: jest.fn(),
  createEmptyBracketMatches: jest.fn().mockResolvedValue(undefined),
  deleteBracket: jest.fn().mockResolvedValue(undefined),
  getMatchDetailsForNotification: jest.fn(),
});

describe('createBracketHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid roundMatchFormats payload on create', async () => {
    const model = buildModel();
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await expect(handlers.createBracket('tournament-1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 3,
      roundMatchFormats: [] as never,
    })).rejects.toThrow(AppError);
  });

  it('rejects invalid inParallelWith references on create', async () => {
    const model = buildModel();
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await expect(handlers.createBracket('tournament-1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 3,
      inParallelWith: ['invalid-reference'],
    })).rejects.toThrow('Invalid inParallelWith reference');
  });

  it('emits format change notifications only for changed scheduled/in-progress matches', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.DRAFT });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 1: 'BO3' },
    });
    model.updateBracket.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 2,
      roundMatchFormats: { 1: 'BO5', 2: 'BO3' },
    });
    model.getBracketMatchesByRound
      .mockResolvedValueOnce([
        { id: 'm1', status: MatchStatus.SCHEDULED, matchFormatKey: null },
        { id: 'm2', status: MatchStatus.COMPLETED, matchFormatKey: null },
        { id: 'm3', status: MatchStatus.IN_PROGRESS, matchFormatKey: 'CUSTOM' },
      ])
      .mockResolvedValueOnce([
        { id: 'm4', status: MatchStatus.SCHEDULED, matchFormatKey: null },
      ]);

    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await handlers.updateBracket('tournament-1', 'bracket-1', {
      roundMatchFormats: { 1: 'BO5', 2: 'BO3' },
      status: BracketStatus.IN_PROGRESS,
    });

    expect(emitMatchFormatChangedNotifications).toHaveBeenCalledWith(
      {
        findById: expect.any(Function),
        getMatchDetailsForNotification: expect.any(Function),
      },
      'tournament-1',
      [
        { matchId: 'm1', matchFormatKey: 'BO5' },
        { matchId: 'm4', matchFormatKey: 'BO3' },
      ]
    );
  });

  it('does not emit format changes when round formats are not provided in update', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.DRAFT });
    model.getBracketById.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: { 1: 'BO3' },
    });
    model.updateBracket.mockResolvedValue({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      totalRounds: 1,
      roundMatchFormats: { 1: 'BO3' },
    });

    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await handlers.updateBracket('tournament-1', 'bracket-1', { name: 'Updated name' });

    expect(emitMatchFormatChangedNotifications).not.toHaveBeenCalled();
  });

  it('creates empty bracket matches when totalRounds is positive', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.DRAFT });
    model.createBracket.mockResolvedValue({
      id: 'bracket-1',
      totalRounds: 2,
      roundMatchFormats: { 1: 'BO3', 2: 'BO5' },
    });
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await handlers.createBracket('tournament-1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 2,
      roundMatchFormats: { 1: 'BO3', 2: 'BO5' },
    });

    expect(model.createEmptyBracketMatches).toHaveBeenCalledWith(
      'tournament-1',
      'bracket-1',
      expect.any(Array),
      { 1: 'BO3', 2: 'BO5' }
    );
  });

  it('does not create empty bracket matches when totalRounds is 0', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.DRAFT });
    model.createBracket.mockResolvedValue({ id: 'bracket-1', totalRounds: 0, roundMatchFormats: {} });
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await handlers.createBracket('tournament-1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 0,
    });

    expect(model.createEmptyBracketMatches).not.toHaveBeenCalled();
  });

  it('rejects create/update/delete when tournament is finished', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.FINISHED });
    model.getBracketById.mockResolvedValue({ id: 'bracket-1', tournamentId: 'tournament-1', totalRounds: 1 });
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await expect(handlers.createBracket('tournament-1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 1,
    })).rejects.toThrow('Brackets cannot be modified for finished tournaments');

    await expect(handlers.updateBracket('tournament-1', 'bracket-1', { name: 'Updated' }))
      .rejects.toThrow('Brackets cannot be modified for finished tournaments');

    await expect(handlers.deleteBracket('tournament-1', 'bracket-1'))
      .rejects.toThrow('Brackets cannot be modified for finished tournaments');
  });

  it('rejects updateBracket when bracket does not belong to tournament', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.DRAFT });
    model.getBracketById.mockResolvedValue({ id: 'bracket-1', tournamentId: 'other', totalRounds: 1 });
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await expect(handlers.updateBracket('tournament-1', 'bracket-1', { name: 'Updated' }))
      .rejects.toThrow('Bracket not found');
  });

  it('validates updateBracketTargets status and bracket existence', async () => {
    const model = buildModel();
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    model.findById.mockResolvedValueOnce({ id: 'tournament-1', status: TournamentStatus.FINISHED });
    await expect(handlers.updateBracketTargets('tournament-1', 'bracket-1', { targetIds: [] }))
      .rejects.toThrow('Bracket targets can only be updated');

    model.findById.mockResolvedValueOnce({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getBracketById.mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'other' });
    await expect(handlers.updateBracketTargets('tournament-1', 'bracket-1', { targetIds: [] }))
      .rejects.toThrow('Bracket not found');
  });

  it('validates target ownership/conflicts and updates bracket targets', async () => {
    const model = buildModel();
    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getBracketById
      .mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'tournament-1' })
      .mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'tournament-1', targets: [] });
    model.getTargetsForTournament.mockResolvedValue([{ id: 'tg-1' }, { id: 'tg-2' }]);
    model.getBracketTargetConflicts.mockResolvedValue([]);
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    await handlers.updateBracketTargets('tournament-1', 'bracket-1', {
      targetIds: ['tg-1', 'tg-1', 'tg-2'],
    });

    expect(model.setBracketTargets).toHaveBeenCalledWith('bracket-1', ['tg-1', 'tg-2']);

    model.getBracketById.mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'tournament-1' });
    model.getTargetsForTournament.mockResolvedValueOnce([{ id: 'tg-1' }]);
    await expect(handlers.updateBracketTargets('tournament-1', 'bracket-1', { targetIds: ['unknown'] }))
      .rejects.toThrow('Targets must belong to the tournament');

    model.getBracketById.mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'tournament-1' });
    model.getTargetsForTournament.mockResolvedValueOnce([{ id: 'tg-1' }]);
    model.getBracketTargetConflicts.mockResolvedValueOnce([{ bracketId: 'other', targetId: 'tg-1' }]);
    await expect(handlers.updateBracketTargets('tournament-1', 'bracket-1', { targetIds: ['tg-1'] }))
      .rejects.toThrow('Targets already assigned to another bracket');
  });

  it('resets bracket matches when editable and bracket exists', async () => {
    const model = buildModel();
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores: jest.fn(),
    });

    model.findById.mockResolvedValueOnce({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getBracketById.mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'tournament-1' });
    await handlers.resetBracketMatches('tournament-1', 'bracket-1');
    expect(model.resetBracketMatches).toHaveBeenCalledWith('bracket-1');
    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', expect.objectContaining({ status: BracketStatus.NOT_STARTED }));

    model.findById.mockResolvedValueOnce({ id: 'tournament-1', status: TournamentStatus.FINISHED });
    await expect(handlers.resetBracketMatches('tournament-1', 'bracket-1'))
      .rejects.toThrow('Brackets can only be reset for draft, open, signature, or live tournaments');

    model.findById.mockResolvedValueOnce({ id: 'tournament-1', status: TournamentStatus.OPEN });
    model.getBracketById.mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 'other' });
    await expect(handlers.resetBracketMatches('tournament-1', 'bracket-1'))
      .rejects.toThrow('Bracket not found');
  });

  it('validates completeBracketRoundWithRandomScores branches', async () => {
    const model = buildModel();
    const completeMatchWithRandomScores = jest.fn().mockResolvedValue(undefined);
    const handlers = createBracketHandlers({
      tournamentModel: model as never,
      validateUUID: jest.fn(),
      completeMatchWithRandomScores,
    });

    model.findById.mockResolvedValue({ id: 'tournament-1', status: TournamentStatus.LIVE });
    model.getBracketById.mockResolvedValue({ id: 'bracket-1', tournamentId: 'tournament-1' });

    await expect(handlers.completeBracketRoundWithRandomScores('tournament-1', 'bracket-1', 0))
      .rejects.toThrow('Invalid round number');

    model.getBracketMatchesByRoundWithPlayers.mockResolvedValueOnce([]);
    await expect(handlers.completeBracketRoundWithRandomScores('tournament-1', 'bracket-1', 1))
      .rejects.toThrow('Bracket round not found');

    model.getBracketMatchesByRoundWithPlayers.mockResolvedValueOnce([
      { id: 'm1', playerMatches: [{ playerId: 'p1' }] },
    ]);
    await expect(handlers.completeBracketRoundWithRandomScores('tournament-1', 'bracket-1', 1))
      .rejects.toThrow('Bracket round has matches without two players');

    model.getBracketMatchesByRoundWithPlayers.mockResolvedValueOnce([
      { id: 'm1', playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }] },
      { id: 'm2', playerMatches: [{ playerId: 'p3' }, { playerId: 'p4' }] },
    ]);
    await handlers.completeBracketRoundWithRandomScores('tournament-1', 'bracket-1', 1);
    expect(completeMatchWithRandomScores).toHaveBeenCalledTimes(2);
  });
});
