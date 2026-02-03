import request from 'supertest';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '../../../shared/src/types';

describe('POST /tournaments - Contract Tests', () => {
  let app: App;
  let server: any;

  beforeAll(async () => {
    app = new App();
    server = app.server;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Valid tournament creation', () => {
    const validTournamentData = {
      name: 'Test Championship 2026',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: new Date('2026-02-10T09:00:00.000Z').toISOString(),
      endTime: new Date('2026-02-10T18:00:00.000Z').toISOString(),
      totalParticipants: 16,
      targetCount: 4,
    };

    it('should create tournament with valid data', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send(validTournamentData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Contract: Response should contain tournament data
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', validTournamentData.name);
      expect(response.body).toHaveProperty('format', validTournamentData.format);
      expect(response.body).toHaveProperty('durationType', validTournamentData.durationType);
      expect(response.body).toHaveProperty('startTime');
      expect(response.body).toHaveProperty('endTime');
      expect(response.body).toHaveProperty('totalParticipants', validTournamentData.totalParticipants);
      expect(response.body).toHaveProperty('targetCount', validTournamentData.targetCount);
      expect(response.body).toHaveProperty('status', 'DRAFT');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('historicalFlag', false);
      
      // Contract: ID should be UUID format
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Contract: Timestamps should be ISO strings
      expect(new Date(response.body.startTime)).toBeInstanceOf(Date);
      expect(new Date(response.body.endTime)).toBeInstanceOf(Date);
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
    });

    it('should handle different tournament formats', async () => {
      const formats = [TournamentFormat.SINGLE, TournamentFormat.DOUBLE, TournamentFormat.TEAM_4_PLAYER];
      
      for (const format of formats) {
        const response = await request(server)
          .post('/api/tournaments')
          .send({ ...validTournamentData, name: `Test ${format}`, format })
          .expect(201);

        expect(response.body.format).toBe(format);
      }
    });

    it('should handle different duration types', async () => {
      const durations = [
        DurationType.HALF_DAY_MORNING,
        DurationType.HALF_DAY_AFTERNOON, 
        DurationType.HALF_DAY_NIGHT,
        DurationType.FULL_DAY,
        DurationType.TWO_DAY,
      ];
      
      for (const durationType of durations) {
        const response = await request(server)
          .post('/api/tournaments')
          .send({ ...validTournamentData, name: `Test ${durationType}`, durationType })
          .expect(201);

        expect(response.body.durationType).toBe(durationType);
      }
    });
  });

  describe('Invalid tournament creation', () => {
    const validTournamentData = {
      name: 'Test Championship 2026',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: new Date('2026-02-10T09:00:00.000Z').toISOString(),
      endTime: new Date('2026-02-10T18:00:00.000Z').toISOString(),
      totalParticipants: 16,
      targetCount: 4,
    };

    it('should reject tournament with missing name', async () => {
      const { name, ...invalidData } = validTournamentData;

      const response = await request(server)
        .post('/api/tournaments')
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toMatch(/name/i);
    });

    it('should reject tournament with name too short', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, name: 'AB' })
        .expect(400);

      expect(response.body.error.message).toMatch(/3 characters/i);
    });

    it('should reject tournament with name too long', async () => {
      const longName = 'A'.repeat(101);
      
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, name: longName })
        .expect(400);

      expect(response.body.error.message).toMatch(/100 characters/i);
    });

    it('should reject tournament with invalid format', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, format: 'INVALID_FORMAT' })
        .expect(400);

      expect(response.body.error.message).toMatch(/format/i);
    });

    it('should reject tournament with invalid duration type', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, durationType: 'INVALID_DURATION' })
        .expect(400);

      expect(response.body.error.message).toMatch(/duration/i);
    });

    it('should reject tournament with end time before start time', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({
          ...validTournamentData,
          startTime: new Date('2026-02-10T18:00:00.000Z').toISOString(),
          endTime: new Date('2026-02-10T09:00:00.000Z').toISOString(),
        })
        .expect(400);

      expect(response.body.error.message).toMatch(/end time.*after.*start time/i);
    });

    it('should reject tournament with too few participants', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, totalParticipants: 1 })
        .expect(400);

      expect(response.body.error.message).toMatch(/2 participants/i);
    });

    it('should reject tournament with too many participants', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, totalParticipants: 129 })
        .expect(400);

      expect(response.body.error.message).toMatch(/128 participants/i);
    });

    it('should reject tournament with too few targets', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, targetCount: 0 })
        .expect(400);

      expect(response.body.error.message).toMatch(/1 target/i);
    });

    it('should reject tournament with too many targets', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, targetCount: 33 })
        .expect(400);

      expect(response.body.error.message).toMatch(/32 targets/i);
    });

    it('should reject tournament with invalid date format', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ ...validTournamentData, startTime: 'invalid-date' })
        .expect(400);

      expect(response.body.error.message).toMatch(/date|time/i);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .type('json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle empty request body', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Response format consistency per constitution', () => {
    it('should return consistent error format', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send({ invalid: 'data' })
        .expect(400);

      // Constitution: Consistent error response format
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path', '/api/tournaments');
    });

    it('should include request timing per performance requirements', async () => {
      const startTime = Date.now();
      
      const validTournamentData = {
        name: 'Performance Test Tournament',
        format: TournamentFormat.SINGLE,
        durationType: DurationType.FULL_DAY,
        startTime: new Date('2026-02-10T09:00:00.000Z').toISOString(),
        endTime: new Date('2026-02-10T18:00:00.000Z').toISOString(),
        totalParticipants: 8,
        targetCount: 2,
      };

      await request(server)
        .post('/api/tournaments')
        .send(validTournamentData)
        .expect(201);

      const duration = Date.now() - startTime;
      
      // Constitution: <2s response time requirement
      expect(duration).toBeLessThan(2000);
    });
  });
});