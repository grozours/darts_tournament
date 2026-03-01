import { TournamentService } from '../../src/services/tournament-service';
import { AppError } from '../../src/middleware/error-handler';
import {
  DurationType,
  MatchStatus,
  Player,
  StageStatus,
  TargetStatus,
  TournamentFormat,
  TournamentStatus,
} from '../../../shared/src/types';
import { TournamentModel } from '../../src/models/tournament-model';
import { getWebSocketService } from '../../src/websocket/server';
import { config } from '../../src/config/environment';
import { redis } from '../../src/config/redis';
import { liveComputationCache } from '../../src/services/live-computation-cache';

const isAdminMock = jest.fn();
const saveTournamentSnapshotMock = jest.fn();
const deleteTournamentSnapshotMock = jest.fn();

jest.mock('../../src/models/tournament-model');
jest.mock('../../src/websocket/server', () => ({
  getWebSocketService: jest.fn(),
}));
jest.mock('../../src/middleware/auth', () => ({
  isAdmin: (...arguments_: unknown[]) => isAdminMock(...arguments_),
}));
jest.mock('../../src/services/tournament-service/autosave', () => ({
  saveTournamentSnapshot: (...arguments_: unknown[]) => saveTournamentSnapshotMock(...arguments_),
  deleteTournamentSnapshot: (...arguments_: unknown[]) => deleteTournamentSnapshotMock(...arguments_),
}));

type MockTournamentModel = {
  create: jest.Mock;
  update: jest.Mock;
  findById: jest.Mock;
  findLiveView: jest.Mock;
  isEditable: jest.Mock;
  findAll: jest.Mock;
  findByDateRange: jest.Mock;
  delete: jest.Mock;
  updateLogo: jest.Mock;
  getOverallStats: jest.Mock;
  getTargetRanges: jest.Mock;
  getTargetsForTournament: jest.Mock;
  getMatchCountForTargets: jest.Mock;
  rebuildTargetsForTournament: jest.Mock;
  updateStatus: jest.Mock;
  getMaxTargetNumber: jest.Mock;
  createTargetsForTournament: jest.Mock;
  getMatchById: jest.Mock;
  getTargetById: jest.Mock;
  getBracketTargetIds: jest.Mock;
  getMatchWithPlayerMatches: jest.Mock;
  resetMatchToScheduled: jest.Mock;
  setTargetAvailable: jest.Mock;
  startMatchWithTarget: jest.Mock;
  finishMatchAndReleaseTarget: jest.Mock;
  updateMatchStatus: jest.Mock;
  updateInProgressMatchScores: jest.Mock;
  updateMatchScores: jest.Mock;
  isPlayerRegistered: jest.Mock;
  getParticipantCount: jest.Mock;
  getCheckedInCount: jest.Mock;
  getParticipants: jest.Mock;
  getOrphanParticipants: jest.Mock;
  getPoolStages: jest.Mock;
  createPoolStage: jest.Mock;
  createPoolsForStage: jest.Mock;
  updatePoolStage: jest.Mock;
  getPoolStageById: jest.Mock;
  getMatchesForPoolStage: jest.Mock;
  completeMatchesForStage: jest.Mock;
  getPoolCountForStage: jest.Mock;
  getPoolsForStage: jest.Mock;
  getPoolAssignmentCountForStage: jest.Mock;
  getPoolMatchesWithPlayers: jest.Mock;
  setPoolMatchPlayers: jest.Mock;
  completePoolsForStage: jest.Mock;
  getBrackets: jest.Mock;
  getBracketById: jest.Mock;
  getBracketMatchesByRoundWithPlayers: jest.Mock;
  completeMatch: jest.Mock;
  getPoolsWithAssignmentsForStage: jest.Mock;
  getPoolsWithMatchesForStage: jest.Mock;
  getMatchCountForPool: jest.Mock;
  createPoolMatches: jest.Mock;
  updatePoolStatuses: jest.Mock;
  deletePoolStage: jest.Mock;
  getPoolStagePools: jest.Mock;
  registerPlayer: jest.Mock;
  unregisterPlayer: jest.Mock;
  updatePlayerCheckIn: jest.Mock;
  findPlayerBySurname: jest.Mock;
  findPlayerByTeamName: jest.Mock;
  createPlayer: jest.Mock;
  findPersonByEmailAndPhone: jest.Mock;
  createPerson: jest.Mock;
  updatePerson: jest.Mock;
  updatePlayer: jest.Mock;
  getPlayerById: jest.Mock;
};

const buildFutureTimes = (hoursFromNow: number) => {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start, end };
};

describe('TournamentService core logic', () => {
  let mockModel: MockTournamentModel;
  let authEnabledOriginal: boolean;

  beforeEach(() => {
    authEnabledOriginal = config.auth.enabled;
    config.auth.enabled = false;
    isAdminMock.mockReset();
    isAdminMock.mockReturnValue(false);
    saveTournamentSnapshotMock.mockReset();
    saveTournamentSnapshotMock.mockResolvedValue(undefined);
    deleteTournamentSnapshotMock.mockReset();
    deleteTournamentSnapshotMock.mockResolvedValue(undefined);
    mockModel = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findLiveView: jest.fn(),
      isEditable: jest.fn(),
      findAll: jest.fn(),
      findByDateRange: jest.fn(),
      delete: jest.fn(),
      updateLogo: jest.fn(),
      getOverallStats: jest.fn(),
      getTargetRanges: jest.fn(),
      getTargetsForTournament: jest.fn(),
      getMatchCountForTargets: jest.fn(),
      rebuildTargetsForTournament: jest.fn(),
      updateStatus: jest.fn(),
      getMaxTargetNumber: jest.fn(),
      createTargetsForTournament: jest.fn(),
      getMatchById: jest.fn(),
      getTargetById: jest.fn(),
      getBracketTargetIds: jest.fn(),
      getMatchWithPlayerMatches: jest.fn(),
      resetMatchToScheduled: jest.fn(),
      setTargetAvailable: jest.fn(),
      startMatchWithTarget: jest.fn(),
      finishMatchAndReleaseTarget: jest.fn(),
      updateMatchStatus: jest.fn(),
      updateInProgressMatchScores: jest.fn(),
      updateMatchScores: jest.fn(),
      isPlayerRegistered: jest.fn(),
      getParticipantCount: jest.fn(),
      getCheckedInCount: jest.fn(),
      getParticipants: jest.fn(),
      getOrphanParticipants: jest.fn(),
      getPoolStages: jest.fn(),
      createPoolStage: jest.fn(),
      createPoolsForStage: jest.fn(),
      updatePoolStage: jest.fn(),
      getPoolStageById: jest.fn(),
      getMatchesForPoolStage: jest.fn(),
      completeMatchesForStage: jest.fn(),
      getPoolCountForStage: jest.fn(),
      getPoolsForStage: jest.fn(),
      getPoolAssignmentCountForStage: jest.fn(),
      getPoolMatchesWithPlayers: jest.fn(),
      setPoolMatchPlayers: jest.fn(),
      completePoolsForStage: jest.fn(),
      getBrackets: jest.fn(),
      getBracketById: jest.fn(),
      getBracketMatchesByRoundWithPlayers: jest.fn(),
      completeMatch: jest.fn(),
      getPoolsWithAssignmentsForStage: jest.fn(),
      getPoolsWithMatchesForStage: jest.fn(),
      getMatchCountForPool: jest.fn(),
      createPoolMatches: jest.fn(),
      updatePoolStatuses: jest.fn(),
      deletePoolStage: jest.fn(),
      getPoolStagePools: jest.fn(),
      registerPlayer: jest.fn(),
      unregisterPlayer: jest.fn(),
      updatePlayerCheckIn: jest.fn(),
      findPlayerBySurname: jest.fn(),
      findPlayerByTeamName: jest.fn(),
      createPlayer: jest.fn(),
      findPersonByEmailAndPhone: jest.fn(),
      createPerson: jest.fn(),
      updatePerson: jest.fn(),
      updatePlayer: jest.fn(),
      getPlayerById: jest.fn(),
    };

    mockModel.getTargetRanges.mockResolvedValue([]);
    mockModel.getPoolStages.mockResolvedValue([]);
    mockModel.getTargetsForTournament.mockResolvedValue([]);
    mockModel.getMatchCountForTargets.mockResolvedValue(0);
    mockModel.getBracketTargetIds.mockResolvedValue([]);
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: 'match-default',
      playerMatches: [],
    });

    (TournamentModel as jest.Mock).mockImplementation(() => mockModel);
    (getWebSocketService as jest.Mock).mockReturnValue(undefined);
  });

  afterEach(() => {
    config.auth.enabled = authEnabledOriginal;
  });

  it('sanitizes tournament names on create', async () => {
    const { start, end } = buildFutureTimes(2);
    const service = new TournamentService({} as never);

    mockModel.create.mockResolvedValue({
      id: 't-1',
      name: 'Spring Invitational',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });

    await service.createTournament({
      name: '<b>Spring Invitational</b>',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    });

    expect(mockModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Spring Invitational' })
    );
  });

  it('persists autosave with admin actor context and custom email claim', async () => {
    const { start, end } = buildFutureTimes(2);
    isAdminMock.mockReturnValue(true);

    const request = {
      user: { id: 'admin-user' },
      auth: { payload: { 'https://darts-tournament.app/email': 'admin@example.com' } },
    };

    const service = new TournamentService({} as never, request as never);

    mockModel.create.mockResolvedValue({
      id: 't-admin',
      name: 'Admin Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });

    await service.createTournament({
      name: 'Admin Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    });

    expect(saveTournamentSnapshotMock).toHaveBeenCalledWith(
      mockModel,
      't-admin',
      expect.objectContaining({
        action: 'CREATE_TOURNAMENT',
        trigger: 'admin',
        actorId: 'admin-user',
        actorEmail: 'admin@example.com',
      })
    );
  });

  it('uses system trigger and swallows autosave persistence errors', async () => {
    const { start, end } = buildFutureTimes(2);
    const service = new TournamentService({} as never);
    const logger = (service as unknown as { logger: { error: jest.Mock } }).logger;
    const loggerErrorSpy = jest.spyOn(logger, 'error');

    saveTournamentSnapshotMock.mockRejectedValueOnce(new Error('snapshot failed'));
    mockModel.create.mockResolvedValue({
      id: 't-system',
      name: 'System Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });

    await expect(service.createTournament({
      name: 'System Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    })).resolves.toEqual(expect.objectContaining({ id: 't-system' }));

    expect(saveTournamentSnapshotMock).toHaveBeenCalledWith(
      mockModel,
      't-system',
      expect.objectContaining({
        action: 'CREATE_TOURNAMENT',
        trigger: 'system',
      })
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to persist tournament autosave snapshot',
      't-system',
      expect.any(Error)
    );
    loggerErrorSpy.mockRestore();
  });

  it('extracts actor email from fallback namespace claim', async () => {
    const { start, end } = buildFutureTimes(2);
    isAdminMock.mockReturnValue(true);
    const service = new TournamentService({} as never, {
      user: { id: 'admin-user' },
      auth: { payload: { 'https://your-domain.com/email': 'legacy@example.com' } },
    } as never);

    mockModel.create.mockResolvedValue({
      id: 't-legacy',
      name: 'Legacy Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });

    await service.createTournament({
      name: 'Legacy Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    });

    expect(saveTournamentSnapshotMock).toHaveBeenCalledWith(
      mockModel,
      't-legacy',
      expect.objectContaining({ actorEmail: 'legacy@example.com', trigger: 'admin' })
    );
  });

  it('omits actor email when auth payload email is empty', async () => {
    const { start, end } = buildFutureTimes(2);
    isAdminMock.mockReturnValue(true);
    const service = new TournamentService({} as never, {
      user: { id: 'admin-user' },
      auth: { payload: { email: '' } },
    } as never);

    mockModel.create.mockResolvedValue({
      id: 't-empty-email',
      name: 'No Mail Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });

    await service.createTournament({
      name: 'No Mail Cup',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    });

    expect(saveTournamentSnapshotMock).toHaveBeenCalledWith(
      mockModel,
      't-empty-email',
      expect.not.objectContaining({ actorEmail: expect.anything() })
    );
  });

  it('deletes tournament and cleans up autosave snapshot', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000333';
    mockModel.findById.mockResolvedValue({ id: tournamentId, name: 'Delete Me' });
    mockModel.delete.mockResolvedValue(true);

    await expect(service.deleteTournament(tournamentId)).resolves.toBe(true);

    expect(mockModel.delete).toHaveBeenCalledWith(tournamentId);
    expect(deleteTournamentSnapshotMock).toHaveBeenCalledWith(tournamentId);
  });

  it('swallows autosave snapshot deletion errors and logs cleanup failures', async () => {
    const service = new TournamentService({} as never);
    const logger = (service as unknown as { logger: { error: jest.Mock } }).logger;
    const loggerErrorSpy = jest.spyOn(logger, 'error');
    const tournamentId = '00000000-0000-4000-8000-000000009999';

    deleteTournamentSnapshotMock.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect((service as unknown as {
      deleteTournamentSnapshotSafe: (id: string) => Promise<void>;
    }).deleteTournamentSnapshotSafe(tournamentId)).resolves.toBeUndefined();

    expect(deleteTournamentSnapshotMock).toHaveBeenCalledWith(tournamentId);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to delete tournament autosave snapshot',
      tournamentId,
      expect.any(Error)
    );
    loggerErrorSpy.mockRestore();
  });

  it('covers private delegates and actor helpers', async () => {
    isAdminMock.mockReturnValue(true);
    const service = new TournamentService({} as never, {
      user: { id: 'admin-user' },
      auth: { payload: { email: 'root@example.com' } },
    } as never);

    mockModel.findLiveView.mockResolvedValue({ id: 'live-1' });

    expect((service as unknown as { isAdminAction: () => boolean }).isAdminAction()).toBe(true);
    expect((service as unknown as { getActorEmailForAction: () => string | undefined }).getActorEmailForAction())
      .toBe('root@example.com');
    expect((service as unknown as { canViewDraftLive: () => boolean }).canViewDraftLive()).toBe(true);

    const transitionSpy = jest.fn().mockResolvedValue({ id: 't1' });
    (service as unknown as { transitionTournamentStatus: jest.Mock }).transitionTournamentStatus = transitionSpy;
    await (service as unknown as {
      delegateTransitionTournamentStatus: (tournamentId: string, status: TournamentStatus) => Promise<unknown>;
    }).delegateTransitionTournamentStatus('t1', TournamentStatus.OPEN);
    expect(transitionSpy).toHaveBeenCalledWith('t1', TournamentStatus.OPEN);

    const registerSpy = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { registerPlayer: jest.Mock }).registerPlayer = registerSpy;
    await (service as unknown as {
      delegateRegisterPlayer: (tournamentId: string, playerId: string) => Promise<void>;
    }).delegateRegisterPlayer('t1', 'p1');
    expect(registerSpy).toHaveBeenCalledWith('t1', 'p1');

    const recomputeRef = jest.fn().mockResolvedValue(undefined);
    (service as unknown as {
      recomputeDoubleStageProgressionReference?: (tournamentId: string, stageId: string) => Promise<void>;
    }).recomputeDoubleStageProgressionReference = recomputeRef;
    await (service as unknown as {
      delegateRecomputeDoubleStageProgression: (tournamentId: string, stageId: string) => Promise<void>;
    }).delegateRecomputeDoubleStageProgression(
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000102'
    );
    expect(recomputeRef).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000102'
    );

    liveComputationCache.invalidateTournament('live-1');
    await (service as unknown as {
      getCachedTournamentLiveView: (tournamentId: string) => Promise<unknown>;
    }).getCachedTournamentLiveView('live-1');
    expect(mockModel.findLiveView).toHaveBeenCalledWith('live-1');
  });

  it('invalidates redis live/list caches when env is not test and logs redis errors', async () => {
    const service = new TournamentService({} as never);
    const invalidateSpy = jest.spyOn(liveComputationCache, 'invalidateTournament').mockImplementation(() => undefined);
    const loggerError = jest.fn();
    (service as unknown as { logger: { error: jest.Mock } }).logger = { error: loggerError } as never;

    const originalEnv = config.env;
    const keys = jest.fn()
      .mockResolvedValueOnce(['tournaments:live-summary:one'])
      .mockResolvedValueOnce(['tournaments:list:one']);
    const del = jest.fn().mockResolvedValue(4);
    const getClientSpy = jest.spyOn(redis, 'getClient').mockReturnValue({ keys, del } as never);

    (config as { env: string }).env = 'development';
    await (service as unknown as {
      invalidateLiveCachesForTournament: (tournamentId: string) => Promise<void>;
    }).invalidateLiveCachesForTournament('tour-1');

    expect(invalidateSpy).toHaveBeenCalledWith('tour-1');
    expect(del).toHaveBeenCalledWith(expect.arrayContaining([
      'tournaments:live:tour-1:admin',
      'tournaments:live:tour-1:public',
      'tournaments:live-summary:one',
      'tournaments:list:one',
    ]));

    keys.mockRejectedValueOnce(new Error('redis down'));
    await (service as unknown as {
      invalidateLiveCachesForTournament: (tournamentId: string) => Promise<void>;
    }).invalidateLiveCachesForTournament('tour-2');
    expect(loggerError).toHaveBeenCalledWith('Failed to invalidate live caches', 'tour-2', expect.any(Error));

    (config as { env: string }).env = originalEnv;
    invalidateSpy.mockRestore();
    getClientSpy.mockRestore();
  });

  it('rejects tournaments with invalid date ranges', async () => {
    const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const end = new Date(start.getTime() - 60 * 60 * 1000);
    const service = new TournamentService({} as never);

    await expect(
      service.createTournament({
        name: 'Invalid Dates',
        format: TournamentFormat.SINGLE,
        durationType: DurationType.FULL_DAY,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        totalParticipants: 8,
        targetCount: 2,
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('creates missing targets when target count increases', async () => {
    const { start, end } = buildFutureTimes(2);
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000002';

    mockModel.isEditable.mockResolvedValue(true);
    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Target Growth',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 2,
      status: TournamentStatus.DRAFT,
    });
    mockModel.update.mockResolvedValue({
      id: tournamentId,
      name: 'Target Growth',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: start,
      endTime: end,
      totalParticipants: 8,
      targetCount: 4,
      status: TournamentStatus.DRAFT,
    });
    await service.updateTournament(tournamentId, { targetCount: 4 });

    expect(mockModel.rebuildTargetsForTournament).toHaveBeenCalledWith(tournamentId, 1, 4);
  });

  it('starts a match with the selected target', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000003';
    const matchId = '00000000-0000-4000-8000-000000000103';
    const targetId = '00000000-0000-4000-8000-000000000203';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.LIVE });
    mockModel.getMatchById.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.SCHEDULED,
      targetId,
    });
    mockModel.getTargetById.mockResolvedValue({
      id: targetId,
      tournamentId,
      status: TargetStatus.AVAILABLE,
    });

    await service.updateMatchStatus(tournamentId, matchId, MatchStatus.IN_PROGRESS);

    expect(mockModel.startMatchWithTarget).toHaveBeenCalledWith(
      matchId,
      targetId,
      expect.any(Date)
    );
  });

  it('blocks bracket match start unless tournament is live', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000013';
    const matchId = '00000000-0000-4000-8000-000000000113';
    const targetId = '00000000-0000-4000-8000-000000000213';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.SIGNATURE });
    mockModel.getMatchById.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.SCHEDULED,
      targetId,
      bracketId: 'bracket-1',
    });
    mockModel.getTargetById.mockResolvedValue({
      id: targetId,
      tournamentId,
      status: TargetStatus.AVAILABLE,
    });

    await expect(
      service.updateMatchStatus(tournamentId, matchId, MatchStatus.IN_PROGRESS)
    ).rejects.toMatchObject({ code: 'BRACKET_MATCH_NOT_LIVE' });

    expect(mockModel.startMatchWithTarget).not.toHaveBeenCalled();
  });

  it('allows bracket match start when tournament is live', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000014';
    const matchId = '00000000-0000-4000-8000-000000000114';
    const targetId = '00000000-0000-4000-8000-000000000214';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.LIVE });
    mockModel.getMatchById.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.SCHEDULED,
      targetId,
      bracketId: 'bracket-2',
    });
    mockModel.getTargetById.mockResolvedValue({
      id: targetId,
      tournamentId,
      status: TargetStatus.AVAILABLE,
    });

    await service.updateMatchStatus(tournamentId, matchId, MatchStatus.IN_PROGRESS);

    expect(mockModel.startMatchWithTarget).toHaveBeenCalledWith(
      matchId,
      targetId,
      expect.any(Date)
    );
  });

  it('releases targets when completing a match', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000004';
    const matchId = '00000000-0000-4000-8000-000000000104';
    const targetId = '00000000-0000-4000-8000-000000000204';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.LIVE });
    mockModel.getMatchById.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.IN_PROGRESS,
      targetId,
    });

    await service.updateMatchStatus(tournamentId, matchId, MatchStatus.COMPLETED);

    expect(mockModel.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      matchId,
      targetId,
      MatchStatus.COMPLETED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
  });

  it('rejects saveMatchScores when match status is not editable', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000034';
    const matchId = '00000000-0000-4000-8000-000000000134';

    mockModel.findById.mockResolvedValue({ id: tournamentId, format: TournamentFormat.SINGLE });
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.SCHEDULED,
      playerMatches: [
        { playerId: '00000000-0000-4000-8000-000000000301' },
        { playerId: '00000000-0000-4000-8000-000000000302' },
      ],
    });

    await expect(
      service.saveMatchScores(tournamentId, matchId, [
        { playerId: '00000000-0000-4000-8000-000000000301', scoreTotal: 3 },
        { playerId: '00000000-0000-4000-8000-000000000302', scoreTotal: 1 },
      ])
    ).rejects.toMatchObject({ code: 'MATCH_STATUS_NOT_EDITABLE' });
  });

  it('updates scores for IN_PROGRESS matches without completion flow', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000035';
    const matchId = '00000000-0000-4000-8000-000000000135';

    mockModel.findById.mockResolvedValue({ id: tournamentId, format: TournamentFormat.SINGLE });
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.IN_PROGRESS,
      playerMatches: [
        { playerId: '00000000-0000-4000-8000-000000000303' },
        { playerId: '00000000-0000-4000-8000-000000000304' },
      ],
    });

    await service.saveMatchScores(tournamentId, matchId, [
      { playerId: '00000000-0000-4000-8000-000000000303', scoreTotal: 4 },
      { playerId: '00000000-0000-4000-8000-000000000304', scoreTotal: 2 },
    ]);

    expect(mockModel.updateInProgressMatchScores).toHaveBeenCalledWith(
      matchId,
      expect.any(Array)
    );
    expect(mockModel.updateMatchScores).not.toHaveBeenCalled();
  });

  it('updates completed match scores and releases target when still in use', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000036';
    const matchId = '00000000-0000-4000-8000-000000000136';
    const targetId = '00000000-0000-4000-8000-000000000236';

    mockModel.findById.mockResolvedValue({ id: tournamentId, format: TournamentFormat.SINGLE });
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.COMPLETED,
      targetId,
      playerMatches: [
        { playerId: '00000000-0000-4000-8000-000000000305' },
        { playerId: '00000000-0000-4000-8000-000000000306' },
      ],
    });
    mockModel.getMatchById.mockResolvedValue({ id: matchId, tournamentId, status: MatchStatus.COMPLETED });
    mockModel.getTargetById.mockResolvedValue({
      id: targetId,
      currentMatchId: matchId,
      status: TargetStatus.IN_USE,
    });

    await service.saveMatchScores(tournamentId, matchId, [
      { playerId: '00000000-0000-4000-8000-000000000305', scoreTotal: 5 },
      { playerId: '00000000-0000-4000-8000-000000000306', scoreTotal: 1 },
    ]);

    expect(mockModel.updateMatchScores).toHaveBeenCalledWith(
      matchId,
      expect.any(Array),
      '00000000-0000-4000-8000-000000000305'
    );
    expect(mockModel.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      matchId,
      targetId,
      MatchStatus.COMPLETED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
  });

  it('rejects completeMatch when match is not in progress', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000037';
    const matchId = '00000000-0000-4000-8000-000000000137';

    mockModel.findById.mockResolvedValue({ id: tournamentId, format: TournamentFormat.SINGLE });
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.SCHEDULED,
      playerMatches: [
        { playerId: '00000000-0000-4000-8000-000000000307' },
        { playerId: '00000000-0000-4000-8000-000000000308' },
      ],
    });

    await expect(
      service.completeMatch(tournamentId, matchId, [
        { playerId: '00000000-0000-4000-8000-000000000307', scoreTotal: 3 },
        { playerId: '00000000-0000-4000-8000-000000000308', scoreTotal: 2 },
      ])
    ).rejects.toMatchObject({ code: 'MATCH_NOT_IN_PROGRESS' });
  });

  it('completes in-progress match and releases target', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000038';
    const matchId = '00000000-0000-4000-8000-000000000138';
    const targetId = '00000000-0000-4000-8000-000000000238';

    mockModel.findById.mockResolvedValue({ id: tournamentId, format: TournamentFormat.SINGLE });
    mockModel.getMatchWithPlayerMatches.mockResolvedValue({
      id: matchId,
      tournamentId,
      status: MatchStatus.IN_PROGRESS,
      targetId,
      playerMatches: [
        { playerId: '00000000-0000-4000-8000-000000000309' },
        { playerId: '00000000-0000-4000-8000-000000000310' },
      ],
    });
    mockModel.getMatchById.mockResolvedValue({ id: matchId, tournamentId, status: MatchStatus.COMPLETED });

    await service.completeMatch(tournamentId, matchId, [
      { playerId: '00000000-0000-4000-8000-000000000309', scoreTotal: 3 },
      { playerId: '00000000-0000-4000-8000-000000000310', scoreTotal: 1 },
    ]);

    expect(mockModel.completeMatch).toHaveBeenCalledWith(
      matchId,
      expect.any(Array),
      '00000000-0000-4000-8000-000000000309',
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
    expect(mockModel.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      matchId,
      targetId,
      MatchStatus.COMPLETED,
      expect.objectContaining({ completedAt: expect.any(Date) })
    );
  });

  it('rejects registrations when tournament is not found', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue(undefined);

    await expect(service.registerPlayer('t-9', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects registrations when tournament is not open', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-9',
      name: 'Closed',
      status: TournamentStatus.DRAFT,
      startTime: new Date(),
      totalParticipants: 8,
    });

    await expect(service.registerPlayer('t-9', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects duplicate registrations', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-9',
      name: 'Open',
      status: TournamentStatus.OPEN,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      totalParticipants: 8,
    });
    mockModel.isPlayerRegistered.mockResolvedValue(true);

    await expect(service.registerPlayer('t-9', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects registrations when tournament is full', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-9',
      name: 'Full',
      status: TournamentStatus.OPEN,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      totalParticipants: 2,
    });
    mockModel.isPlayerRegistered.mockResolvedValue(false);
    mockModel.getParticipantCount.mockResolvedValue(2);

    await expect(service.registerPlayer('t-9', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('registers players when validation passes', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000010';
    const playerId = '00000000-0000-4000-8000-000000000110';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Open',
      status: TournamentStatus.OPEN,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      totalParticipants: 8,
    });
    mockModel.isPlayerRegistered.mockResolvedValue(false);
    mockModel.getParticipantCount.mockResolvedValue(1);

    await service.registerPlayer(tournamentId, playerId);

    expect(mockModel.registerPlayer).toHaveBeenCalledWith(tournamentId, playerId);
  });

  it('rejects unregistration for live tournaments', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({ id: 't-11', status: TournamentStatus.LIVE });

    await expect(service.unregisterPlayer('t-11', 'p-2')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects unregistration when player is not registered', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({ id: 't-12', status: TournamentStatus.OPEN });
    mockModel.isPlayerRegistered.mockResolvedValue(false);

    await expect(service.unregisterPlayer('t-12', 'p-3')).rejects.toBeInstanceOf(AppError);
  });

  it('unregisters players when valid', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000013';
    const playerId = '00000000-0000-4000-8000-000000000113';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.OPEN });
    mockModel.isPlayerRegistered.mockResolvedValue(true);

    await service.unregisterPlayer(tournamentId, playerId);

    expect(mockModel.unregisterPlayer).toHaveBeenCalledWith(tournamentId, playerId);
  });

  it('rejects check-in updates outside signature', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({ id: 't-14', status: TournamentStatus.OPEN });

    await expect(service.updateTournamentPlayerCheckIn('t-14', 'p-5', true))
      .rejects.toBeInstanceOf(AppError);
  });

  it('updates player check-in during signature', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000015';
    const playerId = '00000000-0000-4000-8000-000000000115';
    const player = { id: playerId } as Player;

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.SIGNATURE });
    mockModel.updatePlayerCheckIn.mockResolvedValue(player);

    await service.updateTournamentPlayerCheckIn(tournamentId, playerId, true);

    expect(mockModel.updatePlayerCheckIn).toHaveBeenCalledWith(tournamentId, playerId, true);
  });

  it('auto-transitions to live when all players are checked in', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000016';
    const playerId = '00000000-0000-4000-8000-000000000116';
    const player = { id: playerId } as Player;
    const transitionSpy = jest.fn();

    (service as unknown as { transitionTournamentStatus: jest.Mock }).transitionTournamentStatus = transitionSpy;
    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.SIGNATURE });
    mockModel.updatePlayerCheckIn.mockResolvedValue(player);
    mockModel.getParticipantCount.mockResolvedValue(2);
    mockModel.getCheckedInCount.mockResolvedValue(2);

    await service.updateTournamentPlayerCheckIn(tournamentId, playerId, true);

    expect(transitionSpy).toHaveBeenCalledWith(tournamentId, TournamentStatus.LIVE);
  });

  it('logs and continues when auto-transition fails', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000017';
    const playerId = '00000000-0000-4000-8000-000000000117';
    const player = { id: playerId } as Player;
    const transitionSpy = jest.fn().mockRejectedValue(new Error('boom'));
    const loggerError = jest.fn();

    (service as unknown as { transitionTournamentStatus: jest.Mock }).transitionTournamentStatus = transitionSpy;
    (service as unknown as { logger: { error: jest.Mock } }).logger = { error: loggerError };
    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.SIGNATURE });
    mockModel.updatePlayerCheckIn.mockResolvedValue(player);
    mockModel.getParticipantCount.mockResolvedValue(2);
    mockModel.getCheckedInCount.mockResolvedValue(2);

    await service.updateTournamentPlayerCheckIn(tournamentId, playerId, true);

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to auto-transition tournament to LIVE after check-in',
      tournamentId,
      expect.any(Error)
    );
  });

  it('rejects player registration details when team name duplicates', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-16',
      name: 'Team Event',
      status: TournamentStatus.OPEN,
      format: TournamentFormat.TEAM_4_PLAYER,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      totalParticipants: 8,
    });
    mockModel.getParticipantCount.mockResolvedValue(0);
    mockModel.findPlayerByTeamName.mockResolvedValue({ id: 'existing' });

    await expect(
      service.registerPlayerDetails('t-16', {
        firstName: 'Team',
        lastName: 'Player',
        teamName: 'Legends',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('registers player details with existing person', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000017';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Open',
      status: TournamentStatus.OPEN,
      format: TournamentFormat.SINGLE,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      totalParticipants: 16,
    });
    mockModel.getParticipantCount.mockResolvedValue(0);
    mockModel.findPersonByEmailAndPhone.mockResolvedValue({ id: 'person-1' });
    mockModel.createPlayer.mockResolvedValue({ id: 'player-1' });

    await service.registerPlayerDetails(tournamentId, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+1234567',
    });

    expect(mockModel.findPersonByEmailAndPhone).toHaveBeenCalled();
    expect(mockModel.createPerson).not.toHaveBeenCalled();
    expect(mockModel.createPlayer).toHaveBeenCalledWith(
      tournamentId,
      expect.objectContaining({ personId: 'person-1' })
    );
  });

  it('updates player details when tournament allows it', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000018';
    const playerId = '00000000-0000-4000-8000-000000000118';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      status: TournamentStatus.OPEN,
      format: TournamentFormat.SINGLE,
    });
    mockModel.getPlayerById.mockResolvedValue({ id: playerId, personId: 'person-2' });
    mockModel.updatePlayer.mockResolvedValue({ id: playerId });

    await service.updateTournamentPlayer(tournamentId, playerId, {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      phone: '+33777777',
    });

    expect(mockModel.updatePerson).toHaveBeenCalledWith('person-2', expect.any(Object));
    expect(mockModel.updatePlayer).toHaveBeenCalledWith(
      tournamentId,
      playerId,
      expect.objectContaining({ firstName: 'Grace' })
    );
    expect(mockModel.findPlayerByTeamName).not.toHaveBeenCalled();
  });

  it('rejects player updates when tournament status is not editable', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-19',
      status: TournamentStatus.FINISHED,
      format: TournamentFormat.SINGLE,
    });

    await expect(
      service.updateTournamentPlayer('t-19', 'player-3', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects check-in updates when tournament is missing', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue(undefined);

    await expect(service.updateTournamentPlayerCheckIn('t-20', 'p-9', true))
      .rejects.toBeInstanceOf(AppError);
  });

  it('rejects invalid match status transitions', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({ id: 't-21', status: TournamentStatus.LIVE });
    mockModel.getMatchById.mockResolvedValue({
      id: 'm-9',
      tournamentId: 't-21',
      status: MatchStatus.COMPLETED,
    });

    await expect(
      service.updateMatchStatus('t-21', 'm-9', MatchStatus.IN_PROGRESS)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects invalid tournament IDs on lookup', async () => {
    const service = new TournamentService({} as never);

    await expect(service.getTournamentById('not-a-uuid')).rejects.toBeInstanceOf(AppError);
  });

  it('throws when tournament lookup misses', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue(undefined);

    await expect(
      service.getTournamentById('00000000-0000-4000-8000-000000000000')
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns tournament details by id', async () => {
    const service = new TournamentService({} as never);
    const tournament = {
      id: '00000000-0000-4000-8000-000000000000',
      name: 'Lookup',
      status: TournamentStatus.DRAFT,
    };

    mockModel.findById.mockResolvedValue(tournament);

    await expect(
      service.getTournamentById('00000000-0000-4000-8000-000000000000')
    ).resolves.toEqual(tournament);
  });

  it('rejects invalid pagination filters', async () => {
    const service = new TournamentService({} as never);

    await expect(service.getTournaments({ page: -1 })).rejects.toBeInstanceOf(AppError);
    await expect(service.getTournaments({ limit: 101 })).rejects.toBeInstanceOf(AppError);
  });

  it('returns tournaments for valid filters', async () => {
    const service = new TournamentService({} as never);

    mockModel.findAll.mockResolvedValue([{ id: 't-1' }]);

    await expect(service.getTournaments({ page: 1, limit: 10 })).resolves.toEqual([
      { id: 't-1' },
    ]);
    expect(mockModel.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('rejects invalid tournament logo uploads', async () => {
    const service = new TournamentService({} as never);

    await expect(
      service.uploadTournamentLogo('00000000-0000-4000-8000-000000000000', '')
    ).rejects.toBeInstanceOf(AppError);
  });

  it('updates tournament logo when valid', async () => {
    const service = new TournamentService({} as never);

    mockModel.updateLogo.mockResolvedValue({ id: 't-1', logoUrl: 'https://cdn/logo.png' });

    await expect(
      service.uploadTournamentLogo(
        '00000000-0000-4000-8000-000000000000',
        'https://cdn/logo.png'
      )
    ).resolves.toEqual({ id: 't-1', logoUrl: 'https://cdn/logo.png' });
  });

  it('rejects invalid date ranges', async () => {
    const service = new TournamentService({} as never);

    await expect(service.getTournamentsByDateRange('bad', '2026-01-01'))
      .rejects.toBeInstanceOf(AppError);
    await expect(service.getTournamentsByDateRange('2026-01-02', '2026-01-01'))
      .rejects.toBeInstanceOf(AppError);
  });

  it('returns tournaments within date range', async () => {
    const service = new TournamentService({} as never);

    mockModel.findByDateRange.mockResolvedValue([{ id: 'range-1' }]);

    await expect(
      service.getTournamentsByDateRange('2026-01-01', '2026-01-02')
    ).resolves.toEqual([{ id: 'range-1' }]);
  });

  it('returns false when tournament name is missing', async () => {
    const service = new TournamentService({} as never);

    await expect(service.isTournamentNameAvailable(' ')).resolves.toBe(false);
  });

  it('returns true when tournament name check succeeds', async () => {
    const service = new TournamentService({} as never);

    mockModel.findAll.mockResolvedValue([{ id: 't-1' }]);

    await expect(service.isTournamentNameAvailable('Spring Cup')).resolves.toBe(true);
  });

  it('returns false when tournament name check fails', async () => {
    const service = new TournamentService({} as never);

    mockModel.findAll.mockRejectedValue(new Error('db offline'));

    await expect(service.isTournamentNameAvailable('Spring Cup')).resolves.toBe(false);
  });

  it('returns tournament stats summary', async () => {
    const service = new TournamentService({} as never);

    mockModel.findById.mockResolvedValue({
      id: 't-22',
      totalParticipants: 16,
      targetCount: 4,
      startTime: new Date('2026-01-01T10:00:00Z'),
      endTime: new Date('2026-01-01T12:30:00Z'),
      players: [{ id: 'p-1' }, { id: 'p-2' }],
      matches: [{ status: 'completed' }, { status: 'pending' }],
    });

    await expect(service.getTournamentStats('t-22')).resolves.toEqual({
      totalParticipants: 16,
      currentParticipants: 2,
      targetCount: 4,
      matchesTotal: 2,
      matchesCompleted: 1,
      duration: { hours: 2, minutes: 30, total: '2h 30m' },
    });
  });

  it('returns overall tournament stats', async () => {
    const service = new TournamentService({} as never);

    mockModel.getOverallStats.mockResolvedValue({ total: 12 });

    await expect(service.getOverallTournamentStats()).resolves.toEqual({ total: 12 });
  });

  it('throws when overall stats retrieval fails', async () => {
    const service = new TournamentService({} as never);

    mockModel.getOverallStats.mockRejectedValue(new Error('stats failed'));

    await expect(service.getOverallTournamentStats()).rejects.toBeInstanceOf(AppError);
  });

  it('rejects live view requests for missing tournaments', async () => {
    const service = new TournamentService({} as never);

    mockModel.findLiveView.mockResolvedValue(undefined);

    await expect(
      service.getTournamentLiveView('00000000-0000-4000-8000-000000000000')
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects live view requests for non-live tournaments', async () => {
    const service = new TournamentService({} as never);

    mockModel.findLiveView.mockResolvedValue({
      id: 't-23',
      status: TournamentStatus.OPEN,
    });

    await expect(
      service.getTournamentLiveView('00000000-0000-4000-8000-000000000000')
    ).rejects.toBeInstanceOf(AppError);
  });

  it('reconciles target availability for live view', async () => {
    const service = new TournamentService({} as never);
    const completedAt = new Date('2026-01-01T12:00:00Z');

    mockModel.findLiveView.mockResolvedValue({
      id: 't-24',
      status: TournamentStatus.LIVE,
      targets: [
        { id: 'target-1', status: TargetStatus.IN_USE, currentMatchId: undefined },
        { id: 'target-2', status: TargetStatus.IN_USE, currentMatchId: 'm-2' },
      ],
      poolStages: [],
      brackets: [],
    });
    mockModel.getMatchById.mockResolvedValue({
      id: 'm-2',
      status: MatchStatus.COMPLETED,
      completedAt,
    });

    await service.getTournamentLiveView('00000000-0000-4000-8000-000000000024');

    expect(mockModel.setTargetAvailable).toHaveBeenCalledWith('target-1');
    expect(mockModel.setTargetAvailable).toHaveBeenCalledWith('target-2', completedAt);
  });

  it('returns tournament participants', async () => {
    const service = new TournamentService({} as never);
    mockModel.findById.mockResolvedValue({ id: 't-40' });
    mockModel.getParticipants.mockResolvedValue([{ id: 'p-1' }]);

    await expect(
      service.getTournamentParticipants('00000000-0000-4000-8000-000000000040')
    ).resolves.toEqual([{ id: 'p-1' }]);
  });

  it('returns orphan participants', async () => {
    const service = new TournamentService({} as never);
    mockModel.getOrphanParticipants.mockResolvedValue([{ id: 'p-2' }]);

    await expect(service.getOrphanParticipants()).resolves.toEqual([{ id: 'p-2' }]);
  });

  it('creates pool stages and pools', async () => {
    const service = new TournamentService({} as never);
    mockModel.findById.mockResolvedValue({ id: 't-41', status: TournamentStatus.DRAFT });
    mockModel.createPoolStage.mockResolvedValue({ id: 'stage-1', poolCount: 2 });

    await service.createPoolStage('00000000-0000-4000-8000-000000000041', {
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
    });

    expect(mockModel.createPoolsForStage).toHaveBeenCalledWith('stage-1', 2);
  });

  it('updates pool stages and redistributes pools', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000042';
    const stageId = '00000000-0000-4000-8000-000000000043';
    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.DRAFT });
    mockModel.updatePoolStage.mockResolvedValue({ id: 'stage-2', poolCount: 1 });
    mockModel.getPoolStageById.mockResolvedValue({ id: stageId, tournamentId, poolCount: 1 });
    mockModel.getPoolsWithAssignmentsForStage.mockResolvedValue([]);

    await service.updatePoolStage(
      tournamentId,
      stageId,
      { poolCount: 1 }
    );

    expect(mockModel.updatePoolStage).toHaveBeenCalled();
  });

  it('seeds existing empty pool matches when launching stage', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000142';
    const stageId = '00000000-0000-4000-8000-000000000143';
    const poolId = '00000000-0000-4000-8000-000000000144';
    const playerA = '00000000-0000-4000-8000-000000000145';
    const playerB = '00000000-0000-4000-8000-000000000146';

    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.LIVE });
    mockModel.getPoolStageById.mockResolvedValue({
      id: stageId,
      tournamentId,
      stageNumber: 1,
      poolCount: 1,
      playersPerPool: 2,
      status: StageStatus.EDITION,
      matchFormatKey: null,
    });
    mockModel.updatePoolStage.mockResolvedValue({
      id: stageId,
      tournamentId,
      stageNumber: 1,
      poolCount: 1,
      playersPerPool: 2,
      status: StageStatus.IN_PROGRESS,
      matchFormatKey: null,
    });
    mockModel.getPoolCountForStage.mockResolvedValue(1);
    mockModel.getPoolAssignmentCountForStage.mockResolvedValue(2);
    mockModel.getPoolsWithAssignmentsForStage.mockResolvedValue([
      {
        id: poolId,
        assignments: [{ player: { id: playerA } }, { player: { id: playerB } }],
      },
    ]);
    mockModel.getMatchCountForPool.mockResolvedValue(1);
    mockModel.getPoolMatchesWithPlayers.mockResolvedValue([
      {
        id: 'match-1',
        matchNumber: 1,
        status: MatchStatus.SCHEDULED,
        playerMatches: [],
      },
    ]);
    mockModel.setPoolMatchPlayers.mockResolvedValue(undefined);
    mockModel.updatePoolStatuses.mockResolvedValue(undefined);

    await service.updatePoolStage(tournamentId, stageId, { status: StageStatus.IN_PROGRESS });

    expect(mockModel.setPoolMatchPlayers).toHaveBeenCalledWith('match-1', [playerA, playerB]);
  });

  it('completes pool stage scores and advances bracket', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000043';
    const stageId = '00000000-0000-4000-8000-000000000044';
    mockModel.findById.mockResolvedValue({ id: tournamentId, status: TournamentStatus.LIVE });
    mockModel.getPoolStageById.mockResolvedValue({
      id: stageId,
      tournamentId,
      stageNumber: 1,
      status: StageStatus.IN_PROGRESS,
    });
    mockModel.getPoolStages.mockResolvedValue([
      { id: stageId, stageNumber: 1 },
    ]);
    mockModel.getBrackets.mockResolvedValue([]);
    mockModel.getMatchesForPoolStage.mockResolvedValue([
      { id: 'match-1', playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }] },
    ]);
    mockModel.completeMatch.mockResolvedValue(undefined);
    mockModel.completePoolsForStage.mockResolvedValue(undefined);
    mockModel.updatePoolStage.mockResolvedValue({ id: 'stage-3' });

    await service.completePoolStageWithRandomScores(
      tournamentId,
      stageId
    );

    expect(mockModel.completePoolsForStage).toHaveBeenCalled();
  });

  it('completes bracket rounds with random scores', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000044';
    const bracketId = '00000000-0000-4000-8000-000000000045';
    mockModel.findById.mockResolvedValue({ id: tournamentId });
    mockModel.getBracketById.mockResolvedValue({ id: bracketId, tournamentId });
    mockModel.getBracketMatchesByRoundWithPlayers.mockResolvedValue([
      { id: 'match-1', playerMatches: [{ playerId: 'p-1' }, { playerId: 'p-2' }] },
    ]);
    mockModel.completeMatch.mockResolvedValue(undefined);

    await service.completeBracketRoundWithRandomScores(
      tournamentId,
      bracketId,
      1
    );

    expect(mockModel.completeMatch).toHaveBeenCalled();
  });

  it('deletes pool stages', async () => {
    const service = new TournamentService({} as never);
    mockModel.findById.mockResolvedValue({ id: 't-45', status: TournamentStatus.DRAFT });

    await service.deletePoolStage(
      '00000000-0000-4000-8000-000000000045',
      '00000000-0000-4000-8000-000000000046'
    );

    expect(mockModel.deletePoolStage).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000046'
    );
  });

  it('returns validation errors when registration fails', async () => {
    const service = new TournamentService({} as never);

    jest.spyOn(service, 'registerPlayer').mockRejectedValue(new AppError('No slot', 400, 'FULL'));

    await expect(service.validateRegistrationConstraints('t-30', 'p-1')).resolves.toEqual({
      canRegister: false,
      reasons: ['No slot'],
    });
  });

  it('transitions tournament status when valid', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000031';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Open Cup',
      status: TournamentStatus.DRAFT,
      totalParticipants: 4,
      targetCount: 2,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
    });
    mockModel.updateStatus.mockResolvedValue({ id: tournamentId, status: TournamentStatus.OPEN });

    await expect(
      service.transitionTournamentStatus(tournamentId, TournamentStatus.OPEN)
    ).resolves.toEqual({ id: tournamentId, status: TournamentStatus.OPEN });
  });

  it('rejects invalid status transitions', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000032';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Locked',
      status: TournamentStatus.DRAFT,
      totalParticipants: 4,
      targetCount: 2,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(
      service.transitionTournamentStatus(tournamentId, TournamentStatus.LIVE)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('blocks live starts before check-in completes', async () => {
    const service = new TournamentService({} as never);
    const tournamentId = '00000000-0000-4000-8000-000000000033';

    mockModel.findById.mockResolvedValue({
      id: tournamentId,
      name: 'Soon',
      status: TournamentStatus.SIGNATURE,
      totalParticipants: 4,
      targetCount: 2,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    mockModel.getParticipantCount.mockResolvedValue(4);
    mockModel.getCheckedInCount.mockResolvedValue(2);

    await expect(
      service.transitionTournamentStatus(tournamentId, TournamentStatus.LIVE)
    ).rejects.toBeInstanceOf(AppError);
  });
});
