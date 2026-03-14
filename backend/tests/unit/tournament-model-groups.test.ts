import { describe, expect, it, jest } from '@jest/globals';
import { createTournamentModelGroups } from '../../src/models/tournament-model/groups';

const TEST_HASH = 'test-hash';

const buildPrisma = () => ({
  doublette: {
    findMany: jest.fn().mockImplementation(async () => []),
    findFirst: jest.fn().mockImplementation(async () => null),
    count: jest.fn().mockImplementation(async () => 0),
    create: jest.fn().mockImplementation(async () => ({ id: 'd1' })),
    update: jest.fn().mockImplementation(async () => ({ id: 'd1' })),
    delete: jest.fn().mockImplementation(async () => ({ id: 'd1' })),
  },
  doubletteMember: {
    create: jest.fn().mockImplementation(async () => ({ id: 'dm1' })),
    deleteMany: jest.fn().mockImplementation(async () => ({ count: 1 })),
    findFirst: jest.fn().mockImplementation(async () => null),
  },
  equipe: {
    findMany: jest.fn().mockImplementation(async () => []),
    findFirst: jest.fn().mockImplementation(async () => null),
    count: jest.fn().mockImplementation(async () => 0),
    create: jest.fn().mockImplementation(async () => ({ id: 'e1' })),
    update: jest.fn().mockImplementation(async () => ({ id: 'e1' })),
    delete: jest.fn().mockImplementation(async () => ({ id: 'e1' })),
  },
  equipeMember: {
    create: jest.fn().mockImplementation(async () => ({ id: 'em1' })),
    deleteMany: jest.fn().mockImplementation(async () => ({ count: 1 })),
    findFirst: jest.fn().mockImplementation(async () => null),
  },
  player: {
    findMany: jest.fn().mockImplementation(async () => []),
  },
});

describe('tournament-model groups', () => {
  it('runs all doublette and equipe model operations on success paths', async () => {
    const prisma = buildPrisma();
    const groups = createTournamentModelGroups(prisma as never);

    await expect(groups.countRegisteredDoublettes('t1')).resolves.toBe(0);
    await expect(groups.countRegisteredEquipes('t1')).resolves.toBe(0);

    await expect(groups.listDoublettes('t1', 'ab')).resolves.toEqual([]);
    await expect(groups.getDoubletteById('t1', 'd1')).resolves.toBeNull();
    await expect(groups.createDoublette({ tournamentId: 't1', captainPlayerId: 'p1', name: 'D1', passwordHash: TEST_HASH })).resolves.toEqual({ id: 'd1' });
    await expect(groups.updateDoublettePassword('d1', 'h2')).resolves.toEqual({ id: 'd1' });
    await expect(groups.updateDoublette('d1', { name: 'new' })).resolves.toEqual({ id: 'd1' });
    await expect(groups.addDoubletteMember('d1', 'p2')).resolves.toEqual({ id: 'dm1' });
    await expect(groups.removeDoubletteMember('d1', 'p2')).resolves.toBeUndefined();
    await expect(groups.updateDoubletteCaptain('d1', 'p2')).resolves.toEqual({ id: 'd1' });
    await expect(groups.markDoubletteRegistered('d1')).resolves.toEqual({ id: 'd1' });
    await expect(groups.deleteDoublette('d1')).resolves.toBeUndefined();
    await expect(groups.findDoubletteMembershipByPlayer('t1', 'p1')).resolves.toBeNull();

    await expect(groups.listEquipes('t1', 'ab')).resolves.toEqual([]);
    await expect(groups.getEquipeById('t1', 'e1')).resolves.toBeNull();
    await expect(groups.createEquipe({ tournamentId: 't1', captainPlayerId: 'p1', name: 'E1', passwordHash: TEST_HASH })).resolves.toEqual({ id: 'e1' });
    await expect(groups.updateEquipePassword('e1', 'h2')).resolves.toEqual({ id: 'e1' });
    await expect(groups.updateEquipe('e1', { name: 'new' })).resolves.toEqual({ id: 'e1' });
    await expect(groups.addEquipeMember('e1', 'p2')).resolves.toEqual({ id: 'em1' });
    await expect(groups.removeEquipeMember('e1', 'p2')).resolves.toBeUndefined();
    await expect(groups.updateEquipeCaptain('e1', 'p2')).resolves.toEqual({ id: 'e1' });
    await expect(groups.markEquipeRegistered('e1')).resolves.toEqual({ id: 'e1' });
    await expect(groups.deleteEquipe('e1')).resolves.toBeUndefined();
    await expect(groups.findEquipeMembershipByPlayer('t1', 'p1')).resolves.toBeNull();

    await expect(groups.searchPlayersForGroups('t1', 'ana')).resolves.toEqual([]);

    const searchArgs = prisma.player.findMany.mock.calls.at(-1)?.[0] as {
      take?: number;
      where?: {
        AND?: Array<
        | { OR: Array<{ tournamentId: null } | { tournamentId: { not: string } }> }
        | { NOT: { person: { players: { some: { tournamentId: string } } } } }
        | { doubletteMemberships: { none: { doublette: { tournamentId: string } } } }
        | { equipeMemberships: { none: { equipe: { tournamentId: string } } } }
        >;
      };
    };

    expect(searchArgs?.take).toBe(30);
    expect(searchArgs?.where?.AND).toEqual(expect.arrayContaining([
      {
        OR: [
          { tournamentId: null },
          { tournamentId: { not: 't1' } },
        ],
      },
      {
        NOT: {
          person: {
            players: {
              some: {
                tournamentId: 't1',
              },
            },
          },
        },
      },
      {
        doubletteMemberships: {
          none: {
            doublette: {
              tournamentId: 't1',
            },
          },
        },
      },
      {
        equipeMemberships: {
          none: {
            equipe: {
              tournamentId: 't1',
            },
          },
        },
      },
    ]));
  });

  it('maps unique-constraint errors for create methods', async () => {
    const prisma = buildPrisma();
    const duplicateError = Object.assign(new Error('Duplicate key'), { code: 'P2002' });

    prisma.doublette.create.mockImplementationOnce(async () => {
      throw duplicateError;
    });
    prisma.equipe.create.mockImplementationOnce(async () => {
      throw duplicateError;
    });

    const groups = createTournamentModelGroups(prisma as never);

    await expect(groups.createDoublette({ tournamentId: 't1', captainPlayerId: 'p1', name: 'D1', passwordHash: TEST_HASH }))
      .rejects.toThrow('Doublette name is already used in this tournament');

    await expect(groups.createEquipe({ tournamentId: 't1', captainPlayerId: 'p1', name: 'E1', passwordHash: TEST_HASH }))
      .rejects.toThrow('Equipe name is already used in this tournament');
  });

  it('covers list branches without search term', async () => {
    const prisma = buildPrisma();
    const groups = createTournamentModelGroups(prisma as never);

    await groups.listDoublettes('t1');
    await groups.listEquipes('t1');

    expect(prisma.doublette.findMany).toHaveBeenCalled();
    expect(prisma.equipe.findMany).toHaveBeenCalled();
  });

  it('maps generic model errors across group operations', async () => {
    const prisma = buildPrisma();
    const groups = createTournamentModelGroups(prisma as never);

    prisma.doublette.findMany.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.listDoublettes('t1', 's')).rejects.toThrow('Failed to fetch doublettes');

    prisma.doublette.count.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.countRegisteredDoublettes('t1')).rejects.toThrow('Failed to count registered doublettes');

    prisma.doublette.findFirst.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.getDoubletteById('t1', 'd1')).rejects.toThrow('Failed to fetch doublette');

    prisma.doublette.update.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.updateDoublettePassword('d1', 'h')).rejects.toThrow('Failed to update doublette password');

    prisma.doubletteMember.create.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.addDoubletteMember('d1', 'p1')).rejects.toThrow('Failed to join doublette');

    prisma.doubletteMember.deleteMany.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.removeDoubletteMember('d1', 'p1')).rejects.toThrow('Failed to leave doublette');

    prisma.doublette.update.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.markDoubletteRegistered('d1')).rejects.toThrow('Failed to register doublette');

    prisma.doublette.delete.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.deleteDoublette('d1')).rejects.toThrow('Failed to delete doublette');

    prisma.equipe.findMany.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.listEquipes('t1', 's')).rejects.toThrow('Failed to fetch equipes');

    prisma.equipe.count.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.countRegisteredEquipes('t1')).rejects.toThrow('Failed to count registered equipes');

    prisma.equipe.findFirst.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.getEquipeById('t1', 'e1')).rejects.toThrow('Failed to fetch equipe');

    prisma.equipe.update.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.updateEquipePassword('e1', 'h')).rejects.toThrow('Failed to update equipe password');

    prisma.equipeMember.create.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.addEquipeMember('e1', 'p1')).rejects.toThrow('Failed to join equipe');

    prisma.equipeMember.deleteMany.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.removeEquipeMember('e1', 'p1')).rejects.toThrow('Failed to leave equipe');

    prisma.equipe.update.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.markEquipeRegistered('e1')).rejects.toThrow('Failed to register equipe');

    prisma.equipe.delete.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.deleteEquipe('e1')).rejects.toThrow('Failed to delete equipe');

    prisma.player.findMany.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await expect(groups.searchPlayersForGroups('t1', 'ana')).rejects.toThrow('Failed to search players');
  });
});
