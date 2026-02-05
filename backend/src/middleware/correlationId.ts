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
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if correlation ID is provided in headers, otherwise generate one
  const correlationId = 
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['correlation-id'] as string) ||
    uuidv4();

  // Attach correlation ID to the request object
  req.correlationId = correlationId;

  // Add correlation ID to response headers for tracing
  res.setHeader('x-correlation-id', correlationId);

  // Log the incoming request
  logger.info(
    `${req.method} ${req.path}`,
    {
      correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
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
export const createContextLogger = (req: Request) => {
  type LogMeta = Record<string, unknown>;
  return {
    error: (message: string, meta?: LogMeta) => {
      logger.error(message, {
        correlationId: req.correlationId,
        ...meta,
      });
    },
    warn: (message: string, meta?: LogMeta) => {
      logger.warn(message, {
        correlationId: req.correlationId,
        ...meta,
      });
    },
    info: (message: string, meta?: LogMeta) => {
      logger.info(message, {
        correlationId: req.correlationId,
        ...meta,
      });
    },
    debug: (message: string, meta?: LogMeta) => {
      logger.debug(message, {
        correlationId: req.correlationId,
        ...meta,
      });
    },
  };
};

export default correlationIdMiddleware;