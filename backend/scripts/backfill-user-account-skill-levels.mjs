#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';

const loadPreferredSkillByPersonId = async () => {
  const players = await prisma.player.findMany({
    where: {
      personId: { not: null },
      skillLevel: { not: null },
    },
    select: {
      personId: true,
      skillLevel: true,
      isActive: true,
      registeredAt: true,
    },
    orderBy: [
      { isActive: 'desc' },
      { registeredAt: 'desc' },
    ],
  });

  const preferredSkillByPersonId = new Map();
  for (const player of players) {
    if (!player.personId || !player.skillLevel) {
      continue;
    }
    if (!preferredSkillByPersonId.has(player.personId)) {
      preferredSkillByPersonId.set(player.personId, player.skillLevel);
    }
  }

  return preferredSkillByPersonId;
};

const collectPendingUpdates = (activePlayers, preferredSkillByPersonId) => {
  const updatesByPersonId = new Map();
  const playerIdsToUpdateByPersonId = new Map();

  for (const player of activePlayers) {
    if (!player.personId) {
      continue;
    }

    const preferredSkill = preferredSkillByPersonId.get(player.personId);
    if (!preferredSkill || player.skillLevel === preferredSkill) {
      continue;
    }

    updatesByPersonId.set(player.personId, preferredSkill);
    const currentIds = playerIdsToUpdateByPersonId.get(player.personId) ?? [];
    currentIds.push(player.id);
    playerIdsToUpdateByPersonId.set(player.personId, currentIds);
  }

  return {
    updatesByPersonId,
    playerIdsToUpdateByPersonId,
  };
};

const countPlannedRows = (playerIdsToUpdateByPersonId) => [...playerIdsToUpdateByPersonId.values()].reduce(
  (count, ids) => count + ids.length,
  0
);

const applyUpdates = async (updatesByPersonId, playerIdsToUpdateByPersonId) => {
  let updatedRows = 0;

  for (const [personId, skillLevel] of updatesByPersonId.entries()) {
    const playerIds = playerIdsToUpdateByPersonId.get(personId) ?? [];
    if (playerIds.length === 0) {
      continue;
    }

    const result = await prisma.player.updateMany({
      where: {
        id: { in: playerIds },
      },
      data: {
        skillLevel,
      },
    });
    updatedRows += result.count;
  }

  return updatedRows;
};

const backfillUserAccountSkillLevels = async () => {
  console.log(`[user-skill-backfill] Mode: ${mode}`);

  const preferredSkillByPersonId = await loadPreferredSkillByPersonId();
  const personIds = [...preferredSkillByPersonId.keys()];

  if (personIds.length === 0) {
    console.log('[user-skill-backfill] No person with a known player skill level. Nothing to do.');
    return;
  }

  const activePlayers = await prisma.player.findMany({
    where: {
      personId: { in: personIds },
      isActive: true,
    },
    select: {
      id: true,
      personId: true,
      skillLevel: true,
    },
  });

  const { updatesByPersonId, playerIdsToUpdateByPersonId } = collectPendingUpdates(
    activePlayers,
    preferredSkillByPersonId
  );

  if (updatesByPersonId.size === 0) {
    console.log('[user-skill-backfill] Active players are already aligned with preferred skill levels.');
    return;
  }

  const plannedRows = countPlannedRows(playerIdsToUpdateByPersonId);
  const updatedRows = mode === 'apply'
    ? await applyUpdates(updatesByPersonId, playerIdsToUpdateByPersonId)
    : 0;

  console.log(`[user-skill-backfill] Person accounts with updates: ${updatesByPersonId.size}`);
  console.log(`[user-skill-backfill] Active player rows to update: ${mode === 'apply' ? updatedRows : plannedRows}`);

  if (mode === 'apply') {
    console.log('[user-skill-backfill] Backfill completed successfully.');
  } else {
    console.log('[user-skill-backfill] Dry-run complete. Re-run with --apply to persist changes.');
  }
};

try {
  await backfillUserAccountSkillLevels();
} catch (error) {
  console.error('[user-skill-backfill] Failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
