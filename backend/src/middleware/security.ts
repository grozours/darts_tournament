import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';

// Security middleware per constitution requirements
export const securityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
};

// Rate limiting per constitution performance requirements
export const createRateLimit = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 60000)} minutes.`,
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting in development for easier testing
      return config.isDevelopment && req.ip === '::1';
    },
  });
};

// API rate limits
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, 10); // 10 uploads per hour
export const authRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 auth attempts per 15 minutes

// Content Security Policy
export const cspMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

  res.setHeader('Content-Security-Policy', csp);
  next();
};

// Request sanitization
export const sanitizeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Basic sanitization for common XSS patterns
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    }
    return value;
  };

  const sanitizeObject = (obj: any): any => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    } else {
      obj = sanitizeValue(obj);
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject({ ...req.body });
  }
  if (req.query) {
    req.query = sanitizeObject({ ...req.query });
  }
  if (req.params) {
    req.params = sanitizeObject({ ...req.params });
  }

  next();
};

// File upload security
export const fileSecurityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add file-specific security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
};