import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const matchFormatPresets = await prisma.matchFormatPreset.createMany({
    data:         [
      {
        "key": "BO3",
        "durationMinutes": 30,
        "segments": [
          {
            "game": "501_DO",
            "targetCount": 4
          },
          {
            "game": "CRICKET",
            "targetCount": 2
          },
          {
            "game": "501_DO",
            "targetCount": 2
          }
        ],
        "isSystem": true
      },
      {
        "key": "BO5",
        "durationMinutes": 60,
        "segments": [
          {
            "game": "501_DO",
            "targetCount": 4
          },
          {
            "game": "CRICKET",
            "targetCount": 2
          },
          {
            "game": "501_DO",
            "targetCount": 4
          },
          {
            "game": "CRICKET",
            "targetCount": 2
          },
          {
            "game": "501_DO",
            "targetCount": 2
          }
        ],
        "isSystem": true
      },
      {
        "key": "BO5_F",
        "durationMinutes": 60,
        "segments": [
          {
            "game": "501_DO",
            "targetCount": 4
          },
          {
            "game": "CRICKET",
            "targetCount": 2
          },
          {
            "game": "501_DO",
            "targetCount": 4
          },
          {
            "game": "CRICKET",
            "targetCount": 2
          },
          {
            "game": "701_DO",
            "targetCount": 2
          }
        ],
        "isSystem": true
      }
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${matchFormatPresets.count} match format presets`);

  const tournamentPresets = await prisma.tournamentPreset.createMany({
    data:         [
      {
        "name": "Single pool stage",
        "presetType": "single-pool-stage",
        "totalParticipants": 16,
        "targetCount": 4,
        "templateConfig": null,
        "isSystem": true
      },
      {
        "name": "Three pool stages",
        "presetType": "three-pool-stages",
        "totalParticipants": 16,
        "targetCount": 4,
        "templateConfig": null,
        "isSystem": true
      }
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${tournamentPresets.count} tournament presets`);

  // Clear existing data (optional - comment out to preserve data)
  // await prisma.tournament.deleteMany();

  // Create sample tournaments
  const tournaments = await prisma.tournament.createMany({
    data: [
      {
        name: 'Spring Championship 2026',
        format: 'SINGLE',
        durationType: 'FULL_DAY',
        startTime: new Date('2026-04-15T09:00:00Z'),
        endTime: new Date('2026-04-15T18:00:00Z'),
        totalParticipants: 16,
        targetCount: 4,
        status: 'DRAFT',
      },
      {
        name: 'Double Elimination Open',
        format: 'DOUBLE',
        durationType: 'HALF_DAY_AFTERNOON',
        startTime: new Date('2026-05-01T14:00:00Z'),
        endTime: new Date('2026-05-01T18:00:00Z'),
        totalParticipants: 8,
        targetCount: 2,
        status: 'DRAFT',
      },
      {
        name: 'Team Tournament 2026',
        format: 'TEAM_4_PLAYER',
        durationType: 'FULL_DAY',
        startTime: new Date('2026-06-01T08:00:00Z'),
        endTime: new Date('2026-06-01T20:00:00Z'),
        totalParticipants: 16,
        targetCount: 4,
        status: 'DRAFT',
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${tournaments.count} tournaments`);

  // Get created tournaments for adding players
  const allTournaments = await prisma.tournament.findMany();
  const firstTournament = allTournaments[0];
  
  if (firstTournament) {
    // Create sample players for the first tournament
    const players = await prisma.player.createMany({
      data: [
        { tournamentId: firstTournament.id, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', skillLevel: 'INTERMEDIATE' },
        { tournamentId: firstTournament.id, firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', skillLevel: 'ADVANCED' },
        { tournamentId: firstTournament.id, firstName: 'Bob', lastName: 'Wilson', email: 'bob.wilson@example.com', skillLevel: 'BEGINNER' },
        { tournamentId: firstTournament.id, firstName: 'Alice', lastName: 'Brown', email: 'alice.brown@example.com', skillLevel: 'INTERMEDIATE' },
        { tournamentId: firstTournament.id, firstName: 'Charlie', lastName: 'Davis', email: 'charlie.davis@example.com', skillLevel: 'ADVANCED' },
        { tournamentId: firstTournament.id, firstName: 'Eva', lastName: 'Martinez', email: 'eva.martinez@example.com', skillLevel: 'BEGINNER' },
        { tournamentId: firstTournament.id, firstName: 'Frank', lastName: 'Garcia', email: 'frank.garcia@example.com', skillLevel: 'INTERMEDIATE' },
        { tournamentId: firstTournament.id, firstName: 'Grace', lastName: 'Lee', email: 'grace.lee@example.com', skillLevel: 'ADVANCED' },
      ],
      skipDuplicates: true,
    });

    console.log(`✅ Created ${players.count} players for tournament: ${firstTournament.name}`);
  }

  console.log('🎯 Database seeding completed!');
}
try {
  await main();
} catch (error_) {
  console.error('❌ Seeding failed:', error_);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
