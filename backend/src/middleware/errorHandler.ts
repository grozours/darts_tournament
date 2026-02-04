import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/environment';

// Custom error class per constitution error handling requirements
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string | undefined;

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

// Error handler middleware per constitution requirements
export const errorHandler = (
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code: string | undefined;
  let details: any = undefined;

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = (error as any).details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: (err as any).received || undefined,
    }));
  } else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON';
    code = 'INVALID_JSON';
  } else if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    statusCode = 400;
    code = prismaError.code;
    
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
        message = 'Database error';
    }
  } else if (error.name === 'MulterError') {
    const multerError = error as any;
    statusCode = 400;
    code = multerError.code || 'FILE_UPLOAD_ERROR';

    // Customize messages for common multer errors to match contract tests
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
    } else {
      message = multerError.message || 'File upload error';
    }
  }

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
      ...(code && { code }),
      ...(details && { details }),
      ...(config.isDevelopment && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (
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
    (error as any).field = field;
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