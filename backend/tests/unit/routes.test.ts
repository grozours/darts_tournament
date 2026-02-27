import express from 'express';
import request from 'supertest';

const baseController: Record<string, jest.Mock> = {
  getTournaments: jest.fn((_req, res) => res.status(200).json({ ok: 'getTournaments' })),
  uploadTournamentLogo: jest.fn((_req, res) => res.status(200).json({ ok: 'uploadLogo' })),
  getOverallTournamentStats: jest.fn((_req, res) => res.status(200).json({ ok: 'stats' })),
  updateTournamentStatus: jest.fn((_req, res) => res.status(200).json({ ok: 'status' })),
};

const mockController: Record<string, jest.Mock> = new Proxy(baseController, {
  get(target, prop) {
    if (typeof prop !== 'string') {
      return Reflect.get(target, prop) as jest.Mock;
    }
    if (!target[prop]) {
      target[prop] = jest.fn((_req, res) => res.status(200).json({ ok: prop }));
    }
    return target[prop];
  },
});

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/controllers/tournament-controller', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockController),
  };
});

jest.mock('../../src/middleware/validation', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../src/middleware/auth', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../src/middleware/upload', () => ({
  uploadTournamentLogo: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('tournament routes', () => {
  beforeEach(() => {
    Object.values(mockController).forEach((handler) => handler.mockClear());
  });

  it('wires GET /api/tournaments', async () => {
    const { default: router } = await import('../../src/routes/tournaments');
    const app = express();
    app.use('/api/tournaments', router);

    const response = await request(app).get('/api/tournaments');

    expect(response.status).toBe(200);
    expect(mockController.getTournaments).toHaveBeenCalled();
  });

  it('wires POST /api/tournaments/:id/logo', async () => {
    const { default: router } = await import('../../src/routes/tournaments');
    const app = express();
    app.use('/api/tournaments', router);

    const response = await request(app).post(
      '/api/tournaments/00000000-0000-4000-8000-000000000000/logo'
    );

    expect(response.status).toBe(200);
    expect(mockController.uploadTournamentLogo).toHaveBeenCalled();
  });

  it('wires GET /api/tournaments/stats', async () => {
    const { default: router } = await import('../../src/routes/tournaments');
    const app = express();
    app.use('/api/tournaments', router);

    const response = await request(app).get('/api/tournaments/stats');

    expect(response.status).toBe(200);
    expect(mockController.getOverallTournamentStats).toHaveBeenCalled();
  });

  it('wires PATCH /api/tournaments/:id/status', async () => {
    const { default: router } = await import('../../src/routes/tournaments');
    const app = express();
    app.use(express.json());
    app.use('/api/tournaments', router);

    const response = await request(app)
      .patch('/api/tournaments/00000000-0000-4000-8000-000000000000/status')
      .send({ status: 'OPEN' });

    expect(response.status).toBe(200);
    expect(mockController.updateTournamentStatus).toHaveBeenCalled();
  });

  it('wires GET /api/tournaments/:id/doublettes', async () => {
    const { default: router } = await import('../../src/routes/tournaments');
    const app = express();
    app.use('/api/tournaments', router);

    const response = await request(app).get('/api/tournaments/00000000-0000-4000-8000-000000000000/doublettes');

    expect(response.status).toBe(200);
    expect(mockController.listDoublettes).toHaveBeenCalled();
  });
});
