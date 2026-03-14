import express from 'express';
import request from 'supertest';
import { config } from '../../src/config/environment';

const isAdminMock = jest.fn();
const getActiveDevelopmentAutologinModeMock = jest.fn();
const parseDevelopmentAutologinModeMock = jest.fn();
const findFirstPersonMock = jest.fn();
const findManyPersonMock = jest.fn();
const findManyPlayerMock = jest.fn();
const createPersonMock = jest.fn();
const updatePersonMock = jest.fn();
const deleteManyPersonMock = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    person: {
      findFirst: (...args: unknown[]) => findFirstPersonMock(...args),
      findMany: (...args: unknown[]) => findManyPersonMock(...args),
      create: (...args: unknown[]) => createPersonMock(...args),
      update: (...args: unknown[]) => updatePersonMock(...args),
      deleteMany: (...args: unknown[]) => deleteManyPersonMock(...args),
    },
    player: {
      findMany: (...args: unknown[]) => findManyPlayerMock(...args),
    },
  })),
}));

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

    findFirstPersonMock.mockReset();
    findManyPersonMock.mockReset();
    findManyPlayerMock.mockReset();
    createPersonMock.mockReset();
    updatePersonMock.mockReset();
    deleteManyPersonMock.mockReset();
    findFirstPersonMock.mockResolvedValue(null);
    findManyPersonMock.mockResolvedValue([]);
    findManyPlayerMock.mockResolvedValue([]);
    createPersonMock.mockResolvedValue({
      id: 'person-1',
      firstName: 'Admin',
      lastName: 'User',
      surname: null,
      email: 'admin@example.com',
    });
    updatePersonMock.mockResolvedValue({
      id: 'person-1',
      firstName: 'Admin',
      lastName: 'User',
      surname: null,
      email: 'admin@example.com',
    });
    deleteManyPersonMock.mockResolvedValue({ count: 0 });
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
        name: 'Admin User',
        picture: 'https://example.com/avatar.png',
        firstName: 'Admin',
        lastName: 'User',
      },
      isAdmin: true,
    });
    expect(findFirstPersonMock).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      select: { id: true, firstName: true, lastName: true, surname: true, email: true },
    });
    expect(createPersonMock).toHaveBeenCalledWith({
      data: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
      },
      select: { id: true, firstName: true, lastName: true, surname: true, email: true },
    });
  });

  it('does not create Person when one already exists for email', async () => {
    isAdminMock.mockReturnValue(false);
    findFirstPersonMock.mockResolvedValueOnce({
      id: 'person-existing',
      firstName: 'Existing',
      lastName: 'User',
      surname: 'Champ',
      email: 'existing@example.com',
    });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-2',
          email: 'existing@example.com',
          name: 'Existing User',
          picture: 'https://example.com/avatar-existing.png',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(findFirstPersonMock).toHaveBeenCalledWith({
      where: { email: 'existing@example.com' },
      select: { id: true, firstName: true, lastName: true, surname: true, email: true },
    });
    expect(createPersonMock).not.toHaveBeenCalled();
  });

  it('creates Person with name derived from email when display name is missing', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-3',
          email: 'john.doe@example.com',
          picture: 'https://example.com/avatar-john.png',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(createPersonMock).toHaveBeenCalledWith({
      data: {
        firstName: 'john',
        lastName: 'doe',
        email: 'john.doe@example.com',
      },
      select: { id: true, firstName: true, lastName: true, surname: true, email: true },
    });
  });

  it('returns 500 when ensuring Person fails', async () => {
    isAdminMock.mockReturnValue(false);
    createPersonMock.mockRejectedValueOnce(new Error('database-unavailable'));

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-4',
          email: 'broken@example.com',
          name: 'Broken User',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
  });

  it('returns 500 when ensuring Person fails with a non-Error value', async () => {
    isAdminMock.mockReturnValue(false);
    createPersonMock.mockRejectedValueOnce('db-down');

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-6',
          email: 'string-error@example.com',
          name: 'String Error',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
  });

  it('skips Person creation when no email can be resolved', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-5',
          name: 'No Email',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(findFirstPersonMock).not.toHaveBeenCalled();
    expect(createPersonMock).not.toHaveBeenCalled();
  });

  it('falls back to default Authenticated/User names when name and local-part are empty', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-7',
          email: '@example.com',
          name: '   ',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(createPersonMock).toHaveBeenCalledWith({
      data: {
        firstName: 'Authenticated',
        lastName: 'User',
        email: '@example.com',
      },
      select: { id: true, firstName: true, lastName: true, surname: true, email: true },
    });
  });

  it('updates authenticated user profile', async () => {
    isAdminMock.mockReturnValue(true);
    findFirstPersonMock.mockResolvedValueOnce({
      id: 'person-existing',
      firstName: 'Existing',
      lastName: 'User',
      surname: null,
      email: 'existing@example.com',
    });
    updatePersonMock.mockResolvedValueOnce({
      id: 'person-existing',
      firstName: 'Jordan',
      lastName: 'Player',
      surname: 'The Wall',
      email: 'existing@example.com',
    });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-8',
          email: 'existing@example.com',
          name: 'Existing User',
          picture: 'https://example.com/avatar-existing.png',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/me/profile')
      .send({ firstName: 'Jordan', lastName: 'Player', surname: 'The Wall' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 'user-8',
        email: 'existing@example.com',
        name: 'Jordan Player (The Wall)',
        picture: 'https://example.com/avatar-existing.png',
        firstName: 'Jordan',
        lastName: 'Player',
        surname: 'The Wall',
      },
      isAdmin: true,
    });
  });

  it('rejects invalid authenticated profile payload', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-9',
          email: 'invalid@example.com',
          name: 'Invalid User',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/me/profile')
      .send({ firstName: 'A', lastName: 'B', surname: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('returns 400 when authenticated profile update has no resolvable email', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-10',
          name: 'No Email',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/me/profile')
      .send({ firstName: 'Jordan', lastName: 'Player' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('returns 500 when authenticated profile update fails unexpectedly', async () => {
    isAdminMock.mockReturnValue(false);
    findFirstPersonMock.mockResolvedValueOnce({
      id: 'person-existing',
      firstName: 'Existing',
      lastName: 'User',
      surname: null,
      email: 'existing@example.com',
    });
    updatePersonMock.mockRejectedValueOnce(new Error('db-down'));

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'user-11',
          email: 'existing@example.com',
          name: 'Existing User',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/me/profile')
      .send({ firstName: 'Jordan', lastName: 'Player' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });

  it('lists user accounts for admin users', async () => {
    isAdminMock.mockReturnValue(true);
    const now = new Date('2026-03-14T12:00:00.000Z');
    findManyPersonMock.mockResolvedValueOnce([
      {
        id: 'person-10',
        firstName: 'Jordan',
        lastName: 'Player',
        surname: 'Sniper',
        email: 'jordan@example.com',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/users?q=jordan&limit=50');

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0]).toMatchObject({
      id: 'person-10',
      tournamentCount: 0,
    });
    expect(findManyPersonMock).toHaveBeenCalledWith(expect.objectContaining({
      take: 50,
      where: {
        OR: expect.arrayContaining([
          { firstName: { contains: 'jordan', mode: 'insensitive' } },
          { lastName: { contains: 'jordan', mode: 'insensitive' } },
          { surname: { contains: 'jordan', mode: 'insensitive' } },
          { email: { contains: 'jordan', mode: 'insensitive' } },
        ]),
      },
    }));
    expect(findManyPlayerMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        personId: { in: ['person-10'] },
      }),
      distinct: ['personId', 'tournamentId'],
    }));
  });

  it('filters user accounts by tournamentId and returns tournament counts', async () => {
    isAdminMock.mockReturnValue(true);
    const now = new Date('2026-03-14T12:00:00.000Z');
    findManyPersonMock.mockResolvedValueOnce([
      {
        id: 'person-10',
        firstName: 'Jordan',
        lastName: 'Player',
        surname: 'Sniper',
        email: 'jordan@example.com',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    findManyPlayerMock.mockResolvedValueOnce([
      { personId: 'person-10', tournamentId: '11111111-1111-4111-8111-111111111111' },
      { personId: 'person-10', tournamentId: '22222222-2222-4222-8222-222222222222' },
    ]);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .get('/api/auth/users?tournamentId=11111111-1111-4111-8111-111111111111');

    expect(response.status).toBe(200);
    expect(response.body.users[0]?.tournamentCount).toBe(2);
    expect(findManyPersonMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        players: {
          some: {
            tournamentId: '11111111-1111-4111-8111-111111111111',
            isActive: true,
          },
        },
      }),
    }));
  });

  it('rejects invalid tournamentId filter', async () => {
    isAdminMock.mockReturnValue(true);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .get('/api/auth/users?tournamentId=invalid-id');

    expect(response.status).toBe(400);
    expect(findManyPersonMock).not.toHaveBeenCalled();
  });

  it('rejects user account listing for non-admin users', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'player-1',
          email: 'player@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/users');

    expect(response.status).toBe(403);
    expect(findManyPersonMock).not.toHaveBeenCalled();
  });

  it('returns 401 when listing user accounts without auth payload', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/users');

    expect(response.status).toBe(401);
    expect(findManyPersonMock).not.toHaveBeenCalled();
  });

  it('returns 500 when listing user accounts fails', async () => {
    isAdminMock.mockReturnValue(true);
    findManyPersonMock.mockRejectedValueOnce(new Error('db-down'));

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).get('/api/auth/users?q=test');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });

  it('updates user account as admin', async () => {
    isAdminMock.mockReturnValue(true);
    const now = new Date('2026-03-14T12:00:00.000Z');
    updatePersonMock.mockResolvedValueOnce({
      id: 'person-10',
      firstName: 'Jordan',
      lastName: 'Prime',
      surname: 'Sniper',
      email: 'jordan@example.com',
      createdAt: now,
      updatedAt: now,
    });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/person-10')
      .send({ firstName: 'Jordan', lastName: 'Prime', surname: 'Sniper', email: 'jordan@example.com' });

    expect(response.status).toBe(200);
    expect(updatePersonMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'person-10' },
      data: {
        firstName: 'Jordan',
        lastName: 'Prime',
        surname: 'Sniper',
        email: 'jordan@example.com',
      },
    }));
  });

  it('returns 404 when admin updates an unknown account', async () => {
    isAdminMock.mockReturnValue(true);
    updatePersonMock.mockRejectedValueOnce({ code: 'P2025' });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/unknown')
      .send({ firstName: 'Jordan' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
  });

  it('returns 409 when admin updates account with duplicate email', async () => {
    isAdminMock.mockReturnValue(true);
    updatePersonMock.mockRejectedValueOnce({ code: 'P2002' });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/person-10')
      .send({ email: 'duplicate@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Conflict');
  });

  it('returns 401 when updating a user account without auth payload', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/person-10')
      .send({ firstName: 'Jordan' });

    expect(response.status).toBe(401);
    expect(updatePersonMock).not.toHaveBeenCalled();
  });

  it('rejects user account update for non-admin users', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'player-1',
          email: 'player@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/person-10')
      .send({ firstName: 'Jordan' });

    expect(response.status).toBe(403);
    expect(updatePersonMock).not.toHaveBeenCalled();
  });

  it('rejects invalid admin user account payload', async () => {
    isAdminMock.mockReturnValue(true);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app)
      .patch('/api/auth/users/person-10')
      .send({ firstName: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(updatePersonMock).not.toHaveBeenCalled();
  });

  it('bulk deletes non-admin accounts without tournament registrations', async () => {
    isAdminMock.mockReturnValue(true);
    findManyPersonMock.mockResolvedValueOnce([
      { id: 'user-1', email: 'player-no-tournament@example.com' },
    ]);
    deleteManyPersonMock.mockResolvedValueOnce({ count: 1 });

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).delete('/api/auth/users?scope=without-tournament');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedCount: 1 });
    expect(findManyPersonMock).toHaveBeenCalledWith({
      where: {
        players: {
          none: {
            tournamentId: { not: null },
          },
        },
      },
      select: { id: true, email: true },
    });
    expect(deleteManyPersonMock).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['user-1'],
        },
      },
    });
  });

  it('returns 400 when bulk delete scope is missing', async () => {
    isAdminMock.mockReturnValue(true);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).delete('/api/auth/users');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(deleteManyPersonMock).not.toHaveBeenCalled();
  });

  it('rejects bulk delete for non-admin users', async () => {
    isAdminMock.mockReturnValue(false);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'player-1',
          email: 'player@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).delete('/api/auth/users?scope=without-tournament');

    expect(response.status).toBe(403);
    expect(deleteManyPersonMock).not.toHaveBeenCalled();
  });

  it('returns zero when no non-admin orphan account can be deleted', async () => {
    isAdminMock.mockReturnValue(true);
    findManyPersonMock.mockResolvedValueOnce([]);

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).delete('/api/auth/users?scope=without-tournament');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedCount: 0 });
    expect(deleteManyPersonMock).not.toHaveBeenCalled();
  });

  it('returns 500 when bulk delete query fails', async () => {
    isAdminMock.mockReturnValue(true);
    findManyPersonMock.mockRejectedValueOnce(new Error('db-down'));

    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use((req, _res, next) => {
      (req as { auth?: { payload?: Record<string, unknown> } }).auth = {
        payload: {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      };
      next();
    });
    app.use('/api/auth', router);

    const response = await request(app).delete('/api/auth/users?scope=without-tournament');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
  });

  it('returns current local dev autologin mode', async () => {
    getActiveDevelopmentAutologinModeMock.mockReturnValueOnce(undefined);
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const response = await request(app)
      .get('/api/auth/dev-autologin')
      .set('Host', 'localhost:3000');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mode: 'anonymous',
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

  it('returns 400 for invalid dev autologin mode', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const response = await request(app)
      .post('/api/auth/dev-autologin')
      .set('Host', 'localhost:3000')
      .send({ mode: 'invalid-mode' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('returns 404 for non-local or auth-disabled dev autologin endpoints', async () => {
    const { default: router } = await import('../../src/routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    const nonLocal = await request(app)
      .get('/api/auth/dev-autologin')
      .set('Host', 'example.com');
    expect(nonLocal.status).toBe(404);

    config.auth.enabled = false;
    const disabled = await request(app)
      .post('/api/auth/dev-autologin')
      .set('Host', 'localhost:3000')
      .send({ mode: 'player' });
    expect(disabled.status).toBe(404);

    config.auth.enabled = true;
  });
});
