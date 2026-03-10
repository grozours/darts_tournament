import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AssignmentType,
  MatchStatus,
  StageStatus,
  TournamentFormat,
  TournamentStatus,
} from '../../../shared/src/types';
import { createPoolStageHandlers } from '../../src/services/tournament-service/pool-stage-handlers';
import { emitMatchFormatChangedNotifications } from '../../src/services/tournament-service/match-format-change-notifications';

jest.mock('../../src/services/tournament-service/match-format-change-notifications', () => ({
  emitMatchFormatChangedNotifications: jest.fn(),
}));

const buildModel = () => ({
  findById: jest.fn(),
  getPoolStages: jest.fn().mockReturnValue(Promise.resolve([])),
  getPoolCountForStage: jest.fn().mockReturnValue(Promise.resolve(0)),
  getPoolStageById: jest.fn(),
  createPoolStage: jest.fn(),
  createPoolsForStage: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getPoolsForStage: jest.fn().mockReturnValue(Promise.resolve([])),
  getPoolAssignmentCountForStage: jest.fn().mockReturnValue(Promise.resolve(0)),
  getMatchCountForPool: jest.fn().mockReturnValue(Promise.resolve(0)),
  createEmptyPoolMatches: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getPoolMatchesWithPlayers: jest.fn().mockReturnValue(Promise.resolve([])),
  setPoolMatchPlayers: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  createPoolMatches: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  updatePoolStatuses: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  updatePoolStage: jest.fn(),
  getPoolsWithMatchesForStage: jest.fn().mockReturnValue(Promise.resolve([])),
  getBrackets: jest.fn().mockReturnValue(Promise.resolve([])),
  getMatchDetailsForNotification: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getBracketById: jest.fn(),
  createBracket: jest.fn().mockReturnValue(Promise.resolve({ id: 'bracket-new', name: 'New Bracket' })),
  getStartedBracketMatchCount: jest.fn().mockReturnValue(Promise.resolve(0)),
  deleteMatchesForBracket: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  deleteBracketEntriesForBracket: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  createBracketEntries: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  createBracketMatches: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  updateBracket: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  deletePoolStage: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getPoolsWithAssignmentsForStage: jest.fn().mockReturnValue(Promise.resolve([])),
  getPoolById: jest.fn(),
  resetPoolMatches: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getMatchesForPoolStage: jest.fn().mockReturnValue(Promise.resolve([])),
  completeMatchesForStage: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  completePoolsForStage: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getActivePlayersForTournament: jest.fn().mockReturnValue(Promise.resolve([])),
  getOpponentPairsBeforeStage: jest.fn().mockReturnValue(Promise.resolve([])),
  deletePoolAssignmentsForStage: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  createPoolAssignments: jest.fn().mockReturnValue(Promise.resolve(undefined)),
  getActiveDoublettePlayersForTournament: jest.fn().mockReturnValue(Promise.resolve([])),
});

const liveTournament = {
  id: 'tournament-1',
  status: TournamentStatus.LIVE,
  format: TournamentFormat.SINGLE,
  doubleStageEnabled: false,
};

const createHandlers = (
  model: ReturnType<typeof buildModel>,
  completeMatchWithRandomScores: (match: unknown, now: Date, options: { shouldAdvance: boolean }) => Promise<void> = async () => undefined
) => createPoolStageHandlers({
  tournamentModel: model as never,
  validateUUID: jest.fn(),
  completeMatchWithRandomScores,
});

describe('createPoolStageHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid inParallelWith references on create', async () => {
    const model = buildModel();
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      inParallelWith: ['oops'],
    })).rejects.toThrow('Invalid inParallelWith reference');
  });

  it('rejects non-array inParallelWith values on create', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      inParallelWith: 'stage:1' as unknown as string[],
    })).rejects.toThrow('Invalid inParallelWith value');
  });

  it('rejects non-string match format keys on create and update', async () => {
    const createModel = buildModel();
    createModel.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const createCaseHandlers = createHandlers(createModel);

    await expect(createCaseHandlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 1,
      playersPerPool: 2,
      advanceCount: 1,
      matchFormatKey: 123 as unknown as string,
    })).rejects.toThrow('Invalid match format key');

    const updateModel = buildModel();
    updateModel.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    updateModel.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: null,
    }));
    const updateCaseHandlers = createHandlers(updateModel);

    await expect(updateCaseHandlers.updatePoolStage('tournament-1', 'stage-1', {
      matchFormatKey: 123 as unknown as string,
    })).rejects.toThrow('Invalid match format key');
  });


  it('rejects create when tournament is missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
    })).rejects.toThrow('Tournament not found');
  });

  it('rejects create when tournament status is not editable', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.FINISHED }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
    })).rejects.toThrow('Pool stages can only be modified');
  });

  it('rejects create when ranking destinations do not cover all positions', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Ranking destinations must cover all positions in the pool');
  });

  it('rejects create when ranking destinations reference unknown bracket', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getBrackets.mockReturnValue(Promise.resolve([{ id: 'bracket-1', name: 'Winner' }]));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET', bracketId: 'missing-bracket' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Ranking destinations must reference tournament brackets');
  });

  it('rejects create when ranking destinations contain duplicate positions', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'ELIMINATED' },
        { position: 1, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Duplicate ranking destination position');
  });

  it('rejects create when bracket destination misses bracketId', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'BRACKET' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Bracket destination requires a bracket');
  });

  it('rejects create when pool stage destination misses poolStageId', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Pool stage destination requires a stage');
  });

  it('rejects create for invalid ranking positions and unknown stage destinations', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStages.mockReturnValue(Promise.resolve([{ id: 'stage-2', tournamentId: 'tournament-1' }]));
    const handlers = createHandlers(model);

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 1,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 0, destinationType: 'ELIMINATED' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Invalid ranking destination position');

    await expect(handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 1,
      playersPerPool: 2,
      advanceCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'missing-stage' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Ranking destinations must reference tournament pool stages');
  });

  it('creates pools when poolCount is positive', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.createPoolStage.mockReturnValue(Promise.resolve({ id: 'stage-1', poolCount: 2, playersPerPool: 1 }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', playersPerPool: 1 }));
    const handlers = createHandlers(model);

    await handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
    });

    expect(model.createPoolsForStage).toHaveBeenCalledWith('stage-1', 2);
    expect(model.getPoolStageById).toHaveBeenCalledWith('stage-1');
  });

  it('does not create pools when poolCount is zero', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.createPoolStage.mockReturnValue(Promise.resolve({ id: 'stage-1', poolCount: 0, playersPerPool: 4 }));
    const handlers = createHandlers(model);

    await handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 0,
      playersPerPool: 4,
      advanceCount: 2,
    });

    expect(model.createPoolsForStage).not.toHaveBeenCalled();
    expect(model.createEmptyPoolMatches).not.toHaveBeenCalled();
  });

  it('creates empty pool matches skeleton when playersPerPool >= 2', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.createPoolStage.mockReturnValue(Promise.resolve({ id: 'stage-1', poolCount: 1, playersPerPool: 4 }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      playersPerPool: 4,
      matchFormatKey: 'BO3',
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }]));
    model.getMatchCountForPool.mockReturnValue(Promise.resolve(0));
    const handlers = createHandlers(model);

    await handlers.createPoolStage('tournament-1', {
      stageNumber: 1,
      name: 'Pools',
      poolCount: 1,
      playersPerPool: 4,
      advanceCount: 2,
    });

    expect(model.createEmptyPoolMatches).toHaveBeenCalledWith(
      'tournament-1',
      'pool-1',
      expect.any(Array),
      'BO3'
    );
  });

  it('blocks update to IN_PROGRESS when tournament is not live', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      playersPerPool: 4,
      matchFormatKey: null,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolStage('tournament-1', 'stage-1', {
      status: StageStatus.IN_PROGRESS,
    })).rejects.toThrow('Pool stages can only be started when the tournament is live');
  });

  it('updates pool stage and emits match format change notifications when format changes', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.NOT_STARTED,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.NOT_STARTED,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO5',
    }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        matches: [{ id: 'match-1', status: 'SCHEDULED', matchFormatKey: 'BO3' }],
      },
    ]));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { matchFormatKey: 'BO5' });

    expect(model.updatePoolStage).toHaveBeenCalledWith('stage-1', expect.objectContaining({ matchFormatKey: 'BO5' }));
    expect(emitMatchFormatChangedNotifications).toHaveBeenCalled();
  });

  it('does not emit match format notifications when format is unchanged', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.NOT_STARTED,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.NOT_STARTED,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { name: 'No format change' });

    expect(emitMatchFormatChangedNotifications).not.toHaveBeenCalled();
  });

  it('resets pool matches when stage transitions to NOT_STARTED', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 2,
      matchFormatKey: null,
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.NOT_STARTED,
      playersPerPool: 2,
      poolCount: 2,
      matchFormatKey: null,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }, { id: 'pool-2' }]));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { status: StageStatus.NOT_STARTED });

    expect(model.resetPoolMatches).toHaveBeenCalledWith('pool-1');
    expect(model.resetPoolMatches).toHaveBeenCalledWith('pool-2');
  });

  it('redistributes assignments when stage edition changes pool count', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: null,
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 2,
      matchFormatKey: null,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }, { id: 'pool-2' }]));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([{ id: 'player-1' }, { id: 'player-2' }]));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { poolCount: 2 });

    expect(model.deletePoolAssignmentsForStage).toHaveBeenCalledWith('stage-1');
    expect(model.createPoolAssignments).toHaveBeenCalled();
  });

  it('redistributes stage>1 assignments using opponent history and tie-break selection', async () => {
    const model = buildModel();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4);
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-2',
      tournamentId: 'tournament-1',
      stageNumber: 2,
      status: StageStatus.EDITION,
      playersPerPool: 3,
      poolCount: 1,
      matchFormatKey: null,
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-2',
      tournamentId: 'tournament-1',
      stageNumber: 2,
      status: StageStatus.EDITION,
      playersPerPool: 3,
      poolCount: 2,
      matchFormatKey: null,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }, { id: 'pool-2' }]));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
      { id: 'p4' },
    ]));
    model.getOpponentPairsBeforeStage.mockReturnValue(Promise.resolve([
      ['p1', 'p4'],
      ['p2', 'p3'],
    ]));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-2', { poolCount: 2 });

    expect(model.getOpponentPairsBeforeStage).toHaveBeenCalledWith('tournament-1', 2);
    expect(model.createPoolAssignments).toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('rejects update when pool stage does not belong to tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'other',
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: null,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolStage('tournament-1', 'stage-1', { name: 'x' })).rejects.toThrow('Pool stage not found');
  });

  it('creates pool matches when stage enters IN_PROGRESS', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.LIVE }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.IN_PROGRESS,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.getPoolAssignmentCountForStage.mockReturnValue(Promise.resolve(1));
    model.getPoolsWithAssignmentsForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        assignments: [
          { player: { id: 'player-1' } },
          { player: { id: 'player-2' } },
        ],
      },
    ]));
    model.getMatchCountForPool.mockReturnValue(Promise.resolve(0));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { status: StageStatus.IN_PROGRESS });

    expect(model.createPoolMatches).toHaveBeenCalled();
    expect(model.updatePoolStatuses).toHaveBeenCalled();
  });

  it('assigns registered doublettes as pool entries for DOUBLE tournaments', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.OPEN,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: false,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      advanceCount: 1,
      matchFormatKey: undefined,
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      advanceCount: 1,
      matchFormatKey: undefined,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }]));
    model.getPoolAssignmentCountForStage.mockReturnValue(Promise.resolve(0));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([
      { id: 'member-1' },
      { id: 'member-2' },
      { id: 'member-3' },
      { id: 'member-4' },
    ]));
    model.getActiveDoublettePlayersForTournament.mockReturnValue(Promise.resolve([
      { id: 'doublette-1', skillLevel: 'ADVANCED' },
      { id: 'doublette-2', skillLevel: 'BEGINNER' },
    ]));

    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { name: 'Pools updated' });

    expect(model.createPoolAssignments).toHaveBeenCalledWith([
      {
        poolId: 'pool-1',
        playerId: 'doublette-1',
        assignmentType: AssignmentType.SEEDED,
        seedNumber: 1,
      },
      {
        poolId: 'pool-1',
        playerId: 'doublette-2',
        assignmentType: AssignmentType.SEEDED,
        seedNumber: 2,
      },
    ]);
    expect(model.getActiveDoublettePlayersForTournament).toHaveBeenCalledWith('tournament-1');
  });

  it('reseeds scheduled pool matches when assigned players changed', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.LIVE }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      status: StageStatus.IN_PROGRESS,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: 'BO3',
    }));
    model.getPoolAssignmentCountForStage.mockReturnValue(Promise.resolve(1));
    model.getPoolsWithAssignmentsForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        assignments: [
          { player: { id: 'doublette-1' } },
          { player: { id: 'doublette-2' } },
        ],
      },
    ]));
    model.getMatchCountForPool.mockReturnValue(Promise.resolve(1));
    model.getPoolMatchesWithPlayers.mockReturnValue(Promise.resolve([
      {
        id: 'match-1',
        matchNumber: 1,
        status: MatchStatus.SCHEDULED,
        playerMatches: [
          { position: 1, player: { id: 'legacy-doublette' } },
          { position: 2, player: { id: 'doublette-2' } },
        ],
      },
    ]));
    const handlers = createHandlers(model);

    await handlers.updatePoolStage('tournament-1', 'stage-1', { status: StageStatus.IN_PROGRESS });

    expect(model.setPoolMatchPlayers).toHaveBeenCalledWith('match-1', ['doublette-1', 'doublette-2']);
    expect(model.createPoolMatches).not.toHaveBeenCalled();
  });

  it('returns updated stage without extra handlers for unknown stage status branch', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: null,
    }));
    model.updatePoolStage.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: 'PAUSED',
      playersPerPool: 2,
      poolCount: 1,
      matchFormatKey: null,
    }));
    const handlers = createHandlers(model);

    const result = await handlers.updatePoolStage('tournament-1', 'stage-1', { name: 'Paused stage' } as never);

    expect(result).toEqual(expect.objectContaining({ status: 'PAUSED' }));
  });

  it('rejects update when ranking destinations target same stage', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.LIVE }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      playersPerPool: 2,
      matchFormatKey: null,
      status: StageStatus.EDITION,
    }));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1' },
      { id: 'stage-2', tournamentId: 'tournament-1' },
    ]));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolStage('tournament-1', 'stage-1', {
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'stage-1' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    })).rejects.toThrow('Ranking destinations cannot target the same pool stage');
  });

  it('rejects update when inParallelWith is not an array', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.LIVE }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      playersPerPool: 2,
      matchFormatKey: null,
      status: StageStatus.EDITION,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolStage('tournament-1', 'stage-1', {
      inParallelWith: 'stage:1' as unknown as string[],
    })).rejects.toThrow('Invalid inParallelWith value');
  });

  it('rejects recomputeDoubleStageProgression when tournament is not live', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1'))
      .rejects.toThrow('Double-stage progression can only be recomputed for live tournaments');
  });

  it('rejects recomputeDoubleStageProgression when tournament is missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1'))
      .rejects.toThrow('Tournament not found');
  });

  it('falls back to bracket population when recomputeDoubleStageProgression is not applicable', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
      doubleStageEnabled: false,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      advanceCount: 2,
    }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    const handlers = createHandlers(model);

    await handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1');

    expect(model.getBrackets).toHaveBeenCalledWith('tournament-1');
  });

  it('routes completed stage entries to another pool stage via ranking destinations', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
      doubleStageEnabled: false,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      playersPerPool: 2,
      poolCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 2, destinationType: 'ELIMINATED' },
      ],
    }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'p1', firstName: 'A', lastName: 'A' } },
          { player: { id: 'p2', firstName: 'B', lastName: 'B' } },
        ],
        matches: [],
      },
    ]));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1, playersPerPool: 2, poolCount: 1 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2, playersPerPool: 2, poolCount: 1 },
    ]));
    model.getPoolCountForStage.mockReturnValue(Promise.resolve(1));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-x' }]));
    const handlers = createHandlers(model);

    await handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1');

    expect(model.deletePoolAssignmentsForStage).toHaveBeenCalledWith('stage-2');
    expect(model.createPoolAssignments).toHaveBeenCalled();
  });

  it('separates qualifiers from the same source pool across next-stage pools', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
      doubleStageEnabled: false,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      playersPerPool: 4,
      poolCount: 2,
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 2, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 3, destinationType: 'ELIMINATED' },
        { position: 4, destinationType: 'ELIMINATED' },
      ],
    }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'a1', firstName: 'A', lastName: '01' } },
          { player: { id: 'a2', firstName: 'A', lastName: '02' } },
          { player: { id: 'a3', firstName: 'A', lastName: '03' } },
          { player: { id: 'a4', firstName: 'A', lastName: '04' } },
        ],
        matches: [],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [
          { player: { id: 'b1', firstName: 'B', lastName: '01' } },
          { player: { id: 'b2', firstName: 'B', lastName: '02' } },
          { player: { id: 'b3', firstName: 'B', lastName: '03' } },
          { player: { id: 'b4', firstName: 'B', lastName: '04' } },
        ],
        matches: [],
      },
    ]));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1, playersPerPool: 4, poolCount: 2 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2, playersPerPool: 2, poolCount: 2 },
    ]));
    model.getPoolCountForStage.mockReturnValue(Promise.resolve(2));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-x' }, { id: 'pool-y' }]));
    const handlers = createHandlers(model);

    await handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1');

    const assignments = model.createPoolAssignments.mock.calls[0]?.[0] as Array<{ poolId: string; playerId: string }>;
    expect(assignments).toBeDefined();
    const poolByPlayer = new Map(assignments.map((assignment) => [assignment.playerId, assignment.poolId]));
    expect(poolByPlayer.get('a1')).toBeDefined();
    expect(poolByPlayer.get('a2')).toBeDefined();
    expect(poolByPlayer.get('a1')).not.toBe(poolByPlayer.get('a2'));
    expect(poolByPlayer.get('b1')).toBeDefined();
    expect(poolByPlayer.get('b2')).toBeDefined();
    expect(poolByPlayer.get('b1')).not.toBe(poolByPlayer.get('b2'));
  });

  it('rejects next-stage routing when same-pool separation is impossible with at least two pools', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.SINGLE,
      doubleStageEnabled: false,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      playersPerPool: 3,
      poolCount: 1,
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 2, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 3, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
      ],
    }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'a1', firstName: 'A', lastName: 'One' } },
          { player: { id: 'a2', firstName: 'A', lastName: 'Two' } },
          { player: { id: 'a3', firstName: 'A', lastName: 'Three' } },
        ],
        matches: [],
      },
    ]));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1, playersPerPool: 3, poolCount: 1 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2, playersPerPool: 2, poolCount: 2 },
    ]));
    model.getPoolCountForStage.mockReturnValue(Promise.resolve(2));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-x' }, { id: 'pool-y' }]));
    const handlers = createHandlers(model);

    await expect(handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1'))
      .rejects.toThrow('Unable to separate qualifiers from the same pool in the next pool stage');
  });

  it('handles stage 1 double-stage progression and creates bracket C when missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: true,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      playersPerPool: 4,
      poolCount: 2,
      advanceCount: 2,
    }));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1, playersPerPool: 4, poolCount: 2 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2, playersPerPool: 4, poolCount: 1 },
      { id: 'stage-3', tournamentId: 'tournament-1', stageNumber: 3, playersPerPool: 4, poolCount: 1 },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'p1', firstName: 'A', lastName: 'A' } },
          { player: { id: 'p2', firstName: 'B', lastName: 'B' } },
          { player: { id: 'p3', firstName: 'C', lastName: 'C' } },
          { player: { id: 'p4', firstName: 'D', lastName: 'D' } },
        ],
        matches: [],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [
          { player: { id: 'p5', firstName: 'E', lastName: 'E' } },
          { player: { id: 'p6', firstName: 'F', lastName: 'F' } },
          { player: { id: 'p7', firstName: 'G', lastName: 'G' } },
          { player: { id: 'p8', firstName: 'H', lastName: 'H' } },
        ],
        matches: [],
      },
    ]));
    model.getPoolCountForStage.mockReturnValue(Promise.resolve(2));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-a' }, { id: 'pool-b' }]));
    model.createBracket.mockReturnValue(Promise.resolve({
      id: 'bracket-c',
      name: 'C Bracket',
      roundMatchFormats: {},
    }));
    const handlers = createHandlers(model);

    await handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1');

    expect(model.createBracket).toHaveBeenCalledWith('tournament-1', expect.objectContaining({ name: 'C Bracket' }));
    expect(model.createBracketEntries).toHaveBeenCalled();
  });

  it('handles stage 2 double-stage progression and populates bracket A', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: true,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-2',
      tournamentId: 'tournament-1',
      stageNumber: 2,
      playersPerPool: 4,
      poolCount: 1,
      advanceCount: 2,
    }));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2 },
      { id: 'stage-3', tournamentId: 'tournament-1', stageNumber: 3 },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([
      { id: 'bracket-a', name: 'A Bracket', roundMatchFormats: {} },
    ]));
    model.getPoolsWithMatchesForStage.mockImplementation(async (stageId) => {
      if (stageId === 'stage-1') {
        return [
          {
            id: 's1-pool-1',
            poolNumber: 1,
            assignments: [
              { player: { id: 'p1', firstName: 'A', lastName: '01' } },
              { player: { id: 'p2', firstName: 'A', lastName: '02' } },
            ],
            matches: [],
          },
          {
            id: 's1-pool-2',
            poolNumber: 2,
            assignments: [
              { player: { id: 'p3', firstName: 'B', lastName: '01' } },
              { player: { id: 'p4', firstName: 'B', lastName: '02' } },
            ],
            matches: [],
          },
        ];
      }

      return [
        {
          id: 'pool-1',
          poolNumber: 1,
          assignments: [
            { player: { id: 'p1', firstName: 'A', lastName: '01' } },
            { player: { id: 'p3', firstName: 'B', lastName: '01' } },
          ],
          matches: [],
        },
        {
          id: 'pool-2',
          poolNumber: 2,
          assignments: [
            { player: { id: 'p2', firstName: 'A', lastName: '02' } },
            { player: { id: 'p4', firstName: 'B', lastName: '02' } },
          ],
          matches: [],
        },
      ];
    });
    const handlers = createHandlers(model);

    await handlers.recomputeDoubleStageProgression('tournament-1', 'stage-2');

    expect(model.deleteMatchesForBracket).toHaveBeenCalledWith('bracket-a');
    expect(model.createBracketEntries).toHaveBeenCalled();
    const payload = model.createBracketEntries.mock.calls[0]?.[0] as Array<{ playerId: string; seedNumber: number }>;
    const seedByPlayer = new Map(payload.map((entry) => [entry.playerId, entry.seedNumber]));
    expect(seedByPlayer.get('p1')).toBeDefined();
    expect(seedByPlayer.get('p3')).toBeDefined();
    const firstHalfLimit = payload.length / 2;
    expect((seedByPlayer.get('p1') as number) <= firstHalfLimit)
      .not.toBe((seedByPlayer.get('p3') as number) <= firstHalfLimit);
  });

  it('applies head-to-head +1 tie-break when selecting stage 2 qualifiers from stage 1', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: true,
    }));
    model.getPoolStageById.mockImplementation(async (stageId) => {
      const id = String(stageId);
      if (id === 'stage-1') {
        return {
          id: 'stage-1',
          tournamentId: 'tournament-1',
          stageNumber: 1,
          playersPerPool: 5,
          poolCount: 1,
          advanceCount: 2,
        };
      }
      if (id === 'stage-2') {
        return {
          id: 'stage-2',
          tournamentId: 'tournament-1',
          stageNumber: 2,
          playersPerPool: 2,
          poolCount: 1,
          advanceCount: 2,
        };
      }
      if (id === 'stage-3') {
        return {
          id: 'stage-3',
          tournamentId: 'tournament-1',
          stageNumber: 3,
          playersPerPool: 2,
          poolCount: 1,
          advanceCount: 2,
        };
      }
      return undefined;
    });
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1, playersPerPool: 5, poolCount: 1 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2, playersPerPool: 2, poolCount: 1 },
      { id: 'stage-3', tournamentId: 'tournament-1', stageNumber: 3, playersPerPool: 2, poolCount: 1 },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    model.getPoolsWithMatchesForStage.mockImplementation(async (stageId) => {
      if (String(stageId) !== 'stage-1') {
        return [];
      }

      return [
        {
          id: 'pool-c',
          poolNumber: 3,
          assignments: [
            { player: { id: 'd28', firstName: 'Riley', lastName: 'Singh-Cross' } },
            { player: { id: 'd36', firstName: 'Cameron', lastName: 'Santos-Vale' } },
            { player: { id: 'd1', firstName: 'Jordan', lastName: 'Nguyen-River' } },
            { player: { id: 'd33', firstName: 'Parker', lastName: 'Lopez-Stone' } },
            { player: { id: 'd4', firstName: 'Taylor', lastName: 'Fischer' } },
          ],
          matches: [
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd36' }, scoreTotal: 3 },
                { player: { id: 'd4' }, scoreTotal: 2 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd33' }, scoreTotal: 4 },
                { player: { id: 'd1' }, scoreTotal: 0 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd4' }, scoreTotal: 4 },
                { player: { id: 'd28' }, scoreTotal: 0 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd1' }, scoreTotal: 1 },
                { player: { id: 'd36' }, scoreTotal: 0 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd28' }, scoreTotal: 5 },
                { player: { id: 'd33' }, scoreTotal: 2 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd1' }, scoreTotal: 4 },
                { player: { id: 'd4' }, scoreTotal: 3 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd28' }, scoreTotal: 1 },
                { player: { id: 'd1' }, scoreTotal: 0 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd36' }, scoreTotal: 5 },
                { player: { id: 'd33' }, scoreTotal: 3 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd28' }, scoreTotal: 2 },
                { player: { id: 'd36' }, scoreTotal: 0 },
              ],
            },
            {
              status: MatchStatus.COMPLETED,
              playerMatches: [
                { player: { id: 'd33' }, scoreTotal: 2 },
                { player: { id: 'd4' }, scoreTotal: 0 },
              ],
            },
          ],
        },
      ];
    });
    model.getPoolCountForStage.mockImplementation(async (stageId) => {
      const id = String(stageId);
      if (id === 'stage-2' || id === 'stage-3') {
        return 1;
      }
      return 0;
    });
    model.getPoolsForStage.mockImplementation(async (stageId) => {
      const id = String(stageId);
      if (id === 'stage-2') {
        return [{ id: 'stage2-pool-1' }];
      }
      if (id === 'stage-3') {
        return [{ id: 'stage3-pool-1' }];
      }
      return [];
    });

    const handlers = createHandlers(model);

    await handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1');

    const stage2Call = model.createPoolAssignments.mock.calls.find((call) =>
      Array.isArray(call[0]) && call[0].some((entry: { poolId: string }) => entry.poolId === 'stage2-pool-1')
    );
    const stage2Assignments = (stage2Call?.[0] ?? []) as Array<{ playerId: string }>;
    const stage2PlayerIds = new Set(stage2Assignments.map((entry) => entry.playerId));

    expect(stage2PlayerIds.has('d33')).toBe(true);
    expect(stage2PlayerIds.has('d28')).toBe(true);
    expect(stage2PlayerIds.has('d4')).toBe(false);
  });

  it('rejects recomputeDoubleStageProgression when stage 2/3 are missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({
      id: 'tournament-1',
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: true,
    }));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      stageNumber: 1,
      playersPerPool: 4,
    }));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));

    const handlers = createHandlers(model);

    await expect(handlers.recomputeDoubleStageProgression('tournament-1', 'stage-1'))
      .rejects.toThrow('Double-stage tournament requires stage 2 (A) and stage 3 (B)');
  });

  it('rejects bracket population when stage is not completed', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.IN_PROGRESS,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Pool stage must be completed to populate brackets');
  });

  it('rejects bracket population when tournament is missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects bracket population when tournament is not live', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ ...liveTournament, status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Brackets can only be populated for live tournaments');
  });

  it('rejects bracket population when stage is outside tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'other' }));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Pool stage not found');
  });

  it('rejects bracket population when bracket already started', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({ id: 'bracket-1', tournamentId: 'tournament-1', name: 'Winner' }));
    model.getStartedBracketMatchCount.mockReturnValue(Promise.resolve(1));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Bracket cannot be populated once matches have started');
  });

  it('rejects bracket population when bracket does not belong to tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      advanceCount: 2,
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({ id: 'bracket-1', tournamentId: 'other', name: 'Winner' }));
    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Bracket not found');
  });

  it('rejects bracket population when stage is not final and no routing exists', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      advanceCount: 2,
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({ id: 'bracket-1', tournamentId: 'tournament-1', name: 'Winner' }));
    model.getStartedBracketMatchCount.mockReturnValue(Promise.resolve(0));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
      { id: 'stage-2', tournamentId: 'tournament-1', stageNumber: 2 },
    ]));

    const handlers = createHandlers(model);

    await expect(handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1'))
      .rejects.toThrow('Pool stage must be the final stage to populate brackets');
  });

  it('populates bracket from final stage and defaults to loser entries for loser bracket names', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      advanceCount: 2,
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      name: 'Loser Bracket',
      roundMatchFormats: {},
    }));
    model.getStartedBracketMatchCount.mockReturnValue(Promise.resolve(0));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
    ]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));
    const handlers = createHandlers(model);

    await handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1');

    expect(model.deleteMatchesForBracket).toHaveBeenCalledWith('bracket-1');
    expect(model.deleteBracketEntriesForBracket).toHaveBeenCalledWith('bracket-1');
    expect(model.createBracketEntries).toHaveBeenCalledWith([]);
    expect(model.updateBracket).toHaveBeenCalledWith('bracket-1', expect.objectContaining({ totalRounds: 1 }));
  });

  it('populates bracket from ranking destinations routing when configured', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      advanceCount: 1,
      rankingDestinations: [{ position: 1, destinationType: 'BRACKET', bracketId: 'bracket-1' }],
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({
      id: 'bracket-1',
      tournamentId: 'tournament-1',
      name: 'Winner Bracket',
      roundMatchFormats: {},
    }));
    model.getStartedBracketMatchCount.mockReturnValue(Promise.resolve(0));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));
    const handlers = createHandlers(model);

    await handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-1');

    expect(model.deleteMatchesForBracket).toHaveBeenCalledWith('bracket-1');
    expect(model.createBracketEntries).toHaveBeenCalledWith([]);
  });

  it('separates two qualifiers from the same pool until bracket final', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 1,
      advanceCount: 2,
    }));
    model.getBracketById.mockReturnValue(Promise.resolve({
      id: 'bracket-winner',
      tournamentId: 'tournament-1',
      name: 'Winner Bracket',
      roundMatchFormats: {},
    }));
    model.getStartedBracketMatchCount.mockReturnValue(Promise.resolve(0));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', tournamentId: 'tournament-1', stageNumber: 1 },
    ]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'p1', firstName: 'Alpha', lastName: 'One' } },
          { player: { id: 'p2', firstName: 'Bravo', lastName: 'One' } },
        ],
        matches: [],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [
          { player: { id: 'p3', firstName: 'Alpha', lastName: 'Two' } },
          { player: { id: 'p4', firstName: 'Bravo', lastName: 'Two' } },
        ],
        matches: [],
      },
      {
        id: 'pool-3',
        poolNumber: 3,
        assignments: [
          { player: { id: 'p5', firstName: 'Alpha', lastName: 'Three' } },
          { player: { id: 'p6', firstName: 'Bravo', lastName: 'Three' } },
        ],
        matches: [],
      },
      {
        id: 'pool-4',
        poolNumber: 4,
        assignments: [
          { player: { id: 'p7', firstName: 'Alpha', lastName: 'Four' } },
          { player: { id: 'p8', firstName: 'Bravo', lastName: 'Four' } },
        ],
        matches: [],
      },
    ]));

    const handlers = createHandlers(model);

    await handlers.populateBracketFromPools('tournament-1', 'stage-1', 'bracket-winner');

    const payload = model.createBracketEntries.mock.calls[0]?.[0] as Array<{
      playerId: string;
      seedNumber: number;
    }>;

    expect(payload).toBeDefined();
    expect(payload).toHaveLength(8);

    const seedByPlayer = new Map(payload.map((entry) => [entry.playerId, entry.seedNumber]));
    expect(Math.abs((seedByPlayer.get('p1') ?? 0) - (seedByPlayer.get('p2') ?? 0))).toBe(4);
    expect(Math.abs((seedByPlayer.get('p3') ?? 0) - (seedByPlayer.get('p4') ?? 0))).toBe(4);
    expect(Math.abs((seedByPlayer.get('p5') ?? 0) - (seedByPlayer.get('p6') ?? 0))).toBe(4);
    expect(Math.abs((seedByPlayer.get('p7') ?? 0) - (seedByPlayer.get('p8') ?? 0))).toBe(4);
  });

  it('rejects delete when tournament status is not editable', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.FINISHED }));
    const handlers = createHandlers(model);

    await expect(handlers.deletePoolStage('tournament-1', 'stage-1'))
      .rejects.toThrow('Pool stages can only be modified');
  });

  it('rejects delete when tournament does not exist', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.deletePoolStage('tournament-1', 'stage-1'))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects getPoolStagePools when stage is outside tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'other' }));
    const handlers = createHandlers(model);

    await expect(handlers.getPoolStagePools('tournament-1', 'stage-1'))
      .rejects.toThrow('Pool stage not found');
  });

  it('rejects getPoolStagePools when tournament does not exist', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.getPoolStagePools('tournament-1', 'stage-1'))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects resetPoolMatches when pool does not belong to stage', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'tournament-1' }));
    model.getPoolById.mockReturnValue(Promise.resolve({ id: 'pool-1', poolStageId: 'another-stage' }));
    const handlers = createHandlers(model);

    await expect(handlers.resetPoolMatches('tournament-1', 'stage-1', 'pool-1'))
      .rejects.toThrow('Pool not found');
  });

  it('rejects resetPoolMatches when stage does not belong to tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'other' }));
    const handlers = createHandlers(model);

    await expect(handlers.resetPoolMatches('tournament-1', 'stage-1', 'pool-1'))
      .rejects.toThrow('Pool stage not found');
  });

  it('rejects pool assignment edits when stage is already in progress', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.IN_PROGRESS,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', []))
      .rejects.toThrow('Pool assignments can only be edited in edition or not started stage');
  });

  it('rejects pool assignment edits when tournament is missing', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(null));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', []))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects pool assignment edits when tournament status is not editable', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.FINISHED }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', []))
      .rejects.toThrow('Pool assignments can only be modified for draft, open, signature, or live tournaments');
  });

  it('rejects pool assignment edits when stage is outside tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'other', status: StageStatus.EDITION }));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', []))
      .rejects.toThrow('Pool stage not found');
  });

  it('rejects invalid player assignments', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }]));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([{ id: 'player-1' }]));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', [
      {
        poolId: 'pool-1',
        playerId: 'missing-player',
        assignmentType: AssignmentType.SEEDED,
      },
    ])).rejects.toThrow('Invalid player assignment');
  });

  it('rejects invalid pool assignments', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }]));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([{ id: 'player-1' }]));
    const handlers = createHandlers(model);

    await expect(handlers.updatePoolAssignments('tournament-1', 'stage-1', [
      {
        poolId: 'unknown-pool',
        playerId: 'player-1',
        assignmentType: AssignmentType.SEEDED,
      },
    ])).rejects.toThrow('Invalid pool assignment target');
  });

  it('rejects completePoolStageWithRandomScores when stage is not in progress', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1'))
      .rejects.toThrow('Pool stage must be in progress to complete');
  });

  it('rejects completePoolStageWithRandomScores when stage is outside tournament', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'other',
      status: StageStatus.IN_PROGRESS,
    }));
    const handlers = createHandlers(model);

    await expect(handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1'))
      .rejects.toThrow('Pool stage not found');
  });

  it('deletes pool stage when tournament is editable', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve({ id: 'tournament-1', status: TournamentStatus.OPEN }));
    const handlers = createHandlers(model);

    await handlers.deletePoolStage('tournament-1', 'stage-1');

    expect(model.deletePoolStage).toHaveBeenCalledWith('stage-1');
  });

  it('returns pool stage pools when stage belongs to tournament', async () => {
    const model = buildModel();
    const pools = [{ id: 'pool-1' }];
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'tournament-1' }));
    model.getPoolsWithAssignmentsForStage.mockReturnValue(Promise.resolve(pools));
    const handlers = createHandlers(model);

    const result = await handlers.getPoolStagePools('tournament-1', 'stage-1');

    expect(result).toEqual(pools);
  });

  it('resets pool matches when pool belongs to stage', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({ id: 'stage-1', tournamentId: 'tournament-1' }));
    model.getPoolById.mockReturnValue(Promise.resolve({ id: 'pool-1', poolStageId: 'stage-1' }));
    const handlers = createHandlers(model);

    await handlers.resetPoolMatches('tournament-1', 'stage-1', 'pool-1');

    expect(model.resetPoolMatches).toHaveBeenCalledWith('pool-1');
  });

  it('replaces pool assignments when stage is editable and inputs are valid', async () => {
    const model = buildModel();
    const assignments = [{
      poolId: 'pool-1',
      playerId: 'player-1',
      assignmentType: AssignmentType.SEEDED,
    }];
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-1',
      tournamentId: 'tournament-1',
      status: StageStatus.EDITION,
    }));
    model.getPoolsForStage.mockReturnValue(Promise.resolve([{ id: 'pool-1' }]));
    model.getActivePlayersForTournament.mockReturnValue(Promise.resolve([{ id: 'player-1' }]));
    const handlers = createHandlers(model);

    await handlers.updatePoolAssignments('tournament-1', 'stage-1', assignments);

    expect(model.deletePoolAssignmentsForStage).toHaveBeenCalledWith('stage-1');
    expect(model.createPoolAssignments).toHaveBeenCalledWith(assignments);
  });

  it('completes in-progress stage and only plays matches with at least two players', async () => {
    const model = buildModel();
    const completeMatchSpy = jest.fn();
    const completeMatchWithRandomScores = async (
      match: unknown,
      now: Date,
      options: { shouldAdvance: boolean }
    ) => {
      completeMatchSpy(match, now, options);
    };
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById
      .mockReturnValueOnce(Promise.resolve({
        id: 'stage-1',
        tournamentId: 'tournament-1',
        status: StageStatus.IN_PROGRESS,
        stageNumber: 1,
        advanceCount: 2,
      }))
      .mockReturnValueOnce(Promise.resolve({
        id: 'stage-1',
        tournamentId: 'tournament-1',
        stageNumber: 1,
        advanceCount: 2,
      }));
    model.getMatchesForPoolStage.mockReturnValue(Promise.resolve([
      { id: 'match-played', playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }] },
      { id: 'match-skipped', playerMatches: [{ playerId: 'p1' }] },
    ]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));
    model.getPoolStages.mockReturnValue(Promise.resolve([{ id: 'stage-1', stageNumber: 1 }]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    const handlers = createHandlers(model, completeMatchWithRandomScores);

    await handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1');

    expect(completeMatchSpy).toHaveBeenCalledTimes(1);
    expect(completeMatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'match-played' }),
      expect.any(Date),
      { shouldAdvance: false }
    );
    expect(model.completeMatchesForStage).toHaveBeenCalledWith('stage-1', expect.any(Date));
    expect(model.completePoolsForStage).toHaveBeenCalledWith('stage-1', expect.any(Date));
    expect(model.updatePoolStage).toHaveBeenCalledWith('stage-1', expect.objectContaining({
      status: StageStatus.COMPLETED,
      completedAt: expect.any(Date),
    }));
  });

  it('re-populates brackets when completePoolStageWithRandomScores is called on a completed stage', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById
      .mockReturnValueOnce(Promise.resolve({
        id: 'stage-1',
        tournamentId: 'tournament-1',
        status: StageStatus.COMPLETED,
        stageNumber: 1,
        advanceCount: 2,
      }))
      .mockReturnValueOnce(Promise.resolve({
        id: 'stage-1',
        tournamentId: 'tournament-1',
        stageNumber: 1,
        advanceCount: 2,
      }));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([]));
    model.getPoolStages.mockReturnValue(Promise.resolve([{ id: 'stage-1', stageNumber: 1 }]));
    model.getBrackets.mockReturnValue(Promise.resolve([]));
    const handlers = createHandlers(model);

    await handlers.completePoolStageWithRandomScores('tournament-1', 'stage-1');

    expect(model.completeMatchesForStage).not.toHaveBeenCalled();
    expect(model.completePoolsForStage).not.toHaveBeenCalled();
    expect(model.getPoolsWithMatchesForStage).toHaveBeenCalledWith('stage-1');
  });

  it('populates winner and loser brackets from non-empty final-stage standings', async () => {
    const model = buildModel();
    model.findById.mockReturnValue(Promise.resolve(liveTournament));
    model.getPoolStageById.mockReturnValue(Promise.resolve({
      id: 'stage-2',
      tournamentId: 'tournament-1',
      status: StageStatus.COMPLETED,
      stageNumber: 2,
      advanceCount: 1,
    }));
    model.getPoolStages.mockReturnValue(Promise.resolve([
      { id: 'stage-1', stageNumber: 1, tournamentId: 'tournament-1' },
      { id: 'stage-2', stageNumber: 2, tournamentId: 'tournament-1', advanceCount: 1 },
    ]));
    model.getPoolsWithMatchesForStage.mockReturnValue(Promise.resolve([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [
          { player: { id: 'p1', firstName: 'Alice', lastName: 'One' } },
          { player: { id: 'p2', firstName: 'Bob', lastName: 'One' } },
        ],
        matches: [
          {
            playerMatches: [
              { player: { id: 'p1' }, scoreTotal: 3 },
              { player: { id: 'p2' }, scoreTotal: 1 },
            ],
          },
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [
          { player: { id: 'p3', firstName: 'Cara', lastName: 'Two' } },
          { player: { id: 'p4', firstName: 'Dana', lastName: 'Two' } },
        ],
        matches: [
          {
            playerMatches: [
              { player: { id: 'p3' }, scoreTotal: 2 },
              { player: { id: 'p4' }, scoreTotal: 0 },
            ],
          },
        ],
      },
    ]));
    model.getBrackets.mockReturnValue(Promise.resolve([
      { id: 'bracket-main', name: 'Main Bracket', roundMatchFormats: {} },
      { id: 'bracket-loser', name: 'Loser Bracket', roundMatchFormats: {} },
    ]));
    model.getBracketById.mockReturnValue(Promise.resolve({ id: 'bracket-main', roundMatchFormats: {} }));
    const handlers = createHandlers(model);

    await handlers.completePoolStageWithRandomScores('tournament-1', 'stage-2');

    expect(model.createBracketEntries).toHaveBeenCalled();
    expect(model.createBracketMatches).toHaveBeenCalled();
    expect(model.updateBracket).toHaveBeenCalled();
  });
});
