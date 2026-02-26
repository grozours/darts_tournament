import { describe, expect, it, jest } from '@jest/globals';
import { createTournamentModelPlayers } from '../../src/models/tournament-model/players';

const build = () => {
  const prisma = {
    person: {
      findUnique: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
    },
    player: {
      findUnique: jest.fn() as any,
      create: jest.fn() as any,
      deleteMany: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
      update: jest.fn() as any,
      findFirst: jest.fn() as any,
    },
  };

  return {
    prisma,
    model: createTournamentModelPlayers(prisma as never),
  };
};

describe('tournament model players branches', () => {
  it('maps duplicate registration errors for register/create player', async () => {
    const { model, prisma } = build();
    prisma.player.create.mockRejectedValue({ code: 'P2002' });

    await expect(model.registerPlayer('t-1', 'p-1')).rejects.toMatchObject({ code: 'DUPLICATE_REGISTRATION' });
    await expect(model.createPlayer('t-1', {
      firstName: 'A',
      lastName: 'B',
    })).rejects.toMatchObject({ code: 'DUPLICATE_REGISTRATION' });
  });

  it('maps generic registration errors', async () => {
    const { model, prisma } = build();
    prisma.player.create.mockRejectedValue(new Error('db'));

    await expect(model.registerPlayer('t-1', 'p-1')).rejects.toMatchObject({ code: 'PLAYER_REGISTRATION_FAILED' });
    await expect(model.createPlayer('t-1', {
      firstName: 'A',
      lastName: 'B',
    })).rejects.toMatchObject({ code: 'PLAYER_REGISTRATION_FAILED' });
  });

  it('unregisters player and covers not-registered + generic error branches', async () => {
    const { model, prisma } = build();

    prisma.player.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(model.unregisterPlayer('t-1', 'p-1')).resolves.toBeUndefined();

    prisma.player.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(model.unregisterPlayer('t-1', 'p-1')).rejects.toMatchObject({ code: 'PLAYER_NOT_REGISTERED' });

    prisma.player.deleteMany.mockRejectedValueOnce(new Error('db'));
    await expect(model.unregisterPlayer('t-1', 'p-1')).rejects.toMatchObject({ code: 'PLAYER_UNREGISTRATION_FAILED' });
  });

  it('returns false/zero fallbacks on isPlayerRegistered and counts errors', async () => {
    const { model, prisma } = build();

    prisma.player.findUnique.mockRejectedValueOnce(new Error('x'));
    await expect(model.isPlayerRegistered('t-1', 'p-1')).resolves.toBe(false);

    prisma.player.count.mockRejectedValueOnce(new Error('x'));
    await expect(model.getParticipantCount('t-1')).resolves.toBe(0);

    prisma.player.count.mockRejectedValueOnce(new Error('x'));
    await expect(model.getCheckedInCount('t-1')).resolves.toBe(0);
  });

  it('maps participant rows with optional fields and handles fetch failures', async () => {
    const { model, prisma } = build();
    const registeredAt = new Date();

    prisma.player.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        personId: 'person-1',
        firstName: 'A',
        lastName: 'B',
        surname: 'S',
        teamName: 'T',
        email: 'a@b.c',
        phone: '123',
        skillLevel: 'EXPERT',
        registeredAt,
        checkedIn: true,
      },
      {
        id: 'p-2',
        personId: null,
        firstName: 'C',
        lastName: 'D',
        surname: null,
        teamName: null,
        email: null,
        phone: null,
        skillLevel: null,
        registeredAt,
        checkedIn: false,
      },
    ]);

    const participants = await model.getParticipants('t-1');
    expect(participants[0]).toEqual(expect.objectContaining({ personId: 'person-1', surname: 'S', teamName: 'T', email: 'a@b.c' }));
    expect(participants[1]).toEqual(expect.objectContaining({ playerId: 'p-2', name: 'C D' }));
    expect(participants[1]).not.toHaveProperty('email');

    prisma.player.findMany.mockRejectedValueOnce(new Error('x'));
    await expect(model.getParticipants('t-1')).rejects.toMatchObject({ code: 'PARTICIPANTS_FETCH_FAILED' });
  });

  it('maps orphan participants and handles fetch failure', async () => {
    const { model, prisma } = build();
    const registeredAt = new Date();

    prisma.player.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        personId: null,
        firstName: 'A',
        lastName: 'B',
        surname: null,
        teamName: null,
        email: null,
        phone: null,
        skillLevel: null,
        registeredAt,
        checkedIn: false,
      },
    ]);

    await expect(model.getOrphanParticipants()).resolves.toEqual([
      expect.objectContaining({ playerId: 'p-1', name: 'A B' }),
    ]);

    prisma.player.findMany.mockRejectedValueOnce(new Error('x'));
    await expect(model.getOrphanParticipants()).rejects.toMatchObject({ code: 'ORPHAN_PARTICIPANTS_FETCH_FAILED' });
  });

  it('maps updatePlayerCheckIn and updatePlayer prisma error codes', async () => {
    const { model, prisma } = build();
    const now = new Date();

    prisma.player.update.mockResolvedValueOnce({
      id: 'p-1',
      tournamentId: 't-1',
      firstName: 'A',
      lastName: 'B',
      registeredAt: now,
      checkedIn: true,
      isActive: true,
    });
    await expect(model.updatePlayerCheckIn('t-1', 'p-1', true)).resolves.toEqual(expect.objectContaining({ checkedIn: true }));

    prisma.player.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(model.updatePlayerCheckIn('t-1', 'p-1', true)).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });

    prisma.player.update.mockRejectedValueOnce(new Error('x'));
    await expect(model.updatePlayerCheckIn('t-1', 'p-1', true)).rejects.toMatchObject({ code: 'PLAYER_CHECKIN_UPDATE_FAILED' });

    prisma.player.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(model.updatePlayer('t-1', 'p-1', { firstName: 'Z' })).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });

    prisma.player.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(model.updatePlayer('t-1', 'p-1', { firstName: 'Z' })).rejects.toMatchObject({ code: 'DUPLICATE_REGISTRATION' });

    prisma.player.update.mockRejectedValueOnce(new Error('x'));
    await expect(model.updatePlayer('t-1', 'p-1', { firstName: 'Z' })).rejects.toMatchObject({ code: 'PLAYER_UPDATE_FAILED' });
  });

  it('findPlayerBySurname/teamName include optional excludePlayerId filter', async () => {
    const { model, prisma } = build();
    prisma.player.findFirst.mockResolvedValue({ id: 'p-1' });

    await model.findPlayerBySurname('t-1', 'Alpha');
    await model.findPlayerBySurname('t-1', 'Alpha', 'p-9');
    await model.findPlayerByTeamName('t-1', 'Team');
    await model.findPlayerByTeamName('t-1', 'Team', 'p-9');

    expect(prisma.player.findFirst).toHaveBeenCalledTimes(4);
  });

  it('maps person and player lookup/create/update generic failures', async () => {
    const { model, prisma } = build();

    prisma.person.findUnique.mockRejectedValueOnce(new Error('x'));
    await expect(model.findPersonByEmailAndPhone('a@b.c', '1')).rejects.toMatchObject({ code: 'PERSON_FETCH_FAILED' });

    prisma.person.create.mockRejectedValueOnce(new Error('x'));
    await expect(model.createPerson({ firstName: 'A', lastName: 'B' })).rejects.toMatchObject({ code: 'PERSON_CREATE_FAILED' });

    prisma.person.update.mockRejectedValueOnce(new Error('x'));
    await expect(model.updatePerson('person-1', { firstName: 'C' })).rejects.toMatchObject({ code: 'PERSON_UPDATE_FAILED' });

    prisma.player.findUnique.mockRejectedValueOnce(new Error('x'));
    await expect(model.getPlayerById('p-1')).rejects.toMatchObject({ code: 'PLAYER_FETCH_FAILED' });
  });
});
