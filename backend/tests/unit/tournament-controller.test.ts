import TournamentController from '../../src/controllers/tournament-controller';
import { AppError } from '../../src/middleware/error-handler';
import { TournamentStatus } from '../../../shared/src/types';

const readTournamentSnapshotMock = jest.fn();
const restoreTournamentSnapshotMock = jest.fn();
const listTournamentSnapshotsMock = jest.fn();
const restoreTournamentSnapshotByIdMock = jest.fn();
const restoreTournamentStateFromSnapshotMock = jest.fn();

jest.mock('../../src/services/tournament-service/autosave', () => ({
  readTournamentSnapshot: (...arguments_: unknown[]) => readTournamentSnapshotMock(...arguments_),
  restoreTournamentSnapshot: (...arguments_: unknown[]) => restoreTournamentSnapshotMock(...arguments_),
  listTournamentSnapshots: (...arguments_: unknown[]) => listTournamentSnapshotsMock(...arguments_),
  restoreTournamentSnapshotById: (...arguments_: unknown[]) =>
    restoreTournamentSnapshotByIdMock(...arguments_),
}));

jest.mock('../../src/services/tournament-service/snapshot-restore', () => ({
  restoreTournamentStateFromSnapshot: (...arguments_: unknown[]) =>
    restoreTournamentStateFromSnapshotMock(...arguments_),
}));

let mockService: {
  createTournament: jest.Mock;
  getTournamentById: jest.Mock;
  getTournamentLiveView: jest.Mock;
  getTournaments: jest.Mock;
  updateTournament: jest.Mock;
  deleteTournament: jest.Mock;
  uploadTournamentLogo: jest.Mock;
  getTournamentsByDateRange: jest.Mock;
  registerPlayer: jest.Mock;
  registerPlayerDetails: jest.Mock;
  getPlayerById: jest.Mock;
  unregisterPlayer: jest.Mock;
  getTournamentParticipants: jest.Mock;
  updateTournamentPlayerCheckIn: jest.Mock;
  validateRegistrationConstraints: jest.Mock;
  transitionTournamentStatus: jest.Mock;
};

jest.mock('../../src/services/tournament-service', () => ({
  TournamentService: jest.fn().mockImplementation(() => mockService),
}));

const isAdminMock = jest.fn();

jest.mock('../../src/middleware/auth', () => ({
  isAdmin: (request: unknown) => isAdminMock(request),
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

const buildResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
  return response;
};

const buildRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  body: {},
  params: {},
  query: {},
  ...overrides,
});

describe('tournament-controller', () => {
  let controller: TournamentController;

  beforeEach(() => {
    controller = new TournamentController({} as never);
    mockService = {
      createTournament: jest.fn(),
      getTournamentById: jest.fn(),
      getTournamentLiveView: jest.fn(),
      getTournaments: jest.fn(),
      updateTournament: jest.fn(),
      deleteTournament: jest.fn(),
      uploadTournamentLogo: jest.fn(),
      getTournamentsByDateRange: jest.fn(),
      registerPlayer: jest.fn(),
      registerPlayerDetails: jest.fn(),
      getPlayerById: jest.fn(),
      unregisterPlayer: jest.fn(),
      getTournamentParticipants: jest.fn(),
      updateTournamentPlayerCheckIn: jest.fn(),
      validateRegistrationConstraints: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    };
    isAdminMock.mockReset();
    readTournamentSnapshotMock.mockReset();
    restoreTournamentSnapshotMock.mockReset();
    listTournamentSnapshotsMock.mockReset();
    restoreTournamentSnapshotByIdMock.mockReset();
    restoreTournamentStateFromSnapshotMock.mockReset();
  });

  it('creates tournaments successfully', async () => {
    const request = buildRequest({
      body: {
        name: 'Open Cup',
        format: 'SINGLE',
        durationType: 'FULL_DAY',
        startTime: '2026-02-18T10:00:00.000Z',
        endTime: '2026-02-18T18:00:00.000Z',
        totalParticipants: 8,
        targetCount: 2,
      },
    });
    const response = buildResponse();

    mockService.createTournament.mockResolvedValue({ id: 't-1' });

    await controller.createTournament(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ id: 't-1' });
  });

  it('returns errors on create tournament failures', async () => {
    const request = buildRequest({ body: {} });
    const response = buildResponse();

    mockService.createTournament.mockRejectedValue(new AppError('Bad input', 400, 'BAD_INPUT'));

    await controller.createTournament(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Bad input',
          code: 'BAD_INPUT',
        }),
      })
    );
  });

  it('returns paged tournament lists', async () => {
    const request = buildRequest({
      query: {
        status: TournamentStatus.OPEN,
        format: 'SINGLE',
        name: 'Open',
        page: '2',
        limit: '25',
      },
    });
    const response = buildResponse();

    mockService.getTournaments.mockResolvedValue([{ id: 't-1' }]);

    await controller.getTournaments(request as never, response as never);

    expect(mockService.getTournaments).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TournamentStatus.OPEN,
        format: 'SINGLE',
        name: 'Open',
        page: 2,
        limit: 25,
      })
    );
    expect(response.json).toHaveBeenCalledWith([{ id: 't-1' }]);
  });

  it('hides drafts for non-admin users', async () => {
    const request = buildRequest({ query: { status: TournamentStatus.DRAFT } });
    const response = buildResponse();

    isAdminMock.mockReturnValue(false);

    await controller.getTournaments(request as never, response as never);

    expect(mockService.getTournaments).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      tournaments: [],
      total: 0,
      page: 1,
      limit: 10,
    });
  });

  it('adds excludeDraft for non-admin list queries', async () => {
    const request = buildRequest({ query: { page: '1', limit: '5' } });
    const response = buildResponse();

    isAdminMock.mockReturnValue(false);
    mockService.getTournaments.mockResolvedValue([]);

    await controller.getTournaments(request as never, response as never);

    expect(mockService.getTournaments).toHaveBeenCalledWith(
      expect.objectContaining({ excludeDraft: true })
    );
  });

  it('returns tournament live views', async () => {
    const request = buildRequest({ params: { id: 't-12' } });
    const response = buildResponse();

    mockService.getTournamentLiveView.mockResolvedValue({ id: 't-12' });

    await controller.getTournamentLiveView(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith({ id: 't-12' });
  });

  it('updates tournaments', async () => {
    const request = buildRequest({ params: { id: 't-13' }, body: { name: 'Updated' } });
    const response = buildResponse();

    mockService.updateTournament.mockResolvedValue({ id: 't-13' });

    await controller.updateTournament(request as never, response as never);

    expect(mockService.updateTournament).toHaveBeenCalledWith('t-13', { name: 'Updated' });
    expect(response.json).toHaveBeenCalledWith({ id: 't-13' });
  });

  it('deletes tournaments', async () => {
    const request = buildRequest({ params: { id: 't-14' } });
    const response = buildResponse();

    await controller.deleteTournament(request as never, response as never);

    expect(mockService.deleteTournament).toHaveBeenCalledWith('t-14');
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('rejects missing logo uploads', async () => {
    const request = buildRequest({ params: { id: 't-2' } });
    const response = buildResponse();

    await controller.uploadTournamentLogo(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NO_FILE_UPLOADED',
        }),
      })
    );
  });

  it('uploads tournament logos when present', async () => {
    const request = buildRequest({
      params: { id: 't-2' },
      file: { filename: 'logo.png' },
    });
    const response = buildResponse();

    mockService.uploadTournamentLogo.mockResolvedValue({ id: 't-2' });

    await controller.uploadTournamentLogo(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        logoUrl: '/uploads/logo.png',
        tournament: { id: 't-2' },
      })
    );
  });

  it('rejects date range requests without dates', async () => {
    const request = buildRequest({ query: {} });
    const response = buildResponse();

    await controller.getTournamentsByDateRange(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'MISSING_DATE_PARAMS',
        }),
      })
    );
  });

  it('registers players by id', async () => {
    const request = buildRequest({ params: { id: 't-3' }, body: { playerId: 'p-1' } });
    const response = buildResponse();

    await controller.registerPlayer(request as never, response as never);

    expect(mockService.registerPlayer).toHaveBeenCalledWith('t-3', 'p-1');
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('allows admins to unregister players', async () => {
    const request = buildRequest({ params: { id: 't-4', playerId: 'p-2' } });
    const response = buildResponse();

    isAdminMock.mockReturnValue(true);

    await controller.unregisterPlayer(request as never, response as never);

    expect(mockService.unregisterPlayer).toHaveBeenCalledWith('t-4', 'p-2');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Player unregistered successfully',
      })
    );
  });

  it('rejects unregistering players from another tournament', async () => {
    const request = buildRequest({ params: { id: 't-4', playerId: 'p-2' } });
    const response = buildResponse();

    isAdminMock.mockReturnValue(false);
    mockService.getPlayerById.mockResolvedValue({ tournamentId: 't-99' });

    await controller.unregisterPlayer(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(mockService.unregisterPlayer).not.toHaveBeenCalled();
  });

  it('allows unregistering when user email matches', async () => {
    const request = buildRequest({
      params: { id: 't-4', playerId: 'p-2' },
      auth: { payload: { email: 'user@example.com' } },
    });
    const response = buildResponse();

    isAdminMock.mockReturnValue(false);
    mockService.getPlayerById.mockResolvedValue({
      tournamentId: 't-4',
      email: 'user@example.com',
    });

    await controller.unregisterPlayer(request as never, response as never);

    expect(mockService.unregisterPlayer).toHaveBeenCalledWith('t-4', 'p-2');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Player unregistered successfully' })
    );
  });

  it('rejects unregistering without verified user email', async () => {
    const request = buildRequest({ params: { id: 't-4', playerId: 'p-2' } });
    const response = buildResponse();

    isAdminMock.mockReturnValue(false);
    mockService.getPlayerById.mockResolvedValue({ tournamentId: 't-4', email: 'user@example.com' });

    await controller.unregisterPlayer(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(mockService.unregisterPlayer).not.toHaveBeenCalled();
  });

  it('returns participants payloads', async () => {
    const request = buildRequest({ params: { id: 't-5' } });
    const response = buildResponse();

    mockService.getTournamentParticipants.mockResolvedValue([{ id: 'p-1' }]);

    await controller.getTournamentParticipants(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalCount: 1 })
    );
  });

  it('updates player check-in status', async () => {
    const request = buildRequest({
      params: { id: 't-9', playerId: 'p-3' },
      body: { checkedIn: true },
    });
    const response = buildResponse();

    mockService.updateTournamentPlayerCheckIn.mockResolvedValue({ id: 'p-3' });

    await controller.updateTournamentPlayerCheckIn(request as never, response as never);

    expect(mockService.updateTournamentPlayerCheckIn).toHaveBeenCalledWith('t-9', 'p-3', true);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Player check-in status updated' })
    );
  });

  it('deletes tournament players', async () => {
    const request = buildRequest({ params: { id: 't-10', playerId: 'p-4' } });
    const response = buildResponse();

    await controller.deleteTournamentPlayer(request as never, response as never);

    expect(mockService.unregisterPlayer).toHaveBeenCalledWith('t-10', 'p-4');
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it('validates registrations', async () => {
    const request = buildRequest({ params: { id: 't-6', playerId: 'p-9' } });
    const response = buildResponse();

    mockService.validateRegistrationConstraints.mockResolvedValue({ canRegister: true });

    await controller.validateRegistration(request as never, response as never);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 't-6',
        playerId: 'p-9',
        canRegister: true,
      })
    );
  });

  it('updates tournament status', async () => {
    const request = buildRequest({
      params: { id: 't-7' },
      body: { status: TournamentStatus.OPEN, force: true },
    });
    const response = buildResponse();

    mockService.transitionTournamentStatus.mockResolvedValue({ id: 't-7' });

    await controller.updateTournamentStatus(request as never, response as never);

    expect(mockService.transitionTournamentStatus).toHaveBeenCalledWith(
      't-7',
      TournamentStatus.OPEN,
      true
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('OPEN'),
      })
    );
  });

  it('exports tournament snapshot json for admins', async () => {
    const request = buildRequest({ params: { id: 't-snapshot' } });
    const response = buildResponse();

    const snapshot = {
      schemaVersion: 1,
      tournamentId: 't-snapshot',
      savedAt: '2026-02-26T12:00:00.000Z',
      data: { id: 't-snapshot' },
    };

    mockService.getTournamentById.mockResolvedValue({ id: 't-snapshot' });
    readTournamentSnapshotMock.mockResolvedValue(snapshot);

    await controller.exportTournamentSnapshot(request as never, response as never);

    expect(mockService.getTournamentById).toHaveBeenCalledWith('t-snapshot');
    expect(readTournamentSnapshotMock).toHaveBeenCalledWith('t-snapshot');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.type).toHaveBeenCalledWith('application/json');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="tournament-t-snapshot-snapshot.json"'
    );
    expect(response.send).toHaveBeenCalledWith(snapshot);
  });

  it('returns 404 when snapshot file is missing', async () => {
    const request = buildRequest({ params: { id: 't-missing' } });
    const response = buildResponse();

    mockService.getTournamentById.mockResolvedValue({ id: 't-missing' });
    readTournamentSnapshotMock.mockResolvedValue(undefined);

    await controller.exportTournamentSnapshot(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOURNAMENT_SNAPSHOT_NOT_FOUND' }),
      })
    );
  });

  it('restores snapshot json payload', async () => {
    const request = buildRequest({
      params: { id: 't-restore' },
      body: {
        schemaVersion: 1,
        tournamentId: 'old-id',
        savedAt: '2026-02-20T10:00:00.000Z',
        data: { id: 't-restore' },
      },
    });
    const response = buildResponse();

    mockService.getTournamentById.mockResolvedValue({ id: 't-restore' });

    await controller.restoreTournamentSnapshot(request as never, response as never);

    expect(mockService.getTournamentById).toHaveBeenCalledWith('t-restore');
    expect(restoreTournamentSnapshotMock).toHaveBeenCalledWith('t-restore', request.body);
    expect(restoreTournamentStateFromSnapshotMock).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Tournament snapshot restored successfully',
        tournamentId: 't-restore',
      })
    );
  });

  it('rejects invalid snapshot restore payloads', async () => {
    const request = buildRequest({ params: { id: 't-restore' }, body: { schemaVersion: 2 } });
    const response = buildResponse();

    await controller.restoreTournamentSnapshot(request as never, response as never);

    expect(restoreTournamentSnapshotMock).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_SNAPSHOT_PAYLOAD' }),
      })
    );
  });

  it('lists snapshot history for a tournament', async () => {
    const request = buildRequest({ params: { id: 't-history' } });
    const response = buildResponse();

    mockService.getTournamentById.mockResolvedValue({ id: 't-history' });
    listTournamentSnapshotsMock.mockResolvedValue([
      { snapshotId: 'snap-1', action: 'UPDATE_TOURNAMENT' },
    ]);

    await controller.listTournamentSnapshots(request as never, response as never);

    expect(listTournamentSnapshotsMock).toHaveBeenCalledWith('t-history');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 't-history',
        total: 1,
      })
    );
  });

  it('restores snapshot by snapshot id', async () => {
    const request = buildRequest({
      params: { id: 't-history', snapshotId: 'snap-restore' },
    });
    const response = buildResponse();

    mockService.getTournamentById.mockResolvedValue({ id: 't-history' });
    restoreTournamentSnapshotByIdMock.mockResolvedValue({ snapshotId: 'snap-restore' });

    await controller.restoreTournamentSnapshotById(request as never, response as never);

    expect(restoreTournamentSnapshotByIdMock).toHaveBeenCalledWith('t-history', 'snap-restore');
    expect(restoreTournamentStateFromSnapshotMock).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: 'snap-restore' })
    );
  });
});
