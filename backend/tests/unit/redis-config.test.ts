const redisOn = jest.fn();
const redisConnect = jest.fn();
const redisDisconnect = jest.fn();
const redisPing = jest.fn();

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

describe('redis config', () => {
  beforeEach(() => {
    redisOn.mockReset();
    redisConnect.mockReset();
    redisDisconnect.mockReset();
    redisPing.mockReset();
  });

  it('connects all clients', async () => {
    const { redis } = await import('../../src/config/redis');

    await redis.connect();

    expect(redisConnect).toHaveBeenCalledTimes(3);
  });

  it('disconnects all clients', async () => {
    const { redis } = await import('../../src/config/redis');

    await redis.disconnect();

    expect(redisDisconnect).toHaveBeenCalledTimes(3);
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
});
