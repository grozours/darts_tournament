import { describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../../src/middleware/error-handler';
import {
  createTournamentCoreHandlers,
  type CreateTournamentData,
} from '../../src/services/tournament-service/core-handlers';
import {
  DurationType,
  MatchStatus,
  TournamentFormat,
  TournamentStatus,
  type Tournament,
} from '../../../shared/src/types';

type ModelMock = {
  isEditable: ReturnType<typeof jest.fn>;
  create: ReturnType<typeof jest.fn>;
  findById: ReturnType<typeof jest.fn>;
  findLiveView: ReturnType<typeof jest.fn>;
  findAll: ReturnType<typeof jest.fn>;
  update: ReturnType<typeof jest.fn>;
  delete: ReturnType<typeof jest.fn>;
  updateLogo: ReturnType<typeof jest.fn>;
  findByDateRange: ReturnType<typeof jest.fn>;
  getTargetRanges: ReturnType<typeof jest.fn>;
  getTargetsForTournament: ReturnType<typeof jest.fn>;
  getMatchCountForTargets: ReturnType<typeof jest.fn>;
  rebuildTargetsForTournament: ReturnType<typeof jest.fn>;
  setTargetAvailable: ReturnType<typeof jest.fn>;
  getMatchById: ReturnType<typeof jest.fn>;
  getOverallStats: ReturnType<typeof jest.fn>;
};

const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);

const baseTournament: Tournament = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Cup',
  format: TournamentFormat.SINGLE,
  durationType: DurationType.FULL_DAY,
  startTime: futureStart,
  endTime: futureEnd,
  totalParticipants: 16,
  targetCount: 4,
  targetStartNumber: 1,
  shareTargets: true,
  status: TournamentStatus.DRAFT,
  historicalFlag: false,
  createdAt: new Date(),
};

const build = () => {
  const model: ModelMock = {
    isEditable: jest.fn(async () => true),
    create: jest.fn(async () => baseTournament),
    findById: jest.fn(async () => baseTournament),
    findLiveView: jest.fn(async () => undefined),
    findAll: jest.fn(async () => ({ tournaments: [], total: 0, page: 1, limit: 10 })),
    update: jest.fn(async () => baseTournament),
    delete: jest.fn(async () => true),
    updateLogo: jest.fn(async () => baseTournament),
    findByDateRange: jest.fn(async () => [baseTournament]),
    getTargetRanges: jest.fn(async () => []),
    getTargetsForTournament: jest.fn(async () => []),
    getMatchCountForTargets: jest.fn(async () => 0),
    rebuildTargetsForTournament: jest.fn(async () => undefined),
    setTargetAvailable: jest.fn(async () => undefined),
    getMatchById: jest.fn(async () => undefined),
    getOverallStats: jest.fn(async () => ({ total: 1 })),
  };

  const logger = {
    tournamentCreated: jest.fn(),
    validationError: jest.fn(),
    error: jest.fn(),
  };

  const handlers = createTournamentCoreHandlers({
    tournamentModel: model as never,
    logger: logger as never,
    validateUUID: jest.fn(),
    registerPlayer: jest.fn(async (_tournamentId: string, _playerId: string) => undefined),
    canViewDraftLive: jest.fn(() => false),
  });

  return { model, logger, handlers };
};

const validCreatePayload = (): CreateTournamentData => ({
  name: 'My Tournament',
  location: ' Hall ',
  format: TournamentFormat.SINGLE,
  durationType: DurationType.FULL_DAY,
  startTime: futureStart.toISOString(),
  endTime: futureEnd.toISOString(),
  totalParticipants: 16,
  targetCount: 4,
  targetStartNumber: 1,
  shareTargets: true,
});

describe('core handlers branch coverage', () => {
  it('rejects invalid create payload variants', async () => {
    const { handlers } = build();

    await expect(handlers.createTournament({ ...validCreatePayload(), name: 'a' })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), location: 'x'.repeat(151) })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), totalParticipants: 1 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), totalParticipants: 513 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), targetCount: 0 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), targetCount: 21 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), targetStartNumber: 0 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), startTime: '', endTime: '' })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), format: 'BAD' as never })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), durationType: 'BAD' as never })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), totalParticipants: 8.5 as never })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), targetCount: 4.2 as never })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.createTournament({ ...validCreatePayload(), targetStartNumber: 1.5 as never })).rejects.toBeInstanceOf(AppError);
  });

  it('rejects invalid create date windows', async () => {
    const { handlers } = build();
    const past = new Date(Date.now() - 60_000);

    await expect(
      handlers.createTournament({
        ...validCreatePayload(),
        startTime: past.toISOString(),
        endTime: new Date(past.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      })
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      handlers.createTournament({
        ...validCreatePayload(),
        startTime: futureStart.toISOString(),
        endTime: new Date(futureStart.getTime() + 10 * 60 * 1000).toISOString(),
      })
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      handlers.createTournament({
        ...validCreatePayload(),
        startTime: futureStart.toISOString(),
        endTime: new Date(futureStart.getTime() + 25 * 60 * 60 * 1000).toISOString(),
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects create on target range conflict', async () => {
    const { handlers, model } = build();
    model.getTargetRanges.mockResolvedValueOnce([
      {
        id: 'other',
        name: 'Other Cup',
        targetStartNumber: 1,
        targetCount: 4,
        shareTargets: false,
      },
    ]);

    await expect(handlers.createTournament(validCreatePayload())).rejects.toBeInstanceOf(AppError);
  });

  it('creates tournament on valid payload and sanitizes values', async () => {
    const { handlers, model, logger } = build();

    await expect(handlers.createTournament({ ...validCreatePayload(), name: '<b>My Tournament</b>' })).resolves.toEqual(baseTournament);

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My Tournament',
      location: 'Hall',
    }));
    expect(logger.tournamentCreated).toHaveBeenCalled();
  });

  it('maps unexpected create errors to service error', async () => {
    const { handlers, model, logger } = build();
    model.create.mockRejectedValueOnce(new Error('db'));

    await expect(handlers.createTournament(validCreatePayload())).rejects.toBeInstanceOf(AppError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('maps app errors without code to UNKNOWN_ERROR in validation logger', async () => {
    const { handlers, model, logger } = build();
    model.getTargetRanges.mockRejectedValueOnce(new AppError('range-fail', 400));

    await expect(handlers.createTournament(validCreatePayload())).rejects.toBeInstanceOf(AppError);
    expect(logger.validationError).toHaveBeenCalledWith(
      'UNKNOWN_ERROR',
      'range-fail',
      undefined,
      'My Tournament'
    );
  });

  it('creates tournament without location and keeps logger payload location-free', async () => {
    const { handlers, model, logger } = build();
    const tournamentWithoutLocation = { ...baseTournament, location: undefined };
    model.create.mockResolvedValueOnce(tournamentWithoutLocation);

    await expect(
      handlers.createTournament({ ...validCreatePayload(), location: '   ' })
    ).resolves.toEqual(tournamentWithoutLocation);

    expect(model.create).toHaveBeenCalledWith(expect.not.objectContaining({ location: expect.anything() }));
    expect(logger.tournamentCreated).toHaveBeenCalledWith(
      tournamentWithoutLocation.id,
      tournamentWithoutLocation.name,
      expect.not.objectContaining({ location: expect.anything() })
    );
  });

  it('covers getTournamentLiveView visibility branches', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce(undefined);
    await expect(handlers.getTournamentLiveView(baseTournament.id)).rejects.toBeInstanceOf(AppError);

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.OPEN,
      poolStages: [],
      brackets: [],
      targets: [],
    });
    await expect(handlers.getTournamentLiveView(baseTournament.id)).rejects.toBeInstanceOf(AppError);

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.FINISHED,
      poolStages: [],
      brackets: [],
      targets: [],
    });
    await expect(handlers.getTournamentLiveView(baseTournament.id)).resolves.toEqual(expect.objectContaining({ status: TournamentStatus.FINISHED }));
  });

  it('reconciles target availability for stale IN_USE targets', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.LIVE,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: false,
      targets: [
        { id: 't1', status: 'IN_USE', currentMatchId: null },
        { id: 't2', status: 'IN_USE', currentMatchId: 'm2' },
        { id: 't3', status: 'IN_USE', currentMatchId: 'm3' },
      ],
      poolStages: [{ stageNumber: 2, pools: [{ matches: [{ id: 'm2', status: MatchStatus.IN_PROGRESS }] }] }],
      brackets: [{ matches: [{ id: 'm3', status: MatchStatus.COMPLETED }] }],
    });

    await handlers.getTournamentLiveView(baseTournament.id);

    expect(model.setTargetAvailable).toHaveBeenCalledWith('t1');
    expect(model.setTargetAvailable).toHaveBeenCalledWith('t3', undefined);
  });

  it('supports draft live view when canViewDraftLive is true', async () => {
    const { model, logger } = build();
    const handlers = createTournamentCoreHandlers({
      tournamentModel: model as never,
      logger: logger as never,
      validateUUID: jest.fn(),
      registerPlayer: jest.fn(async (_tournamentId: string, _playerId: string) => undefined),
      canViewDraftLive: () => true,
    });

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.DRAFT,
      targets: [],
      poolStages: [],
      brackets: [],
    });

    await expect(handlers.getTournamentLiveView(baseTournament.id)).resolves.toEqual(expect.objectContaining({ status: TournamentStatus.DRAFT }));
  });

  it('supports open live view when pools are configured', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.OPEN,
      poolStages: [{ poolCount: 0, pools: [{ id: 'pool-1' }] }],
      targets: [],
      brackets: [],
    });

    await expect(handlers.getTournamentLiveView(baseTournament.id)).resolves.toEqual(
      expect.objectContaining({ status: TournamentStatus.OPEN })
    );
  });

  it('supports signature live view using stage poolCount fallback', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.SIGNATURE,
      poolStages: [{ poolCount: 2 }],
      targets: [],
      brackets: [],
    });

    await expect(handlers.getTournamentLiveView(baseTournament.id)).resolves.toEqual(
      expect.objectContaining({ status: TournamentStatus.SIGNATURE })
    );
  });

  it('keeps double stage disabled when no stage 2/3 exists in live view', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      format: TournamentFormat.DOUBLE,
      doubleStageEnabled: false,
      status: TournamentStatus.LIVE,
      targets: [],
      poolStages: [{ stageNumber: 1, pools: [{ matches: [{ id: 'm1', status: MatchStatus.SCHEDULED }] }] }],
      brackets: [{ matches: [{ id: 'b1', status: MatchStatus.SCHEDULED }] }],
    });

    const view = await handlers.getTournamentLiveView(baseTournament.id);
    expect(view.doubleStageEnabled).toBe(false);
  });

  it('ignores non in-use targets and releases missing-match target with completion date', async () => {
    const { handlers, model } = build();
    const completedAt = new Date();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.LIVE,
      targets: [
        { id: 't-available', status: 'AVAILABLE', currentMatchId: null },
        { id: 't-stale', status: 'IN_USE', currentMatchId: 'm-stale' },
      ],
      poolStages: [{ pools: [{ matches: [{ id: undefined, status: MatchStatus.COMPLETED } as never] }] }],
      brackets: [{ matches: [{ id: undefined, status: MatchStatus.COMPLETED } as never] }],
    });
    model.getMatchById.mockResolvedValueOnce({
      id: 'm-stale',
      status: MatchStatus.COMPLETED,
      completedAt,
    });

    await handlers.getTournamentLiveView(baseTournament.id);

    expect(model.setTargetAvailable).toHaveBeenCalledTimes(1);
    expect(model.setTargetAvailable).toHaveBeenCalledWith('t-stale', completedAt);
  });

  it('validates getTournaments pagination/limit', async () => {
    const { handlers, model } = build();

    await expect(handlers.getTournaments({ page: -1 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.getTournaments({ limit: 101 })).rejects.toBeInstanceOf(AppError);
    await expect(handlers.getTournaments({ page: 1, limit: 10 })).resolves.toEqual({ tournaments: [], total: 0, page: 1, limit: 10 });

    expect(model.findAll).toHaveBeenCalled();
  });

  it('covers updateTournament non-editable and not-found branches', async () => {
    const { handlers, model } = build();
    model.isEditable.mockResolvedValueOnce(false);

    await expect(handlers.updateTournament(baseTournament.id, { name: 'X Cup' })).rejects.toBeInstanceOf(AppError);

    model.isEditable.mockResolvedValueOnce(true);
    model.findById.mockResolvedValueOnce(undefined);
    await expect(handlers.updateTournament(baseTournament.id, { name: 'X Cup' })).rejects.toBeInstanceOf(AppError);
  });

  it('covers updateTournament target sync and target-in-use block', async () => {
    const { handlers, model } = build();
    model.isEditable.mockResolvedValue(true);
    model.findById.mockResolvedValue({ ...baseTournament, targetCount: 4, targetStartNumber: 1, shareTargets: true });

    model.getTargetsForTournament.mockResolvedValueOnce([
      { id: 'ta', targetNumber: 1 },
      { id: 'tb', targetNumber: 2 },
      { id: 'tc', targetNumber: 3 },
      { id: 'td', targetNumber: 4 },
    ]);
    model.getMatchCountForTargets.mockResolvedValueOnce(1);

    await expect(
      handlers.updateTournament(baseTournament.id, { targetCount: 2 })
    ).rejects.toBeInstanceOf(AppError);

    model.getTargetsForTournament.mockResolvedValueOnce([
      { id: 'ta', targetNumber: 1 },
      { id: 'tb', targetNumber: 2 },
      { id: 'tc', targetNumber: 3 },
      { id: 'td', targetNumber: 4 },
    ]);
    model.getMatchCountForTargets.mockResolvedValueOnce(0);

    await expect(
      handlers.updateTournament(baseTournament.id, { targetCount: 2, targetStartNumber: 3 })
    ).resolves.toEqual(baseTournament);

    expect(model.rebuildTargetsForTournament).toHaveBeenCalledWith(baseTournament.id, 3, 2);
  });

  it('covers update sanitization flags and allowPastStart for live tournaments', async () => {
    const { handlers, model } = build();
    const liveTournament = {
      ...baseTournament,
      status: TournamentStatus.LIVE,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      targetStartNumber: 2,
      shareTargets: true,
    };

    model.findById.mockResolvedValue(liveTournament);
    model.update.mockResolvedValueOnce({ ...liveTournament, name: 'Live Updated' });

    await expect(
      handlers.updateTournament(baseTournament.id, {
        name: '  <i>Live Updated</i>  ',
        location: '  New Hall  ',
        targetCount: 4,
        targetStartNumber: 2,
        shareTargets: '' as never,
        doubleStageEnabled: 0 as never,
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      })
    ).resolves.toEqual(expect.objectContaining({ name: 'Live Updated' }));

    expect(model.update).toHaveBeenCalledWith(
      baseTournament.id,
      expect.objectContaining({
        name: 'Live Updated',
        location: 'New Hall',
        shareTargets: false,
        doubleStageEnabled: false,
      })
    );
    expect(model.rebuildTargetsForTournament).not.toHaveBeenCalled();
  });

  it('allows overlapping target ranges when both tournaments share targets', async () => {
    const { handlers, model } = build();
    model.getTargetRanges.mockResolvedValueOnce([
      {
        id: 'other',
        name: 'Shared Cup',
        targetStartNumber: 1,
        targetCount: 4,
        shareTargets: true,
      },
    ]);

    await expect(handlers.createTournament({ ...validCreatePayload(), shareTargets: true })).resolves.toEqual(baseTournament);
  });

  it('keeps stale IN_USE target when fallback match is still in progress', async () => {
    const { handlers, model } = build();

    model.findLiveView.mockResolvedValueOnce({
      ...baseTournament,
      status: TournamentStatus.LIVE,
      targets: [{ id: 't-x', status: 'IN_USE', currentMatchId: 'm-x' }],
      poolStages: [],
      brackets: [],
    });
    model.getMatchById.mockResolvedValueOnce({ id: 'm-x', status: MatchStatus.IN_PROGRESS });

    await handlers.getTournamentLiveView(baseTournament.id);

    expect(model.setTargetAvailable).not.toHaveBeenCalledWith('t-x', expect.anything());
  });

  it('validates delete, logo upload and date-range constraints', async () => {
    const { handlers, model } = build();

    model.findById.mockResolvedValueOnce(undefined);
    await expect(handlers.deleteTournament(baseTournament.id)).rejects.toBeInstanceOf(AppError);

    await expect(handlers.uploadTournamentLogo(baseTournament.id, '')).rejects.toBeInstanceOf(AppError);
    await expect(handlers.uploadTournamentLogo(baseTournament.id, '/uploads/a.png')).resolves.toEqual(baseTournament);

    await expect(handlers.getTournamentsByDateRange('bad', 'bad')).rejects.toBeInstanceOf(AppError);
    await expect(handlers.getTournamentsByDateRange('2026-01-10', '2026-01-09')).rejects.toBeInstanceOf(AppError);
    await expect(handlers.getTournamentsByDateRange('2026-01-09', '2026-01-10')).resolves.toEqual([baseTournament]);

    expect(model.findByDateRange).toHaveBeenCalled();
  });

  it('covers name availability/stats/registration constraint branches', async () => {
    const { handlers, model, logger } = build();

    await expect(handlers.isTournamentNameAvailable('')).resolves.toBe(false);

    model.findAll.mockRejectedValueOnce(new Error('find-fail'));
    await expect(handlers.isTournamentNameAvailable('Cup', '  t-1  ')).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalled();

    model.findById.mockResolvedValueOnce(undefined);
    await expect(handlers.getTournamentStats(baseTournament.id)).rejects.toBeInstanceOf(AppError);

    model.findById.mockResolvedValueOnce({ ...baseTournament, players: [], matches: [] });
    await expect(handlers.getTournamentStats(baseTournament.id)).resolves.toEqual(expect.objectContaining({ matchesTotal: 0 }));

    const okHandlers = createTournamentCoreHandlers({
      tournamentModel: model as never,
      logger: logger as never,
      validateUUID: jest.fn(),
      registerPlayer: jest.fn(async (_tournamentId: string, _playerId: string) => undefined),
    });
    await expect(okHandlers.validateRegistrationConstraints(baseTournament.id, 'p1')).resolves.toEqual({ canRegister: true, reasons: [] });

    const failHandlers = createTournamentCoreHandlers({
      tournamentModel: model as never,
      logger: logger as never,
      validateUUID: jest.fn(),
      registerPlayer: jest.fn(async () => { throw new AppError('already registered', 400, 'ALREADY'); }),
    });
    await expect(failHandlers.validateRegistrationConstraints(baseTournament.id, 'p1')).resolves.toEqual({
      canRegister: false,
      reasons: ['already registered'],
    });

    model.getOverallStats.mockResolvedValueOnce({ total: 42 });
    await expect(handlers.getOverallTournamentStats()).resolves.toEqual({ total: 42 });

    model.getOverallStats.mockRejectedValueOnce(new Error('stats-fail'));
    await expect(handlers.getOverallTournamentStats()).rejects.toBeInstanceOf(AppError);
  });

  it('covers name-availability success with excludeId and unknown registration error', async () => {
    const { handlers, model } = build();

    model.findAll.mockResolvedValueOnce({ tournaments: [{ id: 'x' }], total: 1, page: 1, limit: 1 });
    await expect(handlers.isTournamentNameAvailable('Cup', '  t-1  ')).resolves.toBe(true);

    const errorHandlers = createTournamentCoreHandlers({
      tournamentModel: model as never,
      logger: {
        tournamentCreated: jest.fn(),
        validationError: jest.fn(),
        error: jest.fn(),
      } as never,
      validateUUID: jest.fn(),
      registerPlayer: jest.fn(async () => { throw new Error('unexpected'); }),
    });

    await expect(errorHandlers.validateRegistrationConstraints(baseTournament.id, 'p1')).resolves.toEqual({
      canRegister: false,
      reasons: ['Unknown registration error'],
    });
  });

  it('returns tournament targets and handles not-found branch', async () => {
    const { handlers, model } = build();
    model.findById.mockResolvedValueOnce(undefined);

    await expect(handlers.getTournamentTargets(baseTournament.id)).rejects.toBeInstanceOf(AppError);

    model.findById.mockResolvedValueOnce(baseTournament);
    model.getTargetsForTournament.mockResolvedValueOnce([{ id: 'target-1' }]);
    await expect(handlers.getTournamentTargets(baseTournament.id)).resolves.toEqual([{ id: 'target-1' }]);
  });
});
