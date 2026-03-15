import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '@shared/types';

const createTestImage = async (): Promise<string> => {
  const testImagePath = path.join(__dirname, '../fixtures/integration-test-logo.png');
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==',
    'base64'
  );

  const fixturesDir = path.dirname(testImagePath);
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  fs.writeFileSync(testImagePath, testImageBuffer);
  return testImagePath;
};

describe('Tournament Management - Integration Tests', () => {
  let app: App;
  let server: any;
  let createdTournamentId: string;

  const createValidTournamentData = (overrides: Partial<Record<string, unknown>> = {}) => {
    const now = Date.now();
    const startTime = new Date(now + (24 * 60 * 60 * 1000));
    const endTime = new Date(now + (32 * 60 * 60 * 1000));

    return {
      name: 'Integration Test Tournament',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalParticipants: 16,
      targetCount: 3,
      ...overrides,
    };
  };

  beforeAll(async () => {
    app = new App();
    server = app.server;
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('End-to-end tournament workflow', () => {
    it('should complete full tournament creation workflow', async () => {
      // Step 1: Create tournament
      const createResponse = await request(server)
        .post('/api/tournaments')
        .send(createValidTournamentData())
        .expect(201);

      createdTournamentId = createResponse.body.id;
      
      expect(createResponse.body).toMatchObject({
        id: expect.any(String),
        name: 'Integration Test Tournament',
        format: TournamentFormat.SINGLE,
        status: 'DRAFT',
        totalParticipants: 16,
      });

      // Step 2: Verify tournament exists in database
      const getResponse = await request(server)
        .get(`/api/tournaments/${createdTournamentId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(createdTournamentId);
      expect(getResponse.body.name).toBe('Integration Test Tournament');

      // Step 3: Upload logo
      const testImagePath = await createTestImage();
      
      const logoResponse = await request(server)
        .post(`/api/tournaments/${createdTournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      expect(logoResponse.body.logoUrl).toMatch(/^\/uploads\/.+\.png$/);

      // Step 4: Verify logo in tournament data
      const updatedTournamentResponse = await request(server)
        .get(`/api/tournaments/${createdTournamentId}`)
        .expect(200);

      expect(updatedTournamentResponse.body.logoUrl).toBe(logoResponse.body.logoUrl);

      // Cleanup test image
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should enforce tournament status transitions', async () => {
      const createResponse = await request(server)
        .post('/api/tournaments')
        .send(createValidTournamentData({ name: 'Status Transition Tournament' }))
        .expect(201);

      const tournamentId = createResponse.body.id;

      const openResponse = await request(server)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .send({ status: 'OPEN' })
        .expect(200);

      expect(openResponse.body.tournament.status).toBe('OPEN');

      const playerOneResponse = await request(server)
        .post(`/api/tournaments/${tournamentId}/players`)
        .send({
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'grace.hopper@example.com',
        })
        .expect(201);

      const playerTwoResponse = await request(server)
        .post(`/api/tournaments/${tournamentId}/players`)
        .send({
          firstName: 'Alan',
          lastName: 'Turing',
          email: 'alan.turing@example.com',
        })
        .expect(201);

      const signatureResponse = await request(server)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .send({ status: 'SIGNATURE' })
        .expect(200);

      expect(signatureResponse.body.tournament.status).toBe('SIGNATURE');

      const liveDeniedResponse = await request(server)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .send({ status: 'LIVE' })
        .expect(400);

      expect(liveDeniedResponse.body.error.code).toBe('TOURNAMENT_START_TIME_NOT_REACHED');

      await request(server)
        .patch(`/api/tournaments/${tournamentId}/players/${playerOneResponse.body.id}/check-in`)
        .send({ checkedIn: true })
        .expect(200);

      await request(server)
        .patch(`/api/tournaments/${tournamentId}/players/${playerTwoResponse.body.id}/check-in`)
        .send({ checkedIn: true })
        .expect(200);

      await request(server)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .send({ status: 'LIVE' })
        .expect(400);

      const liveResponse = await request(server)
        .get(`/api/tournaments/${tournamentId}`)
        .expect(200);

      expect(liveResponse.body.status).toBe('LIVE');

      const finishedResponse = await request(server)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .send({ status: 'FINISHED' })
        .expect(200);

      expect(finishedResponse.body.tournament.status).toBe('FINISHED');
      expect(finishedResponse.body.tournament.completedAt).toBeTruthy();
    });

    it('should handle tournament list operations', async () => {
      // Create multiple tournaments
      const tournamentIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const tournamentData = {
          ...createValidTournamentData(),
          name: `List Test Tournament ${i + 1}`,
          startTime: new Date(Date.now() + ((i + 2) * 24 * 60 * 60 * 1000)).toISOString(),
          endTime: new Date(Date.now() + ((i + 2) * 24 * 60 * 60 * 1000) + (8 * 60 * 60 * 1000)).toISOString(),
        };

        const createResponse = await request(server)
          .post('/api/tournaments')
          .send(tournamentData)
          .expect(201);
        tournamentIds.push(createResponse.body.id);
      }

      for (const tournamentId of tournamentIds) {
        await request(server)
          .patch(`/api/tournaments/${tournamentId}/status`)
          .send({ status: 'OPEN' })
          .expect(200);
      }

      // Test tournament listing
      const listResponse = await request(server)
        .get('/api/tournaments')
        .expect(200);

      expect(Array.isArray(listResponse.body.tournaments)).toBe(true);
      expect(listResponse.body.tournaments.length).toBeGreaterThanOrEqual(3);

      // Verify our tournaments are in the list
      const tournamentNames = listResponse.body.tournaments.map((t: any) => t.name);
      expect(tournamentNames).toContain('List Test Tournament 1');
      expect(tournamentNames).toContain('List Test Tournament 2');
      expect(tournamentNames).toContain('List Test Tournament 3');
    });

    it('should handle tournament filtering and pagination', async () => {
      // Test filtering by status
      const draftResponse = await request(server)
        .get('/api/tournaments?status=draft')
        .expect(200);

      expect(Array.isArray(draftResponse.body.tournaments)).toBe(true);
      draftResponse.body.tournaments.forEach((tournament: any) => {
        expect(tournament.status).toBe('DRAFT');
      });

      // Test pagination
      const page1Response = await request(server)
        .get('/api/tournaments?page=1&limit=5')
        .expect(200);

      expect(Array.isArray(page1Response.body.tournaments)).toBe(true);
      expect(page1Response.body.tournaments.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error handling integration', () => {
    it('should handle cascading validation errors', async () => {
      const invalidData = {
        name: '', // Empty name
        format: 'INVALID_FORMAT', // Invalid format
        durationType: DurationType.FULL_DAY,
        startTime: 'invalid-date', // Invalid date
        endTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
        totalParticipants: -1, // Invalid count
        targetCount: 0, // Invalid count
      };

      const response = await request(server)
        .post('/api/tournaments')
        .send(invalidData)
        .expect(400);

      // Should contain multiple validation errors
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(1);

      // Check for specific validation errors
      const errorMessages = response.body.error.details.map((d: any) => d.message);
      expect(errorMessages.some((msg: string) => msg.includes('name'))).toBe(true);
      expect(errorMessages.some((msg: string) => msg.includes('format'))).toBe(true);
      expect(errorMessages.some((msg: string) => msg.includes('startTime') || msg.includes('start time') || msg.includes('date'))).toBe(true);
    });

    it('should handle database constraint violations', async () => {
      // Create tournament with specific name
      const uniqueTournament = {
        ...createValidTournamentData(),
        name: 'Unique Tournament Name Test',
      };

      await request(server)
        .post('/api/tournaments')
        .send(uniqueTournament)
        .expect(201);

      // Try to create another tournament with same name (should fail if unique constraint exists)
      const duplicateResponse = await request(server)
        .post('/api/tournaments')
        .send(uniqueTournament);

      // Either succeeds (no unique constraint) or fails with proper error
      if (duplicateResponse.status === 400 || duplicateResponse.status === 409) {
        expect(duplicateResponse.body.error.message).toMatch(/unique|duplicate|exists/i);
      } else {
        expect(duplicateResponse.status).toBe(201);
      }
    });
  });

  describe('Performance integration tests', () => {
    it('should handle multiple concurrent tournament creations', async () => {
      const concurrentRequests = 5;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, index) => 
        request(server)
          .post('/api/tournaments')
          .send({
            ...createValidTournamentData(),
            name: `Concurrent Test Tournament ${index}`,
          })
          .expect(201)
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body.id).toBeDefined();
      });

      // Constitution: Should handle reasonable concurrent load
      expect(duration).toBeLessThan(10000); // 10 seconds for 5 concurrent requests
    });

    it('should handle large tournament data efficiently', async () => {
      const largeTournament = {
        ...createValidTournamentData(),
        name: 'Large Tournament Test', // Long name
        totalParticipants: 128, // Large participant count
        targetCount: 10, // Many targets
      };

      const startTime = Date.now();
      
      const response = await request(server)
        .post('/api/tournaments')
        .send(largeTournament)
        .expect(201);

      const duration = Date.now() - startTime;

      expect(response.body.id).toBeDefined();
      expect(response.body.totalParticipants).toBe(128);
      
      // Constitution: Should handle large data efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds for large tournament
    });
  });

  describe('Database consistency tests', () => {
    it('should maintain data consistency across operations', async () => {
      // Create tournament
      const createResponse = await request(server)
        .post('/api/tournaments')
        .send({
          ...createValidTournamentData(),
          name: 'Consistency Test Tournament',
        })
        .expect(201);

      const tournamentId = createResponse.body.id;
      const originalCreatedAt = createResponse.body.createdAt;

      // Verify data persistence
      const getResponse = await request(server)
        .get(`/api/tournaments/${tournamentId}`)
        .expect(200);

      expect(getResponse.body.createdAt).toBe(originalCreatedAt);
      expect(getResponse.body.status).toBe('DRAFT');

      // Upload logo and verify consistency
      const testImagePath = await createTestImage();
      
      const logoResponse = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      // Verify logo URL is consistent
      const finalGetResponse = await request(server)
        .get(`/api/tournaments/${tournamentId}`)
        .expect(200);

      expect(finalGetResponse.body.logoUrl).toBe(logoResponse.body.logoUrl);
      expect(finalGetResponse.body.createdAt).toBe(originalCreatedAt); // Should not change

      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });
  });

  describe('Security integration tests', () => {
    it('should apply security headers consistently', async () => {
      const response = await request(server)
        .post('/api/tournaments')
        .send(createValidTournamentData())
        .expect(201);

      // Constitution: Security headers should be present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should handle malicious input safely', async () => {
      const maliciousData = {
        ...createValidTournamentData(),
        name: '<script>alert("xss")</script>',
        // Note: More sophisticated attacks would be tested in security-specific tests
      };

      const response = await request(server)
        .post('/api/tournaments')
        .send(maliciousData)
        .expect(400);

      // Request is sanitized first, then rejected by schema validation (name becomes too short)
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('at least 3 characters long'),
          }),
        })
      );
    });
  });

});