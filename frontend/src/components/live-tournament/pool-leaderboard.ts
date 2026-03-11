import type { LiveViewMatch, LiveViewMatchPlayer, LiveViewPool, PoolLeaderboardRow } from './types';

const getLeaderboardPlayerLabel = (
  player: LiveViewMatchPlayer['player'],
  getParticipantLabel?: (player: LiveViewMatchPlayer['player']) => string
) => {
  if (!player) return '';
  if (getParticipantLabel) {
    return getParticipantLabel(player);
  }
  return `${player.firstName} ${player.lastName}`.trim();
};

const ensureLeaderboardRow = (
  rows: Map<string, PoolLeaderboardRow>,
  player: LiveViewMatchPlayer['player'],
  getParticipantLabel?: (player: LiveViewMatchPlayer['player']) => string
) => {
  if (!player) return;
  if (!rows.has(player.id)) {
    rows.set(player.id, {
      playerId: player.id,
      name: getLeaderboardPlayerLabel(player, getParticipantLabel),
      matchesPlayed: 0,
      legsWon: 0,
      legsLost: 0,
      position: 0,
    });
  }
  return rows.get(player.id);
};

const sumOpponentLegs = (playerMatches: LiveViewMatchPlayer[], playerId: string) => {
  let total = 0;
  for (const other of playerMatches) {
    if (other.player?.id && other.player.id !== playerId) {
      total += other.scoreTotal ?? other.legsWon ?? 0;
    }
  }
  return total;
};

const applyMatchResults = (
  rows: Map<string, PoolLeaderboardRow>,
  match: LiveViewMatch
) => {
  if (match.status !== 'COMPLETED') {
    return;
  }

  const playerMatches = match.playerMatches ?? [];
  for (const playerMatch of playerMatches) {
    if (!playerMatch.player || !rows.has(playerMatch.player.id)) {
      continue;
    }
    const row = rows.get(playerMatch.player.id);
    if (!row) continue;

    row.matchesPlayed += 1;
    row.legsWon += playerMatch.scoreTotal ?? playerMatch.legsWon ?? 0;
    row.legsLost += sumOpponentLegs(playerMatches, row.playerId);
  }
};

const getPlayerScore = (playerMatch: LiveViewMatchPlayer) => (
  playerMatch.scoreTotal ?? playerMatch.legsWon ?? 0
);

const applyHeadToHeadBonus = (rows: Map<string, PoolLeaderboardRow>, matches: LiveViewMatch[]) => { // NOSONAR
  const groups = new Map<number, PoolLeaderboardRow[]>();
  for (const row of rows.values()) {
    const bucket = groups.get(row.legsWon) ?? [];
    bucket.push(row);
    groups.set(row.legsWon, bucket);
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const groupIds = new Set(group.map((row) => row.playerId));
    const rowsByPlayerId = new Map(group.map((row) => [row.playerId, row]));

    for (const row of group) {
      row.headToHeadBonus = row.headToHeadBonus ?? 0;
    }

    for (const match of matches) {
      if (match.status !== 'COMPLETED') {
        continue;
      }

      const relevantPlayers = (match.playerMatches ?? []).filter((playerMatch) =>
        Boolean(playerMatch.player?.id && groupIds.has(playerMatch.player.id))
      );
      if (relevantPlayers.length !== 2) {
        continue;
      }

      const [firstMatch, secondMatch] = relevantPlayers;
      if (!firstMatch?.player?.id || !secondMatch?.player?.id) {
        continue;
      }

      const firstScore = getPlayerScore(firstMatch);
      const secondScore = getPlayerScore(secondMatch);
      if (firstScore === secondScore) {
        continue;
      }

      const winnerId = firstScore > secondScore ? firstMatch.player.id : secondMatch.player.id;
      const winner = rowsByPlayerId.get(winnerId);
      if (!winner) {
        continue;
      }
      winner.headToHeadBonus = (winner.headToHeadBonus ?? 0) + 1;
    }
  }
};

const sortLeaderboardRows = (rows: Map<string, PoolLeaderboardRow>) => {
  const sorted = [...rows.values()].toSorted((a, b) => {
    if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
    const bonusDiff = (b.headToHeadBonus ?? 0) - (a.headToHeadBonus ?? 0);
    if (bonusDiff !== 0) return bonusDiff;
    if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
    return a.name.localeCompare(b.name);
  });

  for (const [index, row] of sorted.entries()) {
    row.position = index + 1;
  }

  return sorted;
};

export const buildPoolLeaderboard = (
  pool: LiveViewPool,
  getParticipantLabel?: (player: LiveViewMatchPlayer['player']) => string
): PoolLeaderboardRow[] => {
  const rows = new Map<string, PoolLeaderboardRow>();
  for (const assignment of pool.assignments ?? []) {
    ensureLeaderboardRow(rows, assignment.player, getParticipantLabel);
  }

  for (const match of pool.matches ?? []) {
    if (match.status !== 'COMPLETED') {
      continue;
    }
  }

  for (const match of pool.matches ?? []) {
    applyMatchResults(rows, match);
  }

  applyHeadToHeadBonus(rows, pool.matches ?? []);

  return sortLeaderboardRows(rows);
};
