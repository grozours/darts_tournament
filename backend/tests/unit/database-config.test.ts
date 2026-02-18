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
    poolOn.mockReset();
    poolConnect.mockReset();
    poolEnd.mockReset();
  });

  it('connects and releases clients', async () => {
    const release = jest.fn();
    poolConnect.mockResolvedValue({ release });

    const { database } = await import('../../src/config/database');

    await database.connect();

    expect(poolConnect).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
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
});
