import { Router, Request, Response } from 'express';
import { requireAuth, isAdmin } from '../middleware/auth';

const router = Router();

// Get current user info and admin status
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const userPayload = req.auth?.payload;
  
  if (!userPayload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    user: {
      id: userPayload.sub,
      email: userPayload.email,
      name: userPayload.name,
      picture: userPayload.picture,
    },
    isAdmin: isAdmin(req),
  });
});

export default router;
