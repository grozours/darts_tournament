import { config } from '../../src/config/environment';
import logger from '../../src/utils/logger';

const requireAuthMock = jest.fn();

const createNonErrorThrowable = (message: string): Error => {
  const errorValue = new Error(message);
  Object.setPrototypeOf(errorValue, {});
  return errorValue;
};

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

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

describe('websocket server', () => {
  type HandlerMap = Record<string, (...args: unknown[]) => unknown>;
  const validTournamentId = '11111111-1111-4111-8111-111111111111';

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
    (logger as unknown as { debug: jest.Mock }).debug.mockReset();
    (logger as unknown as { info: jest.Mock }).info.mockReset();
    (logger as unknown as { warn: jest.Mock }).warn.mockReset();
    (logger as unknown as { error: jest.Mock }).error.mockReset();
    requireAuthMock.mockReset();
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

    await joinHandler(validTournamentId);

    expect(socket.join).toHaveBeenCalledWith(`tournament-${validTournamentId}`);
    expect(redisClient.sadd).toHaveBeenCalledWith(`tournament:${validTournamentId}:clients`, 'socket-1');

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

    await getHandler(handlers, 'error')(new Error('socket-fail'));
    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
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

    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const handlers = (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers;

    await getHandler(handlers, 'join-tournament')(validTournamentId);
    await getHandler(handlers, 'leave-tournament')(validTournamentId);

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'JOIN_FAILED' }));
    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
  });

  it('handles non-Error values in join/leave/disconnect failures', async () => {
    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();

    const socket = {
      id: 'socket-non-error',
      on: socketOn,
      join: jest.fn().mockRejectedValue({ reason: 'join-fail-object' }),
      leave: jest.fn().mockRejectedValue({ reason: 'leave-fail-object' }),
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
      sockets: { sockets: new Map([['socket-non-error', socket]]) },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    redisClient.keys.mockRejectedValueOnce({ reason: 'keys-fail-object' });

    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const handlers = (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers;

    await getHandler(handlers, 'join-tournament')(validTournamentId);
    await getHandler(handlers, 'leave-tournament')(validTournamentId);
    await getHandler(handlers, 'disconnect')('bye');

    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
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

    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
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

    const { setupWebSocketServer } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    getHandler(onHandlers, 'connection')(socket as never);
    const disconnectHandler = getHandler(
      (socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> }).handlers,
      'disconnect'
    );

    await disconnectHandler('transport close');
    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
  });

  it('warns when score emission is slow', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_250);

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitMatchScoreUpdated('m-1', 't-1', { score: 10 });

    expect((logger as unknown as { warn: jest.Mock }).warn).toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('handles errors when emitting match started', async () => {
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

    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
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

  it('authenticates joins from token and stores auth payload', async () => {
    const originalAuthEnabled = config.auth.enabled;
    config.auth.enabled = true;

    requireAuthMock.mockImplementation((request: { headers: { authorization?: string }; auth?: { payload?: unknown } }, response: { status: () => unknown; json: () => unknown; setHeader: () => unknown; removeHeader: () => unknown }, next: (error?: unknown) => void) => {
      response.status();
      response.json();
      response.setHeader();
      response.removeHeader();
      if (request.headers.authorization === 'Bearer auth-token') {
        request.auth = { payload: { sub: 'user-1' } };
      }
      next();
    });

    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();
    const socket = {
      id: 'socket-auth-1',
      on: socketOn,
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      data: {},
      handshake: {
        auth: { token: 'auth-token' },
        headers: {},
        query: {},
      },
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-auth-1', socket]]) },
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

    await joinHandler(validTournamentId);

    expect(socket.join).toHaveBeenCalledWith(`tournament-${validTournamentId}`);
    expect(socket.emit).toHaveBeenCalledWith('joined-tournament', {
      tournamentId: validTournamentId,
      clientId: 'socket-auth-1',
    });
    expect((socket as unknown as { data: { authPayload?: unknown } }).data.authPayload).toEqual({ sub: 'user-1' });

    config.auth.enabled = originalAuthEnabled;
  });

  it('rejects joins when auth fails and supports header authorization variants', async () => {
    const originalAuthEnabled = config.auth.enabled;
    config.auth.enabled = true;

    requireAuthMock.mockImplementation((request: { headers: { authorization?: string }; auth?: { payload?: unknown } }, _response: unknown, next: (error?: unknown) => void) => {
      if (request.headers.authorization === 'Bearer header-token') {
        request.auth = { payload: { sub: 'user-header' } };
        next();
        return;
      }
      if (request.headers.authorization === 'Bearer prefixed-token') {
        request.auth = { payload: { sub: 'user-prefixed' } };
        next();
        return;
      }
      if (request.headers.authorization === 'Bearer should-error') {
        next(new Error('auth-fail'));
        return;
      }
      next();
    });

    const onHandlers: HandlerMap = {};
    const socketOn = jest.fn();
    const socket = {
      id: 'socket-auth-2',
      on: socketOn,
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      data: {},
      handshake: {
        auth: {},
        headers: { authorization: ['Bearer header-token'] },
        query: {},
      },
    };

    socketOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers ??= {};
      (socket as unknown as { handlers?: Record<string, (...args: unknown[]) => void> }).handlers![event] = handler;
    });

    const io = {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        onHandlers[event] = handler as never;
      }),
      sockets: { sockets: new Map([['socket-auth-2', socket]]) },
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

    await joinHandler(validTournamentId);
    expect(socket.join).toHaveBeenCalledTimes(1);

    (socket as unknown as { handshake: { auth: { token?: string } } }).handshake.auth.token = 'Bearer prefixed-token';
    (socket as unknown as { handshake: { headers: { authorization: string[] } } }).handshake.headers.authorization = ['Bearer header-token'];
    await joinHandler(validTournamentId);
    expect(socket.join).toHaveBeenCalledTimes(2);

    delete (socket as unknown as { handshake: { auth: { token?: string } } }).handshake.auth.token;
    (socket as unknown as { handshake: { headers: { authorization: string } } }).handshake.headers.authorization = 'Bearer header-token';
    await joinHandler(validTournamentId);
    expect(socket.join).toHaveBeenCalledTimes(3);

    delete (socket as unknown as { handshake: { auth: { token?: string } } }).handshake.auth.token;
    (socket as unknown as { handshake: { headers: { authorization: string[] } } }).handshake.headers.authorization = ['Bearer should-error'];
    await joinHandler(validTournamentId);
    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });

    delete (socket as unknown as { handshake: { auth: { token?: string } } }).handshake.auth.token;
    (socket as unknown as { handshake: { headers: { authorization: unknown } } }).handshake.headers.authorization = [123];
    await joinHandler(validTournamentId);
    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });

    delete (socket as unknown as { handshake: { auth: { token?: string }; headers: { authorization?: unknown } } }).handshake.auth.token;
    delete (socket as unknown as { handshake: { auth: { token?: string }; headers: { authorization?: unknown } } }).handshake.headers.authorization;
    await joinHandler(validTournamentId);
    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });

    config.auth.enabled = originalAuthEnabled;
  });

  it('covers remaining websocket emitter branches', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const { WebSocketService } = await import('../../src/websocket/server');
    const service = new WebSocketService(io as never);

    await service.emitMatchStarted({
      matchId: 'm-ok',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      target: { id: 'target-1', targetNumber: 7 },
      match: { source: 'pool', matchNumber: 1 },
      players: [],
    });
    expect((logger as unknown as { debug: jest.Mock }).debug).toHaveBeenCalledWith(
      'Match started event emitted',
      expect.objectContaining({ metadata: expect.objectContaining({ targetNumber: 7 }) })
    );

    const failingIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };
    redisClient.setex.mockRejectedValueOnce({ reason: 'redis-fail-object' });
    const failingService = new WebSocketService(failingIo as never);

    await failingService.emitTournamentUpdated('t-1', 'LIVE');
    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalledWith(
      'Failed to emit tournament updated event',
      expect.any(Object)
    );

    redisClient.setex.mockRejectedValueOnce(new Error('redis-fail-error'));
    await failingService.emitTournamentUpdated('t-1', 'LIVE');

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('player-fail');
    });
    await failingService.emitPlayerRegistered('t-1', { id: 'p-1' });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw new Error('player-fail-error');
    });
    await failingService.emitPlayerRegistered('t-1', { id: 'p-2' });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('score-fail');
    });
    await failingService.emitMatchScoreUpdated('m-1', 't-1', { score: 1 });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw new Error('score-fail-error');
    });
    await failingService.emitMatchScoreUpdated('m-2', 't-1', { score: 2 });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('format-change-fail');
    });
    await failingService.emitMatchFormatChanged({
      event: 'format_changed',
      matchId: 'm-2',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      matchFormatKey: 'BO3',
      matchFormatTooltip: 'key: BO3',
      match: { source: 'pool', matchNumber: 2 },
      players: [],
    });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('completed-fail');
    });
    await failingService.emitMatchCompleted('m-2', 't-1', { id: 'p-1' });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('finished-fail');
    });
    await failingService.emitMatchFinished({
      event: 'completed',
      matchId: 'm-2',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      match: { source: 'pool', matchNumber: 2 },
      players: [],
    });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('started-fail');
    });
    await failingService.emitMatchStarted({
      matchId: 'm-2',
      tournamentId: 't-1',
      tournamentName: 'Cup',
      match: { source: 'pool', matchNumber: 2 },
      players: [],
    });

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('target-fail');
    });
    await failingService.emitTargetAvailable('target-2', 't-1');

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('pool-fail');
    });
    await failingService.emitPoolAssigned('t-1', []);

    (failingIo.to as jest.Mock).mockImplementationOnce(() => {
      throw createNonErrorThrowable('schedule-fail');
    });
    await failingService.emitScheduleGenerated('t-1', {});

    expect((logger as unknown as { error: jest.Mock }).error).toHaveBeenCalled();
  });

  it('returns websocket singleton and handles non-Error client count failure', async () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
      on: jest.fn(),
    };

    const { setupWebSocketServer, getWebSocketService } = await import('../../src/websocket/server');
    setupWebSocketServer(io as never);

    const service = getWebSocketService();
    expect(service).toBeDefined();

    redisClient.scard.mockRejectedValueOnce({ reason: 'scard-fail-object' });
    await expect(service?.getConnectedClientsCount('t-42')).resolves.toBe(0);
  });
});
