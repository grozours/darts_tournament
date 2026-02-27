import TournamentLogger, { TournamentLogEvent } from '../../src/utils/tournament-logger';

const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();
const loggerDebug = jest.fn();

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: (...args: unknown[]) => loggerInfo(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
    debug: (...args: unknown[]) => loggerDebug(...args),
  },
}));

describe('tournament logger', () => {
  beforeEach(() => {
    loggerInfo.mockClear();
    loggerWarn.mockClear();
    loggerError.mockClear();
    loggerDebug.mockClear();
  });

  it('logs tournament creation events', () => {
    const logger = new TournamentLogger({ correlationId: 'corr-1' } as never);

    logger.tournamentCreated('t-1', 'Spring Cup', { format: 'SINGLE' });

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Tournament created'),
      expect.objectContaining({
        event: TournamentLogEvent.CREATED,
        correlationId: 'corr-1',
        tournamentId: 't-1',
      })
    );
  });

  it('logs validation errors', () => {
    const logger = new TournamentLogger();

    logger.validationError('INVALID', 'bad input', 't-2', 'Cup');

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Tournament validation error'),
      expect.objectContaining({
        event: TournamentLogEvent.VALIDATION_ERROR,
        tournamentId: 't-2',
      })
    );
  });

  it('logs access errors with metadata', () => {
    const logger = new TournamentLogger({
      correlationId: 'corr-2',
      user: { id: 'user-1' },
    } as never);

    logger.accessError('FORBIDDEN', 'denied', 't-3', 'Cup');

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Tournament access error'),
      expect.objectContaining({
        event: TournamentLogEvent.ACCESS_ERROR,
        correlationId: 'corr-2',
        userId: 'user-1',
        tournamentId: 't-3',
      })
    );
  });

  it('logs generic errors with error metadata', () => {
    const logger = new TournamentLogger();

    logger.error('oops', 't-4', { message: 'bad', code: 'FAIL', stack: 'stack' });

    expect(loggerError).toHaveBeenCalledWith(
      'oops',
      expect.objectContaining({
        event: TournamentLogEvent.ACCESS_ERROR,
        tournamentId: 't-4',
      })
    );
  });

  it('covers lifecycle, player and logo event branches', () => {
    const logger = new TournamentLogger();

    logger.tournamentUpdated('t-1', 'Cup', { old: true }, { old: false });
    logger.tournamentDeleted('t-1', 'Cup');
    logger.tournamentStatusChanged('t-1', 'Cup', 'OPEN', 'LIVE');
    logger.playerRegistered('t-1', 'Cup', 'p-1');
    logger.playerRegistered('t-1', 'Cup', 'p-1', 'Alice');
    logger.playerUnregistered('t-1', 'Cup', 'p-1');
    logger.playerUnregistered('t-1', 'Cup', 'p-1', 'Alice');
    logger.logoUploaded('t-1', 'Cup', 'https://example.test/logo.png');
    logger.logoDeleted('t-1', 'Cup');

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Tournament updated'),
      expect.objectContaining({ event: TournamentLogEvent.UPDATED, tournamentId: 't-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Tournament deleted'),
      expect.objectContaining({ event: TournamentLogEvent.DELETED, tournamentId: 't-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('status changed'),
      expect.objectContaining({ event: TournamentLogEvent.STATUS_CHANGED, tournamentId: 't-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Player registered for tournament'),
      expect.objectContaining({ event: TournamentLogEvent.PLAYER_REGISTERED, playerId: 'p-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Player unregistered from tournament'),
      expect.objectContaining({ event: TournamentLogEvent.PLAYER_UNREGISTERED, playerId: 'p-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Logo uploaded for tournament'),
      expect.objectContaining({ event: TournamentLogEvent.LOGO_UPLOADED, tournamentId: 't-1' })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Logo deleted for tournament'),
      expect.objectContaining({ event: TournamentLogEvent.LOGO_DELETED, tournamentId: 't-1' })
    );
  });

  it('covers validation/access optional data and non-object generic errors', () => {
    const logger = new TournamentLogger();

    logger.validationError('INVALID', 'missing data');
    logger.accessError('FORBIDDEN', 'blocked');
    logger.error('plain', undefined, 'just-a-string');

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('validation error'),
      expect.objectContaining({ event: TournamentLogEvent.VALIDATION_ERROR })
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('access error'),
      expect.objectContaining({ event: TournamentLogEvent.ACCESS_ERROR })
    );
    expect(loggerError).toHaveBeenCalledWith(
      'plain',
      expect.objectContaining({ event: TournamentLogEvent.ACCESS_ERROR })
    );
  });
});
