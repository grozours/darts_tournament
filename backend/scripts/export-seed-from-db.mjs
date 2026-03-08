import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const projectRoot = path.resolve(import.meta.dirname, '..');
const outputPath = path.join(projectRoot, 'prisma', 'current-seed-export.json');

const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

const exportSeedSnapshot = async () => {
  const [
    matchFormatPresets,
    tournamentPresets,
    tournaments,
    targets,
    players,
    doublettes,
    doubletteMembers,
  ] = await Promise.all([
    prisma.matchFormatPreset.findMany({
      orderBy: { key: 'asc' },
      select: {
        key: true,
        durationMinutes: true,
        segments: true,
        isSystem: true,
      },
    }),
    prisma.tournamentPreset.findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        presetType: true,
        totalParticipants: true,
        targetCount: true,
        templateConfig: true,
        isSystem: true,
      },
    }),
    prisma.tournament.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        location: true,
        logoUrl: true,
        format: true,
        durationType: true,
        startTime: true,
        endTime: true,
        totalParticipants: true,
        targetCount: true,
        targetStartNumber: true,
        shareTargets: true,
        status: true,
        completedAt: true,
        historicalFlag: true,
        doubleStageEnabled: true,
      },
    }),
    prisma.target.findMany({
      orderBy: [{ tournamentId: 'asc' }, { targetNumber: 'asc' }],
      select: {
        id: true,
        tournamentId: true,
        targetNumber: true,
        targetCode: true,
        name: true,
        status: true,
        lastUsedAt: true,
      },
    }),
    prisma.player.findMany({
      where: { tournamentId: { not: null } },
      orderBy: [{ tournamentId: 'asc' }, { registeredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        tournamentId: true,
        firstName: true,
        lastName: true,
        surname: true,
        teamName: true,
        email: true,
        phone: true,
        skillLevel: true,
        registeredAt: true,
        isActive: true,
        checkedIn: true,
      },
    }),
    prisma.doublette.findMany({
      orderBy: [{ tournamentId: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        tournamentId: true,
        captainPlayerId: true,
        name: true,
        passwordHash: true,
        isRegistered: true,
        registeredAt: true,
      },
    }),
    prisma.doubletteMember.findMany({
      orderBy: [{ doubletteId: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        doubletteId: true,
        playerId: true,
        joinedAt: true,
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    matchFormatPresets,
    tournamentPresets,
    tournaments: tournaments.map((tournament) => ({
      ...tournament,
      startTime: tournament.startTime.toISOString(),
      endTime: tournament.endTime.toISOString(),
      completedAt: toIso(tournament.completedAt),
    })),
    targets: targets.map((target) => ({
      ...target,
      lastUsedAt: toIso(target.lastUsedAt),
    })),
    players: players.map((player) => ({
      ...player,
      tournamentId: player.tournamentId,
      registeredAt: player.registeredAt.toISOString(),
    })),
    doublettes: doublettes.map((doublette) => ({
      ...doublette,
      registeredAt: toIso(doublette.registeredAt),
    })),
    doubletteMembers: doubletteMembers.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
    })),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Seed snapshot exported to ${path.relative(projectRoot, outputPath)}`);
  console.log(`matchFormatPresets=${payload.matchFormatPresets.length}`);
  console.log(`tournamentPresets=${payload.tournamentPresets.length}`);
  console.log(`tournaments=${payload.tournaments.length}`);
  console.log(`targets=${payload.targets.length}`);
  console.log(`players=${payload.players.length}`);
  console.log(`doublettes=${payload.doublettes.length}`);
  console.log(`doubletteMembers=${payload.doubletteMembers.length}`);
};

try {
  await exportSeedSnapshot();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
