import express from 'express';
import request from 'supertest';
import { config } from '../../src/config/environment';

const isAdminMock = jest.fn();
const getActiveDevelopmentAutologinModeMock = jest.fn();
const parseDevelopmentAutologinModeMock = jest.fn();

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAdmin: (...args: unknown[]) => isAdminMock(...args),
  DEVELOPMENT_AUTOLOGIN_COOKIE_NAME: 'dev-autologin-mode',
  DEVELOPMENT_AUTOLOGIN_MODES: ['anonymous', 'player', 'admin'],
  getActiveDevelopmentAutologinMode: (...args: unknown[]) => getActiveDevelopmentAutologinModeMock(...args),
  parseDevelopmentAutologinMode: (...args: unknown[]) => parseDevelopmentAutologinModeMock(...args),
  resolveUserEmailFromPayload: (payload: Record<string, unknown>) => {
    const email = payload.email;
    if (typeof email === 'string' && email.length > 0) {
      return email;
    }

    return null;
  },
}));

describe('auth routes', () => {
  const originalIsDevelopment = config.isDevelopment;
  const originalAuthEnabled = config.auth.enabled;

  beforeEach(() => {
    config.isDevelopment = true;
    config.auth.enabled = true;

    isAdminMock.mockReset();
    getActiveDevelopmentAutologinModeMock.mockReset();
    parseDevelopmentAutologinModeMock.mockReset();

    getActiveDevelopmentAutologinModeMock.mockReturnValue('admin');
    parseDevelopmentAutologinModeMock.mockImplementation((value: unknown) => {
      if (value === 'anonymous' || value === 'player' || value === 'admin') {
        return value;
      }
      return undefined;
    });
  });

  afterAll(() => {
    config.isDevelopment = originalIsDevelopment;
    config.auth.enabled = originalAuthEnabled;
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

  it('returns current local dev autologin mode', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const response = await request(app)
      .get('/api/auth/dev-autologin')
      .set('Host', 'localhost:3000');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mode: 'admin',
      availableModes: ['anonymous', 'player', 'admin'],
    });
  });

  it('updates local dev autologin mode', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const response = await request(app)
      .post('/api/auth/dev-autologin')
      .set('Host', 'localhost:3000')
      .send({ mode: 'player' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mode: 'player' });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('dev-autologin-mode=player')])
    );
  });
});
