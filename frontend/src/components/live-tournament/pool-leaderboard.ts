import type { LiveViewMatch, LiveViewMatchPlayer, LiveViewPool, PoolLeaderboardRow } from './types';

const getLeaderboardPlayerLabel = (player: LiveViewMatchPlayer['player']) => {
  if (!player) return '';
  const fullName = `${player.firstName} ${player.lastName}`.trim();
  if (player.teamName) {
    return `${player.teamName} / ${fullName}`.trim();
  }
  if (player.surname) {
    return `${player.surname} / ${fullName}`.trim();
  }
  return fullName;
};

const ensureLeaderboardRow = (
  rows: Map<string, PoolLeaderboardRow>,
  player: LiveViewMatchPlayer['player']
) => {
  if (!player) return;
  if (!rows.has(player.id)) {
    rows.set(player.id, {
      playerId: player.id,
      name: getLeaderboardPlayerLabel(player),
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

    row.legsWon += playerMatch.scoreTotal ?? playerMatch.legsWon ?? 0;
    row.legsLost += sumOpponentLegs(playerMatches, row.playerId);
  }
};

const sortLeaderboardRows = (rows: Map<string, PoolLeaderboardRow>) => {
  const sorted = [...rows.values()].toSorted((a, b) => {
    if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
    if (a.legsLost !== b.legsLost) return a.legsLost - b.legsLost;
    return a.name.localeCompare(b.name);
  });

  for (const [index, row] of sorted.entries()) {
    row.position = index + 1;
  }

  return sorted;
};

export const buildPoolLeaderboard = (pool: LiveViewPool): PoolLeaderboardRow[] => {
  const rows = new Map<string, PoolLeaderboardRow>();
  for (const assignment of pool.assignments ?? []) {
    ensureLeaderboardRow(rows, assignment.player);
  }

  for (const match of pool.matches ?? []) {
    if (match.status !== 'COMPLETED') {
      continue;
    }
    for (const playerMatch of match.playerMatches ?? []) {
      ensureLeaderboardRow(rows, playerMatch.player);
    }
  }

  for (const match of pool.matches ?? []) {
    applyMatchResults(rows, match);
  }

  return sortLeaderboardRows(rows);
};
