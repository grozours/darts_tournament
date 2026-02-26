import { AppError } from '../../src/middleware/error-handler';
import {
  emitMatchFormatChangedNotifications,
  getMatchFormatTooltip,
} from '../../src/services/tournament-service/match-format-change-notifications';
import {
  getBracketRoundMatchFormatKey,
  normalizeMatchFormatKey,
} from '../../src/services/tournament-service/match-format-presets';
import {
  normalizeMatchScores,
  resolveWinnerAndResultScores,
} from '../../src/services/tournament-service/match-score-policy';
import {
  isPowerOfTwo,
  nextPowerOfTwo,
} from '../../src/services/tournament-service/number-helpers';
import { getWebSocketService } from '../../src/websocket/server';

jest.mock('../../src/websocket/server', () => ({
  getWebSocketService: jest.fn(),
}));

type NotificationDeps = {
  findById: jest.Mock;
  getMatchDetailsForNotification: jest.Mock;
};

describe('tournament service utility modules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('number helpers', () => {
    it('computes next power of two for values below and above powers', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
      expect(nextPowerOfTwo(5)).toBe(8);
      expect(nextPowerOfTwo(16)).toBe(16);
    });

    it('detects powers of two correctly', () => {
      expect(isPowerOfTwo(0)).toBe(false);
      expect(isPowerOfTwo(1)).toBe(true);
      expect(isPowerOfTwo(12)).toBe(false);
      expect(isPowerOfTwo(32)).toBe(true);
    });
  });

  describe('match format presets', () => {
    it('normalizes format keys and handles invalid values', () => {
      expect(normalizeMatchFormatKey(undefined)).toBeUndefined();
      expect(normalizeMatchFormatKey('   ')).toBeUndefined();
      expect(normalizeMatchFormatKey('  BO3  ')).toBe('BO3');
    });

    it('reads round format key by round number when object is valid', () => {
      expect(getBracketRoundMatchFormatKey(null, 1)).toBeUndefined();
      expect(getBracketRoundMatchFormatKey('invalid', 1)).toBeUndefined();
      expect(getBracketRoundMatchFormatKey({ 1: '  BO5  ' }, 1)).toBe('BO5');
      expect(getBracketRoundMatchFormatKey({ 2: 'BO3' }, 1)).toBeUndefined();
    });
  });

  describe('match score policy', () => {
    const match = {
      playerMatches: [{ playerId: 'p1' }, { playerId: 'p2' }],
    };

    it('throws when score list is incomplete', () => {
      expect(() => normalizeMatchScores(match, [{ playerId: 'p1', scoreTotal: 2 }])).toThrow(AppError);
      expect(() => resolveWinnerAndResultScores([{ playerId: 'p1', scoreTotal: 2 }])).toThrow(AppError);
    });

    it('throws when a score references a non participant', () => {
      expect(() => normalizeMatchScores(match, [
        { playerId: 'p1', scoreTotal: 3 },
        { playerId: 'p3', scoreTotal: 1 },
      ])).toThrow(AppError);
    });

    it('throws when scores are tied', () => {
      expect(() => resolveWinnerAndResultScores([
        { playerId: 'p1', scoreTotal: 3 },
        { playerId: 'p2', scoreTotal: 3 },
      ])).toThrow(AppError);
    });

    it('normalizes scores and resolves winner flags', () => {
      const normalized = normalizeMatchScores(match, [
        { playerId: 'p1', scoreTotal: 4 },
        { playerId: 'p2', scoreTotal: 2 },
      ]);
      expect(normalized).toEqual([
        { playerId: 'p1', scoreTotal: 4 },
        { playerId: 'p2', scoreTotal: 2 },
      ]);

      const result = resolveWinnerAndResultScores(normalized);
      expect(result.winnerId).toBe('p1');
      expect(result.resultScores).toEqual([
        { playerId: 'p1', scoreTotal: 4, isWinner: true },
        { playerId: 'p2', scoreTotal: 2, isWinner: false },
      ]);
    });
  });

  describe('match format change notifications', () => {
    const tournamentId = 'tournament-1';

    const makeDependencies = (): NotificationDeps => ({
      findById: jest.fn(),
      getMatchDetailsForNotification: jest.fn(),
    });

    it('returns early when no updates are provided', async () => {
      const deps = makeDependencies();
      await emitMatchFormatChangedNotifications(deps, tournamentId, []);

      expect(getWebSocketService).not.toHaveBeenCalled();
      expect(deps.findById).not.toHaveBeenCalled();
    });

    it('returns early when websocket service is unavailable', async () => {
      const deps = makeDependencies();
      (getWebSocketService as jest.Mock).mockReturnValue(undefined);

      await emitMatchFormatChangedNotifications(deps, tournamentId, [{ matchId: 'm1', matchFormatKey: 'BO3' }]);

      expect(deps.findById).not.toHaveBeenCalled();
    });

    it('returns early when tournament cannot be found', async () => {
      const deps = makeDependencies();
      const emitMatchFormatChanged = jest.fn();
      (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFormatChanged });
      deps.findById.mockResolvedValue(null);

      await emitMatchFormatChangedNotifications(deps, tournamentId, [{ matchId: 'm1', matchFormatKey: 'BO3' }]);

      expect(deps.findById).toHaveBeenCalledWith(tournamentId);
      expect(deps.getMatchDetailsForNotification).not.toHaveBeenCalled();
      expect(emitMatchFormatChanged).not.toHaveBeenCalled();
    });

    it('skips unknown match details and emits notifications for pool and bracket matches', async () => {
      const deps = makeDependencies();
      const emitMatchFormatChanged = jest.fn().mockResolvedValue(undefined);
      (getWebSocketService as jest.Mock).mockReturnValue({ emitMatchFormatChanged });
      deps.findById.mockResolvedValue({ id: tournamentId, name: 'Autumn Cup' });

      deps.getMatchDetailsForNotification
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'm-pool',
          matchNumber: 7,
          roundNumber: 2,
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          target: {
            id: 'target-1',
            targetNumber: 12,
            targetCode: 'A12',
            name: 'Board A12',
          },
          pool: {
            id: 'pool-1',
            poolNumber: 3,
            poolStage: { stageNumber: 2 },
          },
          playerMatches: [
            {
              playerId: 'legacy-player',
              player: {
                id: 'player-1',
                firstName: 'Alice',
                lastName: 'Liddell',
                surname: 'AL',
                teamName: 'Wonder Team',
              },
            },
            {
              playerId: 'player-2',
              player: {
                firstName: 'Bob',
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'm-bracket',
          matchNumber: 12,
          roundNumber: 4,
          startedAt: null,
          target: null,
          pool: null,
          bracket: { name: 'Main Bracket' },
          playerMatches: [],
        });

      await emitMatchFormatChangedNotifications(deps, tournamentId, [
        { matchId: 'missing-details', matchFormatKey: 'BO3' },
        { matchId: 'pool-match', matchFormatKey: 'BO5' },
        { matchId: 'bracket-match', matchFormatKey: 'UNKNOWN_KEY' },
      ]);

      expect(emitMatchFormatChanged).toHaveBeenCalledTimes(2);

      expect(emitMatchFormatChanged).toHaveBeenNthCalledWith(1, expect.objectContaining({
        event: 'format_changed',
        matchId: 'm-pool',
        tournamentId,
        tournamentName: 'Autumn Cup',
        startedAt: '2026-01-01T10:00:00.000Z',
        target: {
          id: 'target-1',
          targetNumber: 12,
          targetCode: 'A12',
          name: 'Board A12',
        },
        match: {
          source: 'pool',
          matchNumber: 7,
          roundNumber: 2,
          stageNumber: 2,
          poolNumber: 3,
          poolId: 'pool-1',
        },
        players: [
          {
            id: 'player-1',
            firstName: 'Alice',
            lastName: 'Liddell',
            surname: 'AL',
            teamName: 'Wonder Team',
          },
          {
            id: 'player-2',
            firstName: 'Bob',
          },
        ],
        matchFormatKey: 'BO5',
      }));

      expect(emitMatchFormatChanged).toHaveBeenNthCalledWith(2, expect.objectContaining({
        event: 'format_changed',
        matchId: 'm-bracket',
        tournamentId,
        tournamentName: 'Autumn Cup',
        match: {
          source: 'bracket',
          matchNumber: 12,
          roundNumber: 4,
          bracketName: 'Main Bracket',
        },
        players: [],
        matchFormatKey: 'UNKNOWN_KEY',
        matchFormatTooltip: 'UNKNOWN_KEY',
      }));
    });

    it('formats match format tooltips for missing, unknown and known presets', () => {
      expect(getMatchFormatTooltip()).toBe('');
      expect(getMatchFormatTooltip('NOT_A_PRESET')).toBe('NOT_A_PRESET');

      const tooltip = getMatchFormatTooltip('BO3');
      expect(tooltip).toContain('key: BO3');
      expect(tooltip).toContain('- 501 DO - 4 Tableaux');
      expect(tooltip).toContain('- Cricket - 2 Tableaux');
    });
  });
});
