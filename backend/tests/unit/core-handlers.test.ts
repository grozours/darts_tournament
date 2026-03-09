import { AppError } from '../../src/middleware/error-handler';
import { createCoreHandlers } from '../../src/controllers/tournament-controller/core-handlers';
import { config } from '../../src/config/environment';
import { redis } from '../../src/config/redis';
import * as authModule from '../../src/middleware/auth';

const readTournamentSnapshotMock = jest.fn();
const listTournamentSnapshotsMock = jest.fn();
const restoreTournamentSnapshotMock = jest.fn();
const restoreTournamentSnapshotByIdMock = jest.fn();
const restoreTournamentStateFromSnapshotMock = jest.fn();

jest.mock('../../src/services/tournament-service/autosave', () => ({
  readTournamentSnapshot: (...arguments_: unknown[]) => readTournamentSnapshotMock(...arguments_),
  listTournamentSnapshots: (...arguments_: unknown[]) => listTournamentSnapshotsMock(...arguments_),
  restoreTournamentSnapshot: (...arguments_: unknown[]) => restoreTournamentSnapshotMock(...arguments_),
  restoreTournamentSnapshotById: (...arguments_: unknown[]) => restoreTournamentSnapshotByIdMock(...arguments_),
}));

jest.mock('../../src/services/tournament-service/snapshot-restore', () => ({
  restoreTournamentStateFromSnapshot: (...arguments_: unknown[]) => restoreTournamentStateFromSnapshotMock(...arguments_),
}));

type ResponseMock = {
  status: jest.Mock;
  json: jest.Mock;
  type: jest.Mock;
  setHeader: jest.Mock;
  send: jest.Mock;
};

const createResponse = (): ResponseMock => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
    type: jest.fn(),
    setHeader: jest.fn(),
    send: jest.fn(),
  } as unknown as ResponseMock;
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  return response;
};

const buildContext = () => {
  const service = {
    createTournament: jest.fn(),
    getTournamentById: jest.fn(),
    getTournamentLiveView: jest.fn(),
    getTournaments: jest.fn(),
    updateTournament: jest.fn(),
    deleteTournament: jest.fn(),
    uploadTournamentLogo: jest.fn(),
    getTournamentsByDateRange: jest.fn(),
    getTournamentStats: jest.fn(),
    isTournamentNameAvailable: jest.fn(),
  };

  return {
    prisma: {
      tournamentPreset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      matchFormatPreset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tournament: {
        findMany: jest.fn(),
      },
    },
    service,
    getTournamentService: jest.fn(() => service),
    ensureDefaultTournamentPresets: jest.fn(),
    ensureDefaultMatchFormatPresets: jest.fn(),
    handleError: jest.fn((response, error: unknown) => {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({ error: error.message });
      } else {
        response.status(500).json({ error: 'internal' });
      }
    }),
    buildTournamentFilters: jest.fn(() => ({ page: 1, limit: 10 })),
    applyTournamentAccessFilters: jest.fn(() => true),
  };
};

describe('core handlers', () => {
  const originalEnv = config.env;

  beforeEach(() => {
    readTournamentSnapshotMock.mockReset();
    listTournamentSnapshotsMock.mockReset();
    restoreTournamentSnapshotMock.mockReset();
    restoreTournamentSnapshotByIdMock.mockReset();
    restoreTournamentStateFromSnapshotMock.mockReset();
    config.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('handles createTournament success and AppError', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.createTournament.mockResolvedValue({ id: 't-1' });
    await handlers.createTournament({ body: { name: 'Cup' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(201);

    const appError = new AppError('bad payload', 400, 'BAD_PAYLOAD', { field: 'name' });
    context.service.createTournament.mockRejectedValue(appError);
    await handlers.createTournament({ body: {} } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 for non AppError in getTournament', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournamentById.mockRejectedValue(new Error('boom'));
    await handlers.getTournament({ params: { id: 't-1' } } as never, response as never);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('returns early from getTournaments when access filter rejects', async () => {
    const context = buildContext();
    context.applyTournamentAccessFilters.mockReturnValue(false);
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    await handlers.getTournaments({ query: {} } as never, response as never);
    expect(context.service.getTournaments).not.toHaveBeenCalled();
  });

  it('handles uploadTournamentLogo no-file branch', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    await handlers.uploadTournamentLogo({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('handles uploadTournamentLogo success branch', async () => {
    const context = buildContext();
    context.service.uploadTournamentLogo.mockResolvedValue({ id: 't-1', logoUrl: '/uploads/logo.png' });
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    await handlers.uploadTournamentLogo({
      params: { id: 't-1' },
      file: { filename: 'logo.png' },
    } as never, response as never);

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      logo_url: '/uploads/logo.png',
    }));
  });

  it('validates date range query params presence', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    await handlers.getTournamentsByDateRange({ query: { startDate: '2026-01-01' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('covers preset CRUD branches for not-found and success paths', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.prisma.tournamentPreset.findUnique.mockResolvedValue(null);
    await handlers.updateTournamentPreset({ params: { presetId: 'p1' }, body: {} } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.prisma.tournamentPreset.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'P',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: null,
    });
    context.prisma.tournamentPreset.update.mockResolvedValue({ id: 'p1' });
    await handlers.updateTournamentPreset({ params: { presetId: 'p1' }, body: { name: 'new' } } as never, response as never);
    expect(context.prisma.tournamentPreset.update).toHaveBeenCalled();

    context.prisma.matchFormatPreset.findUnique.mockResolvedValue({ id: 'f1' });
    context.prisma.matchFormatPreset.delete.mockResolvedValue(undefined);
    await handlers.deleteMatchFormatPreset({ params: { formatId: 'f1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('covers tournament preset list/create/delete branches and delegated errors', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.ensureDefaultTournamentPresets.mockResolvedValue([{ id: 'p1' }]);
    await handlers.getTournamentPresets({} as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ presets: [{ id: 'p1' }] });

    context.ensureDefaultTournamentPresets.mockRejectedValueOnce(new Error('preset fail'));
    await handlers.getTournamentPresets({} as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.prisma.tournamentPreset.create.mockResolvedValue({ id: 'created-preset' });
    await handlers.createTournamentPreset({
      body: {
        name: 'Preset',
        presetType: 'custom',
        totalParticipants: 16,
        targetCount: 4,
        templateConfig: null,
      },
    } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(201);

    context.prisma.tournamentPreset.findUnique.mockResolvedValueOnce(null);
    await handlers.deleteTournamentPreset({ params: { presetId: 'missing' } } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.prisma.tournamentPreset.findUnique.mockResolvedValueOnce({ id: 'p1' });
    context.prisma.tournamentPreset.delete.mockResolvedValueOnce(undefined);
    await handlers.deleteTournamentPreset({ params: { presetId: 'p1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('covers match-format preset list/create/update/delete branches', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.ensureDefaultMatchFormatPresets.mockResolvedValue([{ id: 'f1' }]);
    await handlers.getMatchFormatPresets({} as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ presets: [{ id: 'f1' }] });

    context.prisma.matchFormatPreset.create.mockResolvedValue({ id: 'f-created' });
    await handlers.createMatchFormatPreset({
      body: { key: 'BO3', durationMinutes: 30, segments: [], isSystem: false },
    } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(201);

    context.prisma.matchFormatPreset.findUnique.mockResolvedValueOnce(null);
    await handlers.updateMatchFormatPreset({ params: { formatId: 'missing' }, body: {} } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.prisma.matchFormatPreset.findUnique.mockResolvedValueOnce({ id: 'f1' });
    context.prisma.matchFormatPreset.update.mockResolvedValueOnce({ id: 'f1', key: 'BO5' });
    await handlers.updateMatchFormatPreset({ params: { formatId: 'f1' }, body: { key: 'BO5' } } as never, response as never);
    expect(context.prisma.matchFormatPreset.update).toHaveBeenCalled();

    context.prisma.matchFormatPreset.findUnique.mockResolvedValueOnce(null);
    await handlers.deleteMatchFormatPreset({ params: { formatId: 'missing' } } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();
  });

  it('covers tournament endpoints success paths and app errors', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournamentById.mockResolvedValue({ id: 't-1' });
    await handlers.getTournament({ params: { id: 't-1' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ id: 't-1' });

    context.service.getTournamentLiveView.mockRejectedValueOnce(new AppError('no', 404, 'NOT_FOUND'));
    await handlers.getTournamentLiveView({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(404);

    context.buildTournamentFilters.mockReturnValueOnce({ page: 2, limit: 5 });
    context.applyTournamentAccessFilters.mockReturnValueOnce(true);
    context.service.getTournaments.mockResolvedValueOnce({ tournaments: [{ id: 't-1' }] });
    await handlers.getTournaments({ query: { page: '2' } } as never, response as never);
    expect(context.service.getTournaments).toHaveBeenCalledWith({ page: 2, limit: 5 });

    context.service.updateTournament.mockResolvedValueOnce({ id: 't-updated' });
    await handlers.updateTournament({ params: { id: 't-1' }, body: { name: 'Updated' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ id: 't-updated' });

    context.service.deleteTournament.mockResolvedValueOnce(undefined);
    await handlers.deleteTournament({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(204);

    context.service.getTournamentsByDateRange.mockResolvedValueOnce([{ id: 't-dr' }]);
    await handlers.getTournamentsByDateRange({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith([{ id: 't-dr' }]);

    context.service.getTournamentStats.mockResolvedValueOnce({ matches: 10 });
    await handlers.getTournamentStats({ params: { id: 't-1' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ matches: 10 });

    context.service.isTournamentNameAvailable.mockResolvedValueOnce(true);
    await handlers.checkTournamentNameAvailability({ params: { name: 'Cup' }, query: {} } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ name: 'Cup', available: true });
  });

  it('exports tournament snapshot and handles missing snapshot', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournamentById.mockResolvedValue({ id: 't-export' });
    readTournamentSnapshotMock.mockResolvedValueOnce(null);
    await handlers.exportTournamentSnapshot({ params: { id: 't-export' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(404);

    readTournamentSnapshotMock.mockResolvedValueOnce('{"schemaVersion":1}');
    await handlers.exportTournamentSnapshot({ params: { id: 't-export' } } as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith('{"schemaVersion":1}');
  });

  it('lists snapshots and restores by payload', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournamentById.mockResolvedValue({ id: 't-snap' });
    listTournamentSnapshotsMock.mockResolvedValue([{ snapshotId: 's1' }]);

    await handlers.listTournamentSnapshots({ params: { id: 't-snap' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({
      tournamentId: 't-snap',
      total: 1,
      snapshots: [{ snapshotId: 's1' }],
    });

    await handlers.restoreTournamentSnapshot(
      {
        params: { id: 't-snap' },
        body: null,
      } as never,
      response as never
    );
    expect(response.status).toHaveBeenCalledWith(400);

    await handlers.restoreTournamentSnapshot(
      {
        params: { id: 't-snap' },
        body: {
          schemaVersion: 1,
          data: { tournament: { id: 't-snap' } },
        },
      } as never,
      response as never
    );

    expect(restoreTournamentSnapshotMock).toHaveBeenCalledWith('t-snap', {
      schemaVersion: 1,
      data: { tournament: { id: 't-snap' } },
    });
    expect(restoreTournamentStateFromSnapshotMock).toHaveBeenCalled();
  });

  it('restores by snapshot id with not-found and success branches', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournamentById.mockResolvedValue({ id: 't-snap-id' });

    restoreTournamentSnapshotByIdMock.mockResolvedValueOnce(null);
    await handlers.restoreTournamentSnapshotById(
      {
        params: { id: 't-snap-id', snapshotId: 'missing' },
      } as never,
      response as never
    );
    expect(response.status).toHaveBeenCalledWith(404);

    restoreTournamentSnapshotByIdMock.mockResolvedValueOnce({
      schemaVersion: 1,
      data: { tournament: { id: 't-snap-id' } },
    });
    await handlers.restoreTournamentSnapshotById(
      {
        params: { id: 't-snap-id', snapshotId: 's2' },
      } as never,
      response as never
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(restoreTournamentStateFromSnapshotMock).toHaveBeenCalled();
  });

  it('returns empty live summary when only draft status is requested for public scope', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    await handlers.getLiveSummary(
      {
        query: {
          statuses: 'draft',
        },
      } as never,
      response as never
    );

    expect(response.json).toHaveBeenCalledWith({ tournaments: [] });
    expect(context.prisma.tournament.findMany).not.toHaveBeenCalled();
  });

  it('uses cache for live and list endpoints when enabled', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    config.env = 'development';
    const getMock = jest.fn()
      .mockResolvedValueOnce('{"id":"cached-live"}')
      .mockResolvedValueOnce('{"tournaments":[{"id":"cached-list"}]}');
    const setexMock = jest.fn().mockResolvedValue('OK');

    jest.spyOn(redis, 'getClient').mockReturnValue({
      get: getMock,
      setex: setexMock,
    } as never);

    await handlers.getTournamentLiveView({ params: { id: 't-cache' }, query: {} } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ id: 'cached-live' });
    expect(context.service.getTournamentLiveView).not.toHaveBeenCalled();

    await handlers.getTournaments({ query: { status: 'live' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ tournaments: [{ id: 'cached-list' }] });
    expect(context.service.getTournaments).not.toHaveBeenCalled();

    getMock.mockResolvedValueOnce(undefined);
    context.service.getTournaments.mockResolvedValueOnce({ tournaments: [{ id: 'db-list' }] });
    await handlers.getTournaments({ query: { status: 'live' } } as never, response as never);
    expect(setexMock).toHaveBeenCalled();
  });

  it('builds live summary for admin scope and filters rejected live view promises', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    config.env = 'development';
    jest.spyOn(authModule, 'isAdmin').mockReturnValue(true);
    const getMock = jest.fn().mockResolvedValue(undefined);
    const setexMock = jest.fn().mockResolvedValue('OK');
    jest.spyOn(redis, 'getClient').mockReturnValue({
      get: getMock,
      setex: setexMock,
    } as never);

    context.prisma.tournament.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    context.service.getTournamentLiveView
      .mockResolvedValueOnce({ id: 't1', status: 'DRAFT' })
      .mockRejectedValueOnce(new Error('live view unavailable'));

    await handlers.getLiveSummary(
      {
        query: {
          statuses: 'draft,live',
        },
      } as never,
      response as never
    );

    expect(context.prisma.tournament.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: {
          in: expect.arrayContaining(['DRAFT', 'LIVE']),
        },
      },
    }));
    expect(response.json).toHaveBeenCalledWith({ tournaments: [{ id: 't1', status: 'DRAFT' }] });
    expect(setexMock).toHaveBeenCalled();
  });

  it('covers generic error branches for remaining core endpoints', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.service.getTournaments.mockRejectedValueOnce(new Error('list boom'));
    await handlers.getTournaments({ query: {} } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.prisma.tournament.findMany.mockRejectedValueOnce(new Error('summary boom'));
    await handlers.getLiveSummary({ query: {} } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.service.updateTournament.mockRejectedValueOnce(new Error('update boom'));
    await handlers.updateTournament({ params: { id: 't-1' }, body: {} } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.service.deleteTournament.mockRejectedValueOnce(new Error('delete boom'));
    await handlers.deleteTournament({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.service.getTournamentStats.mockRejectedValueOnce(new Error('stats boom'));
    await handlers.getTournamentStats({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.service.isTournamentNameAvailable.mockRejectedValueOnce(new Error('name boom'));
    await handlers.checkTournamentNameAvailability({ params: { name: 'Cup' }, query: { excludeId: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);

    context.service.getTournamentById.mockRejectedValueOnce(new Error('snapshot list boom'));
    await handlers.listTournamentSnapshots({ params: { id: 't-1' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('covers preset handler catch branches for create and list operations', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    context.prisma.tournamentPreset.create.mockRejectedValueOnce(new Error('create preset boom'));
    await handlers.createTournamentPreset({
      body: {
        name: 'Preset',
        presetType: 'custom',
        totalParticipants: 16,
        targetCount: 4,
      },
    } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.ensureDefaultMatchFormatPresets.mockRejectedValueOnce(new Error('list formats boom'));
    await handlers.getMatchFormatPresets({} as never, response as never);
    expect(context.handleError).toHaveBeenCalled();

    context.prisma.matchFormatPreset.create.mockRejectedValueOnce(new Error('create format boom'));
    await handlers.createMatchFormatPreset({
      body: {
        key: 'BO3',
        durationMinutes: 30,
        segments: [],
      },
    } as never, response as never);
    expect(context.handleError).toHaveBeenCalled();
  });

  it('handles live view fetch with cache miss and cache write failure', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    config.env = 'development';
    context.service.getTournamentLiveView.mockResolvedValueOnce({ id: 't-live' });

    const getMock = jest.fn().mockResolvedValue(undefined);
    const setexMock = jest.fn().mockRejectedValue(new Error('cache write failed'));
    jest.spyOn(redis, 'getClient').mockReturnValue({
      get: getMock,
      setex: setexMock,
    } as never);

    await handlers.getTournamentLiveView({ params: { id: 't-live' }, query: {} } as never, response as never);
    expect(context.service.getTournamentLiveView).toHaveBeenCalledWith('t-live');
    expect(response.json).toHaveBeenCalledWith({ id: 't-live' });
  });

  it('covers query normalization object branch and live summary status fallbacks', async () => {
    const context = buildContext();
    const handlers = createCoreHandlers(context as never);
    const response = createResponse();

    config.env = 'development';
    const getMock = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('{"tournaments":[{"id":"cached-summary"}]}')
      .mockResolvedValueOnce(undefined);
    const setexMock = jest.fn().mockResolvedValue('OK');
    jest.spyOn(redis, 'getClient').mockReturnValue({
      get: getMock,
      setex: setexMock,
    } as never);

    context.service.getTournaments.mockResolvedValueOnce({ tournaments: [{ id: 'normalized' }] });
    await handlers.getTournaments(
      {
        query: {
          status: 'live',
          complex: { nested: true },
        },
      } as never,
      response as never
    );
    expect(setexMock).toHaveBeenCalled();

    await handlers.getLiveSummary({ query: { status: 'live' } } as never, response as never);
    expect(response.json).toHaveBeenCalledWith({ tournaments: [{ id: 'cached-summary' }] });

    context.prisma.tournament.findMany.mockResolvedValueOnce([]);
    await handlers.getLiveSummary({ query: { status: 'invalid-status' } } as never, response as never);
    expect(context.prisma.tournament.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: {
          in: ['LIVE'],
        },
      },
    }));
  });
});
