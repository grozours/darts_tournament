import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { TournamentFormat, DurationType } from '@shared/types';

describe('Tournament Pool Stage & Bracket - Integration Tests', () => {
  let app: any;
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
    process.env.RATE_LIMIT_ENABLED = 'false';
    const appModule = await import('../../src/app');
    const App = appModule.default;
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

  const updateTournamentStatus = async (tournamentId: string, status: 'OPEN' | 'SIGNATURE' | 'LIVE') => {
    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status })
      .expect(200);
  };

  const registerPlayers = async (
    tournamentId: string,
    players: Array<{ firstName: string; lastName: string; email: string }>
  ) => {
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

    return playerIds;
  };

  const checkInPlayers = async (tournamentId: string, playerIds: string[]) => {
    for (const playerId of playerIds) {
      await request(server)
        .patch(`/api/tournaments/${tournamentId}/players/${playerId}/check-in`)
        .send({ checkedIn: true })
        .expect(200);
    }
  };

  const getPoolByPlayerIdMap = (pools: any[]): Map<string, number> => {
    const poolByPlayerId = new Map<string, number>();

    for (const pool of pools) {
      for (const assignment of pool.assignments ?? []) {
        const playerId = assignment?.player?.id as string | undefined;
        const poolNumber = pool.poolNumber as number | undefined;
        if (playerId && poolNumber) {
          poolByPlayerId.set(playerId, poolNumber);
        }
      }
    }

    return poolByPlayerId;
  };

  const getSourcePairsFromPools = (pools: any[]): Array<[string, string]> => {
    const sourcePairs: Array<[string, string]> = [];

    for (const pool of pools) {
      const ids = (pool.assignments ?? [])
        .map((assignment: any) => assignment?.player?.id as string | undefined)
        .filter((value: string | undefined): value is string => Boolean(value));
      if (ids.length !== 2) {
        continue;
      }

      const first = ids[0];
      const second = ids[1];
      if (first && second) {
        sourcePairs.push([first, second]);
      }
    }

    return sourcePairs;
  };

  const getTargetPoolByPlayerId = (pools: any[]): Map<string, string> => {
    const targetPoolByPlayerId = new Map<string, string>();

    for (const pool of pools) {
      for (const assignment of pool.assignments ?? []) {
        const playerId = assignment?.player?.id as string | undefined;
        const poolId = pool.id as string | undefined;
        if (playerId && poolId) {
          targetPoolByPlayerId.set(playerId, poolId);
        }
      }
    }

    return targetPoolByPlayerId;
  };

  const assertSourcePairsAreSeparated = (
    sourcePairs: Array<[string, string]>,
    targetPoolByPlayerId: Map<string, string>
  ) => {
    for (const [first, second] of sourcePairs) {
      expect(targetPoolByPlayerId.get(first)).toBeDefined();
      expect(targetPoolByPlayerId.get(second)).toBeDefined();
      expect(targetPoolByPlayerId.get(first)).not.toBe(targetPoolByPlayerId.get(second));
    }
  };

  const getStage2PoolByPlayer = (pools: any[]): Map<string, number> => {
    const stage2PoolByPlayer = new Map<string, number>();

    for (const pool of pools) {
      const poolNumber = pool?.poolNumber as number | undefined;
      if (!poolNumber) {
        continue;
      }

      for (const assignment of pool.assignments ?? []) {
        const playerId = assignment?.player?.id as string | undefined;
        if (playerId) {
          stage2PoolByPlayer.set(playerId, poolNumber);
        }
      }
    }

    return stage2PoolByPlayer;
  };

  const assertRoundOneOppositePools = (matches: any[], stage2PoolByPlayer: Map<string, number>) => {
    for (const match of matches) {
      if (match?.roundNumber !== 1) {
        continue;
      }

      const playerIds = (match?.playerMatches ?? [])
        .map((playerMatch: any) => playerMatch?.player?.id as string | undefined)
        .filter((value: string | undefined): value is string => Boolean(value));

      if (playerIds.length < 2) {
        continue;
      }

      const [firstPlayerId, secondPlayerId] = playerIds;
      if (!firstPlayerId || !secondPlayerId) {
        continue;
      }

      const firstSourcePool = stage2PoolByPlayer.get(firstPlayerId);
      const secondSourcePool = stage2PoolByPlayer.get(secondPlayerId);
      expect(firstSourcePool).toBeDefined();
      expect(secondSourcePool).toBeDefined();
      expect(firstSourcePool).not.toBe(secondSourcePool);
    }
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

  it('should place two qualifiers from the same pool in opposite bracket halves', async () => {
    const tournamentId = await createTournament('Qualifiers Separation');

    const createStageResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 1,
        name: 'Stage 1',
        poolCount: 4,
        playersPerPool: 2,
        advanceCount: 2,
      })
      .expect(201);
    const stageId = createStageResponse.body.id as string;

    const createBracketResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/brackets`)
      .send({
        name: 'Winner Bracket',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 3,
      })
      .expect(201);
    const bracketId = createBracketResponse.body.id as string;

    await updateTournamentStatus(tournamentId, 'OPEN');

    const emailSuffix = `${Date.now()}-${randomUUID()}`;
    const players = [
      { firstName: 'Alpha', lastName: 'One', email: `alpha.one.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: 'One', email: `bravo.one.${emailSuffix}@example.com` },
      { firstName: 'Alpha', lastName: 'Two', email: `alpha.two.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: 'Two', email: `bravo.two.${emailSuffix}@example.com` },
      { firstName: 'Alpha', lastName: 'Three', email: `alpha.three.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: 'Three', email: `bravo.three.${emailSuffix}@example.com` },
      { firstName: 'Alpha', lastName: 'Four', email: `alpha.four.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: 'Four', email: `bravo.four.${emailSuffix}@example.com` },
    ];

    const playerIds = await registerPlayers(tournamentId, players);

    await updateTournamentStatus(tournamentId, 'SIGNATURE');
    await checkInPlayers(tournamentId, playerIds);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'LIVE' });

    const tournamentAfterLive = await request(server)
      .get(`/api/tournaments/${tournamentId}`)
      .expect(200);
    expect(tournamentAfterLive.body.status).toBe('LIVE');

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const liveBeforeCompletion = await request(server)
      .get(`/api/tournaments/${tournamentId}/live`)
      .expect(200);

    const poolStage = (liveBeforeCompletion.body.poolStages ?? []).find((stage: any) => stage.id === stageId);
    const pools = poolStage?.pools ?? [];
    const poolByPlayerId = getPoolByPlayerIdMap(pools);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    await request(server)
      .post(`/api/tournaments/${tournamentId}/brackets/${bracketId}/populate-from-pools`)
      .send({ stageId, role: 'WINNER' })
      .expect(204);

    const liveAfterPopulation = await request(server)
      .get(`/api/tournaments/${tournamentId}/live`)
      .expect(200);

    const winnerBracket = (liveAfterPopulation.body.brackets ?? []).find((bracket: any) => bracket.id === bracketId);
    const entries = winnerBracket?.entries ?? [];
    expect(entries).toHaveLength(8);

    const entriesByPool = new Map<number, number[]>();
    for (const entry of entries) {
      const playerId = entry?.player?.id as string | undefined;
      const seedNumber = entry?.seedNumber as number | undefined;
      if (!playerId || !seedNumber) continue;
      const poolNumber = poolByPlayerId.get(playerId);
      if (!poolNumber) continue;
      const seeds = entriesByPool.get(poolNumber) ?? [];
      seeds.push(seedNumber);
      entriesByPool.set(poolNumber, seeds);
    }

    for (const seeds of entriesByPool.values()) {
      expect(seeds).toHaveLength(2);
      const firstSeed = seeds[0];
      const secondSeed = seeds[1];
      expect(firstSeed).toBeDefined();
      expect(secondSeed).toBeDefined();
      expect(Math.abs((firstSeed ?? 0) - (secondSeed ?? 0))).toBe(4);
    }
  });

  it('should keep two qualifiers from the same source pool in different pools in next stage', async () => {
    const tournamentId = await createTournament('Next Stage Separation');

    const stage1Response = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 1,
        name: 'Stage 1',
        poolCount: 4,
        playersPerPool: 2,
        advanceCount: 2,
      })
      .expect(201);
    const stage1Id = stage1Response.body.id as string;

    const stage2Response = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 2,
        name: 'Stage 2',
        poolCount: 2,
        playersPerPool: 4,
        advanceCount: 2,
      })
      .expect(201);
    const stage2Id = stage2Response.body.id as string;

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({
        rankingDestinations: [
          { position: 1, destinationType: 'POOL_STAGE', poolStageId: stage2Id },
          { position: 2, destinationType: 'POOL_STAGE', poolStageId: stage2Id },
        ],
      })
      .expect(200);

    await updateTournamentStatus(tournamentId, 'OPEN');

    const emailSuffix = `${Date.now()}-${randomUUID()}`;
    const players = [
      { firstName: 'PoolA', lastName: 'One', email: `poola.one.${emailSuffix}@example.com` },
      { firstName: 'PoolA', lastName: 'Two', email: `poola.two.${emailSuffix}@example.com` },
      { firstName: 'PoolB', lastName: 'One', email: `poolb.one.${emailSuffix}@example.com` },
      { firstName: 'PoolB', lastName: 'Two', email: `poolb.two.${emailSuffix}@example.com` },
      { firstName: 'PoolC', lastName: 'One', email: `poolc.one.${emailSuffix}@example.com` },
      { firstName: 'PoolC', lastName: 'Two', email: `poolc.two.${emailSuffix}@example.com` },
      { firstName: 'PoolD', lastName: 'One', email: `poold.one.${emailSuffix}@example.com` },
      { firstName: 'PoolD', lastName: 'Two', email: `poold.two.${emailSuffix}@example.com` },
    ];

    const playerIds = await registerPlayers(tournamentId, players);

    await updateTournamentStatus(tournamentId, 'SIGNATURE');
    await checkInPlayers(tournamentId, playerIds);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'LIVE' });

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const stage1PoolsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}/pools`)
      .expect(200);
    const stage1Pools = stage1PoolsResponse.body.pools ?? [];

    const sourcePairs = getSourcePairsFromPools(stage1Pools);
    expect(sourcePairs).toHaveLength(4);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const stage2PoolsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages/${stage2Id}/pools`)
      .expect(200);
    const stage2Pools = stage2PoolsResponse.body.pools ?? [];

    const targetPoolByPlayerId = getTargetPoolByPlayerId(stage2Pools);
    assertSourcePairsAreSeparated(sourcePairs, targetPoolByPlayerId);
  });

  it('should keep stage-1 pool mates on opposite bracket halves after multi-stage pools', async () => {
    const tournamentId = await createTournament('Multi Stage Final Only');

    const stage1Response = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 1,
        name: 'Stage 1',
        poolCount: 4,
        playersPerPool: 2,
        advanceCount: 2,
      })
      .expect(201);
    const stage1Id = stage1Response.body.id as string;

    const stage2Response = await request(server)
      .post(`/api/tournaments/${tournamentId}/pool-stages`)
      .send({
        stageNumber: 2,
        name: 'Stage 2',
        poolCount: 2,
        playersPerPool: 4,
        advanceCount: 2,
      })
      .expect(201);
    const stage2Id = stage2Response.body.id as string;

    const bracketResponse = await request(server)
      .post(`/api/tournaments/${tournamentId}/brackets`)
      .send({
        name: 'A Bracket',
        bracketType: 'SINGLE_ELIMINATION',
        totalRounds: 2,
      })
      .expect(201);
    const bracketId = bracketResponse.body.id as string;

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({
        rankingDestinations: [
          { position: 1, destinationType: 'POOL_STAGE', poolStageId: stage2Id },
          { position: 2, destinationType: 'POOL_STAGE', poolStageId: stage2Id },
        ],
      })
      .expect(200);

    await updateTournamentStatus(tournamentId, 'OPEN');

    const emailSuffix = `${Date.now()}-${randomUUID()}`;
    const players = [
      { firstName: 'Alpha', lastName: '01', email: `a01.${emailSuffix}@example.com` },
      { firstName: 'Alpha', lastName: '02', email: `a02.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: '01', email: `b01.${emailSuffix}@example.com` },
      { firstName: 'Bravo', lastName: '02', email: `b02.${emailSuffix}@example.com` },
      { firstName: 'Charlie', lastName: '01', email: `c01.${emailSuffix}@example.com` },
      { firstName: 'Charlie', lastName: '02', email: `c02.${emailSuffix}@example.com` },
      { firstName: 'Delta', lastName: '01', email: `d01.${emailSuffix}@example.com` },
      { firstName: 'Delta', lastName: '02', email: `d02.${emailSuffix}@example.com` },
    ];

    const playerIds = await registerPlayers(tournamentId, players);

    await updateTournamentStatus(tournamentId, 'SIGNATURE');
    await checkInPlayers(tournamentId, playerIds);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/status`)
      .send({ status: 'LIVE' });

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const stage1PoolsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}/pools`)
      .expect(200);
    const stage1Pools = stage1PoolsResponse.body.pools ?? [];

    const sourcePairs = getSourcePairsFromPools(stage1Pools);
    expect(sourcePairs).toHaveLength(4);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage1Id}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage2Id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    await request(server)
      .patch(`/api/tournaments/${tournamentId}/pool-stages/${stage2Id}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const stage2PoolsResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/pool-stages/${stage2Id}/pools`)
      .expect(200);
    const stage2Pools = stage2PoolsResponse.body.pools ?? [];

    const stage2PoolByPlayer = getStage2PoolByPlayer(stage2Pools);

    await request(server)
      .post(`/api/tournaments/${tournamentId}/brackets/${bracketId}/populate-from-pools`)
      .send({ stageId: stage2Id, role: 'WINNER' })
      .expect(204);

    const liveResponse = await request(server)
      .get(`/api/tournaments/${tournamentId}/live`)
      .expect(200);

    const bracket = (liveResponse.body.brackets ?? []).find((item: any) => item.id === bracketId);
    const entries = bracket?.entries ?? [];
    expect(entries).toHaveLength(4);

    const qualifiedByStage2Pool = new Map<number, string[]>();
    for (const entry of entries) {
      const playerId = entry?.player?.id as string | undefined;
      if (!playerId) {
        continue;
      }
      const sourcePoolNumber = stage2PoolByPlayer.get(playerId);
      if (!sourcePoolNumber) {
        continue;
      }
      const bucket = qualifiedByStage2Pool.get(sourcePoolNumber) ?? [];
      bucket.push(playerId);
      qualifiedByStage2Pool.set(sourcePoolNumber, bucket);
    }

    assertRoundOneOppositePools(bracket?.matches ?? [], stage2PoolByPlayer);

    for (const players of qualifiedByStage2Pool.values()) {
      expect(players.length).toBeLessThanOrEqual(2);
    }
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
