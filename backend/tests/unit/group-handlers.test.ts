// @ts-nocheck
import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { scryptSync } from 'node:crypto';
import { SkillLevel, TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { config } from '../../src/config/environment';
import { createGroupHandlers } from '../../src/services/tournament-service/group-handlers';

const buildTournament = (format: TournamentFormat) => ({
  id: 't1',
  format,
  status: TournamentStatus.OPEN,
  startTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
  totalParticipants: 16,
});

const GROUP_CODE_OK = ['group', '-', 'ok'].join('');
const GROUP_CODE_ALT = ['group', '-', 'alt'].join('');
const GROUP_CODE_BAD = ['group', '-', 'bad'].join('');
const GROUP_CODE_NEW = ['group', '-', 'new'].join('');
const GROUP_CODE_MIN = ['g', '1'].join('');
const GROUP_CODE_TEAM_OK = ['team', '-', 'ok'].join('');

const passwordHash = (password: string) => {
  const salt = 'salt-fixed';
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const member = (id: string) => ({ joinedAt: new Date(), player: { id, firstName: 'A', lastName: 'B', email: `${id}@mail.dev` } });

const buildContext = () => {
  const tournamentModel = {
    findById: jest.fn(),
    findPlayerByEmail: jest.fn(),
    getParticipantCount: jest.fn().mockImplementation(async () => 1),
    getParticipants: jest.fn().mockImplementation(async () => []),
    getPlayerById: jest.fn().mockImplementation(async (playerId: string) => ({
      id: playerId,
      tournamentId: 't1',
      personId: null,
      firstName: 'A',
      lastName: 'B',
      surname: null,
      teamName: null,
      email: `${playerId}@mail.dev`,
      skillLevel: null,
    })),
    unregisterPlayer: jest.fn().mockImplementation(async () => undefined),
    countRegisteredDoublettes: jest.fn().mockImplementation(async () => 0),
    countRegisteredEquipes: jest.fn().mockImplementation(async () => 0),
    createPlayer: jest.fn().mockImplementation(async () => ({ id: 'actor-1', email: 'actor@example.com' })),
    listDoublettes: jest.fn().mockImplementation(async () => []),
    findDoubletteMembershipByPlayer: jest.fn().mockImplementation(async () => null),
    createDoublette: jest.fn().mockImplementation(async () => ({
      id: 'd1',
      name: 'D1',
      captainPlayerId: 'actor-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [{ joinedAt: new Date(), player: { id: 'actor-1', firstName: 'A', lastName: 'B', email: 'actor@example.com' } }],
    })),
    getDoubletteById: jest.fn(),
    addDoubletteMember: jest.fn().mockImplementation(async () => undefined),
    updateDoubletteCaptain: jest.fn().mockImplementation(async () => undefined),
    removeDoubletteMember: jest.fn().mockImplementation(async () => undefined),
    markDoubletteRegistered: jest.fn().mockImplementation(async () => undefined),
    markDoubletteUnregistered: jest.fn().mockImplementation(async () => undefined),
    deleteDoublette: jest.fn().mockImplementation(async () => undefined),
    updateDoublettePassword: jest.fn().mockImplementation(async () => undefined),
    updateDoublette: jest.fn(),

    listEquipes: jest.fn().mockImplementation(async () => []),
    findEquipeMembershipByPlayer: jest.fn().mockImplementation(async () => null),
    createEquipe: jest.fn().mockImplementation(async () => ({
      id: 'e1',
      name: 'E1',
      captainPlayerId: 'actor-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [{ joinedAt: new Date(), player: { id: 'actor-1', firstName: 'A', lastName: 'B', email: 'actor@example.com' } }],
    })),
    getEquipeById: jest.fn(),
    addEquipeMember: jest.fn().mockImplementation(async () => undefined),
    removeEquipeMember: jest.fn().mockImplementation(async () => undefined),
    updateEquipeCaptain: jest.fn().mockImplementation(async () => undefined),
    markEquipeRegistered: jest.fn().mockImplementation(async () => undefined),
    markEquipeUnregistered: jest.fn().mockImplementation(async () => undefined),
    deleteEquipe: jest.fn().mockImplementation(async () => undefined),
    updateEquipePassword: jest.fn().mockImplementation(async () => undefined),
    updateEquipe: jest.fn(),
    searchPlayersForGroups: jest.fn().mockImplementation(async () => []),
  };

  const context = {
    tournamentModel,
    logger: { error: jest.fn() },
    validateUUID: jest.fn(),
    getActorEmail: jest.fn(() => 'actor@example.com'),
    isAdminAction: jest.fn(() => false),
  };

  return { context, tournamentModel, handlers: createGroupHandlers(context as never) };
};

describe('group-handlers', () => {
  const authOriginal = config.auth.enabled;

  afterEach(() => {
    config.auth.enabled = authOriginal;
    jest.clearAllMocks();
  });

  it('lists doublettes for DOUBLE format', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.listDoublettes.mockImplementation(async () => ([
      {
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'p1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [{ joinedAt: new Date(), player: { id: 'p1', firstName: 'A', lastName: 'B', email: null } }],
      },
    ]));

    const result = await handlers.listDoublettes('t1', 'abc');
    expect(result).toHaveLength(1);
    expect(tournamentModel.listDoublettes).toHaveBeenCalledWith('t1', 'abc');
  });

  it('rejects listDoublettes when format mismatch', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.SINGLE));

    await expect(handlers.listDoublettes('t1')).rejects.toThrow('Doublettes are only available for DOUBLE tournaments');
  });

  it('creates doublette with actor player in non-admin mode', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'actor-1', email: 'actor@example.com' }));
    context.isAdminAction.mockReturnValue(false);

    const created = await handlers.createDoublette('t1', { name: ' Duo ', password: GROUP_CODE_OK });
    expect(created.name).toBe('D1');
    expect(tournamentModel.createDoublette).toHaveBeenCalled();
  });

  it('rejects joinDoublette with invalid password', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'actor-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      passwordHash: passwordHash(GROUP_CODE_ALT),
      isRegistered: false,
      captainPlayerId: 'p1',
      members: [{ joinedAt: new Date(), player: { id: 'p1', firstName: 'A', lastName: 'B', email: null } }],
    }));

    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_BAD })).rejects.toThrow('Invalid doublette password');
  });

  it('deletes doublette when captain leaves as sole member', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [{ joinedAt: new Date(), player: { id: 'captain-1', firstName: 'A', lastName: 'B', email: null } }],
    }));

    const result = await handlers.leaveDoublette('t1', 'd1');
    expect(result).toEqual({ deleted: true });
    expect(tournamentModel.deleteDoublette).toHaveBeenCalledWith('d1');
  });

  it('rejects registerDoublette when group is incomplete', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [{ joinedAt: new Date(), player: { id: 'captain-1', firstName: 'A', lastName: 'B', email: null } }],
    }));

    await expect(handlers.registerDoublette('t1', 'd1')).rejects.toThrow('Doublette must have exactly 2 members');
  });

  it('rejects registerDoublette when slot capacity is full', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => ({ ...buildTournament(TournamentFormat.DOUBLE), totalParticipants: 1 }));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.countRegisteredDoublettes.mockImplementation(async () => 1);
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));

    await expect(handlers.registerDoublette('t1', 'd1')).rejects.toThrow('Tournament is full');
  });

  it('rejects addEquipeMember when equipe is full', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [
        { joinedAt: new Date(), player: { id: 'captain-1', firstName: 'A', lastName: 'B', email: null } },
        { joinedAt: new Date(), player: { id: 'p2', firstName: 'A', lastName: 'B', email: null } },
        { joinedAt: new Date(), player: { id: 'p3', firstName: 'A', lastName: 'B', email: null } },
        { joinedAt: new Date(), player: { id: 'p4', firstName: 'A', lastName: 'B', email: null } },
      ],
    }));

    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p5' })).rejects.toThrow('Equipe is already full');
  });

  it('maps searchGroupPlayers payload', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.searchPlayersForGroups.mockImplementation(async () => ([
      {
        id: 'p1',
        personId: 'person-1',
        firstName: 'Ana',
        lastName: 'Diaz',
        email: 'ana@example.com',
        teamName: 'Team A',
        surname: 'A1',
        doubletteMemberships: [{ doublette: { id: 'd1', name: 'Duo A' } }],
        equipeMemberships: [{ equipe: { id: 'e1', name: 'Team A' } }],
      },
      {
        id: 'p2',
        personId: 'person-1',
        firstName: 'Ana',
        lastName: 'Diaz',
        email: 'ana+dup@example.com',
        teamName: 'Team B',
        surname: 'A1',
        doubletteMemberships: [],
        equipeMemberships: [],
      },
    ]));

    const result = await handlers.searchGroupPlayers('t1', 'ana');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'p1',
      doublettes: [{ id: 'd1', name: 'Duo A' }],
      equipes: [{ id: 'e1', name: 'Team A' }],
    }));
  });

  it('lists equipes for TEAM_4_PLAYER format', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.listEquipes.mockImplementation(async () => ([
      {
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'p1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('p1')],
      },
    ]));

    const result = await handlers.listEquipes('t1', 'team');
    expect(result).toHaveLength(1);
    expect(tournamentModel.listEquipes).toHaveBeenCalledWith('t1', 'team');
  });

  it('joins doublette with valid password', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'actor-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({
        id: 'd1',
        passwordHash: passwordHash(GROUP_CODE_OK),
        isRegistered: false,
        captainPlayerId: 'p1',
        members: [member('p1')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'p1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('p1'), member('actor-1')],
      }));

    const joined = await handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_OK });
    expect(joined.memberCount).toBe(2);
    expect(tournamentModel.addDoubletteMember).toHaveBeenCalledWith('d1', 'actor-1');
  });

  it('updates and deletes doublette as captain', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));
    tournamentModel.updateDoublette.mockImplementation(async () => ({
      id: 'd1',
      name: 'Renamed',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    }));

    const updated = await handlers.updateDoublette('t1', 'd1', { name: ' Renamed ' });
    expect(updated.name).toBe('Renamed');

    await handlers.deleteDoublette('t1', 'd1');
    expect(tournamentModel.deleteDoublette).toHaveBeenCalledWith('d1');
  });

  it('allows admin to delete registered doublette', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'admin-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));

    await handlers.deleteDoublette('t1', 'd1');
    expect(tournamentModel.deleteDoublette).toHaveBeenCalledWith('d1');
  });

  it('allows admin to delete doublette when tournament is full without creating admin player profile', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue({ ...buildTournament(TournamentFormat.DOUBLE), totalParticipants: 1 });
    tournamentModel.getParticipantCount.mockResolvedValue(2);
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await handlers.deleteDoublette('t1', 'd1');

    expect(tournamentModel.deleteDoublette).toHaveBeenCalledWith('d1');
    expect(tournamentModel.createPlayer).not.toHaveBeenCalled();
  });

  it('updates doublette password as captain', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    }));

    await handlers.updateDoublettePassword('t1', 'd1', { password: GROUP_CODE_NEW });
    expect(tournamentModel.updateDoublettePassword).toHaveBeenCalled();
  });

  it('adds and removes doublette member as captain', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById.mockImplementation(async () => ({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    }));
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({ id: 'd1', isRegistered: false, captainPlayerId: 'captain-1', members: [member('captain-1')] }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2')],
      }));

    const added = await handlers.addDoubletteMember('t1', 'd1', { playerId: 'p2' });
    expect(added.memberCount).toBe(2);

    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({ id: 'd1', isRegistered: false, captainPlayerId: 'captain-1', members: [member('captain-1'), member('p2')] }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1')],
      }));

    const removed = await handlers.removeDoubletteMember('t1', 'd1', 'p2');
    expect(removed.memberCount).toBe(1);
    expect(tournamentModel.unregisterPlayer).toHaveBeenCalledWith('t1', 'p2');
  });

  it('keeps player registered when removed doublette member still belongs to another doublette', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1')],
      });
    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValueOnce({ doubletteId: 'other-d' });

    const removed = await handlers.removeDoubletteMember('t1', 'd1', 'p2');

    expect(removed.memberCount).toBe(1);
    expect(tournamentModel.unregisterPlayer).not.toHaveBeenCalled();
  });

  it('sets first added member as captain when admin adds member to empty doublette', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'admin-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: null,
        members: [],
      }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'p2',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('p2')],
      }));

    const updated = await handlers.addDoubletteMember('t1', 'd1', { playerId: 'p2' });
    expect(updated.captainPlayerId).toBe('p2');
    expect(tournamentModel.updateDoubletteCaptain).toHaveBeenCalledWith('d1', 'p2');
  });

  it('joins and registers equipe with valid password', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'actor-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById
      .mockImplementationOnce(async () => ({
        id: 'e1',
        passwordHash: passwordHash(GROUP_CODE_TEAM_OK),
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2'), member('p3')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2'), member('p3'), member('actor-1')],
      }));

    const joined = await handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_TEAM_OK });
    expect(joined.memberCount).toBe(4);

    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById
      .mockImplementationOnce(async () => ({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: true,
        registeredAt: new Date(),
        createdAt: new Date(),
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      }));

    const registered = await handlers.registerEquipe('t1', 'e1');
    expect(registered.isRegistered).toBe(true);
  });

  it('updates, password-updates and deletes equipe as captain', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));
    tournamentModel.updateEquipe.mockImplementation(async () => ({
      id: 'e1',
      name: 'Team X',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    }));

    const updated = await handlers.updateEquipe('t1', 'e1', { name: ' Team X ' });
    expect(updated.name).toBe('Team X');

    await handlers.updateEquipePassword('t1', 'e1', { password: GROUP_CODE_NEW });
    expect(tournamentModel.updateEquipePassword).toHaveBeenCalled();

    await handlers.deleteEquipe('t1', 'e1');
    expect(tournamentModel.deleteEquipe).toHaveBeenCalledWith('e1');
  });

  it('allows admin to delete registered equipe', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'admin-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    }));

    await handlers.deleteEquipe('t1', 'e1');
    expect(tournamentModel.deleteEquipe).toHaveBeenCalledWith('e1');
  });

  it('allows admin to delete equipe when tournament is full without creating admin player profile', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue({ ...buildTournament(TournamentFormat.TEAM_4_PLAYER), totalParticipants: 1 });
    tournamentModel.getParticipantCount.mockResolvedValue(4);
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });

    await handlers.deleteEquipe('t1', 'e1');

    expect(tournamentModel.deleteEquipe).toHaveBeenCalledWith('e1');
    expect(tournamentModel.createPlayer).not.toHaveBeenCalled();
  });

  it('handles leaveEquipe delete branch for last captain member', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    }));

    const result = await handlers.leaveEquipe('t1', 'e1');
    expect(result).toEqual({ deleted: true });
    expect(tournamentModel.deleteEquipe).toHaveBeenCalledWith('e1');
  });

  it('creates equipe in admin mode and auto-adds members', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.createEquipe.mockImplementation(async () => ({
      id: 'e1',
      name: 'E1',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1')],
    }));
    tournamentModel.findEquipeMembershipByPlayer
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({ equipeId: 'other', playerId: 'p3' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      name: 'Team One',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    }));

    const created = await handlers.createEquipe('t1', {
      name: ' Team One ',
      password: GROUP_CODE_OK,
      captainPlayerId: 'captain-1',
      memberPlayerIds: ['p2', 'p3'],
    });

    expect(created.name).toBe('Team One');
    expect(tournamentModel.addEquipeMember).toHaveBeenCalledWith('e1', 'p2');
  });

  it('registers doublette in admin mode without actor email', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    context.getActorEmail.mockImplementation(() => undefined as never);
    tournamentModel.findById.mockImplementation(async () => buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'captain-1',
        isRegistered: true,
        registeredAt: new Date(),
        createdAt: new Date(),
        members: [member('captain-1'), member('p2')],
      }));

    const registered = await handlers.registerDoublette('t1', 'd1');

    expect(registered.isRegistered).toBe(true);
    expect(tournamentModel.markDoubletteRegistered).toHaveBeenCalledWith('d1');
  });

  it('unregisters doublette successfully when actor is captain', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: true,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2')],
      });

    const result = await handlers.unregisterDoublette('t1', 'd1');

    expect(result.isRegistered).toBe(false);
    expect(tournamentModel.markDoubletteUnregistered).toHaveBeenCalledWith('d1');
  });

  it('rejects unregisterDoublette when tournament is live or group is not registered', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValueOnce({
      ...buildTournament(TournamentFormat.DOUBLE),
      status: TournamentStatus.LIVE,
    });

    await expect(handlers.unregisterDoublette('t1', 'd1')).rejects.toThrow('live or finished');

    tournamentModel.findById.mockResolvedValueOnce(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await expect(handlers.unregisterDoublette('t1', 'd1')).rejects.toThrow('is not registered');
  });

  it('transfers captain when leaving doublette with remaining members', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'p2',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('p2')],
      }));

    const result = await handlers.leaveDoublette('t1', 'd1');
    expect(result).toEqual(expect.objectContaining({ deleted: false }));
    expect(tournamentModel.updateDoubletteCaptain).toHaveBeenCalledWith('d1', 'p2');
  });

  it('rejects removing equipe captain directly', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));

    await expect(handlers.removeEquipeMember('t1', 'e1', 'captain-1')).rejects.toThrow('Captain cannot be removed directly');
  });

  it('rejects adding equipe member when player already belongs to an equipe', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockImplementation(async () => ({ id: 'captain-1', email: 'actor@example.com' }));
    tournamentModel.getEquipeById.mockImplementation(async () => ({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    }));
    tournamentModel.findEquipeMembershipByPlayer.mockImplementation(async () => ({ equipeId: 'e-other', playerId: 'p3' }));

    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p3' })).rejects.toThrow('already part of an equipe');
  });

  it('rejects when listing groups for missing tournament', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue(null);

    await expect(handlers.listDoublettes('t1')).rejects.toThrow('Tournament not found');
    await expect(handlers.listEquipes('t1')).rejects.toThrow('Tournament not found');
  });

  it('rejects when registration deadline has passed with auth enabled', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = true;
    tournamentModel.findById.mockResolvedValue({
      ...buildTournament(TournamentFormat.DOUBLE),
      startTime: new Date(Date.now() + 30 * 60 * 1000),
    });

    await expect(handlers.createDoublette('t1', { name: 'Duo', password: GROUP_CODE_OK })).rejects.toThrow(
      'Registration deadline has passed'
    );
  });

  it('rejects createDoublette when captain already belongs to a doublette', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValue({ doubletteId: 'x' });

    await expect(
      handlers.createDoublette('t1', { name: 'D', password: GROUP_CODE_OK, captainPlayerId: 'p1' })
    ).rejects.toThrow('Captain is already part of a doublette');
  });

  it('rejects updateDoublette when actor is not a member', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });

    await expect(handlers.updateDoublette('t1', 'd1', { name: 'X' })).rejects.toThrow('belong to');
  });

  it('enforces admin-only ranking updates for groups', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });

    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await expect(
      handlers.updateDoublette('t1', 'd1', { skillLevel: SkillLevel.ADVANCED })
    ).rejects.toThrow('Only admin can update group ranking');

    context.isAdminAction.mockReturnValue(true);
    tournamentModel.updateDoublette.mockResolvedValue({
      id: 'd1',
      name: 'D1',
      skillLevel: SkillLevel.ADVANCED,
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });

    const updatedDoublette = await handlers.updateDoublette('t1', 'd1', {
      skillLevel: SkillLevel.ADVANCED,
    });
    expect(updatedDoublette.skillLevel).toBe(SkillLevel.ADVANCED);
    expect(tournamentModel.updateDoublette).toHaveBeenCalledWith('d1', { skillLevel: SkillLevel.ADVANCED });

    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });
    tournamentModel.updateEquipe.mockResolvedValue({
      id: 'e1',
      name: 'E1',
      skillLevel: null,
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });

    const updatedEquipe = await handlers.updateEquipe('t1', 'e1', {
      skillLevel: null,
    });
    expect(updatedEquipe.skillLevel).toBeNull();
    expect(tournamentModel.updateEquipe).toHaveBeenCalledWith('e1', { skillLevel: null });
  });

  it('allows admin to update doublette ranking even when tournament is full and admin has no player profile', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    context.getActorEmail.mockReturnValue('admin@example.com');
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.findById.mockResolvedValue({
      ...buildTournament(TournamentFormat.DOUBLE),
      totalParticipants: 1,
    });
    tournamentModel.getParticipantCount.mockResolvedValue(2);
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      name: 'D1',
      skillLevel: SkillLevel.BEGINNER,
      isRegistered: true,
      captainPlayerId: 'captain-1',
      registeredAt: new Date(),
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });
    tournamentModel.updateDoublette.mockResolvedValue({
      id: 'd1',
      name: 'D1',
      skillLevel: SkillLevel.EXPERT,
      captainPlayerId: 'captain-1',
      isRegistered: true,
      registeredAt: new Date(),
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });

    const updated = await handlers.updateDoublette('t1', 'd1', {
      skillLevel: SkillLevel.EXPERT,
    });

    expect(updated.skillLevel).toBe(SkillLevel.EXPERT);
    expect(tournamentModel.createPlayer).not.toHaveBeenCalled();
    expect(tournamentModel.updateDoublette).toHaveBeenCalledWith('d1', {
      skillLevel: SkillLevel.EXPERT,
    });
  });

  it('allows admin to update equipe ranking even when tournament is full and admin has no player profile', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    context.getActorEmail.mockReturnValue('admin@example.com');
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.findById.mockResolvedValue({
      ...buildTournament(TournamentFormat.TEAM_4_PLAYER),
      totalParticipants: 1,
    });
    tournamentModel.getParticipantCount.mockResolvedValue(4);
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      name: 'E1',
      skillLevel: SkillLevel.BEGINNER,
      isRegistered: true,
      captainPlayerId: 'captain-1',
      registeredAt: new Date(),
      createdAt: new Date(),
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });
    tournamentModel.updateEquipe.mockResolvedValue({
      id: 'e1',
      name: 'E1',
      skillLevel: SkillLevel.EXPERT,
      captainPlayerId: 'captain-1',
      isRegistered: true,
      registeredAt: new Date(),
      createdAt: new Date(),
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });

    const updated = await handlers.updateEquipe('t1', 'e1', {
      skillLevel: SkillLevel.EXPERT,
    });

    expect(updated.skillLevel).toBe(SkillLevel.EXPERT);
    expect(tournamentModel.createPlayer).not.toHaveBeenCalled();
    expect(tournamentModel.updateEquipe).toHaveBeenCalledWith('e1', {
      skillLevel: SkillLevel.EXPERT,
    });
  });

  it('rejects joinDoublette with malformed password hash and with already-member actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValueOnce({ doubletteId: 'existing' });

    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('already in a doublette');

    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValueOnce(null);
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      passwordHash: passwordHash(GROUP_CODE_ALT),
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });

    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('Invalid doublette password');
  });

  it('assigns captain when joining a captain-less empty doublette', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        passwordHash: passwordHash(GROUP_CODE_OK),
        isRegistered: false,
        captainPlayerId: null,
        members: [],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'actor-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('actor-1')],
      });

    const joined = await handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_OK });
    expect(joined.captainPlayerId).toBe('actor-1');
    expect(tournamentModel.updateDoubletteCaptain).toHaveBeenCalledWith('d1', 'actor-1');
  });

  it('rejects leaveDoublette when actor is not member or group is registered', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: true,
      captainPlayerId: 'actor-1',
      members: [member('actor-1')],
    });

    await expect(handlers.leaveDoublette('t1', 'd1')).rejects.toThrow('cannot be modified');

    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });

    await expect(handlers.leaveDoublette('t1', 'd1')).rejects.toThrow('not in this doublette');
  });

  it('returns deleted true when doublette disappears after leave', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'p2', email: 'actor@example.com' });
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);

    const result = await handlers.leaveDoublette('t1', 'd1');
    expect(result).toEqual({ deleted: true });
  });

  it('rejects registerDoublette for no captain and non-captain actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: null,
      members: [member('actor-1'), member('p2')],
    });

    await expect(handlers.registerDoublette('t1', 'd1')).rejects.toThrow('must have a captain');

    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('actor-1')],
    });

    await expect(handlers.registerDoublette('t1', 'd1')).rejects.toThrow('Only the captain can register');
  });

  it('rejects deleting registered doublette for non-admin actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await expect(handlers.deleteDoublette('t1', 'd1')).rejects.toThrow('cannot be deleted');
  });

  it('rejects add/remove doublette member for non-captain actor and missing updated group', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });

    await expect(handlers.addDoubletteMember('t1', 'd1', { playerId: 'p3' })).rejects.toThrow('belong to');

    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'actor-1',
        members: [member('actor-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.removeDoubletteMember('t1', 'd1', 'p3')).rejects.toThrow('Doublette not found');
  });

  it('rejects createEquipe when captain already belongs to another equipe', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValue({ equipeId: 'other' });

    await expect(
      handlers.createEquipe('t1', { name: 'Team', password: GROUP_CODE_OK, captainPlayerId: 'p1' })
    ).rejects.toThrow('Captain is already part of an equipe');
  });

  it('rejects joinEquipe on malformed password hash and already-member actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValueOnce({ equipeId: 'e1' });

    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('already in an equipe');

    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValueOnce(null);
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      passwordHash: passwordHash(GROUP_CODE_ALT),
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('Invalid equipe password');
  });

  it('assigns captain when joining a captain-less empty equipe', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        passwordHash: passwordHash(GROUP_CODE_OK),
        isRegistered: false,
        captainPlayerId: null,
        members: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'actor-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('actor-1')],
      });

    const joined = await handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_OK });
    expect(joined.captainPlayerId).toBe('actor-1');
    expect(tournamentModel.updateEquipeCaptain).toHaveBeenCalledWith('e1', 'actor-1');
  });

  it('rejects leaveEquipe when registered or actor is not member', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: true,
      captainPlayerId: 'actor-1',
      members: [member('actor-1')],
    });
    await expect(handlers.leaveEquipe('t1', 'e1')).rejects.toThrow('Registered equipe cannot be modified');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.leaveEquipe('t1', 'e1')).rejects.toThrow('Player is not in this equipe');
  });

  it('returns deleted true when equipe disappears after leave', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'p2', email: 'actor@example.com' });
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);

    const result = await handlers.leaveEquipe('t1', 'e1');
    expect(result).toEqual({ deleted: true });
  });

  it('rejects registerEquipe for no captain and for non-captain actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: null,
      members: [member('actor-1'), member('p2'), member('p3'), member('p4')],
    });
    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('must have a captain');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('actor-1'), member('p3'), member('p4')],
    });
    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('Only the captain can register');
  });

  it('unregisters equipe successfully in admin mode and without actor email', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    context.getActorEmail.mockReturnValue(undefined as never);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: true,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      });

    const result = await handlers.unregisterEquipe('t1', 'e1');

    expect(result.isRegistered).toBe(false);
    expect(tournamentModel.markEquipeUnregistered).toHaveBeenCalledWith('e1');
  });

  it('rejects deleting registered equipe for non-admin actor', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await expect(handlers.deleteEquipe('t1', 'e1')).rejects.toThrow('cannot be deleted');
  });

  it('rejects add/remove equipe member for non-member actor and missing updated equipe', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p3' })).rejects.toThrow('belong to');

    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'actor-1',
        members: [member('actor-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.removeEquipeMember('t1', 'e1', 'p3')).rejects.toThrow('Equipe not found');
  });

  it('rejects action when actor email cannot be resolved', async () => {
    const { handlers, context } = buildContext();
    context.getActorEmail.mockReturnValue(undefined);

    await expect(handlers.updateDoublette('t1', 'd1', { name: 'x' })).rejects.toThrow(
      'Cannot resolve authenticated user email'
    );
  });

  it('rejects createDoublette when tournament registration is closed or full', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById
      .mockResolvedValueOnce({ ...buildTournament(TournamentFormat.DOUBLE), status: TournamentStatus.LIVE })
      .mockResolvedValueOnce(buildTournament(TournamentFormat.DOUBLE))
      .mockResolvedValueOnce(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.getParticipantCount.mockResolvedValue(32);

    await expect(handlers.createDoublette('t1', { name: 'x', password: GROUP_CODE_MIN })).rejects.toThrow('registration is not open');
    await expect(handlers.createDoublette('t1', { name: 'x', password: GROUP_CODE_MIN })).rejects.toThrow('Tournament is full');
  });

  it('rejects joinDoublette when target group is missing, registered or full', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValue(null);

    tournamentModel.getDoubletteById.mockResolvedValueOnce(null);
    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('Doublette not found');

    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      passwordHash: passwordHash(GROUP_CODE_MIN),
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('registered doublette');

    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      passwordHash: passwordHash(GROUP_CODE_MIN),
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });
    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('already full');
  });

  it('rejects leaveDoublette when next captain cannot be determined', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('captain-1')],
    });

    await expect(handlers.leaveDoublette('t1', 'd1')).rejects.toThrow('Cannot determine next captain');
  });

  it('rejects addDoubletteMember when group is full or player already member elsewhere', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });
    await expect(handlers.addDoubletteMember('t1', 'd1', { playerId: 'p3' })).rejects.toThrow('already full');

    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    tournamentModel.findDoubletteMembershipByPlayer.mockResolvedValue({ doubletteId: 'other' });
    await expect(handlers.addDoubletteMember('t1', 'd1', { playerId: 'p3' })).rejects.toThrow('already part of a doublette');
  });

  it('allows admin to remove doublette member even when tournament is full', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockImplementation(async () => ({ ...buildTournament(TournamentFormat.DOUBLE), totalParticipants: 1 }));
    tournamentModel.getParticipantCount.mockImplementation(async () => 2);
    tournamentModel.findPlayerByEmail.mockImplementation(async () => null);
    tournamentModel.getDoubletteById
      .mockImplementationOnce(async () => ({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      }))
      .mockImplementationOnce(async () => ({
        id: 'd1',
        name: 'D1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        captainPlayerId: 'captain-1',
        members: [member('captain-1')],
      }));

    const removed = await handlers.removeDoubletteMember('t1', 'd1', 'p2');
    expect(removed.memberCount).toBe(1);
    expect(tournamentModel.removeDoubletteMember).toHaveBeenCalledWith('d1', 'p2');
    expect(tournamentModel.createPlayer).not.toHaveBeenCalled();
  });

  it('unregisters doublette when admin removes a member from a registered group', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: true,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        name: 'D1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        captainPlayerId: 'captain-1',
        members: [member('captain-1')],
      });

    await handlers.removeDoubletteMember('t1', 'd1', 'p2');

    expect(tournamentModel.removeDoubletteMember).toHaveBeenCalledWith('d1', 'p2');
    expect(tournamentModel.markDoubletteUnregistered).toHaveBeenCalledWith('d1');
  });

  it('rejects listEquipes on format mismatch', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.SINGLE));

    await expect(handlers.listEquipes('t1')).rejects.toThrow('Equipes are only available');
  });

  it('rejects updateEquipe when missing or actor is not member', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValueOnce(null);
    await expect(handlers.updateEquipe('t1', 'e1', { name: 'x' })).rejects.toThrow('Equipe not found');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.updateEquipe('t1', 'e1', { name: 'x' })).rejects.toThrow('belong to');
  });

  it('rejects joinEquipe when group missing, registered, full, or update result missing', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValue(null);

    tournamentModel.getEquipeById.mockResolvedValueOnce(null);
    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('Equipe not found');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      passwordHash: passwordHash(GROUP_CODE_MIN),
      isRegistered: true,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('registered equipe');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      passwordHash: passwordHash(GROUP_CODE_MIN),
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });
    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('already full');

    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        passwordHash: passwordHash(GROUP_CODE_MIN),
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.joinEquipe('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('Equipe not found');
  });

  it('rejects leaveEquipe when next captain cannot be determined', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('captain-1')],
    });

    await expect(handlers.leaveEquipe('t1', 'e1')).rejects.toThrow('Cannot determine next captain');
  });

  it('rejects registerEquipe when incomplete, full or updated group missing', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });
    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('exactly 4 members');

    tournamentModel.findById.mockResolvedValueOnce({ ...buildTournament(TournamentFormat.TEAM_4_PLAYER), totalParticipants: 0 });
    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });
    tournamentModel.countRegisteredEquipes.mockResolvedValue(1);
    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('Tournament is full');

    tournamentModel.findById.mockResolvedValueOnce(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.countRegisteredEquipes.mockResolvedValue(0);
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('Equipe not found');
  });

  it('rejects updateEquipePassword when equipe does not exist', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue(null);

    await expect(handlers.updateEquipePassword('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('Equipe not found');
  });

  it('rejects addEquipeMember when equipe already full', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });

    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p5' })).rejects.toThrow('already full');
  });

  it('rejects removeEquipeMember when actor tries to remove captain directly', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1'), member('p2')],
    });

    await expect(handlers.removeEquipeMember('t1', 'e1', 'captain-1')).rejects.toThrow('Captain cannot be removed directly');
  });

  it('creates player with fallback split-name defaults when local part is empty', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.getActorEmail.mockReturnValue('@example.com');
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue(null);
    tournamentModel.getParticipantCount.mockResolvedValue(0);

    await handlers.createDoublette('t1', { name: 'Duo', password: GROUP_CODE_OK });

    expect(tournamentModel.createPlayer).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ firstName: 'Player', lastName: 'Member' })
    );
  });

  it('covers addEquipeMember and removeEquipeMember success branches', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });

    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2'), member('p3')],
      });
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValue(null);
    const added = await handlers.addEquipeMember('t1', 'e1', { playerId: 'p3' });
    expect(added.memberCount).toBe(3);

    context.isAdminAction.mockReturnValue(true);
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1')],
      });
    const removed = await handlers.removeEquipeMember('t1', 'e1', 'p2');
    expect(removed.memberCount).toBe(1);
    expect(tournamentModel.unregisterPlayer).toHaveBeenCalledWith('t1', 'p2');
  });

  it('creates a local player when admin adds a cross-tournament member', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);

    tournamentModel.getPlayerById.mockResolvedValue({
      id: 'external-p1',
      tournamentId: 'other-tournament',
      personId: 'person-1',
      firstName: 'Ana',
      lastName: 'Diaz',
      surname: 'A1',
      teamName: 'Team A',
      email: 'ana@example.com',
      skillLevel: null,
    });
    tournamentModel.getParticipants.mockResolvedValue([]);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.getParticipantCount.mockResolvedValue(0);
    tournamentModel.createPlayer.mockResolvedValue({ id: 'local-created-player' });
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: null,
        members: [],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        name: 'D1',
        captainPlayerId: 'local-created-player',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('local-created-player')],
      });

    const updated = await handlers.addDoubletteMember('t1', 'd1', { playerId: 'external-p1' });

    expect(updated.captainPlayerId).toBe('local-created-player');
    expect(tournamentModel.createPlayer).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ personId: 'person-1', firstName: 'Ana', lastName: 'Diaz' })
    );
    expect(tournamentModel.addDoubletteMember).toHaveBeenCalledWith('d1', 'local-created-player');
  });

  it('rejects cross-tournament member add for non-admin users', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(false);
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getPlayerById.mockResolvedValue({
      id: 'external-p1',
      tournamentId: 'other-tournament',
      personId: 'person-1',
      firstName: 'Ana',
      lastName: 'Diaz',
      surname: null,
      teamName: null,
      email: 'ana@example.com',
      skillLevel: null,
    });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });

    await expect(handlers.addDoubletteMember('t1', 'd1', { playerId: 'external-p1' })).rejects.toThrow(
      'Player is not registered for this tournament'
    );
    expect(tournamentModel.addDoubletteMember).not.toHaveBeenCalled();
  });

  it('keeps player registered when removed equipe member still belongs to another equipe', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });

    context.isAdminAction.mockReturnValue(true);
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1')],
      });
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValueOnce({ equipeId: 'other-e' });

    const removed = await handlers.removeEquipeMember('t1', 'e1', 'p2');

    expect(removed.memberCount).toBe(1);
    expect(tournamentModel.unregisterPlayer).not.toHaveBeenCalled();
  });

  it('unregisters equipe when admin removes a member from a registered group', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: true,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1')],
      });

    await handlers.removeEquipeMember('t1', 'e1', 'p2');

    expect(tournamentModel.removeEquipeMember).toHaveBeenCalledWith('e1', 'p2');
    expect(tournamentModel.markEquipeUnregistered).toHaveBeenCalledWith('e1');
  });

  it('covers addEquipe/removeEquipe not-found early branches', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue(null);

    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p3' })).rejects.toThrow('Equipe not found');
    await expect(handlers.removeEquipeMember('t1', 'e1', 'p3')).rejects.toThrow('Equipe not found');
  });

  it('covers leaveEquipe not-found and captain-transfer return branches', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });

    tournamentModel.getEquipeById.mockResolvedValueOnce(null);
    await expect(handlers.leaveEquipe('t1', 'e1')).rejects.toThrow('Equipe not found');

    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'E1',
        captainPlayerId: 'p2',
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('p2')],
      });
    const result = await handlers.leaveEquipe('t1', 'e1');
    expect(result).toEqual(expect.objectContaining({ deleted: false }));
    expect(tournamentModel.updateEquipeCaptain).toHaveBeenCalledWith('e1', 'p2');
  });

  it('covers registerEquipe and deleteEquipe not-found branches', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValue(null);

    await expect(handlers.registerEquipe('t1', 'e1')).rejects.toThrow('Equipe not found');
    await expect(handlers.deleteEquipe('t1', 'e1')).rejects.toThrow('Equipe not found');
  });

  it('covers addEquipeMember updated-missing and removeEquipeMember forbidden branches', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });

    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        isRegistered: false,
        captainPlayerId: 'actor-1',
        members: [member('actor-1')],
      })
      .mockResolvedValueOnce(null);
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValue(null);
    await expect(handlers.addEquipeMember('t1', 'e1', { playerId: 'p3' })).rejects.toThrow('Equipe not found');

    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      isRegistered: false,
      captainPlayerId: 'captain-1',
      members: [member('captain-1')],
    });
    await expect(handlers.removeEquipeMember('t1', 'e1', 'p3')).rejects.toThrow('belong to');
  });

  it('rejects createDoublette when tournament does not exist', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue(null);

    await expect(handlers.createDoublette('t1', { name: 'Duo', password: GROUP_CODE_OK })).rejects.toThrow('Tournament not found');
  });

  it('rejects joinDoublette when stored password hash has invalid shape', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    const malformedStoredHash = passwordHash(GROUP_CODE_OK).replace(':', '');
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      passwordHash: malformedStoredHash,
      isRegistered: false,
      captainPlayerId: 'p1',
      members: [member('p1')],
    });

    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_OK }))
      .rejects.toThrow('Invalid doublette password');
  });

  it('rejects joinDoublette when stored hash length does not match candidate hash length', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;
    const [saltPart, hashPart] = passwordHash(GROUP_CODE_OK).split(':');
    const shortStoredHash = `${saltPart ?? 'salt'}:${(hashPart ?? '').slice(0, 4)}`;
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      passwordHash: shortStoredHash,
      isRegistered: false,
      captainPlayerId: 'p1',
      members: [member('p1')],
    });

    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_OK }))
      .rejects.toThrow('Invalid doublette password');
  });

  it('rejects unregisterDoublette when group is not registered and when refreshed group is missing', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce({
        id: 'd1',
        captainPlayerId: 'captain-1',
        isRegistered: true,
        members: [member('captain-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);

    await expect(handlers.unregisterDoublette('t1', 'd1'))
      .rejects.toThrow('Doublette is not registered');

    await expect(handlers.unregisterDoublette('t1', 'd1'))
      .rejects.toThrow('Doublette not found');
  });

  it('rejects unregisterEquipe when group is not registered and when refreshed group is missing', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        captainPlayerId: 'captain-1',
        isRegistered: false,
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        captainPlayerId: 'captain-1',
        isRegistered: true,
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      })
      .mockResolvedValueOnce(null);

    await expect(handlers.unregisterEquipe('t1', 'e1'))
      .rejects.toThrow('Equipe is not registered');

    await expect(handlers.unregisterEquipe('t1', 'e1'))
      .rejects.toThrow('Equipe not found');
  });

  it('covers admin createDoublette member bootstrap branch', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.createDoublette.mockResolvedValue({
      id: 'd1',
      name: 'D1',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1')],
    });
    tournamentModel.findDoubletteMembershipByPlayer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      name: 'D1',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p3')],
    });

    const response = await handlers.createDoublette('t1', {
      name: 'D1',
      password: GROUP_CODE_OK,
      captainPlayerId: 'captain-1',
      memberPlayerIds: ['captain-1', 'p2', 'p3'],
    });

    expect(tournamentModel.addDoubletteMember).toHaveBeenCalledWith('d1', 'p3');
    expect(response).toEqual(expect.objectContaining({ id: 'd1' }));
  });

  it('covers non-admin createEquipe path where admin bootstrap helper returns undefined', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(false);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.createEquipe.mockResolvedValue({
      id: 'e1',
      name: 'E1',
      captainPlayerId: 'actor-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('actor-1')],
    });

    const response = await handlers.createEquipe('t1', { name: 'Equipe 1', password: GROUP_CODE_TEAM_OK });
    expect(response).toEqual(expect.objectContaining({ id: 'e1' }));
  });

  it('rejects deleteDoublette when captain is missing', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue({
      id: 'd1',
      captainPlayerId: null,
      isRegistered: false,
      members: [member('actor-1')],
    });

    await expect(handlers.deleteDoublette('t1', 'd1')).rejects.toThrow('Only the captain can delete this doublette');
  });

  it('rejects updateDoublette and updateDoublettePassword when doublette is missing', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });
    tournamentModel.getDoubletteById.mockResolvedValue(null);

    await expect(handlers.updateDoublette('t1', 'd1', { name: 'New' })).rejects.toThrow('Doublette not found');
    await expect(handlers.updateDoublettePassword('t1', 'd1', { password: GROUP_CODE_NEW }))
      .rejects.toThrow('Doublette not found');
  });

  it('rejects unregisterDoublette on missing tournament and format mismatch', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);

    tournamentModel.findById.mockResolvedValueOnce(null);
    await expect(handlers.unregisterDoublette('t1', 'd1')).rejects.toThrow('Tournament not found');

    tournamentModel.findById.mockResolvedValueOnce(buildTournament(TournamentFormat.SINGLE));
    await expect(handlers.unregisterDoublette('t1', 'd1')).rejects.toThrow('Doublettes are only available for DOUBLE tournaments');
  });

  it('rejects unregisterEquipe on missing tournament and format mismatch', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);

    tournamentModel.findById.mockResolvedValueOnce(null);
    await expect(handlers.unregisterEquipe('t1', 'e1')).rejects.toThrow('Tournament not found');

    tournamentModel.findById.mockResolvedValueOnce(buildTournament(TournamentFormat.DOUBLE));
    await expect(handlers.unregisterEquipe('t1', 'e1')).rejects.toThrow('Equipes are only available for TEAM_4_PLAYER tournaments');
  });

  it('rejects join/register doublette when refreshed group lookup returns null', async () => {
    const { handlers, tournamentModel } = buildContext();
    config.auth.enabled = false;

    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });

    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        passwordHash: passwordHash(GROUP_CODE_OK),
        isRegistered: false,
        captainPlayerId: 'captain-1',
        members: [member('captain-1')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.joinDoublette('t1', 'd1', { password: GROUP_CODE_OK }))
      .rejects.toThrow('Doublette not found');

    tournamentModel.getDoubletteById
      .mockResolvedValueOnce({
        id: 'd1',
        isRegistered: false,
        captainPlayerId: 'actor-1',
        members: [member('actor-1'), member('p2')],
      })
      .mockResolvedValueOnce(null);
    await expect(handlers.registerDoublette('t1', 'd1')).rejects.toThrow('Doublette not found');
  });

  it('rejects delete/add/remove doublette member on not-found branches', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'actor-1', email: 'actor@example.com' });

    tournamentModel.getDoubletteById.mockResolvedValueOnce(null);
    await expect(handlers.deleteDoublette('t1', 'd1')).rejects.toThrow('Doublette not found');

    tournamentModel.getDoubletteById.mockResolvedValueOnce(null);
    await expect(handlers.addDoubletteMember('t1', 'd1', { playerId: 'p2' })).rejects.toThrow('Doublette not found');

    tournamentModel.getDoubletteById.mockResolvedValueOnce(null);
    await expect(handlers.removeDoubletteMember('t1', 'd1', 'p2')).rejects.toThrow('Doublette not found');
  });

  it('rejects unregisterEquipe when refreshed equipe lookup returns null', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        captainPlayerId: 'captain-1',
        isRegistered: true,
        members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
      })
      .mockResolvedValueOnce(null);

    await expect(handlers.unregisterEquipe('t1', 'e1')).rejects.toThrow('Equipe not found');
  });

  it('rejects equipe ranking update in non-admin mode and covers admin add-member actor-id branch', async () => {
    const { handlers, tournamentModel, context } = buildContext();

    context.isAdminAction.mockReturnValue(false);
    tournamentModel.findPlayerByEmail.mockResolvedValue({ id: 'captain-1', email: 'actor@example.com' });
    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e1',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      members: [member('captain-1')],
    });
    await expect(handlers.updateEquipe('t1', 'e1', { skillLevel: SkillLevel.BEGINNER }))
      .rejects.toThrow('Only admin can update group ranking');

    context.isAdminAction.mockReturnValue(true);
    tournamentModel.getEquipeById
      .mockResolvedValueOnce({
        id: 'e1',
        captainPlayerId: null,
        isRegistered: false,
        members: [member('captain-1')],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        name: 'Equipe 1',
        captainPlayerId: null,
        isRegistered: false,
        registeredAt: null,
        createdAt: new Date(),
        members: [member('captain-1'), member('p2')],
      });
    tournamentModel.findEquipeMembershipByPlayer.mockResolvedValueOnce(null);

    const updated = await handlers.addEquipeMember('t1', 'e1', { playerId: 'p2' });
    expect(updated).toEqual(expect.objectContaining({ id: 'e1' }));
  });

  it('covers admin createDoublette branches for missing captain and full bootstrap early break', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.DOUBLE));

    tournamentModel.createDoublette.mockResolvedValueOnce({
      id: 'd-no-captain',
      name: 'No Captain',
      captainPlayerId: null,
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [],
    });
    const noCaptain = await handlers.createDoublette('t1', { name: 'No Captain', password: GROUP_CODE_OK });
    expect(noCaptain).toEqual(expect.objectContaining({ id: 'd-no-captain' }));

    tournamentModel.createDoublette.mockResolvedValueOnce({
      id: 'd-full',
      name: 'Full Duo',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });
    tournamentModel.getDoubletteById.mockResolvedValueOnce({
      id: 'd-full',
      name: 'Full Duo',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2')],
    });

    const full = await handlers.createDoublette('t1', {
      name: 'Full Duo',
      password: GROUP_CODE_OK,
      captainPlayerId: 'captain-1',
      memberPlayerIds: ['captain-1', 'p2', 'p3'],
    });
    expect(full).toEqual(expect.objectContaining({ id: 'd-full' }));
  });

  it('covers admin createEquipe branches for missing captain and full bootstrap early break', async () => {
    const { handlers, tournamentModel, context } = buildContext();
    config.auth.enabled = false;
    context.isAdminAction.mockReturnValue(true);
    tournamentModel.findById.mockResolvedValue(buildTournament(TournamentFormat.TEAM_4_PLAYER));

    tournamentModel.createEquipe.mockResolvedValueOnce({
      id: 'e-no-captain',
      name: 'No Captain Team',
      captainPlayerId: null,
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [],
    });
    const noCaptain = await handlers.createEquipe('t1', { name: 'No Captain Team', password: GROUP_CODE_TEAM_OK });
    expect(noCaptain).toEqual(expect.objectContaining({ id: 'e-no-captain' }));

    tournamentModel.createEquipe.mockResolvedValueOnce({
      id: 'e-full',
      name: 'Full Team',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });
    tournamentModel.getEquipeById.mockResolvedValueOnce({
      id: 'e-full',
      name: 'Full Team',
      captainPlayerId: 'captain-1',
      isRegistered: false,
      registeredAt: null,
      createdAt: new Date(),
      members: [member('captain-1'), member('p2'), member('p3'), member('p4')],
    });

    const full = await handlers.createEquipe('t1', {
      name: 'Full Team',
      password: GROUP_CODE_TEAM_OK,
      captainPlayerId: 'captain-1',
      memberPlayerIds: ['captain-1', 'p2', 'p3', 'p4'],
    });
    expect(full).toEqual(expect.objectContaining({ id: 'e-full' }));
  });
});
