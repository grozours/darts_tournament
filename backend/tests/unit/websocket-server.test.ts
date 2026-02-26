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

  it('ignores invalid tournament ids on leave', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
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

    await leaveHandler(undefined);

    expect(socket.leave).not.toHaveBeenCalled();
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

  it('handles ping/pong and socket error callbacks', async () => {
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

    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const handlers = (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers;

    await getHandler(handlers, 'ping')();
    expect(socket.emit).toHaveBeenCalledWith('pong', expect.objectContaining({ timestamp: expect.any(Number) }));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await getHandler(handlers, 'error')(new Error('socket-fail'));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handles join and leave failures gracefully', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-1',
      on: socketOn,
      join: jest.fn().mockRejectedValue(new Error('join-fail')),
      leave: jest.fn().mockRejectedValue(new Error('leave-fail')),
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

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const handlers = (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers;

    await getHandler(handlers, 'join-tournament')('t-1');
    await getHandler(handlers, 'leave-tournament')('t-1');

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'JOIN_FAILED' }));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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

  it('returns zero when client count fails', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    redisClient.scard.mockRejectedValue(new Error('boom'));

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await expect(service.getConnectedClientsCount('t-1')).resolves.toBe(0);
  });

  it('emits remaining event types and tolerates emitter errors', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitMatchCompleted('m-1', 't-1', { firstName: 'Alice' });
    await service.emitMatchFinished({
      event: 'completed',
      matchId: 'm-1',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });
    await service.emitMatchFormatChanged({
      event: 'format_changed',
      matchId: 'm-1',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      matchFormatKey: 'BO3',
      matchFormatTooltip: 'key: BO3',
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });
    await service.emitTargetAvailable('target-1', 't-1');
    await service.emitPoolAssigned('t-1', [{ poolId: 'pool-1' }]);
    await service.emitScheduleGenerated('t-1', { generated: true });
    await service.emitPlayerRegistered('t-1', { firstName: 'Bob', lastName: 'Dart' });

    expect(io.emit).toHaveBeenCalled();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failingIo = {
      to: jest.fn(() => {
        throw new Error('emit-fail');
      }),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };
    const failingService = new WebSocketService(failingIo as never);

    await failingService.emitTargetAvailable('target-1', 't-1');
    await failingService.emitPoolAssigned('t-1', []);
    await failingService.emitScheduleGenerated('t-1', {});
    await failingService.emitMatchCompleted('m-1', 't-1', {});
    await failingService.emitMatchFinished({
      event: 'cancelled',
      matchId: 'm-1',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });
    await failingService.emitMatchFormatChanged({
      event: 'format_changed',
      matchId: 'm-1',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      matchFormatKey: 'BO3',
      matchFormatTooltip: 'key: BO3',
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handles disconnect cleanup failures without throwing', async () => {
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

    redisClient.keys.mockRejectedValueOnce(new Error('keys-fail'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const disconnectHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'disconnect'
    );

    await disconnectHandler('transport close');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('warns when score emission is slow', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_250);

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitMatchScoreUpdated('m-1', 't-1', { score: 10 });

    expect(warnSpy).toHaveBeenCalled();

    nowSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('handles errors when emitting match started', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const io = {
      to: jest.fn(() => {
        throw new Error('boom');
      }),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitMatchStarted({
      matchId: 'm-1',
      tournamentId: 't-1',
      tournamentName: 'Test Tournament',
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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
