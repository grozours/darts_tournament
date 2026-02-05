import request from 'supertest';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '@shared/types';

describe('Person Linking - Integration Tests', () => {
  let app: App;
  let server: any;

  const baseTournamentData = {
    format: TournamentFormat.SINGLE,
    durationType: DurationType.FULL_DAY,
    startTime: new Date('2026-06-10T10:00:00.000Z').toISOString(),
    endTime: new Date('2026-06-10T18:00:00.000Z').toISOString(),
    totalParticipants: 8,
    targetCount: 2,
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

  it('should reuse personId when email and phone match', async () => {
    const tournamentA = await request(server)
      .post('/api/tournaments')
      .send({
        ...baseTournamentData,
        name: 'Person Linking Tournament A',
      })
      .expect(201);

    const tournamentB = await request(server)
      .post('/api/tournaments')
      .send({
        ...baseTournamentData,
        name: 'Person Linking Tournament B',
      })
      .expect(201);

    await request(server)
      .patch(`/api/tournaments/${tournamentA.body.id}/status`)
      .send({ status: 'OPEN' })
      .expect(200);

    await request(server)
      .patch(`/api/tournaments/${tournamentB.body.id}/status`)
      .send({ status: 'OPEN' })
      .expect(200);

    const playerPayload = {
      firstName: 'Marie',
      lastName: 'Curie',
      email: 'marie.curie@example.com',
      phone: '+33123456789',
      surname: 'Polonium',
    };

    const firstRegistration = await request(server)
      .post(`/api/tournaments/${tournamentA.body.id}/players`)
      .send(playerPayload)
      .expect(201);

    const secondRegistration = await request(server)
      .post(`/api/tournaments/${tournamentB.body.id}/players`)
      .send({
        ...playerPayload,
        firstName: 'Marie-Sklodowska',
      })
      .expect(201);

    expect(firstRegistration.body.personId).toBeTruthy();
    expect(secondRegistration.body.personId).toBeTruthy();
    expect(secondRegistration.body.personId).toBe(firstRegistration.body.personId);

    const updated = await request(server)
      .patch(`/api/tournaments/${tournamentB.body.id}/players/${secondRegistration.body.id}`)
      .send({
        firstName: 'Marie',
        lastName: 'Curie',
        email: 'marie.curie@example.com',
        phone: '+33123456789',
        surname: 'Radium',
      })
      .expect(200);

    expect(updated.body.personId).toBe(firstRegistration.body.personId);
  });
});
