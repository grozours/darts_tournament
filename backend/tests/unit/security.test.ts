import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';

const capturedOptions: Array<Record<string, unknown>> = [];

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: (options: Record<string, unknown>) => {
    capturedOptions.push(options);
    return (_request: unknown, _response: unknown, next: () => void) => next();
  },
}));

describe('security middleware', () => {
  beforeEach(() => {
    capturedOptions.length = 0;
    jest.resetModules();
  });

  it('applies security headers and removes powered-by', async () => {
    const { securityMiddleware } = await import('../../src/middleware/security');
    const setHeader = jest.fn();
    const removeHeader = jest.fn();
    const next = jest.fn();

    securityMiddleware({} as Request, { setHeader, removeHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });

  it('applies CSP header and file-security headers', async () => {
    const { cspMiddleware, fileSecurityMiddleware } = await import('../../src/middleware/security');
    const setHeader = jest.fn();
    const next = jest.fn();

    cspMiddleware({} as Request, { setHeader } as unknown as Response, next);
    expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));

    setHeader.mockClear();
    fileSecurityMiddleware({} as Request, { setHeader } as unknown as Response, next);
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
    expect(next).toHaveBeenCalled();
  });

  it('sanitizes body/query/params recursively', async () => {
    const { sanitizeMiddleware } = await import('../../src/middleware/security');
    const request = {
      body: {
        html: '<script>alert(1)</script>ok',
        nested: { link: 'javascript:evil()', event: 'onload=boom' },
      },
      query: { q: '<script>x</script>' },
      params: { id: 'javascript:1' },
    } as unknown as Request;

    sanitizeMiddleware(request, {} as Response, jest.fn());

    expect((request.body as Record<string, unknown>).html).toBe('ok');
    expect((request.body as { nested: { link: string } }).nested.link).toBe('evil()');
    expect((request.query as Record<string, unknown>).q).toBe('');
    expect((request.params as Record<string, unknown>).id).toBe('1');
  });

  it('rate-limit skip logic handles disabled, localhost and auth endpoint branches', async () => {
    const security = await import('../../src/middleware/security');
    const { config } = await import('../../src/config/environment');
    const originalDevelopment = config.isDevelopment;
    const originalRateLimitEnabled = config.performance.rateLimitEnabled;

    config.isDevelopment = true;
    config.performance.rateLimitEnabled = true;

    const apiOptions = capturedOptions[0] as { skip?: (request: Request) => boolean };
    const authOptions = capturedOptions[2] as { skip?: (request: Request) => boolean };

    expect(apiOptions.skip?.({
      ip: '::1',
      hostname: 'localhost',
      method: 'GET',
      originalUrl: '/api/tournaments',
    } as Request)).toBe(true);

    config.performance.rateLimitEnabled = false;
    expect(apiOptions.skip?.({
      ip: '10.0.0.1',
      hostname: 'example.com',
      method: 'POST',
      originalUrl: '/api/tournaments',
    } as Request)).toBe(true);

    config.performance.rateLimitEnabled = true;
    expect(authOptions.skip?.({
      ip: '10.0.0.1',
      hostname: 'example.com',
      method: 'GET',
      originalUrl: '/api/auth/login',
    } as Request)).toBe(true);

    expect(authOptions.skip?.({
      ip: '10.0.0.1',
      hostname: 'example.com',
      method: 'POST',
      originalUrl: '/api/auth/dev-autologin/',
    } as Request)).toBe(true);

    expect(security.apiRateLimit).toBeDefined();
    expect(security.authRateLimit).toBeDefined();
    expect(security.uploadRateLimit).toBeDefined();

    config.isDevelopment = originalDevelopment;
    config.performance.rateLimitEnabled = originalRateLimitEnabled;
  });
});
