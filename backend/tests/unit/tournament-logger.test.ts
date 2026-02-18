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
});
