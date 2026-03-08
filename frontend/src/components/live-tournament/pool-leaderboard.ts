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
      legsWon: 0,
      legsLost: 0,
      headToHeadBonus: 0,
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
    if (group.length !== 2) {
      continue;
    }
    const [first, second] = group;
    if (!first || !second) {
      continue;
    }

    const headToHead = matches.find((match) => {
      if (match.status !== 'COMPLETED') return false;
      const ids = new Set(
        (match.playerMatches ?? [])
          .map((playerMatch) => playerMatch.player?.id)
          .filter((id): id is string => Boolean(id))
      );
      return ids.has(first.playerId) && ids.has(second.playerId);
    });

    if (!headToHead) {
      continue;
    }

    const playerMatches = headToHead.playerMatches ?? [];
    const firstMatch = playerMatches.find((playerMatch) => playerMatch.player?.id === first.playerId);
    const secondMatch = playerMatches.find((playerMatch) => playerMatch.player?.id === second.playerId);
    if (!firstMatch || !secondMatch) {
      continue;
    }

    const firstScore = getPlayerScore(firstMatch);
    const secondScore = getPlayerScore(secondMatch);
    if (firstScore === secondScore) {
      continue;
    }
    const winner = firstScore > secondScore ? first : second;
    winner.legsWon += 1;
    winner.headToHeadBonus = (winner.headToHeadBonus ?? 0) + 1;
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
