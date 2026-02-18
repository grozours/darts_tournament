import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../src/config/environment';
import {
  validationMiddleware,
  validate,
  validateUuidParameter,
} from '../../src/middleware/validation';
import {
  correlationIdMiddleware,
  createContextLogger,
} from '../../src/middleware/correlation-id';
import {
  securityMiddleware,
  cspMiddleware,
  sanitizeMiddleware,
  fileSecurityMiddleware,
  createRateLimit,
} from '../../src/middleware/security';
import { AppError } from '../../src/middleware/error-handler';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
}));

jest.mock('express-rate-limit', () => jest.fn((options) => options));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('middleware helpers', () => {
  it('throws when JSON body is missing for mutating requests', () => {
    const request = {
      method: 'POST',
      is: jest.fn().mockReturnValue(true),
      body: undefined,
    };

    expect(() => validationMiddleware(request as never, {} as never, jest.fn()))
      .toThrow(AppError);
  });

  it('passes validation when body is present', () => {
    const request = {
      method: 'POST',
      is: jest.fn().mockReturnValue(true),
      body: { name: 'ok' },
    };
    const next = jest.fn();

    validationMiddleware(request as never, {} as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('parses and validates request bodies', () => {
    const middleware = validate({ body: z.object({ name: z.string() }) });
    const request = { body: { name: 'Ada' } };
    const next = jest.fn();

    middleware(request as never, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(request.body).toEqual({ name: 'Ada' });
  });

  it('reports validation errors via next', () => {
    const middleware = validate({ body: z.object({ name: z.string() }) });
    const request = { body: {} };
    const next = jest.fn();

    middleware(request as never, {} as never, next);

    const error = next.mock.calls[0][0] as AppError & { details?: unknown };
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBeTruthy();
  });

  it('validates uuid parameters', () => {
    const middleware = validateUuidParameter('id');
    const request = { params: { id: 'not-a-uuid' } };
    const next = jest.fn();

    middleware(request as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('uses provided correlation id headers', () => {
    const request = {
      method: 'GET',
      path: '/health',
      headers: { 'x-correlation-id': 'header-id', 'user-agent': 'jest' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as { correlationId?: string };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationIdMiddleware(request as never, response as never, next);

    expect(request.correlationId).toBe('header-id');
    expect(response.setHeader).toHaveBeenCalledWith('x-correlation-id', 'header-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates correlation ids when missing', () => {
    const request = {
      method: 'GET',
      path: '/health',
      headers: { 'user-agent': 'jest' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as { correlationId?: string };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationIdMiddleware(request as never, response as never, next);

    expect(uuidv4).toHaveBeenCalled();
    expect(request.correlationId).toBe('generated-uuid');
  });

  it('creates context logger with correlation id', () => {
    const request = { correlationId: 'ctx-1' };
    const logger = createContextLogger(request as never);

    logger.info('message');

    expect(logger).toHaveProperty('error');
  });

  it('adds standard security headers', () => {
    const response = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    };
    const next = jest.fn();

    securityMiddleware({} as never, response as never, next);

    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });

  it('adds CSP header', () => {
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    cspMiddleware({} as never, response as never, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
  });

  it('sanitizes request data', () => {
    const request = {
      body: {
        name: '<script>alert(1)</script>safe',
        link: 'javascript:alert(1)',
        attr: 'onerror=alert(1)',
        nested: { value: '<script>bad</script>' },
      },
      query: { q: '<script>q</script>' },
      params: { id: 'onload=evil' },
    };
    const next = jest.fn();

    sanitizeMiddleware(request as never, {} as never, next);

    expect(String(request.body.name)).not.toContain('<script>');
    expect(String(request.body.link)).not.toContain('javascript:');
    expect(String(request.body.attr)).not.toContain('onerror');
    expect(String(request.body.nested.value)).not.toContain('<script>');
    expect(String(request.query.q)).not.toContain('<script>');
    expect(String(request.params.id)).not.toContain('onload');
    expect(next).toHaveBeenCalled();
  });

  it('adds file security headers', () => {
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    fileSecurityMiddleware({} as never, response as never, next);

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it('creates rate limit options with skip logic', () => {
    const originalIsDevelopment = config.isDevelopment;
    config.isDevelopment = true;

    const rateLimiter = createRateLimit(1_000, 5) as unknown as {
      skip?: (request: { ip?: string }) => boolean;
      max?: number;
      windowMs?: number;
    };

    expect(rateLimiter.max).toBe(5);
    expect(rateLimiter.windowMs).toBe(1_000);
    expect(rateLimiter.skip?.({ ip: '::1' })).toBe(true);

    config.isDevelopment = originalIsDevelopment;
  });
});
