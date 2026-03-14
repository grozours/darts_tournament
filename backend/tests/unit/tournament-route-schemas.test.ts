import {
  createTournamentPresetSchema,
  updateTournamentPresetSchema,
  getTournamentsSchema,
  getLiveSummarySchema,
  updatePlayerSchema,
  updateMatchFormatPresetSchema,
} from '../../src/routes/tournaments/schemas';
import { TournamentFormat } from '../../../shared/src/types';

const validTemplateConfig = {
  format: TournamentFormat.SINGLE,
  stages: [
    {
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      matchFormatKey: 'BO3',
      inParallelWith: ['bracket:Main'],
    },
  ],
  brackets: [
    {
      name: 'Main',
      totalRounds: 3,
      roundMatchFormats: { 1: 'BO3', 2: 'BO5' },
      inParallelWith: ['stage:1'],
    },
  ],
  routingRules: [
    {
      stageNumber: 1,
      position: 1,
      destinationType: 'BRACKET',
      destinationBracketName: 'Main',
    },
  ],
};

describe('tournament route schemas', () => {
  it('accepts a valid tournament preset payload', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: validTemplateConfig,
    });

    expect(result.success).toBe(true);
  });

  it('rejects routing rules with unknown stage numbers', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        routingRules: [
          {
            stageNumber: 9,
            position: 1,
            destinationType: 'BRACKET',
            destinationBracketName: 'Main',
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid bracket round numbers in roundMatchFormats', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        brackets: [
          {
            name: 'Main',
            totalRounds: 2,
            roundMatchFormats: { 3: 'BO3' },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects self stage reference in inParallelWith', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        stages: [
          {
            name: 'Stage 1',
            poolCount: 2,
            playersPerPool: 4,
            advanceCount: 2,
            inParallelWith: ['stage:1'],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid parallel reference format', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        brackets: [
          {
            name: 'Main',
            totalRounds: 2,
            inParallelWith: ['no-prefix'],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects rules missing destination fields for pool stage and bracket routing', () => {
    const missingPoolStageDestination = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        routingRules: [
          {
            stageNumber: 1,
            position: 1,
            destinationType: 'POOL_STAGE',
          },
        ],
      },
    });

    const missingBracketDestination = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        routingRules: [
          {
            stageNumber: 1,
            position: 1,
            destinationType: 'BRACKET',
          },
        ],
      },
    });

    expect(missingPoolStageDestination.success).toBe(false);
    expect(missingBracketDestination.success).toBe(false);
  });

  it('rejects unknown destination stage and bracket names in routing rules', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        routingRules: [
          {
            stageNumber: 1,
            position: 1,
            destinationType: 'POOL_STAGE',
            destinationStageNumber: 99,
          },
          {
            stageNumber: 1,
            position: 2,
            destinationType: 'BRACKET',
            destinationBracketName: 'Unknown Bracket',
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid and unknown stage in inParallelWith stage references', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        stages: [
          {
            name: 'Stage 1',
            poolCount: 2,
            playersPerPool: 4,
            advanceCount: 2,
            inParallelWith: ['stage:', 'stage:abc', 'stage:0', 'stage:5'],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid and self bracket references in inParallelWith', () => {
    const result = createTournamentPresetSchema.body.safeParse({
      name: 'Preset A',
      presetType: 'single-pool-stage',
      totalParticipants: 16,
      targetCount: 4,
      templateConfig: {
        ...validTemplateConfig,
        brackets: [
          {
            name: 'Main',
            totalRounds: 2,
            inParallelWith: ['bracket:', 'bracket:Main', 'stage:9'],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one field for match format preset updates', () => {
    const result = updateMatchFormatPresetSchema.body.safeParse({});
    expect(result.success).toBe(false);
  });

  it('requires at least one field in preset update payload', () => {
    const result = updateTournamentPresetSchema.body.safeParse({});
    expect(result.success).toBe(false);
  });

  it('normalizes query enum case through preprocess', () => {
    const result = getTournamentsSchema.query.safeParse({ status: 'live', format: 'single' });
    expect(result.success).toBe(true);
  });

  it('validates live summary statuses query format', () => {
    const valid = getLiveSummarySchema.query.safeParse({ statuses: 'LIVE,OPEN' });
    const invalid = getLiveSummarySchema.query.safeParse({ statuses: 'LIVE,OPEN,123' });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('accepts optional personId in update player payload', () => {
    const result = updatePlayerSchema.body.safeParse({
      personId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Alice',
      lastName: 'Doe',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid personId in update player payload', () => {
    const result = updatePlayerSchema.body.safeParse({
      personId: 'not-a-uuid',
      firstName: 'Alice',
      lastName: 'Doe',
    });

    expect(result.success).toBe(false);
  });
});
