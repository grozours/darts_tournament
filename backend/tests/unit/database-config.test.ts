const poolOn = jest.fn();
const poolConnect = jest.fn();
const poolEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    on: poolOn,
    connect: poolConnect,
    end: poolEnd,
  })),
}));

describe('database config', () => {
  beforeEach(() => {
    jest.resetModules();
    poolOn.mockReset();
    poolConnect.mockReset();
    poolEnd.mockReset();
  });

  it('registers pool error handler and logs idle client errors', async () => {
    const loggerModule = await import('../../src/utils/logger');
    const loggerErrorSpy = jest.spyOn(loggerModule.default, 'error').mockImplementation(
      (() => loggerModule.default) as never
    );
    await import('../../src/config/database');

    const callback = poolOn.mock.calls.find(([event]) => event === 'error')?.[1] as ((error: Error) => void) | undefined;
    callback?.(new Error('idle fail'));

    expect(poolOn).toHaveBeenCalledWith('error', expect.any(Function));
    expect(loggerErrorSpy).toHaveBeenCalledWith('Unexpected database error on idle client', expect.objectContaining({
      metadata: expect.objectContaining({ errorMessage: 'idle fail' }),
    }));
    loggerErrorSpy.mockRestore();
  });

  it('connects and releases clients', async () => {
    const release = jest.fn();
    poolConnect.mockResolvedValue({ release });

    const { database } = await import('../../src/config/database');

    await database.connect();

    expect(poolConnect).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it('throws when connect fails', async () => {
    poolConnect.mockRejectedValue(new Error('boom'));

    const { database } = await import('../../src/config/database');

    await expect(database.connect()).rejects.toThrow('boom');
  });

  it('disconnects pools', async () => {
    const { database } = await import('../../src/config/database');

    await database.disconnect();

    expect(poolEnd).toHaveBeenCalled();
  });

  it('returns healthy status when query succeeds', async () => {
    const release = jest.fn();
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    poolConnect.mockResolvedValue({ release, query });

    const { database } = await import('../../src/config/database');

    await expect(database.healthCheck()).resolves.toBe(true);
    expect(release).toHaveBeenCalled();
  });

  it('returns false when health check fails', async () => {
    poolConnect.mockRejectedValue(new Error('connection failed'));

    const { database } = await import('../../src/config/database');

    await expect(database.healthCheck()).resolves.toBe(false);
  });

  it('returns false when health query row count is not one', async () => {
    const release = jest.fn();
    const query = jest.fn().mockResolvedValue({ rowCount: 0 });
    poolConnect.mockResolvedValue({ release, query });

    const { database } = await import('../../src/config/database');

    await expect(database.healthCheck()).resolves.toBe(false);
    expect(release).toHaveBeenCalled();
  });
});
