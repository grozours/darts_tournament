import { randomInt } from 'node:crypto';

import type { TournamentModel } from '../../models/tournament-model';
import { AppError } from '../../middleware/error-handler';
import {
  AssignmentType,
  BracketType,
  BracketStatus,
  MatchStatus,
  PoolStatus,
  StageStatus,
  TournamentFormat,
  TournamentStatus,
} from '../../../../shared/src/types';
import { isPowerOfTwo, nextPowerOfTwo } from './number-helpers';
import {
  getBracketRoundMatchFormatKey,
  normalizeMatchFormatKey,
} from './match-format-presets';
import { emitMatchFormatChangedNotifications } from './match-format-change-notifications';

type PoolStageUpdateData = Partial<{
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
  matchFormatKey: string;
  inParallelWith: string[];
  rankingDestinations: PoolStageRankingDestinationInput[];
  status: StageStatus;
  // eslint-disable-next-line unicorn/no-null
  completedAt: Date | null;
}>;

type PoolStageCreateData = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket?: boolean;
  matchFormatKey?: string;
  inParallelWith?: string[];
  rankingDestinations?: PoolStageRankingDestinationInput[];
};

type PoolStageRankingDestinationInput = {
  position: number;
  destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED';
  bracketId?: string;
  poolStageId?: string;
};

type PoolStandingsEntry = {
  playerId: string;
  seedKey: string;
  poolNumber: number;
  position: number;
  legsWon: number;
  legsLost: number;
  name: string;
};

type MatchForCompletion = {
  id: string;
  status?: string | null;
  playerMatches?: Array<{ playerId?: string | null }> | null;
  targetId?: string | null;
  startedAt?: Date | null;
};

export type PoolStageHandlerContext = {
  tournamentModel: TournamentModel;
  validateUUID: (id: string) => void;
  completeMatchWithRandomScores: (
    match: MatchForCompletion,
    now: Date,
    options: { shouldAdvance: boolean; tournamentId?: string }
  ) => Promise<void>;
};

const compareByPoolAndPosition = (
  first: { poolNumber: number; position: number },
  second: { poolNumber: number; position: number }
): number => {
  if (first.poolNumber !== second.poolNumber) return first.poolNumber - second.poolNumber;
  return first.position - second.position;
};

const buildRankDestinationMap = (
  destinations: PoolStageRankingDestinationInput[]
): Map<number, PoolStageRankingDestinationInput> => {
  const map = new Map<number, PoolStageRankingDestinationInput>();
  for (const destination of destinations) {
    map.set(destination.position, destination);
  }
  return map;
};

const getStageRankingDestinations = (stage: { rankingDestinations?: unknown }) => {
  return Array.isArray(stage.rankingDestinations)
    ? (stage.rankingDestinations as PoolStageRankingDestinationInput[])
    : undefined;
};

export const createPoolStageHandlers = (context: PoolStageHandlerContext) => {
  const { tournamentModel, validateUUID, completeMatchWithRandomScores } = context;

  const getEditableTournamentForPoolStage = async (tournamentId: string) => {
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    if (!isPoolStageEditable(tournament.status)) {
      throw new AppError(
        'Pool stages can only be modified for draft, open, signature, or live tournaments',
        400,
        'POOL_STAGE_NOT_EDITABLE'
      );
    }

    return tournament;
  };

  const isPoolStageEditable = (status: TournamentStatus): boolean => {
    return [
      TournamentStatus.DRAFT,
      TournamentStatus.OPEN,
      TournamentStatus.SIGNATURE,
      TournamentStatus.LIVE,
    ].includes(status);
  };

  const buildPoolStageUpdateData = (data: PoolStageUpdateData): {
    nextData: PoolStageUpdateData;
    shouldRedistribute: boolean;
  } => {
    const nextData = { ...data };
    const shouldRedistribute =
      data.poolCount !== undefined || data.playersPerPool !== undefined;

    if (nextData.status === StageStatus.COMPLETED) {
      nextData.completedAt = new Date();
    }

    return { nextData, shouldRedistribute };
  };

  const ensureValidMatchFormatKey = (
    value: unknown,
    errorCode: string
  ): string | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalized = normalizeMatchFormatKey(value);
    if (!normalized) {
      throw new AppError('Invalid match format key', 400, errorCode);
    }
    return normalized;
  };

  const normalizeParallelReferences = (
    value: unknown,
    errorCode: string
  ): string[] | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new AppError('Invalid inParallelWith value', 400, errorCode);
    }

    const references = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    for (const reference of references) {
      if (!/^(stage:\d+|bracket:.+)$/i.test(reference)) {
        throw new AppError('Invalid inParallelWith reference', 400, errorCode);
      }
    }

    return [...new Set(references)];
  };

  const validatePoolStageRankingDestinations = async (
    tournamentId: string,
    playersPerPool: number,
    destinations?: PoolStageRankingDestinationInput[],
    stageId?: string
  ): Promise<void> => {
    if (!destinations) return;
    const { positions, bracketIds, poolStageIds } =
      collectRankingDestinationInfo(destinations, playersPerPool);
    ensureRankingCoverage(positions, playersPerPool);
    await ensureBracketDestinations(tournamentId, bracketIds);
    await ensurePoolStageDestinations(tournamentId, poolStageIds, stageId);
  };

  const validateRankingPosition = (position: number, playersPerPool: number) => {
    if (!Number.isInteger(position) || position < 1) {
      throw new AppError('Invalid ranking destination position', 400, 'POOL_STAGE_ROUTING_INVALID');
    }
    if (position > playersPerPool) {
      throw new AppError('Ranking destination exceeds players per pool', 400, 'POOL_STAGE_ROUTING_INVALID');
    }
  };

  const collectRankingDestinationInfo = (
    destinations: PoolStageRankingDestinationInput[],
    playersPerPool: number
  ) => {
    const positions = new Set<number>();
    const bracketIds = new Set<string>();
    const poolStageIds = new Set<string>();

    for (const destination of destinations) {
      validateRankingPosition(destination.position, playersPerPool);
      if (positions.has(destination.position)) {
        throw new AppError('Duplicate ranking destination position', 400, 'POOL_STAGE_ROUTING_INVALID');
      }
      positions.add(destination.position);

      if (destination.destinationType === 'BRACKET') {
        if (!destination.bracketId) {
          throw new AppError('Bracket destination requires a bracket', 400, 'POOL_STAGE_ROUTING_INVALID');
        }
        bracketIds.add(destination.bracketId);
      } else if (destination.destinationType === 'POOL_STAGE') {
        if (!destination.poolStageId) {
          throw new AppError('Pool stage destination requires a stage', 400, 'POOL_STAGE_ROUTING_INVALID');
        }
        poolStageIds.add(destination.poolStageId);
      }
    }

    return { positions, bracketIds, poolStageIds };
  };

  const ensureRankingCoverage = (positions: Set<number>, playersPerPool: number) => {
    if (positions.size !== playersPerPool) {
      throw new AppError(
        'Ranking destinations must cover all positions in the pool',
        400,
        'POOL_STAGE_ROUTING_INCOMPLETE'
      );
    }
  };

  const ensureBracketDestinations = async (tournamentId: string, bracketIds: Set<string>) => {
    if (bracketIds.size === 0) return;
    const brackets = await tournamentModel.getBrackets(tournamentId);
    const allowedBracketIds = new Set(brackets.map((bracket) => bracket.id));
    const invalidBracketIds = [...bracketIds].filter((id) => !allowedBracketIds.has(id));
    if (invalidBracketIds.length > 0) {
      throw new AppError(
        'Ranking destinations must reference tournament brackets',
        400,
        'POOL_STAGE_ROUTING_INVALID',
        { invalidBracketIds }
      );
    }
  };

  const ensurePoolStageDestinations = async (
    tournamentId: string,
    poolStageIds: Set<string>,
    stageId?: string
  ) => {
    if (poolStageIds.size === 0) return;
    const stages = await tournamentModel.getPoolStages(tournamentId);
    const allowedStageIds = new Set(stages.map((stage) => stage.id));
    const invalidStageIds = [...poolStageIds].filter((id) => !allowedStageIds.has(id));
    if (invalidStageIds.length > 0) {
      throw new AppError(
        'Ranking destinations must reference tournament pool stages',
        400,
        'POOL_STAGE_ROUTING_INVALID',
        { invalidStageIds }
      );
    }
    if (stageId && poolStageIds.has(stageId)) {
      throw new AppError(
        'Ranking destinations cannot target the same pool stage',
        400,
        'POOL_STAGE_ROUTING_INVALID'
      );
    }
  };

  const addEntryToBucket = <T>(bucketMap: Map<string, T[]>, key: string, entry: T) => {
    const bucket = bucketMap.get(key) ?? [];
    bucket.push(entry);
    bucketMap.set(key, bucket);
  };

  const buildPoolEntry = (
    pool: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>[number],
    row: { playerId: string; position: number; legsWon: number; legsLost: number; name: string }
  ): PoolStandingsEntry => ({
    playerId: row.playerId,
    seedKey: `${pool.poolNumber}-${row.position}`,
    poolNumber: pool.poolNumber,
    position: row.position,
    legsWon: row.legsWon,
    legsLost: row.legsLost,
    name: row.name,
  });

  const buildEntriesFromRankingDestinations = (
    pools: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>,
    destinations: PoolStageRankingDestinationInput[]
  ) => {
    const destinationMap = buildRankDestinationMap(destinations);
    const entriesByBracket = new Map<string, PoolStandingsEntry[]>();
    const entriesByStage = new Map<string, PoolStandingsEntry[]>();

    for (const pool of pools) {
      const standings = buildPoolStandings(pool);
      for (const row of standings) {
        const destination = destinationMap.get(row.position);
        if (!destination) continue;
        const entry = buildPoolEntry(pool, row);

        if (destination.destinationType === 'BRACKET' && destination.bracketId) {
          addEntryToBucket(entriesByBracket, destination.bracketId, entry);
        } else if (destination.destinationType === 'POOL_STAGE' && destination.poolStageId) {
          addEntryToBucket(entriesByStage, destination.poolStageId, entry);
        }
      }
    }

    const bracketEntries = new Map<string, Array<{ playerId: string; seedNumber: number }>>();
    for (const [bracketId, entries] of entriesByBracket) {
      const ordered = [...entries].sort(compareByPoolAndPosition);
      bracketEntries.set(
        bracketId,
        ordered.map((entry, index) => ({ playerId: entry.playerId, seedNumber: index + 1 }))
      );
    }

    const stageEntries = new Map<string, PoolStandingsEntry[]>();
    for (const [stageKey, entries] of entriesByStage) {
      stageEntries.set(stageKey, [...entries].sort(compareByPoolAndPosition));
    }

    return { bracketEntries, stageEntries };
  };

  const applyPoolStageStatusUpdates = async (
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean,
    // eslint-disable-next-line unicorn/no-null
    completedAt?: Date | null
  ): Promise<void> => {
    switch (updatedStage.status) {
      case StageStatus.NOT_STARTED: {
        await handlePoolStageNotStarted(stageId);
        break;
      }
      case StageStatus.EDITION: {
        await handlePoolStageEdition(tournamentId, stageId, updatedStage, shouldRedistribute);
        break;
      }
      case StageStatus.IN_PROGRESS: {
        await handlePoolStageInProgress(tournamentId, stageId, updatedStage);
        break;
      }
      case StageStatus.COMPLETED: {
        await handlePoolStageCompleted(tournamentId, stageId, completedAt ?? new Date());
        break;
      }
      default: {
        break;
      }
    }
  };

  const ensurePoolsForStage = async (
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>
  ): Promise<void> => {
    const currentCount = await tournamentModel.getPoolCountForStage(stageId);
    if (currentCount < updatedStage.poolCount) {
      await tournamentModel.createPoolsForStage(
        stageId,
        updatedStage.poolCount - currentCount,
        currentCount + 1
      );
    }
  };

  const ensurePoolAssignments = async (
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean
  ): Promise<void> => {
    if (shouldRedistribute) {
      await tournamentModel.deletePoolAssignmentsForStage(stageId);
      await assignPlayersToPools(
        tournamentId,
        stageId,
        updatedStage.poolCount,
        updatedStage.playersPerPool
      );
      return;
    }

    const assignmentsCount = await tournamentModel.getPoolAssignmentCountForStage(stageId);
    if (assignmentsCount === 0) {
      await assignPlayersToPools(
        tournamentId,
        stageId,
        updatedStage.poolCount,
        updatedStage.playersPerPool
      );
    }
  };

  const handlePoolStageEdition = async (
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean
  ): Promise<void> => {
    await ensurePoolsForStage(stageId, updatedStage);
    await ensurePoolAssignments(tournamentId, stageId, updatedStage, shouldRedistribute);
  };

  const handlePoolStageInProgress = async (
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>
  ): Promise<void> => {
    await ensurePoolsForStage(stageId, updatedStage);
    await ensurePoolAssignments(tournamentId, stageId, updatedStage, false);
    await createPoolMatchesForStage(tournamentId, stageId);
  };

  const handlePoolStageNotStarted = async (stageId: string): Promise<void> => {
    const pools = await tournamentModel.getPoolsForStage(stageId);
    await Promise.all(pools.map(async (pool) => {
      await tournamentModel.resetPoolMatches(pool.id);
    }));
  };

  const handlePoolStageCompleted = async (
    tournamentId: string,
    stageId: string,
    completedAt: Date
  ): Promise<void> => {
    await tournamentModel.completeMatchesForStage(stageId, completedAt);
    await tournamentModel.completePoolsForStage(stageId, completedAt);
    const handledDoubleStage = await handleDoubleStageProgression(tournamentId, stageId);
    if (!handledDoubleStage) {
      await populateBracketsForStage(tournamentId, stageId);
    }
  };

  const buildPlayerLabel = (player?: { firstName?: string; lastName?: string }) => {
    const first = player?.firstName ?? '';
    const last = player?.lastName ?? '';
    return `${first} ${last}`.trim();
  };

  const buildPoolStandings = (pool: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>[number]) => {
    const rows = new Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>();

    addPoolAssignments(rows, pool.assignments ?? []);
    addPoolMatchResults(rows, pool.matches ?? []);

    return sortPoolStandings(rows);
  };

  const ensurePoolRow = (
    rows: Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>,
    player?: { id?: string; firstName?: string; lastName?: string }
  ): void => {
    if (!player?.id) return;
    if (rows.has(player.id)) return;
    rows.set(player.id, {
      playerId: player.id,
      name: buildPlayerLabel(player),
      legsWon: 0,
      legsLost: 0,
    });
  };

  const addPoolAssignments = (
    rows: Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>,
    assignments: Array<{ player?: { id?: string; firstName?: string; lastName?: string } }>
  ): void => {
    for (const assignment of assignments) {
      ensurePoolRow(rows, assignment.player);
    }
  };

  const addPoolMatchResults = (
    rows: Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>,
    matches: Array<{ status?: string | null; playerMatches?: Array<{ player?: { id?: string; firstName?: string; lastName?: string }; scoreTotal?: number | null; legsWon?: number | null }> | null }>
  ): void => {
    for (const match of matches) {
      if (match.status !== MatchStatus.COMPLETED) continue;
      const playerMatches = match.playerMatches ?? [];
      for (const pm of playerMatches) {
        ensurePoolRow(rows, pm.player);
      }
      applyPoolMatchScores(rows, playerMatches);
    }
  };

  const applyPoolMatchScores = (
    rows: Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>,
    playerMatches: Array<{ player?: { id?: string }; scoreTotal?: number | null; legsWon?: number | null }>
  ): void => {
    for (const pm of playerMatches) {
      if (!pm.player?.id) continue;
      const row = rows.get(pm.player.id);
      if (!row) continue;
      row.legsWon += pm.scoreTotal ?? pm.legsWon ?? 0;
      row.legsLost += sumOpponentLegs(playerMatches, pm.player.id);
    }
  };

  const sumOpponentLegs = (
    playerMatches: Array<{ player?: { id?: string }; scoreTotal?: number | null; legsWon?: number | null }>,
    playerId: string
  ): number => {
    let opponentTotal = 0;
    for (const other of playerMatches) {
      if (other.player?.id && other.player.id !== playerId) {
        opponentTotal += other.scoreTotal ?? other.legsWon ?? 0;
      }
    }
    return opponentTotal;
  };

  const sortPoolStandings = (
    rows: Map<string, { playerId: string; name: string; legsWon: number; legsLost: number }>
  ) => {
    const sorted = [...rows.values()].sort((a, b) => {
      if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
      if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((row, index) => ({
      ...row,
      position: index + 1,
    }));
  };

  const populateBracket = async (
    tournamentId: string,
    bracketId: string,
    entries: Array<{ playerId: string; seedNumber: number }>,
    options?: { forceInProgress?: boolean }
  ): Promise<void> => {
    const bracket = await tournamentModel.getBracketById(bracketId);
    const firstRoundMatchFormatKey = bracket
      ? getBracketRoundMatchFormatKey(bracket.roundMatchFormats, 1)
      : undefined;

    await tournamentModel.deleteMatchesForBracket(bracketId);
    await tournamentModel.deleteBracketEntriesForBracket(bracketId);

    const payload = entries.map((entry) => ({
      bracketId,
      playerId: entry.playerId,
      seedNumber: entry.seedNumber,
      currentRound: 1,
    }));
    await tournamentModel.createBracketEntries(payload);

    const bracketSize = Math.max(2, nextPowerOfTwo(entries.length));
    const totalRounds = Math.max(1, Math.log2(bracketSize));

    if (entries.length < 2) {
      await tournamentModel.updateBracket(bracketId, {
        status: options?.forceInProgress ? BracketStatus.IN_PROGRESS : BracketStatus.NOT_STARTED,
        totalRounds,
      });
      return;
    }

    const ordered = [...entries].sort((a, b) => a.seedNumber - b.seedNumber);
    const playerIds = ordered.map((entry) => entry.playerId);
    const matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];
    let matchNumber = 1;
    for (let left = 0, right = playerIds.length - 1; left < right; left += 1, right -= 1) {
      const first = playerIds[left];
      const second = playerIds[right];
      if (!first || !second) continue;
      matches.push({
        roundNumber: 1,
        matchNumber,
        playerIds: [first, second],
      });
      matchNumber += 1;
    }

    await tournamentModel.createBracketMatches(
      tournamentId,
      bracketId,
      matches,
      firstRoundMatchFormatKey
    );
    await tournamentModel.updateBracket(bracketId, { status: BracketStatus.IN_PROGRESS, totalRounds });
  };

  const populateStageRouting = async (
    tournamentId: string,
    pools: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>,
    routing: PoolStageRankingDestinationInput[]
  ): Promise<void> => {
    const { bracketEntries, stageEntries } = buildEntriesFromRankingDestinations(pools, routing);
    for (const [bracketId, entries] of bracketEntries) {
      await populateBracket(tournamentId, bracketId, entries);
    }

    if (stageEntries.size === 0) return;
    const stages = await tournamentModel.getPoolStages(tournamentId);
    const stageMap = new Map(stages.map((item) => [item.id, item]));
    for (const [targetStageId, entries] of stageEntries) {
      const targetStage = stageMap.get(targetStageId);
      if (!targetStage) continue;
      await assignPlayersToStage(targetStage, entries);
    }
  };

  const populateBracketsForStage = async (tournamentId: string, stageId: string): Promise<void> => {
    const stage = await tournamentModel.getPoolStageById(stageId);
    if (stage?.tournamentId !== tournamentId) {
      return;
    }

    const pools = await tournamentModel.getPoolsWithMatchesForStage(stageId);
    const routing = getStageRankingDestinations(stage);
    if (routing && routing.length > 0) {
      await populateStageRouting(tournamentId, pools, routing);
      return;
    }

    const finalStage = await getFinalPoolStage(tournamentId, stageId);
    if (!finalStage) {
      return;
    }

    const brackets = await tournamentModel.getBrackets(tournamentId);
    if (brackets.length === 0) {
      return;
    }

    const { winners, losers } = collectPoolStandings(pools, finalStage.advanceCount);
    const { winnerEntries, loserEntries } = buildBracketEntriesFromPools(winners, losers);
    const { winnerBracket, loserBracket } = selectWinnerLoserBrackets(brackets);

    if (winnerBracket) {
      await populateBracket(tournamentId, winnerBracket.id, winnerEntries);
    }

    if (loserBracket) {
      await populateBracket(tournamentId, loserBracket.id, loserEntries);
    }
  };

  const tokenizeBracketName = (name: string) =>
    name
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((token) => token.toLowerCase());

  const selectBracketByLabel = (
    brackets: Awaited<ReturnType<TournamentModel['getBrackets']>>,
    label: string
  ) => {
    const target = label.trim().toLowerCase();
    if (!target) return;
    return brackets.find((bracket) => tokenizeBracketName(bracket.name).includes(target));
  };

  const ensureBracketForLabel = async (
    tournamentId: string,
    brackets: Awaited<ReturnType<TournamentModel['getBrackets']>>,
    label: string
  ) => {
    const existing = selectBracketByLabel(brackets, label);
    if (existing) {
      return existing;
    }

    const latestBrackets = await tournamentModel.getBrackets(tournamentId);
    const latestExisting = selectBracketByLabel(latestBrackets, label);
    if (latestExisting) {
      return latestExisting;
    }

    return await tournamentModel.createBracket(tournamentId, {
      name: `${label} Bracket`,
      bracketType: BracketType.SINGLE_ELIMINATION,
      totalRounds: 1,
    });
  };

  const assignPlayersToStage = async (
    stage: Awaited<ReturnType<TournamentModel['getPoolStageById']>>,
    entries: PoolStandingsEntry[]
  ): Promise<void> => {
    if (!stage) return;

    await ensurePoolsForStage(stage.id, stage);
    await tournamentModel.deletePoolAssignmentsForStage(stage.id);

    const pools = await tournamentModel.getPoolsForStage(stage.id);
    if (pools.length === 0) {
      return;
    }

    const unique = uniqueEntriesByPlayerId(entries);
    const capacity = stage.poolCount * stage.playersPerPool;
    const selected = unique.slice(0, capacity);
    const poolStates = pools.map((pool) => ({ pool, count: 0 }));
    const assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }> = [];

    let poolIndex = 0;
    for (const entry of selected) {
      let attempts = 0;
      while (attempts < poolStates.length) {
        const current = poolStates[poolIndex];
        if (!current) {
          break;
        }
        if (current.count < stage.playersPerPool) {
          break;
        }
        poolIndex = (poolIndex + 1) % poolStates.length;
        attempts += 1;
      }

      if (attempts >= poolStates.length) {
        break;
      }

      const target = poolStates[poolIndex];
      if (!target) {
        break;
      }
      target.count += 1;
      assignments.push({
        poolId: target.pool.id,
        playerId: entry.playerId,
        assignmentType: AssignmentType.SEEDED,
        seedNumber: assignments.length + 1,
      });
      poolIndex = (poolIndex + 1) % poolStates.length;
    }

    await tournamentModel.createPoolAssignments(assignments);
  };

  type DoubleStageContext = {
    tournament: NonNullable<Awaited<ReturnType<TournamentModel['findById']>>>;
    stage: NonNullable<Awaited<ReturnType<TournamentModel['getPoolStageById']>>>;
    stages: Awaited<ReturnType<TournamentModel['getPoolStages']>>;
    brackets: Awaited<ReturnType<TournamentModel['getBrackets']>>;
    pools: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>;
  };

  const getDoubleStageContext = async (
    tournamentId: string,
    stageId: string
  ): Promise<DoubleStageContext | undefined> => {
    const tournament = await tournamentModel.findById(tournamentId);
    if (tournament?.format !== TournamentFormat.DOUBLE) {
      return;
    }

    const stage = await tournamentModel.getPoolStageById(stageId);
    if (!stage) {
      return;
    }

    const stages = await tournamentModel.getPoolStages(tournamentId);
    const hasDoubleStages = stages.some((item) => item.stageNumber === 2 || item.stageNumber === 3);
    if (!tournament.doubleStageEnabled && !hasDoubleStages) {
      return;
    }

    const [brackets, pools] = await Promise.all([
      tournamentModel.getBrackets(tournamentId),
      tournamentModel.getPoolsWithMatchesForStage(stageId),
    ]);

    return {
      tournament,
      stage,
      stages,
      brackets,
      pools,
    };
  };

  const handleStageOneDoubleProgression = async (context: DoubleStageContext): Promise<void> => {
    const stageA = context.stages.find((item) => item.stageNumber === 2);
    const stageB = context.stages.find((item) => item.stageNumber === 3);

    if (!stageA || !stageB) {
      throw new AppError(
        'Double-stage tournament requires stage 2 (A) and stage 3 (B)',
        400,
        'DOUBLE_STAGE_MISSING_STAGE'
      );
    }

    const entriesA: PoolStandingsEntry[] = [];
    const entriesB: PoolStandingsEntry[] = [];
    const entriesC: PoolStandingsEntry[] = [];

    for (const pool of context.pools) {
      const standings = buildPoolStandings(pool);
      const topA = standings.slice(0, 2);
      const midB = standings.slice(2, 4);
      const lastC = standings.slice(-1);

      for (const row of topA) entriesA.push(buildPoolEntry(pool, row));
      for (const row of midB) entriesB.push(buildPoolEntry(pool, row));
      for (const row of lastC) entriesC.push(buildPoolEntry(pool, row));
    }

    const uniqueA = uniqueEntriesByPlayerId(entriesA);
    const uniqueB = uniqueEntriesByPlayerId(entriesB);
    const uniqueC = uniqueEntriesByPlayerId(entriesC);
    const stageAIds = new Set(uniqueA.map((entry) => entry.playerId));
    const stageBEntries = uniqueB.filter((entry) => !stageAIds.has(entry.playerId));
    const stageBIds = new Set(stageBEntries.map((entry) => entry.playerId));
    const bracketCEntries = uniqueC.filter(
      (entry) => !stageAIds.has(entry.playerId) && !stageBIds.has(entry.playerId)
    );

    await assignPlayersToStage(stageA, uniqueA);
    await assignPlayersToStage(stageB, stageBEntries);

    const bracketC = await ensureBracketForLabel(context.tournament.id, context.brackets, 'C');
    const entries = [...bracketCEntries];
    entries.sort(compareByPoolAndPosition);
    const seeded = entries.map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    await populateBracket(context.tournament.id, bracketC.id, seeded, { forceInProgress: true });
  };

  const handleStageTwoOrThreeProgression = async (context: DoubleStageContext): Promise<void> => {
    const label = context.stage.stageNumber === 2 ? 'A' : 'B';
    const winners: PoolStandingsEntry[] = [];

    for (const pool of context.pools) {
      const standings = buildPoolStandings(pool);
      const topTwo = standings.slice(0, 2);
      for (const row of topTwo) {
        winners.push(buildPoolEntry(pool, row));
      }
    }

    const bracket = await ensureBracketForLabel(context.tournament.id, context.brackets, label);
    const ordered = uniqueEntriesByPlayerId(winners).sort(compareByPoolAndPosition);
    const seeded = ordered.map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    await populateBracket(context.tournament.id, bracket.id, seeded);
  };

  const handleDoubleStageProgression = async (
    tournamentId: string,
    stageId: string
  ): Promise<boolean> => {
    const context = await getDoubleStageContext(tournamentId, stageId);
    if (!context) {
      return false;
    }

    if (context.stage.stageNumber === 1) {
      await handleStageOneDoubleProgression(context);
      return true;
    }

    if (context.stage.stageNumber === 2 || context.stage.stageNumber === 3) {
      await handleStageTwoOrThreeProgression(context);
      return true;
    }

    return false;
  };

  const getFinalPoolStage = async (tournamentId: string, stageId: string) => {
    const stage = await tournamentModel.getPoolStageById(stageId);
    if (stage?.tournamentId !== tournamentId) {
      return;
    }

    const stages = await tournamentModel.getPoolStages(tournamentId);
    let maxStageNumber = stage.stageNumber;
    for (const item of stages) {
      if (item.stageNumber > maxStageNumber) {
        maxStageNumber = item.stageNumber;
      }
    }
    if (stage.stageNumber !== maxStageNumber) {
      return;
    }

    return stage;
  };

  const collectPoolStandings = (
    pools: Awaited<ReturnType<TournamentModel['getPoolsWithMatchesForStage']>>,
    advanceCount: number
  ) => {
    const winners: PoolStandingsEntry[] = [];
    const losers: PoolStandingsEntry[] = [];

    for (const pool of pools) {
      const standings = buildPoolStandings(pool);
      for (const [index, row] of standings.entries()) {
        const entry = {
          playerId: row.playerId,
          seedKey: `${pool.poolNumber}-${row.position}`,
          poolNumber: pool.poolNumber,
          position: row.position,
          legsWon: row.legsWon,
          legsLost: row.legsLost,
          name: row.name,
        };
        if (index < advanceCount) {
          winners.push(entry);
        } else {
          losers.push(entry);
        }
      }
    }

    return { winners, losers };
  };

  const uniqueEntriesByPlayerId = <T extends { playerId: string }>(entries: T[]): T[] => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (seen.has(entry.playerId)) return false;
      seen.add(entry.playerId);
      return true;
    });
  };

  const buildBracketEntriesFromPools = (winners: PoolStandingsEntry[], losers: PoolStandingsEntry[]) => {
    const winnerList = uniqueEntriesByPlayerId([...winners].sort(compareByPoolAndPosition));
    const loserList = uniqueEntriesByPlayerId([...losers].sort(compareByPoolAndPosition));

    const totalEntries = winnerList.length + loserList.length;
    const targetWinnerCount = computeTargetWinnerCount(winnerList.length, totalEntries);
    const rankedLosers = rankLosers(loserList);
    const promoteCount = Math.max(0, targetWinnerCount - winnerList.length);
    const promoted = rankedLosers.slice(0, promoteCount);
    const promotedIds = new Set(promoted.map((entry) => entry.playerId));
    const remainingLosers = loserList.filter((entry) => !promotedIds.has(entry.playerId));

    const winnerEntries = [...winnerList, ...promoted].map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    const loserEntries = remainingLosers.map((entry, index) => ({
      playerId: entry.playerId,
      seedNumber: index + 1,
    }));

    return { winnerEntries, loserEntries };
  };

  const computeTargetWinnerCount = (winnerCount: number, totalEntries: number): number => {
    let targetWinnerCount = winnerCount;
    for (let target = nextPowerOfTwo(winnerCount); target <= totalEntries; target *= 2) {
      if (isPowerOfTwo(totalEntries - target)) {
        targetWinnerCount = target;
        break;
      }
    }
    return targetWinnerCount;
  };

  const rankLosers = (entries: PoolStandingsEntry[]): PoolStandingsEntry[] => {
    return [...entries].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
      if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
      return a.name.localeCompare(b.name);
    });
  };

  const selectWinnerLoserBrackets = (brackets: Awaited<ReturnType<TournamentModel['getBrackets']>>) => {
    const winnerBracket = brackets.find((bracket) => /winner/i.test(bracket.name)) ?? brackets[0];
    const loserBracket = brackets.find((bracket) => /loser/i.test(bracket.name));
    return { winnerBracket, loserBracket };
  };

  const buildRoundRobinSchedule = (playerIds: string[]) => {
    const players = [...playerIds];
    if (players.length < 2) {
      return [] as Array<{ roundNumber: number; pairs: Array<[string, string]> }>;
    }

    if (players.length % 2 !== 0) {
      players.push('');
    }

    const rounds = players.length - 1;
    const half = players.length / 2;
    const schedule: Array<{ roundNumber: number; pairs: Array<[string, string]> }> = [];
    const rotation = [...players];

    for (let round = 0; round < rounds; round += 1) {
      const pairs: Array<[string, string]> = [];
      for (let index = 0; index < half; index += 1) {
        const home = rotation[index];
        const away = rotation[rotation.length - 1 - index];
        if (home && away) {
          pairs.push([home, away]);
        }
      }

      schedule.push({ roundNumber: round + 1, pairs });

      const fixed = rotation[0] ?? '';
      const rest = rotation.slice(1);
      rest.unshift(rest.pop() as string);
      rotation.splice(0, rotation.length, fixed, ...rest);
    }

    return schedule;
  };

  const buildPoolMatchesFromSchedule = (
    schedule: Array<{ roundNumber: number; pairs: Array<[string, string]> }>
  ): Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> => {
    const matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];
    for (const round of schedule) {
      for (const pair of round.pairs) {
        matches.push({
          roundNumber: round.roundNumber,
          matchNumber: matches.length + 1,
          playerIds: pair,
        });
      }
    }
    return matches;
  };

  const createEmptyPoolMatchesForStage = async (tournamentId: string, stageId: string): Promise<void> => {
    const stage = await tournamentModel.getPoolStageById(stageId);
    if (!stage || stage.playersPerPool < 2) {
      return;
    }

    const stageMatchFormatKey = stage.matchFormatKey ?? undefined;
    const pools = await tournamentModel.getPoolsForStage(stageId);
    const placeholders = Array.from({ length: stage.playersPerPool }, (_, index) => `slot-${index + 1}`);
    const skeletonSchedule = buildRoundRobinSchedule(placeholders);
    let nextMatchNumber = 1;
    const skeletonMatches = skeletonSchedule.flatMap((round) =>
      round.pairs.map(() => ({
        roundNumber: round.roundNumber,
        matchNumber: nextMatchNumber++,
      }))
    );

    for (const pool of pools) {
      const matchCount = await tournamentModel.getMatchCountForPool(pool.id);
      if (matchCount > 0) {
        continue;
      }

      await tournamentModel.createEmptyPoolMatches(
        tournamentId,
        pool.id,
        skeletonMatches,
        stageMatchFormatKey
      );
    }
  };

  const createPoolMatchesForStage = async (tournamentId: string, stageId: string): Promise<void> => {
    const stage = await tournamentModel.getPoolStageById(stageId);
    const stageMatchFormatKey = stage?.matchFormatKey ?? undefined;
    const pools = await tournamentModel.getPoolsWithAssignmentsForStage(stageId);
    const poolsToUpdate: string[] = [];

    const getPoolPlayerIds = (pool: (typeof pools)[number]) => (
      (pool.assignments || [])
        .map((assignment) => assignment.player?.id)
        .filter(Boolean)
    );

    const seedExistingOrCollectMissingMatches = async (
      poolId: string,
      matches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }>,
      existingByMatchNumber: Map<number, Awaited<ReturnType<typeof tournamentModel.getPoolMatchesWithPlayers>>[number]>
    ) => {
      const missingMatches: Array<{ roundNumber: number; matchNumber: number; playerIds: [string, string] }> = [];

      for (const nextMatch of matches) {
        const existing = existingByMatchNumber.get(nextMatch.matchNumber);
        if (!existing) {
          missingMatches.push(nextMatch);
          continue;
        }

        if ((existing.playerMatches?.length ?? 0) < 2 && existing.status === MatchStatus.SCHEDULED) {
          await tournamentModel.setPoolMatchPlayers(existing.id, nextMatch.playerIds);
        }
      }

      if (missingMatches.length > 0) {
        await tournamentModel.createPoolMatches(tournamentId, poolId, missingMatches, stageMatchFormatKey);
      }
    };

    for (const pool of pools) {
      const matchCount = await tournamentModel.getMatchCountForPool(pool.id);

      const playerIds = getPoolPlayerIds(pool);

      if (playerIds.length < 2) {
        continue;
      }

      const schedule = buildRoundRobinSchedule(playerIds);
      const matches = buildPoolMatchesFromSchedule(schedule);
      const existingMatches = matchCount > 0
        ? await tournamentModel.getPoolMatchesWithPlayers(pool.id)
        : [];
      const existingByMatchNumber = new Map(
        existingMatches.map((item) => [item.matchNumber, item])
      );

      await seedExistingOrCollectMissingMatches(pool.id, matches, existingByMatchNumber);

      if (matches.length > 0) {
        poolsToUpdate.push(pool.id);
      }
    }

    await tournamentModel.updatePoolStatuses(poolsToUpdate, PoolStatus.IN_PROGRESS);
  };

  const assignPlayersToPools = async (
    tournamentId: string,
    stageId: string,
    poolCount: number,
    playersPerPool: number
  ): Promise<void> => {
    const pools = await tournamentModel.getPoolsForStage(stageId);
    if (pools.length === 0) return;

    const stage = await tournamentModel.getPoolStageById(stageId);
    if (!stage) return;

    const players = await tournamentModel.getActivePlayersForTournament(tournamentId);
    if (players.length === 0) return;

    const opponentMap = await buildOpponentMap(tournamentId, stage.stageNumber);

    const skillScore: Record<string, number> = {
      EXPERT: 4,
      ADVANCED: 3,
      INTERMEDIATE: 2,
      BEGINNER: 1,
    };

    const shuffled = players
      .map((player) => ({
        player,
        score: skillScore[player.skillLevel || ''] || 0,
        tiebreaker: randomInt(0, 1_000_000),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.tiebreaker - b.tiebreaker;
      })
      .map((item) => item.player);

    const capacity = poolCount * playersPerPool;
    const selected = shuffled.slice(0, capacity);
    const assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }> = [];
    const poolState = pools.map((pool) => ({ pool, players: [] as string[] }));

    for (const [index, player] of selected.entries()) {
      if (!player) continue;
      const chosenPoolState = pickPoolForPlayer(
        player.id,
        poolState,
        playersPerPool,
        opponentMap
      );
      if (!chosenPoolState) continue;

      chosenPoolState.players.push(player.id);
      assignments.push({
        poolId: chosenPoolState.pool.id,
        playerId: player.id,
        assignmentType: AssignmentType.SEEDED,
        seedNumber: index + 1,
      });
    }

    await tournamentModel.createPoolAssignments(assignments);
  };

  const buildOpponentMap = async (
    tournamentId: string,
    stageNumber: number
  ): Promise<Map<string, Set<string>>> => {
    const opponentMap = new Map<string, Set<string>>();
    if (stageNumber <= 1) {
      return opponentMap;
    }

    const opponentPairs = await tournamentModel.getOpponentPairsBeforeStage(
      tournamentId,
      stageNumber
    );
    for (const [first, second] of opponentPairs) {
      if (!opponentMap.has(first)) {
        opponentMap.set(first, new Set());
      }
      if (!opponentMap.has(second)) {
        opponentMap.set(second, new Set());
      }
      opponentMap.get(first)?.add(second);
      opponentMap.get(second)?.add(first);
    }

    return opponentMap;
  };

  const countOpponentConflicts = (
    playerId: string,
    poolPlayers: string[],
    opponentMap: Map<string, Set<string>>
  ): number => {
    const opponents = opponentMap.get(playerId);
    if (!opponents || opponents.size === 0) {
      return 0;
    }
    let conflicts = 0;
    for (const existing of poolPlayers) {
      if (opponents.has(existing)) {
        conflicts += 1;
      }
    }
    return conflicts;
  };

  const pickPoolForPlayer = (
    playerId: string,
    poolState: Array<{ pool: { id: string }; players: string[] }>,
    playersPerPool: number,
    opponentMap: Map<string, Set<string>>
  ) => {
    let best: { state: typeof poolState[number]; conflicts: number } | undefined;

    for (const state of poolState) {
      if (state.players.length >= playersPerPool) continue;
      const conflicts = countOpponentConflicts(playerId, state.players, opponentMap);

      if (!best || isBetterPoolCandidate(conflicts, state.players.length, best)) {
        best = { state, conflicts };
      }
    }

    return best?.state ?? poolState.find((state) => state.players.length < playersPerPool);
  };

  const isBetterPoolCandidate = (
    conflicts: number,
    size: number,
    best: { state: { players: string[] }; conflicts: number }
  ): boolean => {
    if (conflicts !== best.conflicts) {
      return conflicts < best.conflicts;
    }

    const bestSize = best.state.players.length;
    if (size !== bestSize) {
      return size < bestSize;
    }

    // Safe to use non-cryptographic randomness here: this is a non-security tie-breaker for pool
    // balancing only and does not affect authorization, payouts, or security-sensitive decisions.
    return Math.random() < 0.5;
  };

  return {
    getPoolStages: async (tournamentId: string) => {
      validateUUID(tournamentId);
      return await tournamentModel.getPoolStages(tournamentId);
    },
    createPoolStage: async (tournamentId: string, data: PoolStageCreateData) => {
      validateUUID(tournamentId);
      const matchFormatKey = ensureValidMatchFormatKey(data.matchFormatKey, 'POOL_STAGE_MATCH_FORMAT_INVALID');
      const inParallelWith = normalizeParallelReferences(data.inParallelWith, 'POOL_STAGE_IN_PARALLEL_WITH_INVALID');
      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      if (!isPoolStageEditable(tournament.status)) {
        throw new AppError(
          'Pool stages can only be modified for draft, open, signature, or live tournaments',
          400,
          'POOL_STAGE_NOT_EDITABLE'
        );
      }

      await validatePoolStageRankingDestinations(
        tournamentId,
        data.playersPerPool,
        data.rankingDestinations
      );

      const poolStage = await tournamentModel.createPoolStage(tournamentId, {
        ...data,
        ...(matchFormatKey ? { matchFormatKey } : {}),
        ...(inParallelWith === undefined ? {} : { inParallelWith }),
      });
      if (poolStage.poolCount > 0) {
        await tournamentModel.createPoolsForStage(poolStage.id, poolStage.poolCount);
        await createEmptyPoolMatchesForStage(tournamentId, poolStage.id);
      }
      return poolStage;
    },
    updatePoolStage: async (tournamentId: string, stageId: string, data: PoolStageUpdateData) => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      const matchFormatKey = ensureValidMatchFormatKey(data.matchFormatKey, 'POOL_STAGE_MATCH_FORMAT_INVALID');
      const inParallelWith = data.inParallelWith === undefined
        ? undefined
        : normalizeParallelReferences(data.inParallelWith, 'POOL_STAGE_IN_PARALLEL_WITH_INVALID');
      const tournament = await getEditableTournamentForPoolStage(tournamentId);

      const currentStage = await tournamentModel.getPoolStageById(stageId);
      if (currentStage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }
      const previousStageMatchFormatKey = currentStage.matchFormatKey ?? undefined;

      if (data.rankingDestinations) {
        const playersPerPool = data.playersPerPool ?? currentStage.playersPerPool;
        await validatePoolStageRankingDestinations(
          tournamentId,
          playersPerPool,
          data.rankingDestinations,
          stageId
        );
      }

      const { matchFormatKey: _inputMatchFormatKey, ...restData } = data;
      const { nextData, shouldRedistribute } = buildPoolStageUpdateData({
        ...restData,
        ...(data.matchFormatKey === undefined ? {} : { matchFormatKey: matchFormatKey! }),
        ...(data.inParallelWith === undefined ? {} : { inParallelWith: inParallelWith ?? [] }),
      });
      if (nextData.status === StageStatus.IN_PROGRESS && tournament.status !== TournamentStatus.LIVE) {
        throw new AppError(
          'Pool stages can only be started when the tournament is live',
          400,
          'POOL_STAGE_NOT_LIVE'
        );
      }
      const updatedStage = await tournamentModel.updatePoolStage(stageId, nextData);

      await applyPoolStageStatusUpdates(
        tournamentId,
        stageId,
        updatedStage,
        shouldRedistribute,
        nextData.completedAt
      );

      const updatedStageMatchFormatKey = updatedStage.matchFormatKey ?? undefined;
      if (previousStageMatchFormatKey !== updatedStageMatchFormatKey) {
        const pools = await tournamentModel.getPoolsWithMatchesForStage(stageId);
        const affectedMatches = pools
          .flatMap((pool) => (pool.matches ?? []).map((match) => ({ pool, match })))
          .filter(({ match }) => (
            (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.IN_PROGRESS)
            && (match.matchFormatKey ?? previousStageMatchFormatKey) !== (match.matchFormatKey ?? updatedStageMatchFormatKey)
          ))
          .map(({ match }) => ({
            matchId: match.id,
            matchFormatKey: match.matchFormatKey ?? updatedStageMatchFormatKey,
          }))
          .filter((item): item is { matchId: string; matchFormatKey: string } => Boolean(item.matchFormatKey));

        await emitMatchFormatChangedNotifications(
          {
            findById: (id) => tournamentModel.findById(id),
            getMatchDetailsForNotification: (matchId) => tournamentModel.getMatchDetailsForNotification(matchId),
          },
          tournamentId,
          affectedMatches
        );
      }

      return updatedStage;
    },
    recomputeDoubleStageProgression: async (tournamentId: string, stageId: string): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);

      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      if (tournament.status !== TournamentStatus.LIVE) {
        throw new AppError(
          'Double-stage progression can only be recomputed for live tournaments',
          400,
          'DOUBLE_STAGE_NOT_LIVE'
        );
      }

      const handled = await handleDoubleStageProgression(tournamentId, stageId);
      if (!handled) {
        await populateBracketsForStage(tournamentId, stageId);
      }
    },
    populateBracketFromPools: async (
      tournamentId: string,
      stageId: string,
      bracketId: string,
      role?: 'WINNER' | 'LOSER'
    ): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      validateUUID(bracketId);

      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      if (tournament.status !== TournamentStatus.LIVE) {
        throw new AppError(
          'Brackets can only be populated for live tournaments',
          400,
          'BRACKET_POPULATE_NOT_LIVE'
        );
      }

      const stage = await tournamentModel.getPoolStageById(stageId);
      if (stage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }

      if (stage.status !== StageStatus.COMPLETED) {
        throw new AppError(
          'Pool stage must be completed to populate brackets',
          400,
          'POOL_STAGE_NOT_COMPLETED'
        );
      }

      const bracket = await tournamentModel.getBracketById(bracketId);
      if (bracket?.tournamentId !== tournamentId) {
        throw new AppError('Bracket not found', 404, 'BRACKET_NOT_FOUND');
      }

      const startedMatchCount = await tournamentModel.getStartedBracketMatchCount(
        tournamentId,
        bracketId
      );
      if (startedMatchCount > 0) {
        throw new AppError(
          'Bracket cannot be populated once matches have started',
          400,
          'BRACKET_MATCHES_STARTED'
        );
      }

      const pools = await tournamentModel.getPoolsWithMatchesForStage(stageId);
      const routing = getStageRankingDestinations(stage);
      if (routing && routing.length > 0) {
        const { bracketEntries } = buildEntriesFromRankingDestinations(pools, routing);
        const entries = bracketEntries.get(bracketId) ?? [];
        await populateBracket(tournamentId, bracketId, entries);
        return;
      }

      const finalStage = await getFinalPoolStage(tournamentId, stageId);
      if (!finalStage) {
        throw new AppError(
          'Pool stage must be the final stage to populate brackets',
          400,
          'POOL_STAGE_NOT_FINAL'
        );
      }

      const { winners, losers } = collectPoolStandings(pools, finalStage.advanceCount);
      const { winnerEntries, loserEntries } = buildBracketEntriesFromPools(winners, losers);
      const resolvedRole = role
        ?? (/loser/i.test(bracket.name) ? 'LOSER' : 'WINNER');
      const entries = resolvedRole === 'LOSER' ? loserEntries : winnerEntries;

      await populateBracket(tournamentId, bracketId, entries);
    },
    completePoolStageWithRandomScores: async (tournamentId: string, stageId: string): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      await getEditableTournamentForPoolStage(tournamentId);

      const stage = await tournamentModel.getPoolStageById(stageId);
      if (stage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }

      if (stage.status === StageStatus.COMPLETED) {
        const handled = await handleDoubleStageProgression(tournamentId, stageId);
        if (!handled) {
          await populateBracketsForStage(tournamentId, stageId);
        }
        return;
      }

      if (stage.status !== StageStatus.IN_PROGRESS) {
        throw new AppError(
          'Pool stage must be in progress to complete',
          400,
          'POOL_STAGE_NOT_IN_PROGRESS'
        );
      }

      const matches = await tournamentModel.getMatchesForPoolStage(stageId);
      const playableMatches = matches.filter((match) => (match.playerMatches?.length ?? 0) >= 2);

      const now = new Date();
      for (const match of playableMatches) {
        await completeMatchWithRandomScores(match, now, { shouldAdvance: false });
      }

      await tournamentModel.completeMatchesForStage(stageId, now);
      await tournamentModel.completePoolsForStage(stageId, now);
      await tournamentModel.updatePoolStage(stageId, {
        status: StageStatus.COMPLETED,
        completedAt: now,
      });
      const handled = await handleDoubleStageProgression(tournamentId, stageId);
      if (!handled) {
        await populateBracketsForStage(tournamentId, stageId);
      }
    },
    deletePoolStage: async (tournamentId: string, stageId: string): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      if (!isPoolStageEditable(tournament.status)) {
        throw new AppError(
          'Pool stages can only be modified for draft, open, signature, or live tournaments',
          400,
          'POOL_STAGE_NOT_EDITABLE'
        );
      }

      await tournamentModel.deletePoolStage(stageId);
    },
    getPoolStagePools: async (tournamentId: string, stageId: string) => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      const stage = await tournamentModel.getPoolStageById(stageId);
      if (stage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }

      return await tournamentModel.getPoolsWithAssignmentsForStage(stageId);
    },
    resetPoolMatches: async (tournamentId: string, stageId: string, poolId: string): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      validateUUID(poolId);
      await getEditableTournamentForPoolStage(tournamentId);

      const stage = await tournamentModel.getPoolStageById(stageId);
      if (stage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }

      const pool = await tournamentModel.getPoolById(poolId);
      if (pool?.poolStageId !== stageId) {
        throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
      }

      await tournamentModel.resetPoolMatches(poolId);
    },
    updatePoolAssignments: async (
      tournamentId: string,
      stageId: string,
      assignments: Array<{ poolId: string; playerId: string; assignmentType: AssignmentType; seedNumber?: number }>
    ): Promise<void> => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      const tournament = await tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      if (!isPoolStageEditable(tournament.status)) {
        throw new AppError(
          'Pool assignments can only be modified for draft, open, signature, or live tournaments',
          400,
          'POOL_ASSIGNMENTS_NOT_EDITABLE'
        );
      }

      const stage = await tournamentModel.getPoolStageById(stageId);
      if (stage?.tournamentId !== tournamentId) {
        throw new AppError('Pool stage not found', 404, 'POOL_STAGE_NOT_FOUND');
      }

      if (stage.status !== StageStatus.EDITION && stage.status !== StageStatus.NOT_STARTED) {
        throw new AppError(
          'Pool assignments can only be edited in edition or not started stage',
          400,
          'POOL_ASSIGNMENTS_NOT_EDITABLE'
        );
      }

      const pools = await tournamentModel.getPoolsForStage(stageId);
      const poolIds = new Set(pools.map((pool) => pool.id));
      const players = await tournamentModel.getActivePlayersForTournament(tournamentId);
      const playerIds = new Set(players.map((player) => player.id));

      const invalidPool = assignments.find((assignment) => !poolIds.has(assignment.poolId));
      if (invalidPool) {
        throw new AppError('Invalid pool assignment target', 400, 'POOL_ASSIGNMENTS_INVALID_POOL');
      }

      const invalidPlayer = assignments.find((assignment) => !playerIds.has(assignment.playerId));
      if (invalidPlayer) {
        throw new AppError('Invalid player assignment', 400, 'POOL_ASSIGNMENTS_INVALID_PLAYER');
      }

      await tournamentModel.deletePoolAssignmentsForStage(stageId);
      await tournamentModel.createPoolAssignments(assignments);
    },
  };
};
