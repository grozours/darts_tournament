import { Router, Request, Response } from 'express';
import {
  DEVELOPMENT_AUTOLOGIN_COOKIE_NAME,
  DEVELOPMENT_AUTOLOGIN_MODES,
  getActiveDevelopmentAutologinMode,
  isAdmin,
  parseDevelopmentAutologinMode,
  requireAuth,
  resolveUserEmailFromPayload,
} from '../middleware/auth';
import { config } from '../config/environment';

const router = Router();

const isLocalDevelopmentRequest = (request: Request): boolean => {
  const host = request.hostname?.toLowerCase();
  return config.isDevelopment && (host === 'localhost' || host === '127.0.0.1' || host === '::1');
};

router.get('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  response.json({
    mode: getActiveDevelopmentAutologinMode(request) ?? 'anonymous',
    availableModes: DEVELOPMENT_AUTOLOGIN_MODES,
  });
});

router.post('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  const mode = parseDevelopmentAutologinMode(request.body?.mode);
  if (!mode) {
    response.status(400).json({
      error: 'Bad Request',
      message: `Mode must be one of: ${DEVELOPMENT_AUTOLOGIN_MODES.join(', ')}`,
    });
    return;
  }

  response.cookie(DEVELOPMENT_AUTOLOGIN_COOKIE_NAME, mode, {
    sameSite: 'lax',
    secure: false,
    httpOnly: false,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  response.json({ mode });
});

// Get current user info and admin status
router.get('/me', requireAuth, (request: Request, response: Response): void => {
  const userPayload = request.auth?.payload;

  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = resolveUserEmailFromPayload(userPayload);

  response.json({
    user: {
      id: userPayload.sub,
      email,
      name: userPayload.name,
      picture: userPayload.picture,
    },
    isAdmin: isAdmin(request),
  });
});

export default router;
