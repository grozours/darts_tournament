import { TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { config } from '../../src/config/environment';
import { createPlayerHandlers } from '../../src/services/tournament-service/player-handlers';

type ModelMock = {
  findById: jest.Mock;
  isPlayerRegistered: jest.Mock;
  getParticipantCount: jest.Mock;
  registerPlayer: jest.Mock;
  unregisterPlayer: jest.Mock;
  getPlayerById: jest.Mock;
  updatePlayerCheckIn: jest.Mock;
  getCheckedInCount: jest.Mock;
  getParticipants: jest.Mock;
  getOrphanParticipants: jest.Mock;
  findPlayerBySurname: jest.Mock;
  findPlayerByTeamName: jest.Mock;
  findPersonByEmailAndPhone: jest.Mock;
  createPerson: jest.Mock;
  updatePerson: jest.Mock;
  createPlayer: jest.Mock;
  updatePlayer: jest.Mock;
};

const buildContext = () => {
  const model: ModelMock = {
    findById: jest.fn(),
    isPlayerRegistered: jest.fn(),
    getParticipantCount: jest.fn(),
    registerPlayer: jest.fn().mockResolvedValue(undefined),
    unregisterPlayer: jest.fn().mockResolvedValue(undefined),
    getPlayerById: jest.fn(),
    updatePlayerCheckIn: jest.fn().mockResolvedValue({ id: 'p1' }),
    getCheckedInCount: jest.fn().mockResolvedValue(2),
    getParticipants: jest.fn().mockResolvedValue([]),
    getOrphanParticipants: jest.fn().mockResolvedValue([]),
    findPlayerBySurname: jest.fn().mockResolvedValue(undefined),
    findPlayerByTeamName: jest.fn().mockResolvedValue(undefined),
    findPersonByEmailAndPhone: jest.fn().mockResolvedValue(undefined),
    createPerson: jest.fn(),
    updatePerson: jest.fn(),
    createPlayer: jest.fn(),
    updatePlayer: jest.fn().mockResolvedValue({ id: 'p1' }),
  };

  const logger = {
    accessError: jest.fn(),
    validationError: jest.fn(),
    playerRegistered: jest.fn(),
    error: jest.fn(),
  };

  const transitionTournamentStatus = jest.fn().mockResolvedValue(undefined);

  return {
    model,
    logger,
    transitionTournamentStatus,
    handlers: createPlayerHandlers({
      tournamentModel: model as never,
      logger: logger as never,
      validateUUID: jest.fn(),
      transitionTournamentStatus,
    }),
  };
};

describe('player handlers', () => {
  const authEnabledOriginal = config.auth.enabled;

  afterEach(() => {
    config.auth.enabled = authEnabledOriginal;
    jest.clearAllMocks();
  });

  it('rejects registerPlayer when tournament is missing', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('Tournament not found');
  });

  it('rejects registerPlayer when registration is not open', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', name: 'Cup', status: TournamentStatus.DRAFT });

    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('Tournament registration is not open');
  });

  it('rejects registerPlayer when auth enabled and deadline is passed', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = true;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      startTime: new Date(Date.now() + 30 * 60 * 1000),
    });

    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('Registration deadline has passed');
  });

  it('rejects registerPlayer when duplicate or full', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({ id: 't1', name: 'Cup', status: TournamentStatus.OPEN, totalParticipants: 2 });

    model.isPlayerRegistered.mockResolvedValue(true);
    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('Player is already registered for this tournament');

    model.isPlayerRegistered.mockResolvedValue(false);
    model.getParticipantCount.mockResolvedValue(2);
    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('Tournament is full');
  });

  it('registers player on happy path', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({ id: 't1', name: 'Cup', status: TournamentStatus.OPEN, totalParticipants: 8 });
    model.isPlayerRegistered.mockResolvedValue(false);
    model.getParticipantCount.mockResolvedValue(1);

    await handlers.registerPlayer('t1', 'p1');
    expect(model.registerPlayer).toHaveBeenCalledWith('t1', 'p1');
  });

  it('registers player details and enforces team uniqueness for team formats', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.DOUBLE,
    });
    model.getParticipantCount.mockResolvedValue(1);
    model.findPlayerBySurname.mockResolvedValue(undefined);
    model.findPlayerByTeamName.mockResolvedValue(undefined);
    model.findPersonByEmailAndPhone.mockResolvedValue(undefined);
    model.createPerson.mockResolvedValue({ id: 'person-created' });
    model.createPlayer.mockResolvedValue({ id: 'p-created' });

    const created = await handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
    } as never);

    expect(created).toEqual({ id: 'p-created' });
    expect(model.createPlayer).toHaveBeenCalled();
  });

  it('rejects registerPlayerDetails when surname is already used', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });
    model.getParticipantCount.mockResolvedValue(1);
    model.findPlayerBySurname.mockResolvedValue({ id: 'existing' });

    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'A-Doe',
    } as never)).rejects.toThrow('already used');
  });

  it('auto-transitions to live on check-in and logs transition failure', async () => {
    const { model, handlers, transitionTournamentStatus } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.SIGNATURE });
    model.getParticipantCount.mockResolvedValue(2);
    model.getCheckedInCount.mockResolvedValue(2);

    await handlers.updateTournamentPlayerCheckIn('t1', 'p1', true);
    expect(transitionTournamentStatus).toHaveBeenCalledWith('t1', TournamentStatus.LIVE);

    transitionTournamentStatus.mockRejectedValueOnce(new Error('boom'));
    await handlers.updateTournamentPlayerCheckIn('t1', 'p1', true);
  });

  it('rejects check-in when tournament is not in signature', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN });

    await expect(handlers.updateTournamentPlayerCheckIn('t1', 'p1', true))
      .rejects.toThrow('Check-in is only available during signature');
  });

  it('rejects unregister in live tournaments', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.LIVE });

    await expect(handlers.unregisterPlayer('t1', 'p1'))
      .rejects.toThrow('Cannot unregister from tournament that is live or finished');
  });

  it('rejects unregister when player is not registered', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN });
    model.isPlayerRegistered.mockResolvedValue(false);

    await expect(handlers.unregisterPlayer('t1', 'p1'))
      .rejects.toThrow('Player is not registered for this tournament');
  });

  it('returns undefined when getPlayerById misses, then returns mapped player with optional fields', async () => {
    const { model, handlers } = buildContext();
    model.getPlayerById.mockResolvedValueOnce(undefined);

    await expect(handlers.getPlayerById('p1')).resolves.toBeUndefined();

    model.getPlayerById.mockResolvedValueOnce({
      id: 'p1',
      tournamentId: 't1',
      firstName: 'Alice',
      lastName: 'Doe',
      registeredAt: new Date('2026-01-01T10:00:00.000Z'),
      isActive: true,
      checkedIn: true,
      personId: 'person-1',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
      skillLevel: 'ADVANCED',
    });

    const mapped = await handlers.getPlayerById('p1');
    expect(mapped).toEqual(expect.objectContaining({
      id: 'p1',
      personId: 'person-1',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
      skillLevel: 'ADVANCED',
    }));
  });

  it('updates player details after uniqueness checks', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN, format: TournamentFormat.SINGLE });
    model.getPlayerById.mockResolvedValue({ id: 'p1', personId: undefined });

    await handlers.updateTournamentPlayer('t1', 'p1', {
      firstName: 'Alice',
      lastName: 'Doe',
    });

    expect(model.updatePlayer).toHaveBeenCalled();
  });

  it('updates linked person when player has personId', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN, format: TournamentFormat.SINGLE });
    model.getPlayerById.mockResolvedValue({ id: 'p1', personId: 'person-1' });
    model.findPlayerBySurname.mockResolvedValue(undefined);
    model.findPlayerByTeamName.mockResolvedValue(undefined);
    model.updatePerson.mockResolvedValue({ id: 'person-1' });

    await handlers.updateTournamentPlayer('t1', 'p1', {
      firstName: 'Alice',
      lastName: 'Doe',
      email: 'alice@example.com',
    } as never);

    expect(model.updatePerson).toHaveBeenCalled();
    expect(model.updatePlayer).toHaveBeenCalled();
  });

  it('rejects getTournamentParticipants when tournament is missing and returns orphan participants', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.getTournamentParticipants('t1'))
      .rejects.toThrow('Tournament not found');

    model.getOrphanParticipants.mockResolvedValue([{ id: 'o1' }]);
    await expect(handlers.getOrphanParticipants()).resolves.toEqual([{ id: 'o1' }]);
  });
});
