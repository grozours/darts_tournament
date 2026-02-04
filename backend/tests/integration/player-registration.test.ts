import request from 'supertest';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '@shared/types';

describe('Tournament Player Registration - Integration Tests', () => {
  let app: App;
  let server: any;
  let tournamentId: string;
  let playerId: string;

  const createTournamentData = {
    name: 'Player Registration Tournament',
    format: TournamentFormat.SINGLE,
    durationType: DurationType.FULL_DAY,
    startTime: new Date('2026-04-10T10:00:00.000Z').toISOString(),
    endTime: new Date('2026-04-10T18:00:00.000Z').toISOString(),
    totalParticipants: 8,
    targetCount: 2,
  };

  const playerPayload = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada.lovelace@example.com',
    phone: '+1234567890',
  };

  beforeAll(async () => {
    app = new App();
    server = app.server;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('should register, update, list, and remove tournament players', async () => {
    const createResponse = await request(server)
      .post('/api/tournaments')
      .send(createTournamentData)
      .expect(201);

    tournamentId = createResponse.body.id;

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'REGISTRATION_OPEN' })
      .expect(200);

    const registerResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/players`)
      .send(playerPayload)
      .expect(201);

    playerId = registerResponse.body.id;
    expect(registerResponse.body.firstName).toBe(playerPayload.firstName);
    expect(registerResponse.body.lastName).toBe(playerPayload.lastName);

    const listResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/players`)
      .expect(200);

    expect(Array.isArray(listResponse.body.players)).toBe(true);
    expect(listResponse.body.players.length).toBeGreaterThanOrEqual(1);

    const updatedPayload = {
      ...playerPayload,
      firstName: 'Ada-Marie',
      lastName: 'Lovelace',
      email: 'ada.updated@example.com',
    };

    const updateResponse = await request(server)
      .patch(`/api/tournaments/${tournamentId}/players/${playerId}`)
      .send(updatedPayload)
      .expect(200);

    expect(updateResponse.body.firstName).toBe(updatedPayload.firstName);
    expect(updateResponse.body.email).toBe(updatedPayload.email);

    await request(server)
      .delete(`/api/tournaments/${tournamentId}/players/${playerId}`)
      .expect(204);

    const finalListResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/players`)
      .expect(200);

    const ids = finalListResponse.body.players.map((player: any) => player.playerId);
    expect(ids).not.toContain(playerId);
  });
});
