import TournamentController from '../../src/controllers/tournament-controller';
import { AppError } from '../../src/middleware/error-handler';
import { TournamentStatus } from '../../../shared/src/types';

let mockService: {
  createTournament: jest.Mock;
  getTournamentById: jest.Mock;
  getTournaments: jest.Mock;
  uploadTournamentLogo: jest.Mock;
  getTournamentsByDateRange: jest.Mock;
  registerPlayer: jest.Mock;
  registerPlayerDetails: jest.Mock;
  getPlayerById: jest.Mock;
  unregisterPlayer: jest.Mock;
  getTournamentParticipants: jest.Mock;
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
    error: jest.fn(),
  },
}));

const buildResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
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
      getTournaments: jest.fn(),
      uploadTournamentLogo: jest.fn(),
      getTournamentsByDateRange: jest.fn(),
      registerPlayer: jest.fn(),
      registerPlayerDetails: jest.fn(),
      getPlayerById: jest.fn(),
      unregisterPlayer: jest.fn(),
      getTournamentParticipants: jest.fn(),
      validateRegistrationConstraints: jest.fn(),
      transitionTournamentStatus: jest.fn(),
    };
    isAdminMock.mockReset();
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
});
