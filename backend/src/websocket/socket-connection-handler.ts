import type { Request, Response } from 'express';
import type { Socket } from 'socket.io';
import { redis } from '../config/redis';
import { config } from '../config/environment';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

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
  const delimiterIndex = value.indexOf(';');
  const firstSegment = delimiterIndex === -1 ? value : value.slice(0, delimiterIndex);
  return firstSegment.trim().toLowerCase();
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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
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
          authFailureReason = toErrorMessage(error);
          resolve(false);
          return;
        }
        resolve(Boolean(request.auth?.payload));
      });
    } catch (error) {
      logger.warn('Socket authentication failed before completion', {
        metadata: {
          socketId: socket.id,
          errorMessage: toErrorMessage(error),
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

const onJoinTournament = (socket: Socket) => async (tournamentId: string) => {
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
};

const onLeaveTournament = (socket: Socket) => async (tournamentId: string) => {
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
};

const onDisconnect = (socket: Socket) => async (reason: string) => {
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
};

const onSocketError = (socket: Socket) => (error: Error) => {
  logger.error('WebSocket client error', {
    metadata: {
      socketId: socket.id,
      errorMessage: error.message,
    },
  });
};

export const handleSocketConnection = (socket: Socket): void => {
  logger.info('WebSocket client connected', {
    metadata: { socketId: socket.id },
  });

  socket.on('join-tournament', onJoinTournament(socket));
  socket.on('leave-tournament', onLeaveTournament(socket));
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  socket.on('disconnect', onDisconnect(socket));
  socket.on('error', onSocketError(socket));
};