ALTER TABLE "tournament_presets"
ADD COLUMN "template_config" JSONB;

UPDATE "tournament_presets"
SET "template_config" = CASE
  WHEN "preset_type" = 'single-pool-stage' THEN
    '{
      "format": "SINGLE",
      "stages": [
        {
          "name": "Stage 1",
          "poolCount": 3,
          "playersPerPool": 5,
          "advanceCount": 2
        }
      ],
      "brackets": [
        {
          "name": "Loser Bracket",
          "totalRounds": 3
        },
        {
          "name": "Winner Bracket",
          "totalRounds": 3
        }
      ],
      "routingRules": [
        {
          "stageNumber": 1,
          "position": 1,
          "destinationType": "BRACKET",
          "destinationBracketName": "Winner Bracket"
        },
        {
          "stageNumber": 1,
          "position": 2,
          "destinationType": "BRACKET",
          "destinationBracketName": "Winner Bracket"
        },
        {
          "stageNumber": 1,
          "position": 3,
          "destinationType": "BRACKET",
          "destinationBracketName": "Loser Bracket"
        },
        {
          "stageNumber": 1,
          "position": 4,
          "destinationType": "BRACKET",
          "destinationBracketName": "Loser Bracket"
        },
        {
          "stageNumber": 1,
          "position": 5,
          "destinationType": "BRACKET",
          "destinationBracketName": "Loser Bracket"
        }
      ]
    }'::jsonb
  WHEN "preset_type" = 'three-pool-stages' THEN
    '{
      "format": "DOUBLE",
      "stages": [
        {
          "name": "Brassage",
          "poolCount": 3,
          "playersPerPool": 5,
          "advanceCount": 5
        },
        {
          "name": "Niveau A",
          "poolCount": 2,
          "playersPerPool": 4,
          "advanceCount": 2
        },
        {
          "name": "Niveau B",
          "poolCount": 2,
          "playersPerPool": 4,
          "advanceCount": 2
        }
      ],
      "brackets": [
        {
          "name": "Niveau A",
          "totalRounds": 3
        },
        {
          "name": "Niveau B",
          "totalRounds": 3
        },
        {
          "name": "Niveau C",
          "totalRounds": 3
        }
      ],
      "routingRules": [
        {
          "stageNumber": 1,
          "position": 1,
          "destinationType": "POOL_STAGE",
          "destinationStageNumber": 2
        },
        {
          "stageNumber": 1,
          "position": 2,
          "destinationType": "POOL_STAGE",
          "destinationStageNumber": 2
        },
        {
          "stageNumber": 1,
          "position": 3,
          "destinationType": "POOL_STAGE",
          "destinationStageNumber": 3
        },
        {
          "stageNumber": 1,
          "position": 4,
          "destinationType": "POOL_STAGE",
          "destinationStageNumber": 3
        },
        {
          "stageNumber": 1,
          "position": 5,
          "destinationType": "BRACKET",
          "destinationBracketName": "Niveau C"
        },
        {
          "stageNumber": 2,
          "position": 1,
          "destinationType": "BRACKET",
          "destinationBracketName": "Niveau A"
        },
        {
          "stageNumber": 2,
          "position": 2,
          "destinationType": "BRACKET",
          "destinationBracketName": "Niveau A"
        },
        {
          "stageNumber": 2,
          "position": 3,
          "destinationType": "ELIMINATED"
        },
        {
          "stageNumber": 2,
          "position": 4,
          "destinationType": "ELIMINATED"
        },
        {
          "stageNumber": 3,
          "position": 1,
          "destinationType": "BRACKET",
          "destinationBracketName": "Niveau B"
        },
        {
          "stageNumber": 3,
          "position": 2,
          "destinationType": "BRACKET",
          "destinationBracketName": "Niveau B"
        },
        {
          "stageNumber": 3,
          "position": 3,
          "destinationType": "ELIMINATED"
        },
        {
          "stageNumber": 3,
          "position": 4,
          "destinationType": "ELIMINATED"
        }
      ]
    }'::jsonb
  ELSE "template_config"
END;
