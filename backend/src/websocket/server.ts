import { Server as SocketServer, Socket } from 'socket.io';
import type { Request, Response } from 'express';
import { redis } from '../config/redis';
import { config } from '../config/environment';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

type PlayerSummary = {
  id?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
  teamName?: string;
  [key: string]: unknown;
};

type MatchStartedPayload = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  startedAt?: string;
  matchFormatKey?: string;
  matchFormatTooltip?: string;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string | null;
  };
  match: {
    source: 'pool' | 'bracket';
    matchNumber: number;
    roundNumber?: number | null;
    stageNumber?: number;
    poolNumber?: number;
    poolId?: string;
    bracketName?: string | null;
  };
  players: PlayerSummary[];
};

type MatchFinishedPayload = MatchStartedPayload & {
  event: 'completed' | 'cancelled';
  finishedAt?: string;
  winner?: PlayerSummary | null;
  players: Array<PlayerSummary & {
    scoreTotal?: number | null;
    legsWon?: number | null;
    setsWon?: number | null;
    isWinner?: boolean | null;
  }>;
};

type MatchFormatChangedPayload = MatchStartedPayload & {
  event: 'format_changed';
  matchFormatKey: string;
  matchFormatTooltip: string;
};

type ScorePayload = Record<string, unknown>;
type PoolAssignmentPayload = Record<string, unknown>;
type SchedulePayload = Record<string, unknown>;

// WebSocket events per constitution real-time requirements
export interface WebSocketEvents {
  // Tournament events
  'tournament:updated': (data: { tournamentId: string; status: string }) => void;
  'tournament:player-registered': (data: { tournamentId: string; player: PlayerSummary }) => void;
  
  // Match events
  'match:started': (data: MatchStartedPayload) => void;
  'match:score-updated': (data: { matchId: string; tournamentId: string; score: ScorePayload }) => void;
  'match:completed': (data: { matchId: string; tournamentId: string; winner: PlayerSummary }) => void;
  'match:finished': (data: MatchFinishedPayload) => void;
  'match:format-changed': (data: MatchFormatChangedPayload) => void;
  
  // Target events
  'target:available': (data: { targetId: string; tournamentId: string }) => void;
  'target:in-use': (data: { targetId: string; matchId: string; tournamentId: string }) => void;
  
  // Pool events
  'pool:assigned': (data: { tournamentId: string; poolAssignments: PoolAssignmentPayload[] }) => void;
  
  // Schedule events
  'schedule:generated': (data: { tournamentId: string; schedule: SchedulePayload }) => void;
  'schedule:updated': (data: { tournamentId: string; changes: SchedulePayload }) => void;
  
  // Error events
  'error': (data: { message: string; code?: string }) => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const toHeaderValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
};

const resolveHandshakeAuthorization = (socket: Socket): string | undefined => {
  const tokenCandidate = socket.handshake.auth?.token;
  if (typeof tokenCandidate === 'string' && tokenCandidate.trim()) {
    const trimmedToken = tokenCandidate.trim();
    return trimmedToken.startsWith('Bearer ') ? trimmedToken : `Bearer ${trimmedToken}`;
  }

  const headerAuthorization = toHeaderValue(socket.handshake.headers.authorization);
  if (headerAuthorization?.trim()) {
    return headerAuthorization.trim();
  }

  return undefined;
};

const normalizeMimeType = (value: string): string => {
  const firstSegment = value.split(';').at(0);
  return (firstSegment ?? '').trim().toLowerCase();
};

const matchesMimeType = (contentType: string, expectedType: string): boolean => {
  const normalizedContentType = normalizeMimeType(contentType);
  const normalizedExpectedType = expectedType.trim().toLowerCase();

  if (!normalizedExpectedType) {
    return false;
  }

  if (normalizedExpectedType === '*/*') {
    return true;
  }

  if (normalizedExpectedType === 'json') {
    return normalizedContentType === 'application/json' || normalizedContentType.endsWith('+json');
  }

  if (normalizedExpectedType === 'urlencoded') {
    return normalizedContentType === 'application/x-www-form-urlencoded';
  }

  if (normalizedExpectedType.endsWith('/*')) {
    const expectedGroup = normalizedExpectedType.slice(0, normalizedExpectedType.indexOf('/'));
    return normalizedContentType.startsWith(`${expectedGroup}/`);
  }

  return normalizedContentType === normalizedExpectedType;
};

const resolveRequestHeader = (headers: Record<string, unknown>, headerName: string): string | undefined => {
  const normalizedHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalizedHeaderName) {
      continue;
    }
    return toHeaderValue(value);
  }

  return undefined;
};

const authenticateSocket = async (socket: Socket): Promise<boolean> => {
  if (!config.auth.enabled) {
    return true;
  }

  const authorizationHeader = resolveHandshakeAuthorization(socket);

  const requestHeaders: Record<string, unknown> = {
    ...socket.handshake.headers,
    ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
  };
  const handshakeUrl = typeof socket.handshake.url === 'string' && socket.handshake.url.trim()
    ? socket.handshake.url
    : '/socket.io';

  const request = {
    headers: requestHeaders,
    method: 'GET',
    url: handshakeUrl,
    originalUrl: handshakeUrl,
    path: handshakeUrl,
    query: socket.handshake.query,
    correlationId: undefined,
    get: (name: string): string | undefined => resolveRequestHeader(requestHeaders, name),
    header: (name: string): string | undefined => resolveRequestHeader(requestHeaders, name),
    is: (type: string | string[]): string | false => {
      const contentType = resolveRequestHeader(requestHeaders, 'content-type');
      if (!contentType) {
        return false;
      }

      const expectedTypes = Array.isArray(type) ? type : [type];
      for (const expectedType of expectedTypes) {
        if (matchesMimeType(contentType, expectedType)) {
          return expectedType;
        }
      }

      return false;
    },
  } as unknown as Request;

  const response = {
    status: () => response,
    json: () => response,
    setHeader: () => response,
    removeHeader: () => response,
  } as unknown as Response;

  let authFailureReason: string | undefined;
  const isAuthenticated = await new Promise<boolean>((resolve) => {
    try {
      requireAuth(request, response, (error?: unknown) => {
        if (error) {
          authFailureReason = error instanceof Error ? error.message : String(error);
          resolve(false);
          return;
        }
        resolve(Boolean(request.auth?.payload));
      });
    } catch (error) {
      logger.warn('Socket authentication failed before completion', {
        metadata: {
          socketId: socket.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      resolve(false);
    }
  });

  if (isAuthenticated) {
    socket.data.authPayload = request.auth?.payload;
    socket.data.authFailureReason = undefined;
  } else {
    socket.data.authFailureReason = authFailureReason;
  }

  return isAuthenticated;
};

const handleSocketConnection = (socket: Socket): void => {
  logger.info('WebSocket client connected', {
    metadata: { socketId: socket.id },
  });

  socket.on('join-tournament', async (tournamentId: string) => {
    logger.info('WebSocket join tournament requested', {
      metadata: { socketId: socket.id, tournamentId },
    });

    if (!tournamentId || typeof tournamentId !== 'string' || !isUuid(tournamentId)) {
      logger.warn('WebSocket join tournament rejected: invalid tournament id', {
        metadata: { socketId: socket.id, tournamentId },
      });
      socket.emit('error', { message: 'Invalid tournament ID', code: 'INVALID_TOURNAMENT_ID' });
      return;
    }

    const authenticated = await authenticateSocket(socket);
    if (!authenticated) {
      const authorizationHeader = resolveHandshakeAuthorization(socket);
      const authScheme = authorizationHeader?.split(' ')[0] ?? 'none';
      const authLength = authorizationHeader ? authorizationHeader.length : 0;
      const failureReason = typeof socket.data.authFailureReason === 'string'
        ? socket.data.authFailureReason
        : 'unknown';
      logger.warn(
        `WebSocket join tournament rejected: unauthorized (hasAuthorization=${Boolean(authorizationHeader)} scheme=${authScheme} authLength=${authLength} reason=${failureReason})`,
        {
        metadata: {
          socketId: socket.id,
          tournamentId,
          hasAuthorization: Boolean(authorizationHeader),
          authScheme,
          authLength,
          reason: failureReason,
        },
        }
      );
      socket.emit('error', { message: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }

    try {
      await socket.join(`tournament-${tournamentId}`);
      logger.info('WebSocket client joined tournament room', {
        metadata: { socketId: socket.id, tournamentId },
      });

      await redis.getClient().sadd(`tournament:${tournamentId}:clients`, socket.id);

      socket.emit('joined-tournament', { tournamentId, clientId: socket.id });
    } catch (error) {
      logger.error('Failed to join tournament room', {
        metadata: {
          socketId: socket.id,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      socket.emit('error', { message: 'Failed to join tournament', code: 'JOIN_FAILED' });
    }
  });

  socket.on('leave-tournament', async (tournamentId: string) => {
    if (!tournamentId || typeof tournamentId !== 'string') {
      return;
    }

    try {
      await socket.leave(`tournament-${tournamentId}`);
      logger.debug('WebSocket client left tournament room', {
        metadata: { socketId: socket.id, tournamentId },
      });

      await redis.getClient().srem(`tournament:${tournamentId}:clients`, socket.id);

      socket.emit('left-tournament', { tournamentId, clientId: socket.id });
    } catch (error) {
      logger.error('Failed to leave tournament room', {
        metadata: {
          socketId: socket.id,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  socket.on('disconnect', async (reason: string) => {
    logger.debug('WebSocket client disconnected', {
      metadata: { socketId: socket.id, reason },
    });

    try {
      const keys = await redis.getClient().keys('tournament:*:clients');
      for (const key of keys) {
        await redis.getClient().srem(key, socket.id);
      }
    } catch (error) {
      logger.error('Failed to clean up websocket client tracking', {
        metadata: {
          socketId: socket.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  socket.on('error', (error: Error) => {
    logger.error('WebSocket client error', {
      metadata: {
        socketId: socket.id,
        errorMessage: error.message,
      },
    });
  });
};

// WebSocket server setup per constitution real-time requirements
export const setupWebSocketServer = (io: SocketServer): void => {
  webSocketService = new WebSocketService(io);
  io.on('connection', handleSocketConnection);

  // Performance monitoring per constitution
  const monitorConnections = (): void => {
    const connectionCount = io.sockets.sockets.size;
    
    if (config.performance.enableMetrics) {
      logger.debug('WebSocket connection count', {
        metadata: { connectionCount },
      });
    }
    
    // Performance warning if too many connections
    if (connectionCount > 1000) {
      logger.warn('High WebSocket connection count', {
        metadata: { connectionCount },
      });
    }
  };

  // Monitor every 30 seconds
  const monitorInterval = setInterval(monitorConnections, 30_000);
  monitorInterval.unref?.();

  logger.info('WebSocket server initialized', {
    metadata: { realtimeSupport: true },
  });
};

let webSocketService: WebSocketService | undefined;

export const getWebSocketService = () => webSocketService;

// WebSocket event emitters for use in services
export class WebSocketService {
  private readonly io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  // Tournament events
  async emitTournamentUpdated(tournamentId: string, status: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:updated', { tournamentId, status });
      
      // Cache the event in Redis for reliability
      await redis.getClient().setex(
        `event:tournament:${tournamentId}:updated`,
        300, // 5 minutes TTL
        JSON.stringify({ tournamentId, status, timestamp: Date.now() })
      );

      logger.debug('Tournament updated event emitted', {
        metadata: { tournamentId, status },
      });
    } catch (error) {
      logger.error('Failed to emit tournament updated event', {
        metadata: {
          tournamentId,
          status,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchFormatChanged(payload: MatchFormatChangedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:format-changed', payload);

      logger.debug('Match format changed event emitted', {
        metadata: { matchId: payload.matchId, tournamentId: payload.tournamentId, matchFormatKey: payload.matchFormatKey },
      });
    } catch (error) {
      logger.error('Failed to emit match format changed event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitPlayerRegistered(tournamentId: string, player: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:player-registered', { 
        tournamentId, 
        player 
      });

      logger.debug('Player registered event emitted', {
        metadata: { tournamentId, playerId: player.id },
      });
    } catch (error) {
      logger.error('Failed to emit player registered event', {
        metadata: {
          tournamentId,
          playerId: player.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Match events per <2s constitution requirement
  async emitMatchScoreUpdated(matchId: string, tournamentId: string, score: ScorePayload): Promise<void> {
    try {
      const startTime = Date.now();
      
      this.io.to(`tournament-${tournamentId}`).emit('match:score-updated', { 
        matchId, 
        tournamentId, 
        score 
      });
      
      const duration = Date.now() - startTime;
      if (duration > 100) { // Warning if over 100ms for real-time updates
        logger.warn('Slow websocket emission', {
          metadata: { matchId, tournamentId, durationMs: duration },
        });
      }

      logger.debug('Match score updated event emitted', {
        metadata: { matchId, tournamentId, durationMs: duration },
      });
    } catch (error) {
      logger.error('Failed to emit match score update', {
        metadata: {
          matchId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchCompleted(matchId: string, tournamentId: string, winner: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('match:completed', { 
        matchId, 
        tournamentId, 
        winner 
      });

      logger.debug('Match completed event emitted', {
        metadata: { matchId, tournamentId, winnerId: winner?.id },
      });
    } catch (error) {
      logger.error('Failed to emit match completed event', {
        metadata: {
          matchId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchFinished(payload: MatchFinishedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:finished', payload);

      logger.debug('Match finished event emitted', {
        metadata: { matchId: payload.matchId, tournamentId: payload.tournamentId, event: payload.event },
      });
    } catch (error) {
      logger.error('Failed to emit match finished event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchStarted(payload: MatchStartedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:started', payload);

      logger.info('Match started event emitted', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          targetNumber: payload.target?.targetNumber,
        },
      });
    } catch (error) {
      logger.error('Failed to emit match started event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Target events
  async emitTargetAvailable(targetId: string, tournamentId: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('target:available', { 
        targetId, 
        tournamentId 
      });

      logger.debug('Target available event emitted', {
        metadata: { targetId, tournamentId },
      });
    } catch (error) {
      logger.error('Failed to emit target available event', {
        metadata: {
          targetId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Pool assignment events
  async emitPoolAssigned(tournamentId: string, poolAssignments: PoolAssignmentPayload[]): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('pool:assigned', { 
        tournamentId, 
        poolAssignments 
      });

      logger.debug('Pool assigned event emitted', {
        metadata: { tournamentId, assignmentsCount: poolAssignments.length },
      });
    } catch (error) {
      logger.error('Failed to emit pool assigned event', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Schedule events
  async emitScheduleGenerated(tournamentId: string, schedule: SchedulePayload): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('schedule:generated', { 
        tournamentId, 
        schedule 
      });

      logger.debug('Schedule generated event emitted', {
        metadata: { tournamentId },
      });
    } catch (error) {
      logger.error('Failed to emit schedule generated event', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Get connected clients count for a tournament
  async getConnectedClientsCount(tournamentId: string): Promise<number> {
    try {
      const clients = await redis.getClient().scard(`tournament:${tournamentId}:clients`);
      return clients;
    } catch (error) {
      logger.error('Failed to get connected clients count', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      return 0;
    }
  }
}

export default WebSocketService;