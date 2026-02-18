type HandlerMap = Map<string, (...args: unknown[]) => void>;

describe('server entrypoint', () => {
  let handlers: HandlerMap;
  let exitSpy: jest.SpyInstance;
  let onSpy: jest.SpyInstance;

  beforeEach(() => {
    handlers = new Map();
    jest.resetModules();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    onSpy = jest
      .spyOn(process, 'on')
      .mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        handlers.set(String(event), handler);
        return process as never;
      });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    onSpy.mockRestore();
  });

  it('starts the app on import', async () => {
    const startMock = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../src/app', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ start: startMock })),
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/server');
    });

    expect(startMock).toHaveBeenCalled();
  });

  it('exits when app start fails', async () => {
    const startMock = jest.fn().mockRejectedValue(new Error('fail'));

    jest.doMock('../../src/app', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ start: startMock })),
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/server');
    });

    await new Promise(setImmediate);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on uncaught exceptions', async () => {
    const startMock = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../src/app', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ start: startMock })),
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/server');
    });

    const handler = handlers.get('uncaughtException');
    handler?.(new Error('boom'));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on unhandled rejections', async () => {
    const startMock = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../src/app', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ start: startMock })),
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/server');
    });

    const handler = handlers.get('unhandledRejection');
    handler?.(new Error('reject'), Promise.resolve());

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
