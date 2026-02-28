const redisOn = jest.fn();
const redisConnect = jest.fn();
const redisDisconnect = jest.fn();
const redisPing = jest.fn();
const loggerDebug = jest.fn();
const loggerInfo = jest.fn();
const loggerError = jest.fn();
const loggerWarn = jest.fn();

const RedisMock = jest.fn().mockImplementation(() => ({
  on: redisOn,
  connect: redisConnect,
  disconnect: redisDisconnect,
  ping: redisPing,
}));

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: (...args: unknown[]) => loggerDebug(...args),
    info: (...args: unknown[]) => loggerInfo(...args),
    error: (...args: unknown[]) => loggerError(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
  },
}));

describe('redis config', () => {
  const originalRedisPassword = process.env.REDIS_PASSWORD;

  beforeEach(() => {
    redisOn.mockReset();
    redisConnect.mockReset();
    redisDisconnect.mockReset();
    redisPing.mockReset();
    loggerDebug.mockReset();
    loggerInfo.mockReset();
    loggerError.mockReset();
    loggerWarn.mockReset();
    jest.resetModules();
  });

  afterAll(() => {
    if (typeof originalRedisPassword === 'string') {
      process.env.REDIS_PASSWORD = originalRedisPassword;
    } else {
      delete process.env.REDIS_PASSWORD;
    }
  });

  it('registers connect and error handlers on initialization', async () => {
    const { redis } = await import('../../src/config/redis');
    expect(redis).toBeDefined();

    const connectHandler = redisOn.mock.calls.find((call) => call[0] === 'connect')?.[1] as (() => void) | undefined;
    const errorHandler = redisOn.mock.calls.find((call) => call[0] === 'error')?.[1] as ((error: Error) => void) | undefined;

    expect(connectHandler).toBeDefined();
    expect(errorHandler).toBeDefined();

    connectHandler?.();
    errorHandler?.(new Error('boom'));

    expect(loggerDebug).toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
  });

  it('passes redis password to ioredis when configured', async () => {
    process.env.REDIS_PASSWORD = 'secret';

    await import('../../src/config/redis');

    expect(RedisMock).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret' }));
  });

  it('connects all clients', async () => {
    const { redis } = await import('../../src/config/redis');

    await redis.connect();

    expect(redisConnect).toHaveBeenCalledTimes(3);
    expect(loggerInfo).toHaveBeenCalledWith('Redis connected successfully');
  });

  it('throws and logs when connect fails', async () => {
    redisConnect.mockRejectedValueOnce(new Error('connect failed'));
    const { redis } = await import('../../src/config/redis');

    await expect(redis.connect()).rejects.toThrow('connect failed');
    expect(loggerError).toHaveBeenCalledWith(
      'Redis connection failed',
      expect.objectContaining({ metadata: expect.objectContaining({ errorMessage: 'connect failed' }) })
    );
  });

  it('disconnects all clients', async () => {
    const { redis } = await import('../../src/config/redis');

    await redis.disconnect();

    expect(redisDisconnect).toHaveBeenCalledTimes(3);
    expect(loggerInfo).toHaveBeenCalledWith('Redis disconnected');
  });

  it('returns healthy status when ping succeeds', async () => {
    redisPing.mockResolvedValue('PONG');
    const { redis } = await import('../../src/config/redis');

    await expect(redis.healthCheck()).resolves.toBe(true);
  });

  it('returns false when ping fails', async () => {
    redisPing.mockRejectedValue(new Error('ping failed'));
    const { redis } = await import('../../src/config/redis');

    await expect(redis.healthCheck()).resolves.toBe(false);
  });

  it('returns false and logs when ping rejects with non-error value', async () => {
    redisPing.mockRejectedValue('unexpected');
    const { redis } = await import('../../src/config/redis');

    await expect(redis.healthCheck()).resolves.toBe(false);
    expect(loggerDebug).toHaveBeenCalledWith(
      'Redis health check failed',
      expect.objectContaining({ metadata: expect.objectContaining({ errorMessage: 'unexpected' }) })
    );
  });
});
