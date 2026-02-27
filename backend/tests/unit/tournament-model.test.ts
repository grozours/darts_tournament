import { TournamentModel } from '../../src/models/tournament-model';
import { AppError } from '../../src/middleware/error-handler';
import { BracketType, TournamentFormat, DurationType, TournamentStatus } from '../../../shared/src/types';

type PrismaMock = {
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
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
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  bracket: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  person: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  player: {
    create: jest.Mock;
    deleteMany: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  doublette: {
    groupBy: jest.Mock;
  };
  equipe: {
    groupBy: jest.Mock;
  };
  match: {
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
      $executeRaw: jest.fn(),
      $transaction: jest.fn(async (steps) => steps),
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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      bracket: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      person: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      player: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      doublette: {
        groupBy: jest.fn(),
      },
      equipe: {
        groupBy: jest.fn(),
      },
      match: {
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
      personId: undefined,
      surname: undefined,
      teamName: undefined,
      email: undefined,
      phone: undefined,
      skillLevel: undefined,
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

  it('finds a person by email and phone', async () => {
    const person = { id: 'person-1' };
    prisma.person.findUnique.mockResolvedValue(person);

    const result = await model.findPersonByEmailAndPhone('ada@example.com', '123');

    expect(prisma.person.findUnique).toHaveBeenCalledWith({
      where: { email_phone: { email: 'ada@example.com', phone: '123' } },
    });
    expect(result).toBe(person);
  });

  it('maps person lookup errors', async () => {
    prisma.person.findUnique.mockRejectedValue(new Error('db'));

    await expect(
      model.findPersonByEmailAndPhone('ada@example.com', '123')
    ).rejects.toBeInstanceOf(AppError);
  });

  it('creates person records', async () => {
    prisma.person.create.mockResolvedValue({ id: 'person-2' });

    await expect(
      model.createPerson({ firstName: 'Ada', lastName: 'Lovelace' })
    ).resolves.toEqual({ id: 'person-2' });
  });

  it('maps person update errors', async () => {
    prisma.person.update.mockRejectedValue(new Error('db'));

    await expect(
      model.updatePerson('person-1', { firstName: 'Ada' })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns player lookups', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p-1' });

    await expect(model.getPlayerById('p-1')).resolves.toEqual({ id: 'p-1' });
  });

  it('maps player lookup errors', async () => {
    prisma.player.findUnique.mockRejectedValue(new Error('db'));

    await expect(model.getPlayerById('p-1')).rejects.toBeInstanceOf(AppError);
  });

  it('returns max target number', async () => {
    prisma.target.findFirst.mockResolvedValue({ targetNumber: 4 });

    await expect(model.getMaxTargetNumber('t-1')).resolves.toBe(4);
  });

  it('creates targets when count is positive', async () => {
    await model.createTargetsForTournament('t-1', 3, 2);

    expect(prisma.target.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { tournamentId: 't-1', targetNumber: 3, targetCode: 'target3' },
          { tournamentId: 't-1', targetNumber: 4, targetCode: 'target4' },
        ],
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

  it('updates status with raw fallback for enum errors', async () => {
    const validationError = new Error('validation');
    validationError.name = 'PrismaClientValidationError';
    prisma.tournament.update.mockRejectedValue(validationError);
    prisma.tournament.findUnique.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.LIVE,
    });

    const result = await model.updateStatus('t-1', TournamentStatus.LIVE);

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.status).toBe(TournamentStatus.LIVE);
  });

  it('throws when raw status update cannot find tournament', async () => {
    const validationError = new Error('validation');
    validationError.name = 'PrismaClientValidationError';
    prisma.tournament.update.mockRejectedValue(validationError);
    prisma.tournament.findUnique.mockResolvedValue(null);

    await expect(
      model.updateStatus('t-1', TournamentStatus.LIVE)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('maps duplicate player updates', async () => {
    prisma.player.update.mockRejectedValue({ code: 'P2002' });

    await expect(
      model.updatePlayer('t-1', 'p-1', { firstName: 'Ada' })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('finds players by surname and team name', async () => {
    prisma.player.findFirst.mockResolvedValueOnce({ id: 'p-1' }).mockResolvedValueOnce({ id: 'p-2' });

    await expect(model.findPlayerBySurname('t-1', 'Smith', 'p-3')).resolves.toEqual({ id: 'p-1' });
    await expect(model.findPlayerByTeamName('t-1', 'A-Team')).resolves.toEqual({ id: 'p-2' });

    expect(prisma.player.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        tournamentId: 't-1',
        surname: { equals: 'Smith', mode: 'insensitive' },
        id: { not: 'p-3' },
      },
    });
    expect(prisma.player.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tournamentId: 't-1',
        teamName: { equals: 'A-Team', mode: 'insensitive' },
      },
    });
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

  it('finds tournament by id and maps findById errors', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(baseTournament);
    await expect(model.findById('t-1')).resolves.toEqual(expect.objectContaining({ id: 't-1' }));

    prisma.tournament.findUnique.mockRejectedValueOnce(new Error('db'));
    await expect(model.findById('t-1')).rejects.toBeInstanceOf(AppError);
  });

  it('returns live view and maps live view errors', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({ id: 't-1', poolStages: [], brackets: [] });
    await expect(model.findLiveView('t-1')).resolves.toEqual(expect.objectContaining({ id: 't-1' }));

    prisma.tournament.findUnique.mockRejectedValueOnce(new Error('db'));
    await expect(model.findLiveView('t-1')).rejects.toBeInstanceOf(AppError);
  });

  it('findAll applies filters, pagination and participant counts', async () => {
    prisma.tournament.findMany.mockResolvedValueOnce([baseTournament]);
    prisma.tournament.count.mockResolvedValueOnce(1);
    prisma.player.groupBy = jest.fn().mockResolvedValueOnce([
      { tournamentId: 't-1', _count: { _all: 3 } },
    ]);
    prisma.doublette.groupBy = jest.fn().mockResolvedValueOnce([]);
    prisma.equipe.groupBy = jest.fn().mockResolvedValueOnce([]);

    const result = await model.findAll({
      status: TournamentStatus.DRAFT,
      format: TournamentFormat.SINGLE,
      name: 'Test',
      page: 2,
      limit: 5,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(prisma.tournament.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5,
      take: 5,
      orderBy: { name: 'asc' },
    }));
    expect(result.tournaments[0]?.currentParticipants).toBe(3);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  it('findAll supports excludeDraft and maps errors', async () => {
    prisma.tournament.findMany.mockResolvedValueOnce([]);
    prisma.tournament.count.mockResolvedValueOnce(0);
    prisma.doublette.groupBy = jest.fn().mockResolvedValueOnce([]);
    prisma.equipe.groupBy = jest.fn().mockResolvedValueOnce([]);

    await expect(model.findAll({ excludeDraft: true })).resolves.toEqual({
      tournaments: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    prisma.tournament.findMany.mockRejectedValueOnce(new Error('db'));
    await expect(model.findAll()).rejects.toBeInstanceOf(AppError);
  });

  it('findAll returns registered group slots for grouped formats', async () => {
    prisma.tournament.findMany.mockResolvedValueOnce([
      {
        ...baseTournament,
        format: TournamentFormat.DOUBLE,
      },
    ]);
    prisma.tournament.count.mockResolvedValueOnce(1);
    prisma.player.groupBy = jest.fn().mockResolvedValueOnce([
      { tournamentId: 't-1', _count: { _all: 8 } },
    ]);
    prisma.doublette.groupBy = jest.fn().mockResolvedValueOnce([
      { tournamentId: 't-1', _count: { _all: 4 } },
    ]);
    prisma.equipe.groupBy = jest.fn().mockResolvedValueOnce([]);

    const result = await model.findAll();
    expect(result.tournaments[0]?.currentParticipants).toBe(4);
  });

  it('maps target range and target list queries with error branches', async () => {
    prisma.tournament.findMany.mockResolvedValueOnce([
      { id: 't-1', name: 'One', targetStartNumber: null, targetCount: 2, shareTargets: null },
    ]);
    prisma.target.findMany.mockResolvedValueOnce([{ id: 'ta', targetNumber: 1 }]);

    await expect(model.getTargetRanges('t-2')).resolves.toEqual([
      { id: 't-1', name: 'One', targetStartNumber: 1, targetCount: 2, shareTargets: true },
    ]);
    await expect(model.getTargetsForTournament('t-1')).resolves.toEqual([{ id: 'ta', targetNumber: 1 }]);

    prisma.tournament.findMany.mockRejectedValueOnce(new Error('db'));
    await expect(model.getTargetRanges()).rejects.toBeInstanceOf(AppError);

    prisma.target.findMany.mockRejectedValueOnce(new Error('db'));
    await expect(model.getTargetsForTournament('t-1')).rejects.toBeInstanceOf(AppError);
  });

  it('counts match usage for targets and handles errors', async () => {
    prisma.match.count.mockResolvedValueOnce(4);
    await expect(model.getMatchCountForTargets(['ta', 'tb'])).resolves.toBe(4);
    await expect(model.getMatchCountForTargets([])).resolves.toBe(0);

    prisma.match.count.mockRejectedValueOnce(new Error('db'));
    await expect(model.getMatchCountForTargets(['ta'])).rejects.toBeInstanceOf(AppError);
  });

  it('rebuilds targets with update/delete/create branches', async () => {
    prisma.target.findMany
      .mockResolvedValueOnce([
        { id: 'ta', targetNumber: 1 },
        { id: 'tb', targetNumber: 2 },
        { id: 'tc', targetNumber: 3 },
      ])
      .mockResolvedValueOnce([{ id: 'ta', targetNumber: 1 }]);

    await model.rebuildTargetsForTournament('t-1', 10, 2);
    await model.rebuildTargetsForTournament('t-1', 20, 3);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.target.update).toHaveBeenCalled();
    expect(prisma.target.deleteMany).toHaveBeenCalled();
    expect(prisma.target.createMany).toHaveBeenCalled();
  });

  it('updates logo and maps logo update errors', async () => {
    prisma.tournament.update.mockResolvedValueOnce({ ...baseTournament, logoUrl: '/uploads/logo.png' });
    await expect(model.updateLogo('t-1', '/uploads/logo.png')).resolves.toEqual(expect.objectContaining({ id: 't-1' }));

    prisma.tournament.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(model.updateLogo('missing', '/uploads/logo.png')).rejects.toBeInstanceOf(AppError);

    prisma.tournament.update.mockRejectedValueOnce(new Error('db'));
    await expect(model.updateLogo('t-1', '/uploads/logo.png')).rejects.toBeInstanceOf(AppError);
  });

  it('maps additional updateStatus branches', async () => {
    prisma.tournament.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(model.updateStatus('missing', TournamentStatus.LIVE)).rejects.toBeInstanceOf(AppError);

    prisma.tournament.update.mockRejectedValueOnce(new Error('db'));
    await expect(model.updateStatus('t-1', TournamentStatus.LIVE)).rejects.toBeInstanceOf(AppError);
  });

  it('maps date range failures and generic isEditable failures', async () => {
    prisma.tournament.findMany.mockRejectedValueOnce(new Error('db'));
    await expect(model.findByDateRange(new Date(), new Date())).rejects.toBeInstanceOf(AppError);

    prisma.tournament.findUnique.mockRejectedValueOnce(new Error('db'));
    await expect(model.isEditable('t-1')).rejects.toBeInstanceOf(AppError);
  });
});
