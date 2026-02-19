import { randomInt } from 'node:crypto';

import type { TournamentModel } from '../../models/tournament-model';
import { AppError } from '../../middleware/error-handler';
import {
  AssignmentType,
  BracketStatus,
  MatchStatus,
  PoolStatus,
  StageStatus,
  TournamentStatus,
} from '../../../../shared/src/types';
import { isPowerOfTwo, nextPowerOfTwo } from './number-helpers';

type PoolStageUpdateData = Partial<{
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
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

export const createPoolStageHandlers = (context: PoolStageHandlerContext) => {
  const { tournamentModel, validateUUID, completeMatchWithRandomScores } = context;

  const getEditableTournamentForPoolStage = async (tournamentId: string): Promise<void> => {
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

  const applyPoolStageStatusUpdates = async (
    tournamentId: string,
    stageId: string,
    updatedStage: Awaited<ReturnType<TournamentModel['updatePoolStage']>>,
    shouldRedistribute: boolean,
    // eslint-disable-next-line unicorn/no-null
    completedAt?: Date | null
  ): Promise<void> => {
    switch (updatedStage.status) {
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

  const handlePoolStageCompleted = async (
    tournamentId: string,
    stageId: string,
    completedAt: Date
  ): Promise<void> => {
    await tournamentModel.completeMatchesForStage(stageId, completedAt);
    await tournamentModel.completePoolsForStage(stageId, completedAt);
    await populateBracketsForStage(tournamentId, stageId);
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
    entries: Array<{ playerId: string; seedNumber: number }>
  ): Promise<void> => {
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
      await tournamentModel.updateBracket(bracketId, { status: BracketStatus.NOT_STARTED, totalRounds });
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

    await tournamentModel.createBracketMatches(tournamentId, bracketId, matches);
    await tournamentModel.updateBracket(bracketId, { status: BracketStatus.IN_PROGRESS, totalRounds });
  };

  const populateBracketsForStage = async (tournamentId: string, stageId: string): Promise<void> => {
    const stage = await getFinalPoolStage(tournamentId, stageId);
    if (!stage) {
      return;
    }

    const brackets = await tournamentModel.getBrackets(tournamentId);
    if (brackets.length === 0) {
      return;
    }

    const pools = await tournamentModel.getPoolsWithMatchesForStage(stageId);
    const { winners, losers } = collectPoolStandings(pools, stage.advanceCount);
    const { winnerEntries, loserEntries } = buildBracketEntriesFromPools(winners, losers);
    const { winnerBracket, loserBracket } = selectWinnerLoserBrackets(brackets);

    if (winnerBracket) {
      await populateBracket(tournamentId, winnerBracket.id, winnerEntries);
    }

    if (loserBracket) {
      await populateBracket(tournamentId, loserBracket.id, loserEntries);
    }
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

  const createPoolMatchesForStage = async (tournamentId: string, stageId: string): Promise<void> => {
    const pools = await tournamentModel.getPoolsWithAssignmentsForStage(stageId);
    const poolsToUpdate: string[] = [];

    for (const pool of pools) {
      const matchCount = await tournamentModel.getMatchCountForPool(pool.id);
      if (matchCount > 0) {
        continue;
      }

      const playerIds = (pool.assignments || [])
        .map((assignment) => assignment.player?.id)
        .filter(Boolean);

      if (playerIds.length < 2) {
        continue;
      }

      const schedule = buildRoundRobinSchedule(playerIds);
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

      await tournamentModel.createPoolMatches(tournamentId, pool.id, matches);
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

      const poolStage = await tournamentModel.createPoolStage(tournamentId, data);
      if (poolStage.poolCount > 0) {
        await tournamentModel.createPoolsForStage(poolStage.id, poolStage.poolCount);
      }
      return poolStage;
    },
    updatePoolStage: async (tournamentId: string, stageId: string, data: PoolStageUpdateData) => {
      validateUUID(tournamentId);
      validateUUID(stageId);
      await getEditableTournamentForPoolStage(tournamentId);

      const { nextData, shouldRedistribute } = buildPoolStageUpdateData(data);
      const updatedStage = await tournamentModel.updatePoolStage(stageId, nextData);

      await applyPoolStageStatusUpdates(
        tournamentId,
        stageId,
        updatedStage,
        shouldRedistribute,
        nextData.completedAt
      );

      return updatedStage;
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
        await populateBracketsForStage(tournamentId, stageId);
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
      const invalidMatch = matches.find((match) => (match.playerMatches?.length ?? 0) < 2);
      if (invalidMatch) {
        throw new AppError(
          'Pool stage has matches without two players',
          400,
          'POOL_STAGE_MATCH_INCOMPLETE'
        );
      }

      const now = new Date();
      for (const match of matches) {
        await completeMatchWithRandomScores(match, now, { shouldAdvance: false });
      }

      await tournamentModel.completePoolsForStage(stageId, now);
      await tournamentModel.updatePoolStage(stageId, {
        status: StageStatus.COMPLETED,
        completedAt: now,
      });
      await populateBracketsForStage(tournamentId, stageId);
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

      if (stage.status !== StageStatus.EDITION) {
        throw new AppError(
          'Pool assignments can only be edited in edition stage',
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
