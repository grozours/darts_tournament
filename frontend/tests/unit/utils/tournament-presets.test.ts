import { describe, expect, it } from 'vitest';
import {
  buildPresetRoutingUpdates,
  buildTournamentPresetTemplate,
  getDefaultPresetTemplateConfig,
} from '../../../src/utils/tournament-presets';

describe('tournament-presets utils', () => {
  it('builds single-pool default config with computed pool count', () => {
    const config = getDefaultPresetTemplateConfig('single-pool-stage', 25);

    expect(config.format).toBe('SINGLE');
    expect(config.stages).toHaveLength(1);
    expect(config.stages[0]?.poolCount).toBe(5);
    expect(config.routingRules.some((rule) => rule.destinationType === 'BRACKET')).toBe(true);
  });

  it('falls back participant count for invalid input and returns double preset for custom', () => {
    const config = getDefaultPresetTemplateConfig('custom', Number.NaN);

    expect(config.format).toBe('DOUBLE');
    expect(config.stages).toHaveLength(3);
    expect(config.stages[0]?.poolCount).toBeGreaterThanOrEqual(1);
    expect(config.brackets).toHaveLength(3);
  });

  it('builds template and infers losersAdvanceToBracket plus optional fields', () => {
    const template = buildTournamentPresetTemplate({
      presetType: 'custom',
      templateConfig: {
        format: 'DOUBLE',
        stages: [
          {
            name: 'Stage A',
            poolCount: 2,
            playersPerPool: 4,
            advanceCount: 2,
            inParallelWith: ['stage:2'],
          },
          {
            name: 'Stage B',
            poolCount: 1,
            playersPerPool: 4,
            advanceCount: 1,
          },
        ],
        brackets: [
          {
            name: 'Winner',
            totalRounds: 2,
            inParallelWith: ['bracket:Loser'],
          },
          {
            name: 'Loser',
            totalRounds: 2,
          },
        ],
        routingRules: [
          { stageNumber: 1, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Winner' },
          { stageNumber: 2, position: 1, destinationType: 'ELIMINATED' },
        ],
      },
    }, 16);

    expect(template.stages[0]?.losersAdvanceToBracket).toBe(true);
    expect(template.stages[1]?.losersAdvanceToBracket).toBe(false);
    expect(template.stages[0]?.inParallelWith).toEqual(['stage:2']);
    expect(template.brackets[0]?.inParallelWith).toEqual(['bracket:Loser']);
  });

  it('builds routing updates and skips invalid destinations or missing stage ids', () => {
    const updates = buildPresetRoutingUpdates(
      {
        format: 'DOUBLE',
        stages: [],
        brackets: [],
        routingRules: [
          { stageNumber: 1, position: 1, destinationType: 'POOL_STAGE', destinationStageNumber: 2 },
          { stageNumber: 1, position: 2, destinationType: 'BRACKET', destinationBracketName: 'Main' },
          { stageNumber: 1, position: 3, destinationType: 'ELIMINATED' },
          { stageNumber: 2, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Missing' },
          { stageNumber: 99, position: 1, destinationType: 'ELIMINATED' },
        ],
      },
      [
        { id: 'stage-1', stageNumber: 1 },
        { id: 'stage-2', stageNumber: 2 },
      ],
      [{ id: 'br-1', name: 'Main' }]
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      stageId: 'stage-1',
      rankingDestinations: [
        { position: 1, destinationType: 'POOL_STAGE', poolStageId: 'stage-2' },
        { position: 2, destinationType: 'BRACKET', bracketId: 'br-1' },
        { position: 3, destinationType: 'ELIMINATED' },
      ],
    });
  });

  it('returns empty routing updates when config is missing or has no rules', () => {
    expect(buildPresetRoutingUpdates(undefined, [], [])).toEqual([]);
    expect(buildPresetRoutingUpdates({ format: 'SINGLE', stages: [], brackets: [], routingRules: [] }, [], [])).toEqual([]);
  });
});
