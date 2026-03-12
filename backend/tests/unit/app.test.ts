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

  it('logs slow responses and server-error responses in request finish hook', async () => {
    databaseHealthCheck.mockResolvedValue(false);
    redisHealthCheck.mockResolvedValue(true);

    const { config } = await import('../../src/config/environment');
    const previousMax = config.performance.maxResponseTime;
    config.performance.maxResponseTime = -1;

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/health');

    expect(response.status).toBe(503);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Slow response:'),
      expect.any(Object)
    );
    expect(loggerError).toHaveBeenCalledWith(
      'Response finished with server error',
      expect.any(Object)
    );

    config.performance.maxResponseTime = previousMax;
  });

  it('does not log slow response when under threshold', async () => {
    databaseHealthCheck.mockResolvedValue(true);
    redisHealthCheck.mockResolvedValue(true);

    const { config } = await import('../../src/config/environment');
    const previousMax = config.performance.maxResponseTime;
    config.performance.maxResponseTime = Number.MAX_SAFE_INTEGER;

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/api');

    expect(response.status).toBe(200);
    expect(loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Slow response:'),
      expect.any(Object)
    );

    config.performance.maxResponseTime = previousMax;
  });

  it('uses optional auth middleware branch when auth is enabled', async () => {
    databaseHealthCheck.mockResolvedValue(true);
    redisHealthCheck.mockResolvedValue(true);

    const { config } = await import('../../src/config/environment');
    const previousAuthEnabled = config.auth.enabled;
    config.auth.enabled = true;

    const { default: App } = await import('../../src/app');
    const app = new App();

    const response = await request(app.app).get('/api');
    expect(response.status).toBe(200);

    config.auth.enabled = previousAuthEnabled;
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

  it('logs development dependency details when starting in development mode', async () => {
    databaseConnect.mockResolvedValue(undefined);
    redisConnect.mockResolvedValue(undefined);

    const { config } = await import('../../src/config/environment');
    const previousDevelopment = config.isDevelopment;
    const previousDatabaseUrl = config.database.url;
    const previousRedisHost = config.redis.host;
    const previousRedisPort = config.redis.port;
    config.isDevelopment = true;
    config.database.url = 'postgresql://user:pass@localhost:5432/db';
    config.redis.host = 'localhost';
    config.redis.port = 6379;

    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process as never);

    const { default: App } = await import('../../src/app');
    const app = new App();
    const listenSpy = jest.spyOn(app.server, 'listen').mockImplementation(((_port: number, callback?: () => void) => {
      callback?.();
      return app.server;
    }) as never);

    await app.start();

    expect(loggerDebug).toHaveBeenCalledWith(
      'Backend dependencies in development mode',
      expect.any(Object)
    );

    listenSpy.mockRestore();
    onSpy.mockRestore();
    config.isDevelopment = previousDevelopment;
    config.database.url = previousDatabaseUrl;
    config.redis.host = previousRedisHost;
    config.redis.port = previousRedisPort;
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

  it('logs stringified error when start fails with non-Error value', async () => {
    databaseConnect.mockRejectedValue('connect failed string');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { default: App } = await import('../../src/app');
    const app = new App();

    await app.start();

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to start server',
      expect.objectContaining({
        metadata: expect.objectContaining({ errorMessage: 'connect failed string' }),
      })
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('invokes shutdown handlers registered for SIGTERM and SIGINT', async () => {
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

    const shutdownSpy = jest.spyOn(app as unknown as { shutdown: (signal: string) => Promise<void> }, 'shutdown')
      .mockResolvedValue(undefined);
    const sigtermHandler = onSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as (() => void) | undefined;
    const sigintHandler = onSpy.mock.calls.find((call) => call[0] === 'SIGINT')?.[1] as (() => void) | undefined;

    sigtermHandler?.();
    sigintHandler?.();

    expect(shutdownSpy).toHaveBeenCalledWith('SIGTERM');
    expect(shutdownSpy).toHaveBeenCalledWith('SIGINT');

    shutdownSpy.mockRestore();
    listenSpy.mockRestore();
    onSpy.mockRestore();
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

  it('logs stringified error when shutdown fails with non-Error value', async () => {
    databaseDisconnect.mockRejectedValue('disconnect failed string');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { default: App } = await import('../../src/app');
    const app = new App();
    const closeSpy = jest.spyOn(app.server, 'close').mockImplementation(((callback?: (error?: Error) => void) => {
      callback?.();
      return app.server;
    }) as never);

    await (app as unknown as { shutdown: (signal: string) => Promise<void> }).shutdown('SIGUSR1');

    expect(loggerError).toHaveBeenCalledWith(
      'Error during graceful shutdown',
      expect.objectContaining({
        metadata: expect.objectContaining({ signal: 'SIGUSR1', errorMessage: 'disconnect failed string' }),
      })
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
