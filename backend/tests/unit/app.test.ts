import request from 'supertest';

const databaseHealthCheck = jest.fn();
const redisHealthCheck = jest.fn();

jest.mock('../../src/config/database', () => ({
  database: {
    healthCheck: () => databaseHealthCheck(),
  },
}));

jest.mock('../../src/config/redis', () => ({
  redis: {
    healthCheck: () => redisHealthCheck(),
  },
}));

jest.mock('../../src/websocket/server', () => ({
  setupWebSocketServer: jest.fn(),
}));

describe('app routes', () => {
  beforeEach(() => {
    databaseHealthCheck.mockReset();
    redisHealthCheck.mockReset();
  });

  it('returns healthy status when dependencies are healthy', async () => {
    databaseHealthCheck.mockResolvedValue(true);
    redisHealthCheck.mockResolvedValue(true);

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'healthy',
        services: {
          database: 'healthy',
          redis: 'healthy',
        },
      })
    );
  });

  it('returns unhealthy status when dependencies are unhealthy', async () => {
    databaseHealthCheck.mockResolvedValue(false);
    redisHealthCheck.mockResolvedValue(true);

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
  });

  it('returns api metadata', async () => {
    databaseHealthCheck.mockResolvedValue(true);
    redisHealthCheck.mockResolvedValue(true);

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/api');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        version: expect.any(String),
        environment: expect.any(String),
      })
    );
  });

  it('returns 404 for unknown routes', async () => {
    databaseHealthCheck.mockResolvedValue(true);
    redisHealthCheck.mockResolvedValue(true);

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Not Found',
      })
    );
  });
});
