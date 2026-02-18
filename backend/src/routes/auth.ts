import { Router, Request, Response } from 'express';
import { requireAuth, isAdmin } from '../middleware/auth';

const router = Router();

// Get current user info and admin status
router.get('/me', requireAuth, (request: Request, response: Response): void => {
  const userPayload = request.auth?.payload;

  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = userPayload.email
    ?? userPayload['https://darts-tournament.app/email']
    ?? userPayload['https://your-domain.com/email']
    ?? userPayload.name;

  response.json({
    user: {
      id: userPayload.sub,
      email: typeof email === 'string' ? email : undefined,
      name: userPayload.name,
      picture: userPayload.picture,
    },
    isAdmin: isAdmin(request),
  });
});

export default router;
