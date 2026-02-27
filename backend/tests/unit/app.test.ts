import request from 'supertest';

const databaseHealthCheck = jest.fn();
const redisHealthCheck = jest.fn();
const databaseConnect = jest.fn();
const databaseDisconnect = jest.fn();
const redisConnect = jest.fn();
const redisDisconnect = jest.fn();
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();
const loggerDebug = jest.fn();

jest.mock('../../src/config/database', () => ({
  database: {
    healthCheck: () => databaseHealthCheck(),
    connect: () => databaseConnect(),
    disconnect: () => databaseDisconnect(),
  },
}));

jest.mock('../../src/config/redis', () => ({
  redis: {
    healthCheck: () => redisHealthCheck(),
    connect: () => redisConnect(),
    disconnect: () => redisDisconnect(),
  },
}));

jest.mock('../../src/websocket/server', () => ({
  setupWebSocketServer: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: (...args: unknown[]) => loggerInfo(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
    debug: (...args: unknown[]) => loggerDebug(...args),
  },
  stream: {
    write: jest.fn(),
  },
}));

describe('app routes', () => {
  beforeEach(() => {
    databaseHealthCheck.mockReset();
    redisHealthCheck.mockReset();
    databaseConnect.mockReset();
    databaseDisconnect.mockReset();
    redisConnect.mockReset();
    redisDisconnect.mockReset();
    loggerInfo.mockReset();
    loggerWarn.mockReset();
    loggerError.mockReset();
    loggerDebug.mockReset();
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

  it('starts server and registers signal handlers', async () => {
    databaseConnect.mockResolvedValue(undefined);
    redisConnect.mockResolvedValue(undefined);

    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process as never);

    const { default: App } = await import('../../src/app');
    const app = new App();
    const listenSpy = jest.spyOn(app.server, 'listen').mockImplementation(((_port: number, callback?: () => void) => {
      callback?.();
      return app.server;
    }) as never);

    await app.start();

    expect(databaseConnect).toHaveBeenCalled();
    expect(redisConnect).toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    listenSpy.mockRestore();
    onSpy.mockRestore();
  });

  it('exits when start fails', async () => {
    databaseConnect.mockRejectedValue(new Error('connect failed'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { default: App } = await import('../../src/app');
    const app = new App();

    await app.start();

    expect(loggerError).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('shuts down gracefully', async () => {
    databaseDisconnect.mockResolvedValue(undefined);
    redisDisconnect.mockResolvedValue(undefined);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { default: App } = await import('../../src/app');
    const app = new App();
    const closeSpy = jest.spyOn(app.server, 'close').mockImplementation(((callback?: (error?: Error) => void) => {
      callback?.();
      return app.server;
    }) as never);

    await (app as unknown as { shutdown: (signal: string) => Promise<void> }).shutdown('SIGTERM');

    expect(closeSpy).toHaveBeenCalled();
    expect(databaseDisconnect).toHaveBeenCalled();
    expect(redisDisconnect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exits with error when shutdown fails', async () => {
    databaseDisconnect.mockRejectedValue(new Error('disconnect failed'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { default: App } = await import('../../src/app');
    const app = new App();
    const closeSpy = jest.spyOn(app.server, 'close').mockImplementation(((callback?: (error?: Error) => void) => {
      callback?.();
      return app.server;
    }) as never);

    await (app as unknown as { shutdown: (signal: string) => Promise<void> }).shutdown('SIGINT');

    expect(loggerError).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
