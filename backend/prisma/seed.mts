import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type SeedSnapshot = {
  exportedAt: string;
  matchFormatPresets: Array<{
    key: string;
    durationMinutes: number;
    segments: unknown;
    isSystem: boolean;
  }>;
  tournamentPresets: Array<{
    name: string;
    presetType: string;
    totalParticipants: number;
    targetCount: number;
    templateConfig: unknown;
    isSystem: boolean;
  }>;
  tournaments: Array<{
    id: string;
    name: string;
    location?: string | null;
    logoUrl?: string | null;
    format: 'SINGLE' | 'DOUBLE' | 'TEAM_4_PLAYER';
    durationType:
      | 'HALF_DAY_MORNING'
      | 'HALF_DAY_AFTERNOON'
      | 'HALF_DAY_NIGHT'
      | 'FULL_DAY'
      | 'TWO_DAY';
    startTime: string;
    endTime: string;
    totalParticipants: number;
    targetCount: number;
    targetStartNumber: number;
    shareTargets: boolean;
    status: 'DRAFT' | 'OPEN' | 'SIGNATURE' | 'LIVE' | 'FINISHED';
    completedAt?: string | null;
    historicalFlag: boolean;
    doubleStageEnabled: boolean;
  }>;
  targets: Array<{
    id: string;
    tournamentId: string;
    targetNumber: number;
    targetCode: string;
    name?: string | null;
    status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
    lastUsedAt?: string | null;
  }>;
  players: Array<{
    id: string;
    tournamentId?: string | null;
    firstName: string;
    lastName: string;
    surname?: string | null;
    teamName?: string | null;
    email?: string | null;
    phone?: string | null;
    skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | null;
    registeredAt: string;
    isActive: boolean;
    checkedIn: boolean;
  }>;
  doublettes: Array<{
    id: string;
    tournamentId: string;
    captainPlayerId?: string | null;
    name: string;
    passwordHash: string;
    isRegistered: boolean;
    registeredAt?: string | null;
  }>;
  doubletteMembers: Array<{
    id: string;
    doubletteId: string;
    playerId: string;
    joinedAt: string;
  }>;
};

const prisma = new PrismaClient();
const snapshotPath = path.join(process.cwd(), 'prisma', 'current-seed-export.json');
const presetsPath = path.join(process.cwd(), 'prisma', 'current-presets-export.json');

const asDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  return new Date(value);
};

const readSnapshot = (): SeedSnapshot => {
  if (!fs.existsSync(snapshotPath)) {
    if (fs.existsSync(presetsPath)) {
      const presetsOnly = JSON.parse(fs.readFileSync(presetsPath, 'utf8')) as {
        exportedAt?: string;
        matchFormatPresets?: SeedSnapshot['matchFormatPresets'];
        tournamentPresets?: SeedSnapshot['tournamentPresets'];
      };

      return {
        exportedAt: presetsOnly.exportedAt ?? new Date().toISOString(),
        matchFormatPresets: presetsOnly.matchFormatPresets ?? [],
        tournamentPresets: presetsOnly.tournamentPresets ?? [],
        tournaments: [],
        targets: [],
        players: [],
        doublettes: [],
        doubletteMembers: [],
      };
    }

    throw new Error(
      `Snapshot files not found: ${snapshotPath} and ${presetsPath}. Run npm run db:export-seed or npm run db:sync-presets-seed in backend first.`
    );
  }

  const baseSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as SeedSnapshot;
  if (!fs.existsSync(presetsPath)) {
    return baseSnapshot;
  }

  const presetsOnly = JSON.parse(fs.readFileSync(presetsPath, 'utf8')) as {
    exportedAt?: string;
    matchFormatPresets?: SeedSnapshot['matchFormatPresets'];
    tournamentPresets?: SeedSnapshot['tournamentPresets'];
  };

  return {
    ...baseSnapshot,
    exportedAt: presetsOnly.exportedAt ?? baseSnapshot.exportedAt,
    matchFormatPresets: presetsOnly.matchFormatPresets ?? baseSnapshot.matchFormatPresets,
    tournamentPresets: presetsOnly.tournamentPresets ?? baseSnapshot.tournamentPresets,
  };
};

async function main() {
  const snapshot = readSnapshot();

  console.log(`Seeding from snapshot exported at ${snapshot.exportedAt}`);

  const matchFormatPresets = await prisma.matchFormatPreset.createMany({
    data: snapshot.matchFormatPresets.map((preset) => ({
      ...preset,
      segments: preset.segments as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${matchFormatPresets.count} match format presets`);

  const tournamentPresets = await prisma.tournamentPreset.createMany({
    data: snapshot.tournamentPresets.map((preset) => ({
      ...preset,
      templateConfig: preset.templateConfig as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${tournamentPresets.count} tournament presets`);

  const tournaments = await prisma.tournament.createMany({
    data: snapshot.tournaments.map((tournament) => ({
      ...tournament,
      startTime: new Date(tournament.startTime),
      endTime: new Date(tournament.endTime),
      completedAt: asDate(tournament.completedAt),
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${tournaments.count} tournaments`);

  const targets = await prisma.target.createMany({
    data: snapshot.targets.map((target) => ({
      ...target,
      lastUsedAt: asDate(target.lastUsedAt),
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${targets.count} targets`);

  const players = await prisma.player.createMany({
    data: snapshot.players.map((player) => ({
      ...player,
      registeredAt: new Date(player.registeredAt),
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${players.count} players`);

  const doublettes = await prisma.doublette.createMany({
    data: snapshot.doublettes.map((doublette) => ({
      ...doublette,
      registeredAt: asDate(doublette.registeredAt),
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${doublettes.count} doublettes`);

  const doubletteMembers = await prisma.doubletteMember.createMany({
    data: snapshot.doubletteMembers.map((member) => ({
      ...member,
      joinedAt: new Date(member.joinedAt),
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${doubletteMembers.count} doublette members`);

  console.log('Database seeding completed');
}

try {
  await main();
} catch (error_) {
  console.error('Seeding failed:', error_);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
