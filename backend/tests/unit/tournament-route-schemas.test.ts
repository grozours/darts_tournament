import {
  createTournamentPresetSchema,
  updateTournamentPresetSchema,
  getTournamentsSchema,
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

  it('requires at least one field in preset update payload', () => {
    const result = updateTournamentPresetSchema.body.safeParse({});
    expect(result.success).toBe(false);
  });

  it('normalizes query enum case through preprocess', () => {
    const result = getTournamentsSchema.query.safeParse({ status: 'live', format: 'single' });
    expect(result.success).toBe(true);
  });
});
