import { z } from 'zod';
import {
  AppError,
  asyncHandler,
  createAuthError,
  createAuthorizationError,
  createDatabaseError,
  createValidationError,
  errorHandler,
  notFoundHandler,
} from '../../src/middleware/error-handler';

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
  stream: {
    write: jest.fn(),
  },
}));

const buildResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return response;
};

const buildRequest = () => ({
  method: 'GET',
  originalUrl: '/api/tournaments',
  get: jest.fn().mockReturnValue('jest'),
  ip: '127.0.0.1',
});

describe('error-handler middleware', () => {
  it('handles AppError responses', () => {
    const request = buildRequest();
    const response = buildResponse();
    const error = new AppError('Bad input', 400, 'BAD_INPUT');

    errorHandler(error, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Bad input',
          statusCode: 400,
          code: 'BAD_INPUT',
        }),
      })
    );
  });

  it('handles Zod validation errors', () => {
    const request = buildRequest();
    const response = buildResponse();
    let zodError: unknown;

    try {
      z.object({ name: z.string() }).parse({});
    } catch (error) {
      zodError = error;
    }

    errorHandler(zodError as never, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      })
    );
  });

  it('handles invalid JSON errors', () => {
    const request = buildRequest();
    const response = buildResponse();
    const error = new SyntaxError('Unexpected token');

    (error as unknown as { body?: string }).body = '{bad json}';

    errorHandler(error, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_JSON',
        }),
      })
    );
  });

  it('handles Prisma unique constraint errors', () => {
    const request = buildRequest();
    const response = buildResponse();
    const error = new Error('Prisma error');

    (error as unknown as { name?: string; code?: string; meta?: { target?: string[] } }).name =
      'PrismaClientKnownRequestError';
    (error as unknown as { code?: string }).code = 'P2002';
    (error as unknown as { meta?: { target?: string[] } }).meta = { target: ['email'] };

    errorHandler(error, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Unique constraint violation',
          code: 'P2002',
        }),
      })
    );
  });

  it('handles Prisma not found errors', () => {
    const request = buildRequest();
    const response = buildResponse();
    const error = new Error('Prisma not found');

    (error as unknown as { name?: string; code?: string }).name = 'PrismaClientKnownRequestError';
    (error as unknown as { code?: string }).code = 'P2025';

    errorHandler(error, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Record not found',
          code: 'P2025',
        }),
      })
    );
  });

  it('handles Multer file size errors', () => {
    const request = buildRequest();
    const response = buildResponse();
    const error = new Error('too big');

    (error as unknown as { name?: string; code?: string }).name = 'MulterError';
    (error as unknown as { code?: string }).code = 'LIMIT_FILE_SIZE';

    errorHandler(error, request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'File too large',
        }),
      })
    );
  });

  it('handles Multer file-count and unexpected-field errors', () => {
    const request = buildRequest();
    const responseA = buildResponse();
    const fileCountError = new Error('too many');

    (fileCountError as unknown as { name?: string; code?: string }).name = 'MulterError';
    (fileCountError as unknown as { code?: string }).code = 'LIMIT_FILE_COUNT';

    errorHandler(fileCountError, request as never, responseA as never, jest.fn());
    expect(responseA.status).toHaveBeenCalledWith(400);
    expect(responseA.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Only a single file is allowed',
        }),
      })
    );

    const responseB = buildResponse();
    const unexpectedFieldError = new Error('unexpected');

    (unexpectedFieldError as unknown as { name?: string; code?: string; field?: string }).name = 'MulterError';
    (unexpectedFieldError as unknown as { code?: string }).code = 'LIMIT_UNEXPECTED_FILE';
    (unexpectedFieldError as unknown as { field?: string }).field = 'avatar';

    errorHandler(unexpectedFieldError, request as never, responseB as never, jest.fn());
    expect(responseB.status).toHaveBeenCalledWith(400);
    expect(responseB.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Invalid file field. Expected logo',
        }),
      })
    );
  });

  it('handles explicit HTTP and unauthorized errors', () => {
    const request = buildRequest();
    const responseA = buildResponse();
    const httpError = new Error('Forbidden request') as Error & { statusCode?: number; code?: string };
    httpError.statusCode = 403;
    httpError.code = 'FORBIDDEN';

    errorHandler(httpError, request as never, responseA as never, jest.fn());
    expect(responseA.status).toHaveBeenCalledWith(403);
    expect(responseA.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Forbidden request',
          code: 'FORBIDDEN',
        }),
      })
    );

    const responseB = buildResponse();
    const authError = new Error('not authorized') as Error & { name: string; code?: string };
    authError.name = 'UnauthorizedError';

    errorHandler(authError, request as never, responseB as never, jest.fn());
    expect(responseB.status).toHaveBeenCalledWith(401);
    expect(responseB.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'UNAUTHORIZED',
        }),
      })
    );
  });

  it('creates validation errors with field metadata', () => {
    const error = createValidationError('Missing field', 'name');

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError & { field?: string }).field).toBe('name');
  });

  it('creates database/auth/authz helper errors', () => {
    expect(createDatabaseError().code).toBe('DATABASE_ERROR');
    expect(createAuthError().statusCode).toBe(401);
    expect(createAuthorizationError().statusCode).toBe(403);
  });

  it('forwards async handler errors', async () => {
    const error = new AppError('Async fail', 500, 'ASYNC_FAIL');
    const next = jest.fn();
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler({} as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('creates not found errors', () => {
    const request = { originalUrl: '/missing' } as never;
    const next = jest.fn();

    notFoundHandler(request, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('/missing');
  });
});
