import { MatchStatus } from '../../../shared/src/types';
import { AppError } from '../../src/middleware/error-handler';
import { createTournamentModelMatches } from '../../src/models/tournament-model/matches';

type PrismaMock = {
  matchFormatPreset: {
    findUnique: jest.Mock;
  };
  match: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  target: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  playerMatch: {
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const buildPrisma = (): PrismaMock => ({
  matchFormatPreset: {
    findUnique: jest.fn(),
  },
  match: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  target: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  playerMatch: {
    update: jest.fn(),
  },
  $transaction: jest.fn(async (steps) => steps),
});

describe('tournament model matches handlers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns undefined when pool stage lookup fails', async () => {
    const prisma = buildPrisma();
    prisma.match.findUnique.mockRejectedValue(new Error('db down'));
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.getMatchPoolStageId('match-1')).resolves.toBeUndefined();
  });

  it('returns pool stage id when available and undefined when relation is missing', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelMatches(prisma as never);

    prisma.match.findUnique.mockResolvedValueOnce({ pool: { poolStageId: 'stage-1' } });
    await expect(handlers.getMatchPoolStageId('match-1')).resolves.toBe('stage-1');

    prisma.match.findUnique.mockResolvedValueOnce(null);
    await expect(handlers.getMatchPoolStageId('match-2')).resolves.toBeUndefined();
  });

  it('fetches match format preset and maps fetch failures', async () => {
    const prisma = buildPrisma();
    prisma.matchFormatPreset.findUnique.mockResolvedValueOnce({ key: 'BO3' });
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.getMatchFormatPresetByKey('BO3')).resolves.toEqual({ key: 'BO3' });

    prisma.matchFormatPreset.findUnique.mockRejectedValueOnce(new Error('preset read failure'));
    await expect(handlers.getMatchFormatPresetByKey('BO3'))
      .rejects.toMatchObject({ code: 'MATCH_FORMAT_PRESET_FETCH_FAILED', statusCode: 500 });
  });

  it('maps prisma P2025 to MATCH_NOT_FOUND on updateMatchStatus', async () => {
    const prisma = buildPrisma();
    prisma.match.update.mockRejectedValue({ code: 'P2025' });
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.updateMatchStatus('match-1', MatchStatus.SCHEDULED))
      .rejects.toMatchObject({ code: 'MATCH_NOT_FOUND', statusCode: 404 });
  });

  it('throws generic update status error when prisma code is not P2025', async () => {
    const prisma = buildPrisma();
    prisma.match.update.mockRejectedValue(new Error('boom'));
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.updateMatchStatus('match-1', MatchStatus.SCHEDULED))
      .rejects.toMatchObject({ code: 'MATCH_STATUS_UPDATE_FAILED', statusCode: 500 });
  });

  it('resets a match without target update when targetId is missing', async () => {
    const prisma = buildPrisma();
    prisma.match.update.mockResolvedValue({ id: 'match-1' });
    const handlers = createTournamentModelMatches(prisma as never);

    await handlers.resetMatchToScheduled('match-1');

    const transactionSteps = prisma.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(transactionSteps).toHaveLength(1);
    expect(prisma.target.update).not.toHaveBeenCalled();
  });

  it('resets a match with target update when targetId is provided', async () => {
    const prisma = buildPrisma();
    prisma.match.update.mockResolvedValue({ id: 'match-1' });
    prisma.target.update.mockResolvedValue({ id: 'target-1' });
    const handlers = createTournamentModelMatches(prisma as never);

    await handlers.resetMatchToScheduled('match-1', 'target-1');

    const transactionSteps = prisma.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(transactionSteps).toHaveLength(2);
    expect(prisma.target.update).toHaveBeenCalled();
  });

  it('maps reset match errors for prisma P2025 and generic failures', async () => {
    const prismaNotFound = buildPrisma();
    prismaNotFound.match.update.mockReturnValue({});
    prismaNotFound.$transaction.mockRejectedValueOnce({ code: 'P2025' });
    const handlersNotFound = createTournamentModelMatches(prismaNotFound as never);

    await expect(handlersNotFound.resetMatchToScheduled('match-1'))
      .rejects.toMatchObject({ code: 'MATCH_NOT_FOUND', statusCode: 404 });

    const prismaGeneric = buildPrisma();
    prismaGeneric.match.update.mockReturnValue({});
    prismaGeneric.$transaction.mockRejectedValueOnce(new Error('reset failed'));
    const handlersGeneric = createTournamentModelMatches(prismaGeneric as never);

    await expect(handlersGeneric.resetMatchToScheduled('match-1'))
      .rejects.toMatchObject({ code: 'MATCH_RESET_FAILED', statusCode: 500 });
  });

  it('maps P2025 and generic branches for updateInProgressMatchScores', async () => {
    const prismaNotFound = buildPrisma();
    prismaNotFound.playerMatch.update.mockReturnValue({});
    prismaNotFound.match.update.mockReturnValue({});
    prismaNotFound.$transaction.mockRejectedValue({ code: 'P2025' });
    const handlersNotFound = createTournamentModelMatches(prismaNotFound as never);

    await expect(handlersNotFound.updateInProgressMatchScores('match-1', [
      { playerId: 'player-1', scoreTotal: 2 },
      { playerId: 'player-2', scoreTotal: 1 },
    ])).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND', statusCode: 404 });

    const prismaGeneric = buildPrisma();
    prismaGeneric.playerMatch.update.mockReturnValue({});
    prismaGeneric.match.update.mockReturnValue({});
    prismaGeneric.$transaction.mockRejectedValue(new Error('generic'));
    const handlersGeneric = createTournamentModelMatches(prismaGeneric as never);

    await expect(handlersGeneric.updateInProgressMatchScores('match-1', [
      { playerId: 'player-1', scoreTotal: 2 },
      { playerId: 'player-2', scoreTotal: 1 },
    ])).rejects.toMatchObject({ code: 'MATCH_SCORE_UPDATE_FAILED', statusCode: 500 });
  });

  it('throws model fetch error for getMatchById failures', async () => {
    const prisma = buildPrisma();
    prisma.match.findUnique.mockRejectedValue(new Error('read failure'));
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.getMatchById('match-1'))
      .rejects.toThrow(AppError);
  });

  it('throws target fetch error for getTargetById failures', async () => {
    const prisma = buildPrisma();
    prisma.target.findUnique.mockRejectedValue(new Error('read failure'));
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.getTargetById('target-1'))
      .rejects.toMatchObject({ code: 'TARGET_FETCH_FAILED', statusCode: 500 });
  });

  it('starts match with target and maps start failure', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelMatches(prisma as never);

    await handlers.startMatchWithTarget('match-1', 'target-1', new Date('2026-01-01T10:00:00.000Z'));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    prisma.$transaction.mockRejectedValueOnce(new Error('tx fail'));
    await expect(
      handlers.startMatchWithTarget('match-1', 'target-1', new Date('2026-01-01T10:00:00.000Z'))
    ).rejects.toMatchObject({ code: 'MATCH_START_FAILED', statusCode: 500 });
  });

  it('finishes match and releases target with completedAt fallback date', async () => {
    const prisma = buildPrisma();
    const handlers = createTournamentModelMatches(prisma as never);

    await handlers.finishMatchAndReleaseTarget('match-1', 'target-1', MatchStatus.COMPLETED, {});
    expect(prisma.target.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'AVAILABLE',
        currentMatchId: null,
        lastUsedAt: expect.any(Date),
      }),
    }));

    prisma.$transaction.mockRejectedValueOnce(new Error('tx fail'));
    await expect(
      handlers.finishMatchAndReleaseTarget('match-1', 'target-1', MatchStatus.COMPLETED, {})
    ).rejects.toMatchObject({ code: 'MATCH_FINISH_FAILED', statusCode: 500 });
  });

  it('maps P2025 and generic branches for updateMatchScores', async () => {
    const prismaNotFound = buildPrisma();
    prismaNotFound.playerMatch.update.mockReturnValue({});
    prismaNotFound.match.update.mockReturnValue({});
    prismaNotFound.$transaction.mockRejectedValue({ code: 'P2025' });
    const handlersNotFound = createTournamentModelMatches(prismaNotFound as never);

    await expect(handlersNotFound.updateMatchScores('match-1', [
      { playerId: 'player-1', scoreTotal: 3, isWinner: true },
      { playerId: 'player-2', scoreTotal: 1, isWinner: false },
    ], 'player-1')).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND', statusCode: 404 });

    const prismaGeneric = buildPrisma();
    prismaGeneric.playerMatch.update.mockReturnValue({});
    prismaGeneric.match.update.mockReturnValue({});
    prismaGeneric.$transaction.mockRejectedValue(new Error('generic'));
    const handlersGeneric = createTournamentModelMatches(prismaGeneric as never);

    await expect(handlersGeneric.updateMatchScores('match-1', [
      { playerId: 'player-1', scoreTotal: 3, isWinner: true },
      { playerId: 'player-2', scoreTotal: 1, isWinner: false },
    ], 'player-1')).rejects.toMatchObject({ code: 'MATCH_SCORE_UPDATE_FAILED', statusCode: 500 });
  });

  it('maps completeMatch and details fetch error branches', async () => {
    const prisma = buildPrisma();
    prisma.playerMatch.update.mockReturnValue({});
    prisma.match.update.mockReturnValue({});
    prisma.$transaction.mockRejectedValue({ code: 'P2025' });
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.completeMatch('match-1', [
      { playerId: 'player-1', scoreTotal: 2, isWinner: true },
      { playerId: 'player-2', scoreTotal: 1, isWinner: false },
    ], 'player-1', {})).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND', statusCode: 404 });

    prisma.match.findUnique.mockRejectedValueOnce(new Error('details fail'));
    await expect(handlers.getMatchDetailsForNotification('match-1'))
      .rejects.toMatchObject({ code: 'MATCH_DETAILS_FETCH_FAILED', statusCode: 500 });
  });

  it('supports successful completeMatch transaction', async () => {
    const prisma = buildPrisma();
    prisma.playerMatch.update.mockReturnValue({});
    prisma.match.update.mockReturnValue({});
    prisma.$transaction.mockResolvedValueOnce([]);
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.completeMatch('match-1', [
      { playerId: 'player-1', scoreTotal: 2, isWinner: true },
      { playerId: 'player-2', scoreTotal: 1, isWinner: false },
    ], 'player-1', { startedAt: new Date('2026-01-01T10:00:00.000Z') })).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('maps completeMatch generic failure branch', async () => {
    const prisma = buildPrisma();
    prisma.playerMatch.update.mockReturnValue({});
    prisma.match.update.mockReturnValue({});
    prisma.$transaction.mockRejectedValueOnce(new Error('complete failed'));
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.completeMatch('match-1', [
      { playerId: 'player-1', scoreTotal: 2, isWinner: true },
      { playerId: 'player-2', scoreTotal: 1, isWinner: false },
    ], 'player-1', {})).rejects.toMatchObject({ code: 'MATCH_COMPLETE_FAILED', statusCode: 500 });
  });

  it('updates target availability and maps update failure', async () => {
    const prisma = buildPrisma();
    prisma.target.update.mockResolvedValueOnce({ id: 'target-1', status: 'AVAILABLE' });
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.setTargetAvailable('target-1')).resolves.toEqual({ id: 'target-1', status: 'AVAILABLE' });

    prisma.target.update.mockRejectedValueOnce(new Error('target update failure'));
    await expect(handlers.setTargetAvailable('target-1'))
      .rejects.toMatchObject({ code: 'TARGET_UPDATE_FAILED', statusCode: 500 });
  });

  it('fetches match with player matches and maps read failure', async () => {
    const prisma = buildPrisma();
    prisma.match.findUnique.mockResolvedValueOnce({ id: 'match-1', playerMatches: [] });
    const handlers = createTournamentModelMatches(prisma as never);

    await expect(handlers.getMatchWithPlayerMatches('match-1'))
      .resolves.toEqual({ id: 'match-1', playerMatches: [] });

    prisma.match.findUnique.mockRejectedValueOnce(new Error('match with players read failure'));
    await expect(handlers.getMatchWithPlayerMatches('match-1'))
      .rejects.toMatchObject({ code: 'MATCH_FETCH_FAILED', statusCode: 500 });
  });
});
