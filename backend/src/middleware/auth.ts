import { auth, type AuthResult } from 'express-oauth2-jwt-bearer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthResult;
  }
}

const noopAuth = (_request: Request, _response: Response, next: NextFunction) => {
  next();
};

const authMiddleware = auth({
  audience: config.auth.audience,
  issuerBaseURL: config.auth.issuerBaseURL,
  tokenSigningAlg: 'RS256',
});

const applyDevelopmentAdminAutologin = (request: Request): boolean => {
  const email = config.auth.devAutoLoginAdminEmail;

  if (!config.isDevelopment || !email) {
    return false;
  }

  const authHeader = request.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return false;
  }

  request.auth = {
    header: { alg: 'none' },
    token: 'dev-autologin',
    payload: {
      sub: `dev-admin:${email}`,
      email,
      name: 'Dev Admin (autologin)',
    },
  } as unknown as AuthResult;

  return true;
};

export const requireAuth = config.auth.enabled
  ? (request: Request, response: Response, next: NextFunction) => {
      if (applyDevelopmentAdminAutologin(request)) {
        next();
        return;
      }
      authMiddleware(request, response, next);
    }
  : noopAuth;

// Optional auth middleware: validates token if present, allows requests without token
export const optionalAuth = (request: Request, response: Response, next: NextFunction) => {
  if (!config.auth.enabled) {
    return next();
  }

  if (applyDevelopmentAdminAutologin(request)) {
    return next();
  }

  // If no authorization header, skip auth validation
  const authHeader = request.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  return authMiddleware(request, response, next);
};

// Check if user is admin based on email
export const isAdmin = (request: Request): boolean => {
  const payload = request.auth?.payload;
  if (!payload) {
    return false;
  }
  
  // Try to get email from various possible claims
  const userEmail = 
    payload.email || 
    payload['https://darts-tournament.app/email'] ||
    payload['https://your-domain.com/email'] ||
    payload.name; // Sometimes Auth0 puts email in name for Google login
  
  if (!userEmail || typeof userEmail !== 'string') {
    console.log('[Admin Check] No email found in token. Available claims:', Object.keys(payload));
    console.log('[Admin Check] Full payload:', JSON.stringify(payload, undefined, 2));
    return false;
  }
  
  const isUserAdmin = config.auth.adminEmails.includes(userEmail.toLowerCase());
  console.log('[Admin Check]', { 
    userEmail, 
    isAdmin: isUserAdmin, 
    configuredAdmins: config.auth.adminEmails 
  });
  
  return isUserAdmin;
};

// Middleware to require admin access
export const requireAdmin = (request: Request, response: Response, next: NextFunction): void => {
  if (!config.auth.enabled) {
    next();
    return;
  }
  if (!request.auth?.payload) {
    console.log('[requireAdmin] No auth payload found');
    response.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (!isAdmin(request)) {
    console.log('[requireAdmin] User is not admin. Payload:', request.auth.payload);
    response.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
};