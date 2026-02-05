import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/environment';

// Custom error class per constitution error handling requirements
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code !== undefined) {
      this.code = code;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

type ErrorContext = {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
};

type ErrorWithDetails = Error & { details?: unknown; code?: string };
type PrismaError = { code?: string; meta?: { target?: unknown } };
type MulterErrorLike = { code?: string; field?: string; message?: string };

const defaultErrorContext: ErrorContext = {
  statusCode: 500,
  message: 'Internal Server Error',
};

const buildAppErrorContext = (error: AppError): ErrorContext => {
  const details = (error as ErrorWithDetails).details;
  const context: ErrorContext = {
    statusCode: error.statusCode,
    message: error.message,
  };
  if (error.code) {
    context.code = error.code;
  }
  if (details) {
    context.details = details;
  }
  return context;
};

const buildZodErrorContext = (error: ZodError): ErrorContext => ({
  statusCode: 400,
  message: 'Validation Error',
  code: 'VALIDATION_ERROR',
  details: error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    value: 'received' in err ? (err as { received?: unknown }).received : undefined,
  })),
});

const buildSyntaxErrorContext = (error: Error): ErrorContext | null => {
  if (error instanceof SyntaxError && 'body' in error) {
    return {
      statusCode: 400,
      message: 'Invalid JSON',
      code: 'INVALID_JSON',
    };
  }

  return null;
};

const buildPrismaErrorContext = (error: Error): ErrorContext | null => {
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as PrismaError;
    let statusCode = 400;
    let message = 'Database error';
    let details: unknown = undefined;

    switch (prismaError.code) {
      case 'P2002':
        message = 'Unique constraint violation';
        details = { field: prismaError.meta?.target };
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      default:
        break;
    }

    const context: ErrorContext = {
      statusCode,
      message,
    };
    if (prismaError.code) {
      context.code = prismaError.code;
    }
    if (details) {
      context.details = details;
    }
    return context;
  }

  return null;
};

const buildMulterErrorContext = (error: Error): ErrorContext | null => {
  if (error.name === 'MulterError') {
    const multerError = error as MulterErrorLike;
    let message = multerError.message || 'File upload error';

    if (multerError.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large';
    } else if (multerError.code === 'LIMIT_FILE_COUNT') {
      message = 'Only a single file is allowed';
    } else if (multerError.code === 'LIMIT_UNEXPECTED_FILE') {
      if (multerError.field && multerError.field !== 'logo') {
        message = 'Invalid file field. Expected logo';
      } else {
        message = 'Only a single file is allowed';
      }
    }

    return {
      statusCode: 400,
      message,
      code: multerError.code || 'FILE_UPLOAD_ERROR',
    };
  }

  return null;
};

const resolveErrorContext = (error: Error | AppError | ZodError): ErrorContext => {
  if (error instanceof AppError) {
    return buildAppErrorContext(error);
  }

  if (error instanceof ZodError) {
    return buildZodErrorContext(error);
  }

  return (
    buildSyntaxErrorContext(error) ||
    buildPrismaErrorContext(error) ||
    buildMulterErrorContext(error) ||
    defaultErrorContext
  );
};

// Error handler middleware per constitution requirements
export const errorHandler = (
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  void _next;
  const { statusCode, message, code, details } = resolveErrorContext(error);

  // Log error per constitution logging requirements
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message,
    code,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    ...(config.isDevelopment && { stack: error.stack }),
  };

  if (statusCode >= 500) {
    console.error('❌ Server Error:', errorLog);
  } else {
    console.warn('⚠️  Client Error:', errorLog);
  }

  // Response format per constitution consistency requirements
  const errorResponse = {
    error: {
      message,
      statusCode,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(config.isDevelopment && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export const asyncHandler = (fn: AsyncHandler) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Validation error helper
export const createValidationError = (
  message: string,
  field?: string
): AppError => {
  const error = new AppError(message, 400, 'VALIDATION_ERROR');
  if (field) {
    (error as AppError & { field?: string }).field = field;
  }
  return error;
};

// Database error helper
export const createDatabaseError = (
  message: string = 'Database operation failed'
): AppError => {
  return new AppError(message, 500, 'DATABASE_ERROR');
};

// Authentication error helper
export const createAuthError = (
  message: string = 'Authentication required'
): AppError => {
  return new AppError(message, 401, 'AUTH_ERROR');
};

// Authorization error helper
export const createAuthorizationError = (
  message: string = 'Insufficient permissions'
): AppError => {
  return new AppError(message, 403, 'AUTHORIZATION_ERROR');
};