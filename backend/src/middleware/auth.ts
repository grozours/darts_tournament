import { auth } from 'express-oauth2-jwt-bearer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

// Extend Express Request to include auth property
declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload?: {
          sub?: string;
          email?: string;
          [key: string]: unknown;
        };
      };
    }
  }
}

export const requireAuth = auth({
  audience: config.auth.audience,
  issuerBaseURL: config.auth.issuerBaseURL,
  tokenSigningAlg: 'RS256',
});

// Optional auth middleware: validates token if present, allows requests without token
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // If no authorization header, skip auth validation
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If auth header is present, validate it
  const authMiddleware = auth({
    audience: config.auth.audience,
    issuerBaseURL: config.auth.issuerBaseURL,
    tokenSigningAlg: 'RS256',
  });

  return authMiddleware(req, res, next);
};

// Check if user is admin based on email
export const isAdmin = (req: Request): boolean => {
  const payload = req.auth?.payload;
  if (!payload) {
    return false;
  }
  
  // Try to get email from various possible claims
  const userEmail = 
    payload.email || 
    payload['https://darts-tournament.app/email'] ||
    payload['https://your-domain.com/email'] ||
    payload['http://your-domain.com/email'] ||
    payload.name; // Sometimes Auth0 puts email in name for Google login
  
  if (!userEmail || typeof userEmail !== 'string') {
    console.log('[Admin Check] No email found in token. Available claims:', Object.keys(payload));
    console.log('[Admin Check] Full payload:', JSON.stringify(payload, null, 2));
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
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.payload) {
    console.log('[requireAdmin] No auth payload found');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!isAdmin(req)) {
    console.log('[requireAdmin] User is not admin. Payload:', req.auth.payload);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  next();
};