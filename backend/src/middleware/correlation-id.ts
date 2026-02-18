import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Extend the Request interface to include correlationId
declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

/**
 * Middleware to generate and attach correlation ID to requests
 */
export const correlationIdMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  // Check if correlation ID is provided in headers, otherwise generate one
  const correlationId = 
    (request.headers['x-correlation-id'] as string) ||
    (request.headers['correlation-id'] as string) ||
    uuidv4();

  // Attach correlation ID to the request object
  request.correlationId = correlationId;

  // Add correlation ID to response headers for tracing
  response.setHeader('x-correlation-id', correlationId);

  // Log the incoming request
  logger.info(
    `${request.method} ${request.path}`,
    {
      correlationId,
      method: request.method,
      path: request.path,
      query: request.query,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.socket.remoteAddress,
      metadata: {
        requestStart: new Date().toISOString(),
      }
    }
  );

  next();
};

/**
 * Logger instance with correlation ID context
 */
export const createContextLogger = (request: Request) => {
  type LogMeta = Record<string, unknown>;
  return {
    error: (message: string, meta?: LogMeta) => {
      logger.error(message, {
        correlationId: request.correlationId,
        ...meta,
      });
    },
    warn: (message: string, meta?: LogMeta) => {
      logger.warn(message, {
        correlationId: request.correlationId,
        ...meta,
      });
    },
    info: (message: string, meta?: LogMeta) => {
      logger.info(message, {
        correlationId: request.correlationId,
        ...meta,
      });
    },
    debug: (message: string, meta?: LogMeta) => {
      logger.debug(message, {
        correlationId: request.correlationId,
        ...meta,
      });
    },
  };
};

export default correlationIdMiddleware;