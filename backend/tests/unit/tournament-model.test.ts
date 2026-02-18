import { TournamentModel } from '../../src/models/tournament-model';
import { AppError } from '../../src/middleware/error-handler';
import { BracketType, TournamentFormat, DurationType, TournamentStatus } from '../../../shared/src/types';

type PrismaMock = {
  tournament: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    groupBy: jest.Mock;
    aggregate: jest.Mock;
    count: jest.Mock;
  };
  target: {
    createMany: jest.Mock;
  };
  bracket: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  player: {
    create: jest.Mock;
    deleteMany: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

const baseTournament = {
  id: 't-1',
  name: 'Test Tournament',
  format: TournamentFormat.SINGLE,
  durationType: DurationType.FULL_DAY,
  status: TournamentStatus.DRAFT,
  startTime: new Date('2026-01-01T10:00:00Z'),
  endTime: new Date('2026-01-01T18:00:00Z'),
  totalParticipants: 8,
  targetCount: 2,
  createdAt: new Date('2026-01-01T09:00:00Z'),
  historicalFlag: false,
};

describe('tournament model', () => {
  let prisma: PrismaMock;
  let model: TournamentModel;

  beforeEach(() => {
    prisma = {
      tournament: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      target: {
        createMany: jest.fn(),
      },
      bracket: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      player: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    model = new TournamentModel(prisma as unknown as never);
  });

  it('creates tournaments and targets', async () => {
    prisma.tournament.create.mockResolvedValue(baseTournament);
    prisma.target.createMany.mockResolvedValue({ count: 2 });

    const result = await model.create({
      name: 'Test Tournament',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: baseTournament.startTime,
      endTime: baseTournament.endTime,
      totalParticipants: 8,
      targetCount: 2,
    });

    expect(prisma.tournament.create).toHaveBeenCalled();
    expect(prisma.target.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) })
    );
    expect(result).toEqual(expect.objectContaining({ id: 't-1', name: 'Test Tournament' }));
  });

  it('throws when create hits unique constraint', async () => {
    prisma.tournament.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      model.create({
        name: 'Test Tournament',
        format: TournamentFormat.SINGLE,
        durationType: DurationType.FULL_DAY,
        startTime: baseTournament.startTime,
        endTime: baseTournament.endTime,
        totalParticipants: 8,
        targetCount: 2,
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('updates tournaments', async () => {
    prisma.tournament.update.mockResolvedValue(baseTournament);

    const result = await model.update('t-1', { name: 'Updated' });

    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't-1' } })
    );
    expect(result.name).toBe('Test Tournament');
  });

  it('maps update not found to AppError', async () => {
    prisma.tournament.update.mockRejectedValue({ code: 'P2025' });

    await expect(model.update('t-1', { name: 'Updated' })).rejects.toBeInstanceOf(AppError);
  });

  it('deletes tournaments', async () => {
    prisma.tournament.delete.mockResolvedValue(baseTournament);

    await expect(model.delete('t-1')).resolves.toBe(true);
  });

  it('maps delete not found to AppError', async () => {
    prisma.tournament.delete.mockRejectedValue({ code: 'P2025' });

    await expect(model.delete('t-1')).rejects.toBeInstanceOf(AppError);
  });

  it('returns editable status for draft tournaments', async () => {
    prisma.tournament.findUnique.mockResolvedValue({ status: TournamentStatus.DRAFT });

    await expect(model.isEditable('t-1')).resolves.toBe(true);
  });

  it('returns false for non-editable tournaments', async () => {
    prisma.tournament.findUnique.mockResolvedValue({ status: TournamentStatus.FINISHED });

    await expect(model.isEditable('t-1')).resolves.toBe(false);
  });

  it('throws when editable check cannot find tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValue(undefined);

    await expect(model.isEditable('t-1')).rejects.toBeInstanceOf(AppError);
  });

  it('registers players successfully', async () => {
    prisma.player.create.mockResolvedValue({ id: 'p-1' });

    await expect(model.registerPlayer('t-1', 'p-1')).resolves.toBeUndefined();
    expect(prisma.player.create).toHaveBeenCalled();
  });

  it('maps duplicate registration errors', async () => {
    prisma.player.create.mockRejectedValue({ code: 'P2002' });

    await expect(model.registerPlayer('t-1', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('creates players with details', async () => {
    prisma.player.create.mockResolvedValue({
      id: 'p-2',
      tournamentId: 't-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      registeredAt: new Date('2026-01-02T10:00:00Z'),
      isActive: true,
      checkedIn: false,
      personId: null,
      surname: null,
      teamName: null,
      email: null,
      phone: null,
      skillLevel: null,
    });

    const result = await model.createPlayer('t-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'p-2',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
    );
  });

  it('unregisters players when count is positive', async () => {
    prisma.player.deleteMany.mockResolvedValue({ count: 1 });

    await expect(model.unregisterPlayer('t-1', 'p-1')).resolves.toBeUndefined();
  });

  it('throws when unregistering missing players', async () => {
    prisma.player.deleteMany.mockResolvedValue({ count: 0 });

    await expect(model.unregisterPlayer('t-1', 'p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('checks player registration status', async () => {
    prisma.player.findUnique.mockResolvedValue({ tournamentId: 't-1' });

    await expect(model.isPlayerRegistered('t-1', 'p-1')).resolves.toBe(true);
    await expect(model.isPlayerRegistered('t-2', 'p-1')).resolves.toBe(false);
  });

  it('returns false on registration lookup errors', async () => {
    prisma.player.findUnique.mockRejectedValue(new Error('db')); 

    await expect(model.isPlayerRegistered('t-1', 'p-1')).resolves.toBe(false);
  });

  it('returns zero participant counts on errors', async () => {
    prisma.player.count.mockRejectedValue(new Error('db'));

    await expect(model.getParticipantCount('t-1')).resolves.toBe(0);
    await expect(model.getCheckedInCount('t-1')).resolves.toBe(0);
  });

  it('maps bracket update not found', async () => {
    prisma.bracket.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      model.updateBracket('b-1', { name: 'Bracket' })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns overall stats', async () => {
    prisma.tournament.count.mockResolvedValue(10);
    prisma.tournament.groupBy
      .mockResolvedValueOnce([
        { status: 'DRAFT', _count: { status: 2 } },
        { status: 'FINISHED', _count: { status: 3 } },
        { status: 'LIVE', _count: { status: 1 } },
      ])
      .mockResolvedValueOnce([
        { format: 'SINGLE', _count: { format: 6 } },
        { format: 'DOUBLE', _count: { format: 4 } },
      ]);
    prisma.tournament.aggregate.mockResolvedValue({
      _sum: { totalParticipants: 40 },
      _avg: { totalParticipants: 4 },
      _max: { totalParticipants: 8 },
      _min: { totalParticipants: 2 },
    });
    prisma.player.count.mockResolvedValue(12);
    prisma.tournament.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

    const stats = await model.getOverallStats();

    expect(stats.overview.totalTournaments).toBe(10);
    expect(stats.participants.totalCapacity).toBe(40);
    expect(stats.distribution.byFormat.length).toBe(2);
  });

  it('maps date range results', async () => {
    prisma.tournament.findMany.mockResolvedValue([baseTournament]);

    const results = await model.findByDateRange(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-02-01T00:00:00Z')
    );

    expect(prisma.tournament.findMany).toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  it('creates brackets', async () => {
    prisma.bracket.create.mockResolvedValue({ id: 'b-1' });

    await expect(
      model.createBracket('t-1', {
        name: 'Bracket',
        bracketType: BracketType.SINGLE_ELIMINATION,
        totalRounds: 3,
      })
    ).resolves.toEqual({ id: 'b-1' });
  });

  it('deletes brackets', async () => {
    prisma.bracket.delete.mockResolvedValue({ id: 'b-1' });

    await expect(model.deleteBracket('b-1')).resolves.toBeUndefined();
  });
});
