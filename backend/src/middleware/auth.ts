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

export const DEVELOPMENT_AUTOLOGIN_MODES = ['anonymous', 'player', 'admin'] as const;
export type DevelopmentAutologinMode = (typeof DEVELOPMENT_AUTOLOGIN_MODES)[number];
export const DEVELOPMENT_AUTOLOGIN_COOKIE_NAME = 'dev-autologin-mode';

export const parseDevelopmentAutologinMode = (value: unknown): DevelopmentAutologinMode | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'anonymous' || normalized === 'player' || normalized === 'admin') {
    return normalized;
  }
  return undefined;
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  const parsedCookies: Record<string, string> = {};
  for (const rawEntry of cookieHeader.split(';')) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = decodeURIComponent(entry.slice(0, separator).trim());
    const value = decodeURIComponent(entry.slice(separator + 1).trim());
    if (!key) {
      continue;
    }
    parsedCookies[key] = value;
  }

  return parsedCookies;
};

const resolveRequestedDevelopmentAutologinMode = (request: Request): DevelopmentAutologinMode | undefined => {
  const queryModeCandidate = request.query?.devAuthMode;
  const queryMode = parseDevelopmentAutologinMode(
    Array.isArray(queryModeCandidate) ? queryModeCandidate[0] : queryModeCandidate
  );
  if (queryMode) {
    return queryMode;
  }

  const headerMode = parseDevelopmentAutologinMode(request.headers['x-dev-autologin-mode']);
  if (headerMode) {
    return headerMode;
  }

  const cookies = parseCookieHeader(request.headers.cookie);
  const cookieMode = parseDevelopmentAutologinMode(cookies[DEVELOPMENT_AUTOLOGIN_COOKIE_NAME]);
  if (cookieMode) {
    return cookieMode;
  }

  const configuredMode = parseDevelopmentAutologinMode(config.auth.devAutoLoginMode);
  if (configuredMode) {
    return configuredMode;
  }

  if (config.auth.devAutoLoginAdminEmail) {
    return 'admin';
  }

  return undefined;
};

export const getActiveDevelopmentAutologinMode = (request: Request): DevelopmentAutologinMode | undefined => {
  if (!config.isDevelopment || !config.auth.enabled) {
    return undefined;
  }

  if (!config.auth.devAutoLoginEnabled) {
    if (config.auth.devAutoLoginAdminEmail) {
      return 'admin';
    }
    return undefined;
  }

  return resolveRequestedDevelopmentAutologinMode(request);
};

const runConfiguredAuth = (request: Request, response: Response, next: NextFunction) => {
  if (!config.auth.enabled) {
    noopAuth(request, response, next);
    return;
  }

  const authMiddleware = auth({
    audience: config.auth.audience,
    issuerBaseURL: config.auth.issuerBaseURL,
    tokenSigningAlg: 'RS256',
  });

  authMiddleware(request, response, next);
};

const applyDevelopmentAutologin = (request: Request): boolean => {
  if (!config.isDevelopment) {
    return false;
  }

  const authHeader = request.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const mode = getActiveDevelopmentAutologinMode(request);
  if (!mode || mode === 'anonymous') {
    return false;
  }

  const email = mode === 'admin'
    ? config.auth.devAutoLoginAdminEmail ?? config.auth.adminEmails[0]
    : config.auth.devAutoLoginPlayerEmail ?? 'dev-player@example.com';

  if (!email) {
    return false;
  }

  const subjectPrefix = mode === 'admin' ? 'dev-admin' : 'dev-player';
  const displayName = mode === 'admin' ? 'Dev Admin (autologin)' : 'Dev Player (autologin)';

  request.auth = {
    header: { alg: 'none' },
    token: 'dev-autologin',
    payload: {
      sub: `${subjectPrefix}:${email}`,
      email,
      name: displayName,
    },
  } as unknown as AuthResult;

  return true;
};

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  if (!config.auth.enabled) {
    noopAuth(request, response, next);
    return;
  }

  if (applyDevelopmentAutologin(request)) {
    next();
    return;
  }

  runConfiguredAuth(request, response, next);
};

// Optional auth middleware: validates token if present, allows requests without token
export const optionalAuth = (request: Request, response: Response, next: NextFunction) => {
  if (!config.auth.enabled) {
    return next();
  }

  if (applyDevelopmentAutologin(request)) {
    return next();
  }

  // If no authorization header, skip auth validation
  const authHeader = request.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  return runConfiguredAuth(request, response, next);
};

const normalizePossibleEmail = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized.includes('@')) {
    return undefined;
  }

  return normalized;
};

export const resolveUserEmailFromPayload = (payload: Record<string, unknown>): string | undefined => {
  const directCandidates = [
    payload.email,
    payload['https://darts-tournament.app/email'],
    payload['https://your-domain.com/email'],
    payload.preferred_username,
    payload.upn,
    payload.name,
  ];

  for (const candidate of directCandidates) {
    const email = normalizePossibleEmail(candidate);
    if (email) {
      return email;
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!key.endsWith('/email')) {
      continue;
    }
    const email = normalizePossibleEmail(value);
    if (email) {
      return email;
    }
  }

  return undefined;
};

// Check if user is admin based on email
export const isAdmin = (request: Request): boolean => {
  const payload = request.auth?.payload;
  if (!payload) {
    return false;
  }

  const userEmail = resolveUserEmailFromPayload(payload);

  if (!userEmail) {
    console.log('[Admin Check] No email found in token. Available claims:', Object.keys(payload));
    console.log('[Admin Check] Full payload:', JSON.stringify(payload, undefined, 2));
    return false;
  }

  const isUserAdmin = config.auth.adminEmails.includes(userEmail);
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