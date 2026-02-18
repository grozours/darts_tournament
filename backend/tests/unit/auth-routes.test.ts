import express from 'express';
import request from 'supertest';

const isAdminMock = jest.fn();

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAdmin: (...args: unknown[]) => isAdminMock(...args),
}));

describe('auth routes', () => {
  beforeEach(() => {
    isAdminMock.mockReset();
  });

  it('returns 401 when auth payload is missing', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns user info and admin status when payload exists', async () => {
    isAdminMock.mockReturnValue(true);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-1',
          email: 'admin@example.com',
          name: 'Admin',
          picture: 'https://example.com/avatar.png',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin',
        picture: 'https://example.com/avatar.png',
      },
      isAdmin: true,
    });
  });
});
