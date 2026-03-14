import { TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { config } from '../../src/config/environment';
import { createPlayerHandlers } from '../../src/services/tournament-service/player-handlers';

type ModelMock = {
  getPersonById: jest.Mock;
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
  deleteOrphanParticipants: jest.Mock;
  findPlayerBySurname: jest.Mock;
  findPlayerByTeamName: jest.Mock;
  findPersonByEmailAndPhone: jest.Mock;
  createPerson: jest.Mock;
  updatePerson: jest.Mock;
  createPlayer: jest.Mock;
  updatePlayer: jest.Mock;
};

const buildContext = (options?: { isAdminAction?: boolean }) => {
  const model: ModelMock = {
    getPersonById: jest.fn().mockResolvedValue(undefined),
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
    deleteOrphanParticipants: jest.fn().mockResolvedValue(0),
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
      isAdminAction: () => options?.isAdminAction ?? false,
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

  it('registers player when auth is enabled and deadline is not passed', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = true;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
      startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });
    model.isPlayerRegistered.mockResolvedValue(false);
    model.getParticipantCount.mockResolvedValue(1);

    await handlers.registerPlayer('t1', 'p1');
    expect(model.registerPlayer).toHaveBeenCalledWith('t1', 'p1');
  });

  it('rejects registerPlayer for grouped formats when requester is not admin', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.TEAM_4_PLAYER,
    });

    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('registration must be completed by a doublette/equipe captain');
  });

  it('logs non-AppError failures during registerPlayer', async () => {
    const { model, handlers, logger } = buildContext({ isAdminAction: true });
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });
    model.isPlayerRegistered.mockResolvedValue(false);
    model.getParticipantCount.mockResolvedValue(1);
    model.registerPlayer.mockRejectedValue(new Error('db boom'));

    await expect(handlers.registerPlayer('t1', 'p1')).rejects.toThrow('db boom');
    expect(logger.error).toHaveBeenCalled();
  });

  it('rejects registerPlayerDetails for grouped formats when not admin', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.DOUBLE,
    });
    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
    } as never)).rejects.toThrow('registration must be completed by a doublette/equipe captain');
  });

  it('registers player details for grouped formats in admin context', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
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

  it('rejects registerPlayerDetails with personId for non-admin users', async () => {
    const { model, handlers } = buildContext();
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });

    await expect(handlers.registerPlayerDetails('t1', {
      personId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Alice',
      lastName: 'Doe',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects registerPlayerDetails when admin-selected person does not exist', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });
    model.getPersonById.mockResolvedValue(undefined);

    await expect(handlers.registerPlayerDetails('t1', {
      personId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Alice',
      lastName: 'Doe',
    })).rejects.toMatchObject({ code: 'PERSON_NOT_FOUND' });
  });

  it('registers player details with an existing personId in admin context', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });
    model.getParticipantCount.mockResolvedValue(1);
    model.getPersonById.mockResolvedValue({ id: 'person-99' });
    model.createPlayer.mockResolvedValue({ id: 'p-created' });

    await handlers.registerPlayerDetails('t1', {
      personId: 'person-99',
      firstName: 'Alice',
      lastName: 'Doe',
    });

    expect(model.createPlayer).toHaveBeenCalledWith('t1', expect.objectContaining({ personId: 'person-99' }));
    expect(model.createPerson).not.toHaveBeenCalled();
  });

  it('logs non-AppError failures during registerPlayerDetails', async () => {
    const { model, handlers, logger } = buildContext({ isAdminAction: true });
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
    });
    model.getParticipantCount.mockResolvedValue(1);
    model.findPlayerBySurname.mockResolvedValue(undefined);
    model.findPlayerByTeamName.mockResolvedValue(undefined);
    model.findPersonByEmailAndPhone.mockResolvedValue(undefined);
    model.createPerson.mockResolvedValue({ id: 'person-created' });
    model.createPlayer.mockRejectedValue(new Error('db boom'));

    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
    } as never)).rejects.toThrow('db boom');

    expect(logger.error).toHaveBeenCalled();
  });

  it('uses slot-based player capacity for grouped admin registration', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    config.auth.enabled = false;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 2,
      format: TournamentFormat.DOUBLE,
    });
    model.getParticipantCount.mockResolvedValue(3);
    model.findPlayerBySurname.mockResolvedValue(undefined);
    model.findPlayerByTeamName.mockResolvedValue(undefined);
    model.findPersonByEmailAndPhone.mockResolvedValue(undefined);
    model.createPerson.mockResolvedValue({ id: 'person-created' });
    model.createPlayer.mockResolvedValue({ id: 'p-created' });

    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'A-Doe',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '123',
    } as never)).resolves.toEqual({ id: 'p-created' });

    model.getParticipantCount.mockResolvedValue(4);
    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Bob',
      lastName: 'Doe',
      surname: 'B-Doe',
    } as never)).rejects.toThrow('Tournament is full');
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

  it('unregisters player when tournament is editable and player is registered', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN });
    model.isPlayerRegistered.mockResolvedValue(true);

    await handlers.unregisterPlayer('t1', 'p1');

    expect(model.unregisterPlayer).toHaveBeenCalledWith('t1', 'p1');
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

  it('does not auto-transition when checkedIn is false or counts are insufficient', async () => {
    const { model, handlers, transitionTournamentStatus } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.SIGNATURE });

    await handlers.updateTournamentPlayerCheckIn('t1', 'p1', false);
    expect(transitionTournamentStatus).not.toHaveBeenCalled();

    model.getParticipantCount.mockResolvedValue(4);
    model.getCheckedInCount.mockResolvedValue(2);
    await handlers.updateTournamentPlayerCheckIn('t1', 'p1', true);
    expect(transitionTournamentStatus).not.toHaveBeenCalled();
  });

  it('returns tournament participants when tournament exists', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN });
    model.getParticipants.mockResolvedValue([{ id: 'p1' }]);

    const participants = await handlers.getTournamentParticipants('t1');
    expect(participants).toEqual([{ id: 'p1' }]);
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

  it('reassigns player to another person when admin and target person exists', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN, format: TournamentFormat.SINGLE });
    model.getPlayerById.mockResolvedValue({ id: 'p1', personId: 'person-1' });
    model.getPersonById.mockResolvedValue({ id: 'person-2' });

    await handlers.updateTournamentPlayer('t1', 'p1', {
      personId: 'person-2',
      firstName: 'Alice',
      lastName: 'Doe',
    });

    expect(model.getPersonById).toHaveBeenCalledWith('person-2');
    expect(model.updatePerson).not.toHaveBeenCalled();
    expect(model.updatePlayer).toHaveBeenCalledWith('t1', 'p1', expect.objectContaining({ personId: 'person-2' }));
  });

  it('rejects player reassignment when requester is not admin', async () => {
    const { model, handlers } = buildContext({ isAdminAction: false });
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN, format: TournamentFormat.SINGLE });
    model.getPlayerById.mockResolvedValue({ id: 'p1', personId: 'person-1' });

    await expect(handlers.updateTournamentPlayer('t1', 'p1', {
      personId: 'person-2',
      firstName: 'Alice',
      lastName: 'Doe',
    })).rejects.toThrow('Admin access required to reassign player account');
  });

  it('rejects player reassignment when target person does not exist', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    model.findById.mockResolvedValue({ id: 't1', status: TournamentStatus.OPEN, format: TournamentFormat.SINGLE });
    model.getPlayerById.mockResolvedValue({ id: 'p1', personId: 'person-1' });
    model.getPersonById.mockResolvedValue(undefined);

    await expect(handlers.updateTournamentPlayer('t1', 'p1', {
      personId: 'person-missing',
      firstName: 'Alice',
      lastName: 'Doe',
    })).rejects.toThrow('Person not found');
  });

  it('rejects registerPlayerDetails when tournament is missing', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
    } as never)).rejects.toThrow('Tournament not found');
  });

  it('rejects registerPlayerDetails when auth enabled and deadline is passed', async () => {
    const { model, handlers } = buildContext({ isAdminAction: true });
    config.auth.enabled = true;
    model.findById.mockResolvedValue({
      id: 't1',
      name: 'Cup',
      status: TournamentStatus.OPEN,
      totalParticipants: 8,
      format: TournamentFormat.SINGLE,
      startTime: new Date(Date.now() + 30 * 60 * 1000),
    });

    await expect(handlers.registerPlayerDetails('t1', {
      firstName: 'Alice',
      lastName: 'Doe',
    } as never)).rejects.toThrow('Registration deadline has passed');
  });

  it('maps player without optional fields', async () => {
    const { model, handlers } = buildContext();
    model.getPlayerById.mockResolvedValueOnce({
      id: 'p2',
      tournamentId: 't1',
      firstName: 'Bob',
      lastName: 'Doe',
      registeredAt: new Date('2026-01-01T10:00:00.000Z'),
      isActive: true,
      checkedIn: false,
    });

    const minimal = await handlers.getPlayerById('p2');
    expect(minimal).toEqual(expect.objectContaining({ id: 'p2', firstName: 'Bob' }));
    expect(minimal).not.toHaveProperty('personId');
    expect(minimal).not.toHaveProperty('surname');
    expect(minimal).not.toHaveProperty('teamName');
    expect(minimal).not.toHaveProperty('email');
    expect(minimal).not.toHaveProperty('phone');
    expect(minimal).not.toHaveProperty('skillLevel');
  });

  it('rejects updateTournamentPlayer when tournament is missing', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.updateTournamentPlayer('t1', 'p1', {
      firstName: 'Alice',
      lastName: 'Doe',
    })).rejects.toThrow('Tournament not found');
  });

  it('rejects check-in when tournament is missing', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.updateTournamentPlayerCheckIn('t1', 'p1', true))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects unregister when tournament is missing', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.unregisterPlayer('t1', 'p1'))
      .rejects.toThrow('Tournament not found');
  });

  it('rejects getTournamentParticipants when tournament is missing and returns orphan participants', async () => {
    const { model, handlers } = buildContext();
    model.findById.mockResolvedValue(null);

    await expect(handlers.getTournamentParticipants('t1'))
      .rejects.toThrow('Tournament not found');

    model.getOrphanParticipants.mockResolvedValue([{ id: 'o1' }]);
    await expect(handlers.getOrphanParticipants()).resolves.toEqual([{ id: 'o1' }]);

    model.deleteOrphanParticipants.mockResolvedValue(3);
    await expect(handlers.deleteOrphanParticipants()).resolves.toBe(3);
  });
});
