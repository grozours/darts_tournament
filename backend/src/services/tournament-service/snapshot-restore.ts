import type { PrismaClient } from '@prisma/client';
import type { TournamentSnapshot } from './autosave';


const toArray = <T>(value: T[] | undefined | null): T[] => value ?? [];
type DateLike = Date | string;
type NullableDateLike = DateLike | null;
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

type SnapshotCollections = {
  data: Record<string, unknown>;
  players: Array<Record<string, unknown>>;
  targets: Array<Record<string, unknown>>;
  poolStages: Array<Record<string, unknown>>;
  brackets: Array<Record<string, unknown>>;
  pools: Array<Record<string, unknown>>;
  poolAssignments: Array<Record<string, unknown>>;
  matches: Array<Record<string, unknown>>;
  playerMatches: Array<Record<string, unknown>>;
  bracketTargets: Array<Record<string, unknown>>;
  bracketEntries: Array<Record<string, unknown>>;
};

const collectSnapshotCollections = (snapshot: TournamentSnapshot): SnapshotCollections => {
  const data = snapshot.data as Record<string, unknown>;

  const players = toArray(data.players as Array<Record<string, unknown>> | undefined);
  const targets = toArray(data.targets as Array<Record<string, unknown>> | undefined);
  const poolStages = toArray(data.poolStages as Array<Record<string, unknown>> | undefined);
  const brackets = toArray(data.brackets as Array<Record<string, unknown>> | undefined);

  const pools = poolStages.flatMap((stage) => toArray(stage.pools as Array<Record<string, unknown>> | undefined));
  const poolAssignments = pools.flatMap((pool) =>
    toArray(pool.assignments as Array<Record<string, unknown>> | undefined)
  );

  const poolMatches = pools.flatMap((pool) => toArray(pool.matches as Array<Record<string, unknown>> | undefined));
  const bracketMatches = brackets.flatMap((bracket) =>
    toArray(bracket.matches as Array<Record<string, unknown>> | undefined)
  );

  const matchesById = new Map<string, Record<string, unknown>>();
  for (const match of [...poolMatches, ...bracketMatches]) {
    const matchId = match.id;
    if (typeof matchId === 'string') {
      matchesById.set(matchId, match);
    }
  }
  const matches = [...matchesById.values()];

  const playerMatches = matches.flatMap((match) =>
    toArray(match.playerMatches as Array<Record<string, unknown>> | undefined)
  );

  const bracketTargets = brackets.flatMap((bracket) =>
    toArray(bracket.bracketTargets as Array<Record<string, unknown>> | undefined)
  );
  const bracketEntries = brackets.flatMap((bracket) =>
    toArray(bracket.entries as Array<Record<string, unknown>> | undefined)
  );

  return {
    data,
    players,
    targets,
    poolStages,
    brackets,
    pools,
    poolAssignments,
    matches,
    playerMatches,
    bracketTargets,
    bracketEntries,
  };
};

const updateTournamentFromSnapshot = async (
  transaction: TransactionClient,
  tournamentId: string,
  data: Record<string, unknown>
): Promise<void> => {
  await transaction.tournament.update({
    where: { id: tournamentId },
    data: {
      name: (data.name as string) ?? 'Tournament',
      location: (data.location as string | null | undefined) ?? null,
      ...(data.logoUrl === undefined ? {} : { logoUrl: (data.logoUrl as string | null) ?? null }),
      format: data.format as never,
      durationType: data.durationType as never,
      startTime: data.startTime as DateLike,
      endTime: data.endTime as DateLike,
      totalParticipants: data.totalParticipants as number,
      targetCount: data.targetCount as number,
      targetStartNumber: (data.targetStartNumber as number | undefined) ?? 1,
      shareTargets: (data.shareTargets as boolean | undefined) ?? true,
      status: data.status as never,
      completedAt: (data.completedAt as NullableDateLike | undefined) ?? null,
      historicalFlag: (data.historicalFlag as boolean | undefined) ?? false,
      doubleStageEnabled: (data.doubleStageEnabled as boolean | undefined) ?? false,
    },
  });
};

const restorePlayers = async (
  transaction: TransactionClient,
  tournamentId: string,
  players: Array<Record<string, unknown>>
): Promise<void> => {
  if (players.length === 0) {
    return;
  }

  await transaction.player.createMany({
    data: players.map((player) => ({
      id: player.id as string,
      tournamentId,
      personId: (player.personId as string | undefined) ?? null,
      firstName: player.firstName as string,
      lastName: player.lastName as string,
      surname: (player.surname as string | undefined) ?? null,
      teamName: (player.teamName as string | undefined) ?? null,
      email: (player.email as string | undefined) ?? null,
      phone: (player.phone as string | undefined) ?? null,
      skillLevel: player.skillLevel as never,
      registeredAt: player.registeredAt as DateLike,
      isActive: (player.isActive as boolean | undefined) ?? true,
      checkedIn: (player.checkedIn as boolean | undefined) ?? false,
    })),
  });
};

const restoreTargets = async (
  transaction: TransactionClient,
  tournamentId: string,
  targets: Array<Record<string, unknown>>
): Promise<void> => {
  if (targets.length === 0) {
    return;
  }

  await transaction.target.createMany({
    data: targets.map((target) => ({
      id: target.id as string,
      tournamentId,
      targetNumber: target.targetNumber as number,
      targetCode: target.targetCode as string,
      name: (target.name as string | undefined) ?? null,
      status: (target.status as never) ?? 'AVAILABLE',
      currentMatchId: null,
      lastUsedAt: (target.lastUsedAt as NullableDateLike | undefined) ?? null,
    })),
  });
};

const restorePoolStages = async (
  transaction: TransactionClient,
  tournamentId: string,
  poolStages: Array<Record<string, unknown>>
): Promise<void> => {
  if (poolStages.length === 0) {
    return;
  }

  await transaction.poolStage.createMany({
    data: poolStages.map((stage) => ({
      id: stage.id as string,
      tournamentId,
      stageNumber: stage.stageNumber as number,
      name: stage.name as string,
      matchFormatKey: (stage.matchFormatKey as string | undefined) ?? null,
      inParallelWith: stage.inParallelWith as never,
      poolCount: stage.poolCount as number,
      playersPerPool: stage.playersPerPool as number,
      advanceCount: stage.advanceCount as number,
      losersAdvanceToBracket: (stage.losersAdvanceToBracket as boolean | undefined) ?? false,
      rankingDestinations: stage.rankingDestinations as never,
      status: (stage.status as never) ?? 'NOT_STARTED',
      createdAt: stage.createdAt as DateLike,
      completedAt: (stage.completedAt as NullableDateLike | undefined) ?? null,
    })),
  });
};

const restorePools = async (
  transaction: TransactionClient,
  pools: Array<Record<string, unknown>>
): Promise<void> => {
  if (pools.length === 0) {
    return;
  }

  await transaction.pool.createMany({
    data: pools.map((pool) => ({
      id: pool.id as string,
      poolStageId: pool.poolStageId as string,
      poolNumber: pool.poolNumber as number,
      name: pool.name as string,
      status: (pool.status as never) ?? 'NOT_STARTED',
      createdAt: pool.createdAt as DateLike,
      completedAt: (pool.completedAt as NullableDateLike | undefined) ?? null,
    })),
  });
};

const restorePoolAssignments = async (
  transaction: TransactionClient,
  poolAssignments: Array<Record<string, unknown>>
): Promise<void> => {
  if (poolAssignments.length === 0) {
    return;
  }

  await transaction.poolAssignment.createMany({
    data: poolAssignments.map((assignment) => ({
      id: assignment.id as string,
      poolId: assignment.poolId as string,
      playerId: assignment.playerId as string,
      assignmentType: assignment.assignmentType as never,
      seedNumber: (assignment.seedNumber as number | undefined) ?? null,
      assignedAt: assignment.assignedAt as DateLike,
    })),
  });
};

const restoreBrackets = async (
  transaction: TransactionClient,
  tournamentId: string,
  brackets: Array<Record<string, unknown>>
): Promise<void> => {
  if (brackets.length === 0) {
    return;
  }

  await transaction.bracket.createMany({
    data: brackets.map((bracket) => ({
      id: bracket.id as string,
      tournamentId,
      bracketType: bracket.bracketType as never,
      name: bracket.name as string,
      roundMatchFormats: bracket.roundMatchFormats as never,
      inParallelWith: bracket.inParallelWith as never,
      totalRounds: bracket.totalRounds as number,
      status: (bracket.status as never) ?? 'NOT_STARTED',
      createdAt: bracket.createdAt as DateLike,
      completedAt: (bracket.completedAt as NullableDateLike | undefined) ?? null,
    })),
  });
};

const restoreBracketTargets = async (
  transaction: TransactionClient,
  bracketTargets: Array<Record<string, unknown>>
): Promise<void> => {
  if (bracketTargets.length === 0) {
    return;
  }

  await transaction.bracketTarget.createMany({
    data: bracketTargets.map((target) => ({
      id: target.id as string,
      bracketId: target.bracketId as string,
      targetId: target.targetId as string,
      createdAt: target.createdAt as DateLike,
    })),
  });
};

const restoreBracketEntries = async (
  transaction: TransactionClient,
  bracketEntries: Array<Record<string, unknown>>
): Promise<void> => {
  if (bracketEntries.length === 0) {
    return;
  }

  await transaction.bracketEntry.createMany({
    data: bracketEntries.map((entry) => ({
      id: entry.id as string,
      bracketId: entry.bracketId as string,
      playerId: entry.playerId as string,
      seedNumber: entry.seedNumber as number,
      currentRound: entry.currentRound as number,
      isEliminated: (entry.isEliminated as boolean | undefined) ?? false,
      finalPosition: (entry.finalPosition as number | undefined) ?? null,
      enteredAt: entry.enteredAt as DateLike,
    })),
  });
};

const restoreMatches = async (
  transaction: TransactionClient,
  tournamentId: string,
  matches: Array<Record<string, unknown>>
): Promise<void> => {
  if (matches.length === 0) {
    return;
  }

  await transaction.match.createMany({
    data: matches.map((match) => ({
      id: match.id as string,
      tournamentId,
      poolId: (match.poolId as string | undefined) ?? null,
      bracketId: (match.bracketId as string | undefined) ?? null,
      matchFormatKey: (match.matchFormatKey as string | undefined) ?? null,
      targetId: (match.targetId as string | undefined) ?? null,
      roundNumber: match.roundNumber as number,
      matchNumber: match.matchNumber as number,
      legs: (match.legs as number | undefined) ?? 1,
      sets: (match.sets as number | undefined) ?? 1,
      status: (match.status as never) ?? 'SCHEDULED',
      scheduledAt: (match.scheduledAt as NullableDateLike | undefined) ?? null,
      startedAt: (match.startedAt as NullableDateLike | undefined) ?? null,
      completedAt: (match.completedAt as NullableDateLike | undefined) ?? null,
      winnerId: (match.winnerId as string | undefined) ?? null,
    })),
  });
};

const restorePlayerMatches = async (
  transaction: TransactionClient,
  playerMatches: Array<Record<string, unknown>>
): Promise<void> => {
  if (playerMatches.length === 0) {
    return;
  }

  await transaction.playerMatch.createMany({
    data: playerMatches.map((playerMatch) => ({
      id: playerMatch.id as string,
      matchId: playerMatch.matchId as string,
      playerId: playerMatch.playerId as string,
      playerPosition: playerMatch.playerPosition as number,
      scoreTotal: (playerMatch.scoreTotal as number | undefined) ?? 0,
      legsWon: (playerMatch.legsWon as number | undefined) ?? 0,
      setsWon: (playerMatch.setsWon as number | undefined) ?? 0,
      isWinner: (playerMatch.isWinner as boolean | undefined) ?? false,
    })),
  });
};

const restoreTargetCurrentMatches = async (
  transaction: TransactionClient,
  tournamentId: string,
  targets: Array<Record<string, unknown>>
): Promise<void> => {
  const targetsWithCurrentMatch = targets.filter((target) => typeof target.currentMatchId === 'string');
  await Promise.all(
    targetsWithCurrentMatch.map((target) =>
      transaction.target.updateMany({
        where: { id: target.id as string, tournamentId },
        data: { currentMatchId: target.currentMatchId as string },
      })
    )
  );
};

const restoreSnapshotInTransaction = async (
  transaction: TransactionClient,
  tournamentId: string,
  collections: SnapshotCollections
): Promise<void> => {
  const {
    data,
    players,
    targets,
    poolStages,
    brackets,
    pools,
    poolAssignments,
    matches,
    playerMatches,
    bracketTargets,
    bracketEntries,
  } = collections;

  await transaction.schedule.deleteMany({ where: { tournamentId } });
  await transaction.match.deleteMany({ where: { tournamentId } });
  await transaction.bracket.deleteMany({ where: { tournamentId } });
  await transaction.poolStage.deleteMany({ where: { tournamentId } });
  await transaction.target.deleteMany({ where: { tournamentId } });
  await transaction.player.deleteMany({ where: { tournamentId } });

  await updateTournamentFromSnapshot(transaction, tournamentId, data);
  await restorePlayers(transaction, tournamentId, players);
  await restoreTargets(transaction, tournamentId, targets);
  await restorePoolStages(transaction, tournamentId, poolStages);
  await restorePools(transaction, pools);
  await restorePoolAssignments(transaction, poolAssignments);
  await restoreBrackets(transaction, tournamentId, brackets);
  await restoreBracketTargets(transaction, bracketTargets);
  await restoreBracketEntries(transaction, bracketEntries);
  await restoreMatches(transaction, tournamentId, matches);
  await restorePlayerMatches(transaction, playerMatches);
  await restoreTargetCurrentMatches(transaction, tournamentId, targets);
};

export const restoreTournamentStateFromSnapshot = async (
  prisma: PrismaClient,
  tournamentId: string,
  snapshot: TournamentSnapshot
): Promise<void> => {
  const collections = collectSnapshotCollections(snapshot);
  await prisma.$transaction(async (transaction: TransactionClient) => {
    await restoreSnapshotInTransaction(transaction, tournamentId, collections);
  });
};
