import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';

type RateLimitOptions = {
  skip?: (request: Request) => boolean;
};

const isLocalDevelopmentRequest = (request: Request): boolean => {
  if (!config.isDevelopment) {
    return false;
  }

  const host = request.hostname?.toLowerCase();
  return request.ip === '::1' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const isDevelopmentProfileEndpoint = (request: Request): boolean => {
  const path = request.originalUrl.split('?')[0] ?? request.originalUrl;
  return path === '/api/auth/me' || path === '/api/auth/dev-autologin';
};

// Security middleware per constitution requirements
export const securityMiddleware = (
  _request: Request,
  response: Response,
  next: NextFunction
): void => {
  // Add security headers
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  response.removeHeader('X-Powered-By');
  
  next();
};

// Rate limiting per constitution performance requirements
export const createRateLimit = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 100,
  options: RateLimitOptions = {}
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 60_000)} minutes.`,
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (request: Request) => {
      if (isLocalDevelopmentRequest(request)) {
        return true;
      }
      return options.skip?.(request) ?? false;
    },
  });
};

// API rate limits
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 100, {
  skip: isDevelopmentProfileEndpoint,
}); // 100 requests per 15 minutes
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, 10); // 10 uploads per hour
export const authRateLimit = createRateLimit(15 * 60 * 1000, 5, {
  skip: isDevelopmentProfileEndpoint,
}); // 5 auth attempts per 15 minutes

// Content Security Policy
export const cspMiddleware = (_request: Request, response: Response, next: NextFunction): void => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');

  response.setHeader('Content-Security-Policy', csp);
  next();
};

// Request sanitization
const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replaceAll(/javascript:/gi, '')
      .replaceAll(/on\w+=/gi, '');
  }
  return value;
};

const sanitizeObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      result[key] = sanitizeObject(record[key]);
    }
    return result;
  }
  return sanitizeValue(value);
};

export const sanitizeMiddleware = (
  request: Request,
  _response: Response,
  next: NextFunction
): void => {
  // Basic sanitization for common XSS patterns
  if (request.body) {
    request.body = sanitizeObject({ ...request.body }) as typeof request.body;
  }
  if (request.query) {
    request.query = sanitizeObject({ ...request.query }) as typeof request.query;
  }
  if (request.params) {
    request.params = sanitizeObject({ ...request.params }) as typeof request.params;
  }

  next();
};

// File upload security
export const fileSecurityMiddleware = (
  _request: Request,
  response: Response,
  next: NextFunction
): void => {
  // Add file-specific security headers
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  
  next();
};