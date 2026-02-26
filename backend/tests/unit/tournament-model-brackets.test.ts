import { MatchStatus } from '../../../shared/src/types';
import { createTournamentModelBrackets } from '../../src/models/tournament-model/brackets';

const buildPrisma = () => ({
  bracketEntry: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  match: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
  target: {
    updateMany: jest.fn(),
  },
  score: {
    deleteMany: jest.fn(),
  },
  playerMatch: {
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  bracket: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  bracketTarget: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(async (steps) => steps),
});

describe('tournament model brackets', () => {
  it('returns early for empty createBracketEntries', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.createBracketEntries([]);
    expect(prisma.bracketEntry.createMany).not.toHaveBeenCalled();
  });

  it('returns 0 on count failures', async () => {
    const prisma = buildPrisma();
    prisma.match.count.mockRejectedValueOnce(new Error('boom'));
    prisma.match.count.mockRejectedValueOnce(new Error('boom'));
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getMatchCountForBracket('b1')).resolves.toBe(0);
    await expect(handlers.getStartedBracketMatchCount('t1')).resolves.toBe(0);
  });

  it('resets bracket matches with populated transaction branches', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany.mockResolvedValue([
      { id: 'm1', roundNumber: 1, targetId: 'target-1' },
      { id: 'm2', roundNumber: 2, targetId: null },
    ]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.resetBracketMatches('b1');
    const transaction = prisma.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(transaction.length).toBeGreaterThanOrEqual(4);
  });

  it('throws reset error when reset transaction fails', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany.mockResolvedValue([]);
    prisma.$transaction.mockRejectedValue(new Error('tx fail'));
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.resetBracketMatches('b1')).rejects.toThrow('Failed to reset bracket matches');
  });

  it('handles createBracketMatchWithSlots empty and error branches', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.createBracketMatchWithSlots('t1', 'b1', 1, 1, []);
    expect(prisma.match.create).not.toHaveBeenCalled();

    prisma.match.create.mockRejectedValue(new Error('create fail'));
    await expect(handlers.createBracketMatchWithSlots('t1', 'b1', 1, 1, [{ playerId: 'p1', playerPosition: 1 }]))
      .rejects.toThrow('Failed to create bracket match');
  });

  it('throws for setBracketMatchPlayers errors', async () => {
    const prisma = buildPrisma();
    prisma.$transaction.mockRejectedValue(new Error('tx fail'));
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.setBracketMatchPlayers('m1', ['p1', 'p2']))
      .rejects.toThrow('Failed to seed bracket match players');
  });

  it('throws for setBracketMatchPlayerPosition errors', async () => {
    const prisma = buildPrisma();
    prisma.$transaction.mockRejectedValue(new Error('tx fail'));
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.setBracketMatchPlayerPosition('m1', 'p1', 1))
      .rejects.toThrow('Failed to seed bracket match player');
  });

  it('queries started matches with explicit bracketId branch', async () => {
    const prisma = buildPrisma();
    prisma.match.count.mockResolvedValue(2);
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.getStartedBracketMatchCount('t1', 'b1');
    expect(prisma.match.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bracketId: 'b1', status: { not: MatchStatus.SCHEDULED } }),
    }));
  });

  it('creates and deletes bracket entries on non-empty payloads', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.createBracketEntries([
      { bracketId: 'b1', playerId: 'p1', seedNumber: 1, currentRound: 1 },
    ]);
    await handlers.deleteBracketEntriesForBracket('b1');

    expect(prisma.bracketEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [{ bracketId: 'b1', playerId: 'p1', seedNumber: 1, currentRound: 1 }],
      skipDuplicates: true,
    }));
    expect(prisma.bracketEntry.deleteMany).toHaveBeenCalledWith({ where: { bracketId: 'b1' } });
  });

  it('fetches bracket matches and maps fetch errors', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany.mockResolvedValueOnce([{ id: 'm1' }]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBracketMatches('b1')).resolves.toEqual([{ id: 'm1' }]);

    prisma.match.findMany.mockRejectedValueOnce(new Error('fail'));
    await expect(handlers.getBracketMatches('b1')).rejects.toThrow('Failed to fetch bracket matches');
  });

  it('creates bracket matches and empty bracket matches', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.createBracketMatches('t1', 'b1', [
      { roundNumber: 1, matchNumber: 1, playerIds: ['p1', 'p2'] },
    ], 'BO3');
    await handlers.createEmptyBracketMatches('t1', 'b1', [
      { roundNumber: 2, matchNumber: 1 },
    ], { 2: 'BO5' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    await handlers.createBracketMatches('t1', 'b1', []);
    await handlers.createEmptyBracketMatches('t1', 'b1', []);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('fetches bracket by id and maps fetch errors', async () => {
    const prisma = buildPrisma();
    prisma.bracket.findUnique.mockResolvedValueOnce({ id: 'b1' });
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBracketById('b1')).resolves.toEqual({ id: 'b1' });

    prisma.bracket.findUnique.mockRejectedValueOnce(new Error('fail'));
    await expect(handlers.getBracketById('b1')).rejects.toThrow('Failed to fetch bracket');
  });

  it('fetches bracket matches by round and with players', async () => {
    const prisma = buildPrisma();
    prisma.match.findMany
      .mockResolvedValueOnce([{ id: 'm1', matchNumber: 1 }])
      .mockResolvedValueOnce([{ id: 'm2', playerMatches: [] }]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBracketMatchesByRound('b1', 1)).resolves.toEqual([{ id: 'm1', matchNumber: 1 }]);
    await expect(handlers.getBracketMatchesByRoundWithPlayers('b1', 1)).resolves.toEqual([{ id: 'm2', playerMatches: [] }]);

    prisma.match.findMany.mockRejectedValueOnce(new Error('fail-round'));
    await expect(handlers.getBracketMatchesByRound('b1', 1)).rejects.toThrow('Failed to fetch bracket matches');

    prisma.match.findMany.mockRejectedValueOnce(new Error('fail-round-players'));
    await expect(handlers.getBracketMatchesByRoundWithPlayers('b1', 1)).rejects.toThrow('Failed to fetch bracket matches');
  });

  it('returns zero on bracket per-round and entry count failures', async () => {
    const prisma = buildPrisma();
    prisma.match.count.mockRejectedValueOnce(new Error('boom'));
    prisma.bracketEntry.count.mockRejectedValueOnce(new Error('boom'));
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBracketMatchCountByRound('b1', 1)).resolves.toBe(0);
    await expect(handlers.getBracketEntryCount('b1')).resolves.toBe(0);
  });

  it('maps brackets with target ids and started-match flag', async () => {
    const prisma = buildPrisma();
    prisma.bracket.findMany.mockResolvedValueOnce([
      {
        id: 'b1',
        bracketTargets: [{ targetId: 'target-1' }],
      },
      {
        id: 'b2',
        bracketTargets: [],
      },
    ]);
    prisma.match.groupBy.mockResolvedValueOnce([
      { bracketId: 'b1', _count: { _all: 2 } },
    ]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBrackets('t1')).resolves.toEqual([
      expect.objectContaining({ id: 'b1', targetIds: ['target-1'], hasStartedMatches: true }),
      expect.objectContaining({ id: 'b2', targetIds: [], hasStartedMatches: false }),
    ]);
  });

  it('handles empty-bracket and error branches for getBrackets', async () => {
    const prisma = buildPrisma();
    prisma.bracket.findMany.mockResolvedValueOnce([]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBrackets('t1')).resolves.toEqual([]);
    expect(prisma.match.groupBy).not.toHaveBeenCalled();

    prisma.bracket.findMany.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers.getBrackets('t1')).rejects.toThrow('Failed to fetch brackets');
  });

  it('fetches bracket target ids and conflicts and maps errors', async () => {
    const prisma = buildPrisma();
    prisma.bracketTarget.findMany
      .mockResolvedValueOnce([{ targetId: 't1' }, { targetId: 't2' }])
      .mockResolvedValueOnce([{ bracketId: 'b2', targetId: 't2' }]);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.getBracketTargetIds('b1')).resolves.toEqual(['t1', 't2']);
    await expect(handlers.getBracketTargetConflicts(['t1', 't2'], 'b1')).resolves.toEqual([{ bracketId: 'b2', targetId: 't2' }]);
    await expect(handlers.getBracketTargetConflicts([])).resolves.toEqual([]);

    prisma.bracketTarget.findMany.mockRejectedValueOnce(new Error('boom-targets'));
    await expect(handlers.getBracketTargetIds('b1')).rejects.toThrow('Failed to fetch bracket targets');

    prisma.bracketTarget.findMany.mockRejectedValueOnce(new Error('boom-conflicts'));
    await expect(handlers.getBracketTargetConflicts(['t1'])).rejects.toThrow('Failed to fetch bracket target conflicts');
  });

  it('sets bracket targets with and without new targets and maps errors', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.setBracketTargets('b1', ['t1', 't2']);
    await handlers.setBracketTargets('b1', []);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    prisma.$transaction.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers.setBracketTargets('b1', ['t1'])).rejects.toThrow('Failed to update bracket targets');
  });

  it('creates bracket with optional fields and maps create errors', async () => {
    const prisma = buildPrisma();
    prisma.bracket.create.mockResolvedValueOnce({ id: 'b1' });
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.createBracket('t1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 3,
      roundMatchFormats: { 1: 'BO3' } as never,
      inParallelWith: ['stage:1'] as never,
    })).resolves.toEqual({ id: 'b1' });

    prisma.bracket.create.mockRejectedValueOnce(new Error('create-fail'));
    await expect(handlers.createBracket('t1', {
      name: 'Main',
      bracketType: 'SINGLE' as never,
      totalRounds: 3,
    })).rejects.toThrow('Failed to create bracket');
  });

  it('updates and deletes brackets with not-found and generic error mapping', async () => {
    const prisma = buildPrisma();
    prisma.bracket.update.mockResolvedValueOnce({ id: 'b1' });
    prisma.bracket.delete.mockResolvedValueOnce(undefined);
    const handlers = createTournamentModelBrackets(prisma as never);

    await expect(handlers.updateBracket('b1', { name: 'Updated' })).resolves.toEqual({ id: 'b1' });
    await expect(handlers.deleteBracket('b1')).resolves.toBeUndefined();

    prisma.bracket.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(handlers.updateBracket('b1', { name: 'Updated' })).rejects.toThrow('Bracket not found');

    prisma.bracket.update.mockRejectedValueOnce(new Error('update-fail'));
    await expect(handlers.updateBracket('b1', { name: 'Updated' })).rejects.toThrow('Failed to update bracket');

    prisma.bracket.delete.mockRejectedValueOnce({ code: 'P2025' });
    await expect(handlers.deleteBracket('b1')).rejects.toThrow('Bracket not found');

    prisma.bracket.delete.mockRejectedValueOnce(new Error('delete-fail'));
    await expect(handlers.deleteBracket('b1')).rejects.toThrow('Failed to delete bracket');
  });

  it('deletes matches for bracket', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelBrackets(prisma as never);

    await handlers.deleteMatchesForBracket('b1');

    expect(prisma.match.deleteMany).toHaveBeenCalledWith({ where: { bracketId: 'b1' } });
  });
});
