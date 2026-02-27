import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const loggerHttp = jest.fn();
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();
const loggerDebug = jest.fn();

const addColors = jest.fn();
const timestamp = jest.fn(() => ({ kind: 'timestamp' }));
const colorize = jest.fn(() => ({ kind: 'colorize' }));
const json = jest.fn(() => ({ kind: 'json' }));
const combine = jest.fn((...formats: unknown[]) => ({ kind: 'combine', formats }));
const printfCallbacks: Array<(info: Record<string, unknown>) => string> = [];
const printf = jest.fn((callback: (info: Record<string, unknown>) => string) => {
  printfCallbacks.push(callback);
  return { kind: 'printf', callback };
});

const createLogger = jest.fn((config?: unknown) => ({
  http: loggerHttp,
  info: loggerInfo,
  warn: loggerWarn,
  error: loggerError,
  debug: loggerDebug,
}));

class ConsoleTransport {
  options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.options = options;
  }
}

class FileTransport {
  options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.options = options;
  }
}

const mockWinston = {
  addColors,
  format: {
    timestamp,
    colorize,
    json,
    combine,
    printf,
  },
  transports: {
    Console: ConsoleTransport,
    File: FileTransport,
  },
  createLogger,
};

describe('logger util', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    printfCallbacks.length = 0;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('builds test-environment logger and formats log lines across value types', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;

    jest.doMock('winston', () => ({
      __esModule: true,
      default: mockWinston,
    }));

    jest.isolateModules(() => {
      const module = require('../../src/utils/logger') as {
        logger: { http: (message: string) => void };
        stream: { write: (message: string) => void };
      };

      expect(createLogger.mock.calls.length).toBeGreaterThan(0);
      const firstCall = createLogger.mock.calls[0];
      if (!firstCall) {
        throw new Error('createLogger was not called');
      }

      const config = firstCall[0] as {
        level: string;
        transports: unknown[];
        exceptionHandlers: unknown[];
        rejectionHandlers: unknown[];
      };

      expect(config.level).toBe('info');
      expect(config.transports).toHaveLength(1);
      expect(config.exceptionHandlers).toEqual([]);
      expect(config.rejectionHandlers).toEqual([]);
      expect(addColors).toHaveBeenCalled();

      const consolePrintf = printfCallbacks[0];
      const filePrintf = printfCallbacks[1];
      if (!consolePrintf || !filePrintf) {
        throw new Error('expected printf callbacks to be registered');
      }

      expect(consolePrintf({ timestamp: 'ts', level: 'info', correlationId: 'corr-1', message: 'hello' }))
        .toContain('[corr-1]');

      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(consolePrintf({ timestamp: 'ts', level: 'info', message: circular }))
        .toContain('[unserializable]');
      expect(consolePrintf({ timestamp: 'ts', level: 'info', message: 42, correlationId: 7n }))
        .toContain('[7]');
      expect(consolePrintf({ timestamp: 'ts', level: 'info', message: undefined }))
        .toContain(': ');

      const rendered = filePrintf({
        timestamp: 'ts',
        level: 'warn',
        message: true,
        correlationId: { key: 'id' },
        userId: 'u-1',
        tournamentId: 't-1',
        playerId: 'p-1',
        metadata: { raw: true },
      });

      expect(JSON.parse(rendered)).toEqual(
        expect.objectContaining({
          timestamp: 'ts',
          level: 'warn',
          message: 'true',
          correlationId: '{"key":"id"}',
          userId: 'u-1',
          tournamentId: 't-1',
          playerId: 'p-1',
          metadata: { raw: true },
        })
      );

      module.stream.write('request line\n');
      expect(loggerHttp).toHaveBeenCalledWith('request line');
    });
  });

  it('builds non-test logger with file and process handlers', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';

    jest.doMock('winston', () => ({
      __esModule: true,
      default: mockWinston,
    }));

    jest.isolateModules(() => {
      require('../../src/utils/logger');

      expect(createLogger.mock.calls.length).toBeGreaterThan(0);
      const firstCall = createLogger.mock.calls[0];
      if (!firstCall) {
        throw new Error('createLogger was not called');
      }

      const config = firstCall[0] as {
        level: string;
        transports: unknown[];
        exceptionHandlers: unknown[];
        rejectionHandlers: unknown[];
      };

      expect(config.level).toBe('debug');
      expect(config.transports).toHaveLength(4);
      expect(config.exceptionHandlers).toHaveLength(1);
      expect(config.rejectionHandlers).toHaveLength(1);
    });
  });
});
