import { config } from '../../src/config/environment';

const redisClient = {
  sadd: jest.fn(),
  srem: jest.fn(),
  keys: jest.fn(),
  setex: jest.fn(),
  scard: jest.fn(),
};

jest.mock('../../src/config/redis', () => ({
  redis: {
    getClient: () => redisClient,
  },
}));

describe('websocket server', () => {
  type HandlerMap = Record<string, (...args: unknown[]) => unknown>;

  const getHandler = (handlers: HandlerMap, key: string): ((...args: unknown[]) => unknown) => {
    const handler = handlers[key];
    if (!handler) {
      throw new Error(`Missing handler for ${key}`);
    }
    return handler;
  };

  beforeEach(() => {
    redisClient.sadd.mockReset();
    redisClient.srem.mockReset();
    redisClient.keys.mockReset();
    redisClient.setex.mockReset();
    redisClient.scard.mockReset();
  });

  it('initializes handlers and joins rooms', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-1', socket]]) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    jest.useFakeTimers();
    const { setupWebSocketServer } = await import('../../src/websocket/server');

    setupWebSocketServer(io as never);

    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));

    const connectionHandler = getHandler(onHandlers, 'connection');
    connectionHandler(socket as never);

    const joinHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'join-tournament'
    );

    await joinHandler('t-1');

    expect(socket.join).toHaveBeenCalledWith('tournament-t-1');
    expect(redisClient.sadd).toHaveBeenCalledWith('tournament:t-1:clients', 'socket-1');

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('rejects invalid tournament ids on join', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-1', socket]]) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const { setupWebSocketServer } = await import('../../src/websocket/server');

    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const joinHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'join-tournament'
    );

    await joinHandler(undefined);

    expect(socket.emit).toHaveBeenCalledWith('error', expect.any(Object));
  });

  it('handles leave requests', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-1', socket]]) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const { setupWebSocketServer } = await import('../../src/websocket/server');

    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const leaveHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'leave-tournament'
    );

    await leaveHandler('t-1');

    expect(socket.leave).toHaveBeenCalledWith('tournament-t-1');
    expect(redisClient.srem).toHaveBeenCalledWith('tournament:t-1:clients', 'socket-1');
  });

  it('cleans up client tracking on disconnect', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
      emit: jest.fn(),
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-1', socket]]) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    redisClient.keys.mockResolvedValue(['tournament:1:clients']);

    const { setupWebSocketServer } = await import('../../src/websocket/server');

    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);

    const disconnectHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'disconnect'
    );

    await disconnectHandler('server shutdown');

    expect(redisClient.srem).toHaveBeenCalledWith('tournament:1:clients', 'socket-1');
  });

  it('emits tournament updates and caches in redis', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitTournamentUpdated('t-1', 'LIVE');

    expect(io.to).toHaveBeenCalledWith('tournament-t-1');
    expect(io.emit).toHaveBeenCalledWith('tournament:updated', {
      tournamentId: 't-1',
      status: 'LIVE',
    });
    expect(redisClient.setex).toHaveBeenCalled();
  });

  it('returns connected client counts', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    redisClient.scard.mockResolvedValue(5);

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await expect(service.getConnectedClientsCount('t-1')).resolves.toBe(5);
  });

  it('logs high connection counts when metrics enabled', async () => {
    const originalEnableMetrics = config.performance.enableMetrics;
    config.performance.enableMetrics = true;

    const io = {
      on: jest.fn(),
      sockets: { sockets: new Map(Array.from({ length: 1001 }, (_, index) => [String(index), {}])) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    jest.useFakeTimers();
    const { setupWebSocketServer } = await import('../../src/websocket/server');

    setupWebSocketServer(io as never);

    jest.advanceTimersByTime(30_000);

    jest.useRealTimers();
    config.performance.enableMetrics = originalEnableMetrics;
  });
});
