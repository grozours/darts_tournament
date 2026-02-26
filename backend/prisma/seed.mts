import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const matchFormatPresets = await prisma.matchFormatPreset.createMany({
    data:             [
      {
        "key": "BO3",
        "durationMinutes": 45,
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
        "key": "BO3_Arbre_Niveau_C",
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
        "isSystem": false
      },
      {
        "key": "BO3_INDIV",
        "durationMinutes": 20,
        "segments": [
          {
            "game": "501_DO",
            "targetCount": 1
          },
          {
            "game": "CRICKET",
            "targetCount": 1
          },
          {
            "game": "501_DO",
            "targetCount": 1
          }
        ],
        "isSystem": false
      },
      {
        "key": "BO5_501",
        "durationMinutes": 45,
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
        "key": "BO5_501_701",
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
      },
      {
        "key": "BO5_501_INDIV",
        "durationMinutes": 30,
        "segments": [
          {
            "game": "501_DO",
            "targetCount": 1
          },
          {
            "game": "CRICKET",
            "targetCount": 1
          },
          {
            "game": "501_DO",
            "targetCount": 1
          },
          {
            "game": "CRICKET",
            "targetCount": 1
          },
          {
            "game": "501_DO",
            "targetCount": 1
          }
        ],
        "isSystem": false
      }
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${matchFormatPresets.count} match format presets`);

  const tournamentPresets = await prisma.tournamentPreset.createMany({
    data:             [
      {
        "name": "Doublette 40 joueurs",
        "presetType": "three-pool-stages",
        "totalParticipants": 40,
        "targetCount": 9,
        "templateConfig": {
          "format": "DOUBLE",
          "stages": [
            {
              "name": "Brassage",
              "poolCount": 8,
              "advanceCount": 5,
              "matchFormatKey": "BO3",
              "playersPerPool": 5
            },
            {
              "name": "Niveau A",
              "poolCount": 4,
              "advanceCount": 2,
              "inParallelWith": [
                "stage:3",
                "bracket:Niveau C"
              ],
              "matchFormatKey": "BO3",
              "playersPerPool": 4
            },
            {
              "name": "Niveau B",
              "poolCount": 4,
              "advanceCount": 2,
              "inParallelWith": [
                "stage:2",
                "bracket:Niveau C"
              ],
              "matchFormatKey": "BO3",
              "playersPerPool": 4
            }
          ],
          "brackets": [
            {
              "name": "Niveau A",
              "totalRounds": 3,
              "inParallelWith": [
                "bracket:Niveau C",
                "bracket:Niveau B"
              ],
              "roundMatchFormats": {
                "1": "BO5_501",
                "2": "BO5_501_701",
                "3": "BO5_501_701"
              }
            },
            {
              "name": "Niveau B",
              "totalRounds": 3,
              "inParallelWith": [
                "bracket:Niveau C",
                "bracket:Niveau A"
              ],
              "roundMatchFormats": {
                "1": "BO5_501",
                "2": "BO5_501_701",
                "3": "BO5_501_701"
              }
            },
            {
              "name": "Niveau C",
              "totalRounds": 3,
              "inParallelWith": [
                "bracket:Niveau B",
                "bracket:Niveau A",
                "stage:2",
                "stage:3"
              ],
              "roundMatchFormats": {
                "1": "BO3_Arbre_Niveau_C",
                "2": "BO3_Arbre_Niveau_C",
                "3": "BO3_Arbre_Niveau_C"
              }
            }
          ],
          "routingRules": [
            {
              "position": 1,
              "stageNumber": 1,
              "destinationType": "POOL_STAGE",
              "destinationStageNumber": 2
            },
            {
              "position": 2,
              "stageNumber": 1,
              "destinationType": "POOL_STAGE",
              "destinationStageNumber": 2
            },
            {
              "position": 3,
              "stageNumber": 1,
              "destinationType": "POOL_STAGE",
              "destinationStageNumber": 3
            },
            {
              "position": 4,
              "stageNumber": 1,
              "destinationType": "POOL_STAGE",
              "destinationStageNumber": 3
            },
            {
              "position": 5,
              "stageNumber": 1,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau C"
            },
            {
              "position": 1,
              "stageNumber": 2,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau A"
            },
            {
              "position": 2,
              "stageNumber": 2,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau A"
            },
            {
              "position": 3,
              "stageNumber": 2,
              "destinationType": "ELIMINATED"
            },
            {
              "position": 4,
              "stageNumber": 2,
              "destinationType": "ELIMINATED"
            },
            {
              "position": 1,
              "stageNumber": 3,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau B"
            },
            {
              "position": 2,
              "stageNumber": 3,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau B"
            },
            {
              "position": 3,
              "stageNumber": 3,
              "destinationType": "ELIMINATED"
            },
            {
              "position": 4,
              "stageNumber": 3,
              "destinationType": "ELIMINATED"
            }
          ]
        },
        "isSystem": true
      },
      {
        "name": "Individuels 40 joueurs",
        "presetType": "single-pool-stage",
        "totalParticipants": 40,
        "targetCount": 9,
        "templateConfig": {
          "format": "SINGLE",
          "stages": [
            {
              "name": "Brassage",
              "poolCount": 8,
              "advanceCount": 4,
              "matchFormatKey": "BO3_INDIV",
              "playersPerPool": 5
            }
          ],
          "brackets": [
            {
              "name": "Niveau A",
              "totalRounds": 4,
              "inParallelWith": [
                "bracket:Niveau B"
              ],
              "roundMatchFormats": {
                "1": "BO3_INDIV",
                "2": "BO5_501_INDIV",
                "3": "BO5_501_INDIV",
                "4": "BO5_501_INDIV"
              }
            },
            {
              "name": "Niveau B",
              "totalRounds": 4,
              "inParallelWith": [
                "bracket:Niveau A"
              ],
              "roundMatchFormats": {
                "1": "BO3_INDIV",
                "2": "BO5_501_INDIV",
                "3": "BO5_501_INDIV",
                "4": "BO5_501_INDIV"
              }
            }
          ],
          "routingRules": [
            {
              "position": 1,
              "stageNumber": 1,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau A"
            },
            {
              "position": 2,
              "stageNumber": 1,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau A"
            },
            {
              "position": 3,
              "stageNumber": 1,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau B"
            },
            {
              "position": 4,
              "stageNumber": 1,
              "destinationType": "BRACKET",
              "destinationBracketName": "Niveau B"
            },
            {
              "position": 5,
              "stageNumber": 1,
              "destinationType": "ELIMINATED"
            }
          ]
        },
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
