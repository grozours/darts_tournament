import request from 'supertest';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '@shared/types';

describe('Tournament Pool Stage & Bracket - Integration Tests', () => {
  let app: App;
  let server: any;

  const baseTournamentData = {
    name: 'Pool Stage Tournament',
    format: TournamentFormat.SINGLE,
    durationType: DurationType.FULL_DAY,
    startTime: new Date('2026-05-20T10:00:00.000Z').toISOString(),
    endTime: new Date('2026-05-20T18:00:00.000Z').toISOString(),
    totalParticipants: 16,
    targetCount: 3,
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

  const createTournament = async (nameSuffix: string) => {
    const response = await request(server)
      .post('/api/tournaments')
      .send({
        ...baseTournamentData,
        name: `${baseTournamentData.name} ${nameSuffix}`,
      })
      .expect(201);

    return response.body.id as string;
  };

  it('should create, update, and delete a pool stage', async () => {
    const tournamentId = await createTournament('Pool Stage');

    const createStageResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 1,
        name: 'Stage 1',
        poolCount: 2,
        playersPerPool: 4,
        advanceCount: 2,
      })
      .expect(201);

    const stageId = createStageResponse.body.id as string;
    expect(createStageResponse.body.status).toBe('NOT_STARTED');

    const listStagesResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages`)
      .expect(200);

    expect(Array.isArray(listStagesResponse.body.poolStages)).toBe(true);
    expect(listStagesResponse.body.poolStages.map((stage: any) => stage.id)).toContain(stageId);

    const editionResponse = await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .send({ status: 'EDITION' })
      .expect(200);

    expect(editionResponse.body.status).toBe('EDITION');

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'OPEN' })
      .expect(200);

    const players = [
      { firstName: 'Ada', lastName: 'Lovelace', email: 'ada.lovelace@example.com' },
      { firstName: 'Alan', lastName: 'Turing', email: 'alan.turing@example.com' },
      { firstName: 'Grace', lastName: 'Hopper', email: 'grace.hopper@example.com' },
      { firstName: 'Linus', lastName: 'Torvalds', email: 'linus.torvalds@example.com' },
    ];

    const playerIds: string[] = [];
    for (const player of players) {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/players`)
        .send(player)
        .expect(201);
      if (response.body?.id) {
        playerIds.push(response.body.id);
      }
    }

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'SIGNATURE' })
      .expect(200);

    for (const playerId of playerIds) {
      await request(server)
        .patch(`/api/tournaments/${tournamentId}/players/${playerId}/check-in`)
        .send({ checkedIn: true })
        .expect(200);
    }

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'LIVE' })
      .expect(400);

    const inProgressResponse = await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(inProgressResponse.body.status).toBe('IN_PROGRESS');

    const liveResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/live`)
      .expect(200);

    const pools = liveResponse.body.poolStages?.[0]?.pools ?? [];
    const totalMatches = pools.reduce(
      (sum: number, pool: any) => sum + (pool.matches?.length || 0),
      0
    );
    expect(totalMatches).toBeGreaterThan(0);

    const firstMatch = pools.flatMap((pool: any) => pool.matches || [])[0];
    expect(firstMatch?.playerMatches?.length || 0).toBeGreaterThanOrEqual(2);

    const completedResponse = await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    expect(completedResponse.body.status).toBe('COMPLETED');

    await request(server)
      .delete(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .expect(204);

    const finalStagesResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages`)
      .expect(200);

    expect(finalStagesResponse.body.poolStages.map((stage: any) => stage.id)).not.toContain(stageId);
  });

  it('should create and delete a bracket', async () => {
    const tournamentId = await createTournament('Bracket');

    const createBracketResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/brackets`)
      .send({
        name: 'Main Bracket',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 3,
      })
      .expect(201);

    const bracketId = createBracketResponse.body.id as string;

    const listBracketsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/brackets`)
      .expect(200);

    expect(Array.isArray(listBracketsResponse.body.brackets)).toBe(true);
    expect(listBracketsResponse.body.brackets.map((bracket: any) => bracket.id)).toContain(bracketId);

    await request(server)
      .delete(`/api/tournaments/${tournamentId}/brackets/${bracketId}`)
      .expect(204);

    const finalBracketsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/brackets`)
      .expect(200);

    expect(finalBracketsResponse.body.brackets.map((bracket: any) => bracket.id)).not.toContain(bracketId);
  });

  it('should delete a tournament', async () => {
    const tournamentId = await createTournament('Delete');

    await request(server)
      .delete(`/api/tournaments/${tournamentId}`)
      .expect(204);

    await request(server)
      .get(`/api/tournaments/${tournamentId}`)
      .expect(404);
  });
});
